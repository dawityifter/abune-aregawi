'use strict';

// scripts/unlearn-on-behalf-payment.js — keep an on-behalf payment, forget
// what it wrongly taught the matcher. All data synthetic.
const {
  sequelize, Member, Transaction, LedgerEntry, BankTransaction, ZelleEmailQueue,
  Pledge, PledgeCampaign, PledgeAllocation, BankMemoMatch, ZelleMemoMatch
} = require('../../src/models');
const { unlearnOnBehalfPayment } = require('../../scripts/unlearn-on-behalf-payment');
const { findSuggestionCandidates } = require('../../src/services/bankMemoMatchService');

describe('unlearn-on-behalf-payment', () => {
  let treasurer, sender, pledger, bystander, campaign, pledge, ownRow, bank, tx, orphanEmail;
  const PAYER = 'ABEL T SENDER';

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {}, force: true, truncate: true });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await ZelleEmailQueue.destroy({ where: {} });
    await BankMemoMatch.destroy({ where: {} });
    await ZelleMemoMatch.destroy({ where: {} });
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await BankTransaction.destroy({ where: {} });
    await Member.destroy({ where: {} });

    treasurer = await Member.create({ first_name: 'Test', last_name: 'Treasurer', phone_number: '+15555550191', role: 'treasurer', is_active: true });
    sender = await Member.create({ first_name: 'Abel', last_name: 'Sender', phone_number: '+15555550192', is_active: true });
    pledger = await Member.create({ first_name: 'Hana', last_name: 'Pledger', phone_number: '+15555550193', is_active: true });
    bystander = await Member.create({ first_name: 'Other', last_name: 'Payer', phone_number: '+15555550194', is_active: true });
    campaign = await PledgeCampaign.create({ slug: 'drive', name: 'Drive', status: 'active', start_date: '2026-01-01' });
    pledge = await Pledge.create({ member_id: pledger.id, campaign_id: campaign.id, amount: 1000, first_name: 'Hana', last_name: 'Pledger', fulfillment_intent: 'later' });

    // The sender's own earlier payment.
    ownRow = await BankTransaction.create({
      transaction_hash: 'a'.repeat(32), date: '2026-09-14', amount: 1000, type: 'ZELLE', status: 'MATCHED',
      description: `Zelle payment from ${PAYER} 39990000002`, payer_name: PAYER,
      external_ref_id: '39990000002', member_id: sender.id, reconciled_source: 'MANUAL'
    });

    // The on-behalf payment: from the sender, credited to the pledger's pledge.
    const hash = 'b'.repeat(32);
    bank = await BankTransaction.create({
      transaction_hash: hash, date: '2026-09-21', amount: 300, type: 'ZELLE', status: 'MATCHED',
      description: `Zelle payment from ${PAYER} 39990000001`, payer_name: PAYER,
      external_ref_id: '39990000001', member_id: pledger.id, reconciled_source: 'MANUAL'
    });
    tx = await Transaction.create({
      member_id: pledger.id, collected_by: treasurer.id, amount: 300, payment_date: '2026-09-21',
      payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded', external_id: hash,
      note: `Zelle payment from ${PAYER} 39990000001`
    });
    await LedgerEntry.create({
      type: 'pledge_drive', category: 'INC011', amount: 300, entry_date: '2026-09-21', member_id: pledger.id,
      payment_method: 'zelle', transaction_id: tx.id, external_id: hash, memo: 'INC011 - Bank reconciliation match'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: tx.id, amount: 300, source: 'treasurer_manual',
      allocated_by: treasurer.id, idempotency_key: `txn:${tx.id}`
    });

    // What the old code learned: the sender's keys re-pointed at the pledger;
    // the legacy memo, only ever inserted, still names the sender.
    await BankMemoMatch.create({ match_key: `ZELLE:PAYER:${PAYER}`, source_type: 'ZELLE', member_id: pledger.id, created_from_bank_transaction_id: bank.id });
    await BankMemoMatch.create({ match_key: `ZELLE:DESCRIPTION:${PAYER}`, source_type: 'ZELLE', member_id: pledger.id, created_from_bank_transaction_id: bank.id });
    await ZelleMemoMatch.create({ member_id: sender.id, memo: PAYER });
    await BankMemoMatch.create({ match_key: 'ZELLE:PAYER:SOMEONE ELSE', source_type: 'ZELLE', member_id: bystander.id });

    // The payment's email, still waiting on Zelle Review.
    orphanEmail = await ZelleEmailQueue.create({
      external_id: 'zelle:39990000001', payer_name: PAYER, amount: 300, payment_date: '2026-09-20',
      status: 'NEEDS_REVIEW', matched_member_id: sender.id, match_source: 'LEARNED_ZELLE'
    });
  });

  const run = async (extra = {}) => {
    const t = await sequelize.transaction();
    try {
      const log = await unlearnOnBehalfPayment({ transactionId: tx.id, senderMemberId: String(sender.id), byMemberId: treasurer.id, ...extra }, t);
      await t.commit();
      return log;
    } catch (e) { await t.rollback(); throw e; }
  };

  it('returns the sender\'s keys to the sender and keeps the payment exactly as it was', async () => {
    await run();

    // Payment, ledger, pledge credit, bank row: untouched.
    const after = await Transaction.findByPk(tx.id);
    expect(String(after.member_id)).toBe(String(pledger.id));
    expect(Number(after.amount)).toBe(300);
    expect(String((await LedgerEntry.findOne({ where: { transaction_id: tx.id } })).member_id)).toBe(String(pledger.id));
    expect(Number(await PledgeAllocation.sum('amount', { where: { pledge_id: pledge.id } }))).toBe(300);
    await bank.reload();
    expect(bank.status).toBe('MATCHED');
    expect(String(bank.member_id)).toBe(String(pledger.id));

    // Keys: back to the sender, pointing at the sender's own payment.
    const keys = await BankMemoMatch.findAll({ where: { match_key: [`ZELLE:PAYER:${PAYER}`, `ZELLE:DESCRIPTION:${PAYER}`] } });
    expect(keys).toHaveLength(2);
    keys.forEach((k) => {
      expect(String(k.member_id)).toBe(String(sender.id));
      expect(String(k.created_from_bank_transaction_id)).toBe(String(ownRow.id));
    });
    // Someone else's key is not touched.
    expect(String((await BankMemoMatch.findOne({ where: { match_key: 'ZELLE:PAYER:SOMEONE ELSE' } })).member_id)).toBe(String(bystander.id));

    // The next payment from the sender is suggested for the sender, with no conflict.
    const [top] = await findSuggestionCandidates({ type: 'ZELLE', payer_name: PAYER, description: `Zelle payment from ${PAYER} 31000000001` });
    expect(String(top.member.id)).toBe(String(sender.id));
    expect(top.confidence).toBe('high');

    // The audit trail.
    expect(bank.payer_name).toBe(PAYER);
    expect(bank.reconciled_meta).toMatchObject({
      sender_link: 'THIS_PAYMENT_ONLY',
      sender_member_id: sender.id,
      sender_payer_name: PAYER,
      unlearned_by: treasurer.id
    });
  });

  it('attaches the payment\'s orphaned email so it cannot be posted or re-matched again', async () => {
    await run();
    await orphanEmail.reload();
    expect(orphanEmail.status).toBe('BANK_POSTED');
    expect(String(orphanEmail.transaction_id)).toBe(String(tx.id));
    expect(String(orphanEmail.bank_transaction_id)).toBe(String(bank.id));
    expect(String(orphanEmail.matched_member_id)).toBe(String(pledger.id));
    expect(orphanEmail.match_source).toBe('TREASURER_ATTACH:THIS_PAYMENT_ONLY');
  });

  it('with --sender none deletes the keys instead (a sender who is not a member)', async () => {
    await run({ senderMemberId: 'none' });
    expect(await BankMemoMatch.count({ where: { match_key: [`ZELLE:PAYER:${PAYER}`, `ZELLE:DESCRIPTION:${PAYER}`] } })).toBe(0);
    await bank.reload();
    expect(bank.reconciled_meta.sender_member_id).toBeNull();
  });

  it('refuses when the sender is the credited member', async () => {
    await expect(run({ senderMemberId: String(pledger.id) })).rejects.toThrow(/not "on behalf of"/);
  });

  it('a rolled-back run (dry run) changes nothing', async () => {
    const t = await sequelize.transaction();
    await unlearnOnBehalfPayment({ transactionId: tx.id, senderMemberId: String(sender.id), byMemberId: treasurer.id }, t);
    await t.rollback();
    expect(await BankMemoMatch.count({ where: { member_id: pledger.id } })).toBe(2);
    await orphanEmail.reload();
    expect(orphanEmail.status).toBe('NEEDS_REVIEW');
  });
});
