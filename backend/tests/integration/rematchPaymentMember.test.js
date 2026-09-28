'use strict';

// scripts/rematch-payment-member.js — moving a wrongly matched payment. All data synthetic.
const {
  sequelize, Member, Transaction, LedgerEntry, BankTransaction, ZelleEmailQueue,
  Pledge, PledgeCampaign, PledgeAllocation, BankMemoMatch, ZelleMemoMatch
} = require('../../src/models');
const { rematchPayment } = require('../../scripts/rematch-payment-member');

describe('rematch-payment-member', () => {
  let treasurer, wrong, right, campaign, wrongPledge, rightPledge, bank, tx;

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

    treasurer = await Member.create({ first_name: 'Test', last_name: 'Treasurer', phone_number: '+15555550181', role: 'treasurer', is_active: true });
    wrong = await Member.create({ first_name: 'Wrong', last_name: 'Member', phone_number: '+15555550182', is_active: true });
    right = await Member.create({ first_name: 'Right', last_name: 'Member', phone_number: '+15555550183', is_active: true });
    campaign = await PledgeCampaign.create({ slug: 'drive', name: 'Drive', status: 'active', start_date: '2026-01-01' });
    wrongPledge = await Pledge.create({ member_id: wrong.id, campaign_id: campaign.id, amount: 500, first_name: 'Wrong', last_name: 'Member', fulfillment_intent: 'later' });
    rightPledge = await Pledge.create({ member_id: right.id, campaign_id: campaign.id, amount: 500, first_name: 'Right', last_name: 'Member', fulfillment_intent: 'later' });

    const hash = 'b'.repeat(32);
    bank = await BankTransaction.create({
      transaction_hash: hash, date: '2026-09-14', amount: 500, type: 'ZELLE', status: 'MATCHED',
      description: 'Zelle payment from Sample  Llc ABC123456789', payer_name: 'Sample  Llc',
      external_ref_id: 'ABC123456789', member_id: wrong.id, reconciled_source: 'MANUAL'
    });
    tx = await Transaction.create({
      member_id: wrong.id, collected_by: treasurer.id, amount: 500, payment_date: '2026-09-14',
      payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded', external_id: hash
    });
    await LedgerEntry.create({
      type: 'pledge_drive', category: 'INC011', amount: 500, entry_date: '2026-09-14', member_id: wrong.id,
      payment_method: 'zelle', transaction_id: tx.id, external_id: hash, memo: 'INC011 - Bank reconciliation match'
    });
    await PledgeAllocation.create({
      pledge_id: wrongPledge.id, transaction_id: tx.id, amount: 500, source: 'treasurer_manual',
      allocated_by: treasurer.id, idempotency_key: `txn:${tx.id}`
    });
    await BankMemoMatch.create({ match_key: 'ZELLE:PAYER:SAMPLE LLC', source_type: 'ZELLE', member_id: wrong.id });
    await BankMemoMatch.create({ match_key: 'ZELLE:DESCRIPTION:SAMPLE LLC', source_type: 'ZELLE', member_id: wrong.id });
    await ZelleMemoMatch.create({ member_id: wrong.id, memo: 'Sample  Llc ABC123456789' });
    await ZelleMemoMatch.create({ member_id: wrong.id, memo: 'Sample Llcx Other' }); // a different payer
  });

  const run = async (extra = {}) => {
    const t = await sequelize.transaction();
    try {
      const log = await rematchPayment({ transactionId: tx.id, toMemberId: right.id, byMemberId: treasurer.id, ...extra }, t);
      await t.commit();
      return log;
    } catch (e) { await t.rollback(); throw e; }
  };

  const netFor = async (pledgeId) => (await PledgeAllocation.sum('amount', { where: { pledge_id: pledgeId } })) || 0;

  it('moves the payment everywhere it was recorded', async () => {
    await run();

    expect(String((await Transaction.findByPk(tx.id)).member_id)).toBe(String(right.id));
    const ledger = await LedgerEntry.findOne({ where: { transaction_id: tx.id } });
    expect(String(ledger.member_id)).toBe(String(right.id));
    expect(ledger.external_id).toBe(bank.transaction_hash); // bank link kept
    expect(String((await BankTransaction.findByPk(bank.id)).member_id)).toBe(String(right.id));

    // Pledge credit moved via an appended reversal, not an edit.
    expect(Number(await netFor(wrongPledge.id))).toBe(0);
    expect(Number(await netFor(rightPledge.id))).toBe(500);
    const reversal = await PledgeAllocation.findOne({ where: { pledge_id: wrongPledge.id, amount: -500 } });
    expect(reversal.reason).toMatch(/wrong member/);
    expect(String(reversal.allocated_by)).toBe(String(treasurer.id));

    // Who the sender is was not part of the correction: learned keys stay.
    expect((await BankMemoMatch.findAll()).every((m) => String(m.member_id) === String(wrong.id))).toBe(true);
  });

  it('--remember-sender re-points the learned keys at the right member', async () => {
    await run({ rememberSender: true });
    // Future payments from this payer are suggested for the right member.
    const learned = await BankMemoMatch.findAll();
    expect(learned.every((m) => String(m.member_id) === String(right.id))).toBe(true);
    expect(String((await ZelleMemoMatch.findOne({ where: { memo: 'Sample  Llc ABC123456789' } })).member_id)).toBe(String(right.id));
    expect(String((await ZelleMemoMatch.findOne({ where: { memo: 'Sample Llcx Other' } })).member_id)).toBe(String(wrong.id));
  });

  it('reports where each affected pledge ends up, counting the member\'s own payments', async () => {
    // The wrong member also paid their pledge themselves.
    const own = await Transaction.create({
      member_id: wrong.id, collected_by: treasurer.id, amount: 500, payment_date: '2026-09-14',
      payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({ pledge_id: wrongPledge.id, transaction_id: own.id, amount: 500, source: 'treasurer_manual' });

    const log = (await run()).join('\n');
    expect(log).toMatch(new RegExp(`pledge #${wrongPledge.id} \\(Wrong Member.*paid 500.00, paid in full — from 1 payment`));
    expect(log).toMatch(new RegExp(`pledge #${rightPledge.id} \\(Right Member.*paid 500.00, paid in full`));
  });

  it('is safe to run twice', async () => {
    await run();
    const log = await run();
    expect(log.join('\n')).not.toMatch(/reversed|credited 500|->/);
    expect(Number(await netFor(rightPledge.id))).toBe(500);
    expect(await PledgeAllocation.count()).toBe(3);
  });

  it('updates the Zelle email row when there is one', async () => {
    const q = await ZelleEmailQueue.create({
      external_id: 'zelle:X1', payer_name: 'SAMPLE LLC', amount: 500, payment_date: '2026-09-13',
      status: 'CREATED', transaction_id: tx.id, matched_member_id: wrong.id
    });
    await run();
    await q.reload();
    expect(String(q.matched_member_id)).toBe(String(right.id));
    expect(q.match_source).toBe('TREASURER_REMATCH');
  });

  it('leaves the payment unallocated when the right member has no open pledge', async () => {
    await rightPledge.destroy();
    const log = await run();
    expect(log.join('\n')).toMatch(/UNALLOCATED/);
    expect(Number(await netFor(wrongPledge.id))).toBe(0);
  });

  it('leaves the learned keys alone by default (the payment may have been paid on behalf)', async () => {
    const log = await run();
    expect((await BankMemoMatch.findAll()).every((m) => String(m.member_id) === String(wrong.id))).toBe(true);
    expect(log.join('\n')).toMatch(/--remember-sender/);
  });

  it('a rolled-back run (dry run) changes nothing', async () => {
    const t = await sequelize.transaction();
    await rematchPayment({ transactionId: tx.id, toMemberId: right.id, byMemberId: treasurer.id }, t);
    await t.rollback();
    expect(String((await Transaction.findByPk(tx.id)).member_id)).toBe(String(wrong.id));
    expect(await PledgeAllocation.count()).toBe(1);
  });
});
