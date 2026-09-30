'use strict';

// scripts/merge-duplicate-member.js — merging a duplicate member record. All data synthetic.
const {
  sequelize, Member, Dependent, Transaction, LedgerEntry, BankTransaction,
  Pledge, PledgeCampaign, PledgeAllocation, BankMemoMatch, ZelleMemoMatch, MemberLoan
} = require('../../src/models');
const { mergeDuplicateMember } = require('../../scripts/merge-duplicate-member');

describe('merge-duplicate-member', () => {
  let treasurer, dup, right, campaign;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {}, force: true, truncate: true });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await BankMemoMatch.destroy({ where: {} });
    await ZelleMemoMatch.destroy({ where: {} });
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await BankTransaction.destroy({ where: {} });
    await MemberLoan.destroy({ where: {} });
    await Dependent.destroy({ where: {} });
    await Member.destroy({ where: {} });

    treasurer = await Member.create({ first_name: 'Test', last_name: 'Treasurer', phone_number: '+15555550181', role: 'treasurer', is_active: true });
    dup = await Member.create({ first_name: 'Duplicate', last_name: 'Person', phone_number: '+15555550182', is_active: true });
    right = await Member.create({ first_name: 'Correct', last_name: 'Person', phone_number: '+15555550183', is_active: true });
    await Member.update({ family_id: sequelize.col('id') }, { where: { id: [dup.id, right.id] } });
    campaign = await PledgeCampaign.create({ slug: 'drive', name: 'Drive', status: 'active', start_date: '2026-01-01' });
  });

  const run = async () => {
    const t = await sequelize.transaction();
    try {
      const log = await mergeDuplicateMember({ fromId: dup.id, toId: right.id, byId: treasurer.id }, t);
      await t.commit();
      return log;
    } catch (e) { await t.rollback(); throw e; }
  };

  const makePayment = async (memberId, overrides = {}) => {
    const hash = overrides.hash || `${memberId}${Math.random().toString(16).slice(2, 10)}`.padEnd(32, '0').slice(0, 32);
    const bank = await BankTransaction.create({
      transaction_hash: hash, date: '2025-06-30', amount: 100, type: 'ZELLE', status: 'MATCHED',
      description: 'Zelle payment from Duplicate Person', payer_name: 'Duplicate Person',
      member_id: memberId, reconciled_source: 'MANUAL'
    });
    const tx = await Transaction.create({
      member_id: memberId, collected_by: treasurer.id, amount: 100, payment_date: '2025-06-30',
      payment_type: 'membership_due', payment_method: 'zelle', status: 'succeeded', external_id: hash, ...overrides.tx
    });
    await LedgerEntry.create({
      type: 'membership_due', category: 'INC001', amount: 100, entry_date: '2025-06-30', member_id: memberId,
      payment_method: 'zelle', transaction_id: tx.id, external_id: hash, memo: 'INC001 - Bank reconciliation match'
    });
    return { bank, tx };
  };

  it('moves pledges, moves every payment, re-points learned keys, and deletes the duplicate', async () => {
    const pledge = await Pledge.create({ member_id: dup.id, campaign_id: campaign.id, amount: 200, first_name: 'Duplicate', last_name: 'Person', fulfillment_intent: 'immediate', is_historical: false });
    const { tx } = await makePayment(dup.id);
    await PledgeAllocation.create({ pledge_id: pledge.id, transaction_id: tx.id, amount: 200, source: 'treasurer_manual', allocated_by: treasurer.id, idempotency_key: `txn:${tx.id}` });
    await BankMemoMatch.create({ match_key: 'ZELLE:PAYER:DUPLICATE PERSON', source_type: 'ZELLE', member_id: dup.id });
    await ZelleMemoMatch.create({ member_id: dup.id, memo: 'Duplicate Person ABC123' });

    await run();

    expect(String((await Pledge.findByPk(pledge.id)).member_id)).toBe(String(right.id));
    expect(String((await Transaction.findByPk(tx.id)).member_id)).toBe(String(right.id));
    expect(String((await BankMemoMatch.findOne({ where: { match_key: 'ZELLE:PAYER:DUPLICATE PERSON' } })).member_id)).toBe(String(right.id));
    expect(String((await ZelleMemoMatch.findOne({ where: { memo: 'Duplicate Person ABC123' } })).member_id)).toBe(String(right.id));
    expect(await Member.findByPk(dup.id)).toBeNull();
    expect(Number(await PledgeAllocation.sum('amount', { where: { pledge_id: pledge.id } }))).toBe(200);
  });

  it('moves multiple payments across different years', async () => {
    const { tx: tx1 } = await makePayment(dup.id, { tx: { payment_date: '2025-02-10' } });
    const { tx: tx2 } = await makePayment(dup.id, { tx: { payment_date: '2026-09-14' } });

    await run();

    expect(String((await Transaction.findByPk(tx1.id)).member_id)).toBe(String(right.id));
    expect(String((await Transaction.findByPk(tx2.id)).member_id)).toBe(String(right.id));
  });

  it('a rolled-back run (dry run) changes nothing', async () => {
    const { tx } = await makePayment(dup.id);
    const t = await sequelize.transaction();
    await mergeDuplicateMember({ fromId: dup.id, toId: right.id, byId: treasurer.id }, t);
    await t.rollback();
    expect(String((await Transaction.findByPk(tx.id)).member_id)).toBe(String(dup.id));
    expect(await Member.findByPk(dup.id)).not.toBeNull();
  });

  it('refuses when the duplicate has dependents of their own', async () => {
    await Dependent.create({ memberId: dup.id, firstName: 'Kid', lastName: 'Person', relationship: 'Son' });
    await expect(run()).rejects.toThrow(/dependent/);
    expect(await Member.findByPk(dup.id)).not.toBeNull();
  });

  it('refuses when the duplicate is head of another member\'s household', async () => {
    const follower = await Member.create({ first_name: 'Follower', last_name: 'Person', phone_number: '+15555550199', is_active: true, family_id: dup.id });
    await expect(run()).rejects.toThrow(/head of another member's household/);
    await follower.destroy();
  });

  it('refuses when the duplicate holds a member_loans row', async () => {
    await MemberLoan.create({ member_id: dup.id, amount: 100, outstanding_balance: 100, payment_method: 'cash', loan_date: '2025-01-01' });
    await expect(run()).rejects.toThrow(/member_loans/);
  });

  it('refuses when the duplicate is collected_by on a transaction', async () => {
    await Transaction.create({ member_id: right.id, collected_by: dup.id, amount: 50, payment_date: '2025-01-01', payment_type: 'other', payment_method: 'zelle', status: 'succeeded' });
    await expect(run()).rejects.toThrow(/collected_by/);
  });

  it('refuses when the duplicate pledge would collide with the right member\'s open pledge', async () => {
    await Pledge.create({ member_id: dup.id, campaign_id: campaign.id, amount: 100, first_name: 'Duplicate', last_name: 'Person', fulfillment_intent: 'later', is_historical: false });
    await Pledge.create({ member_id: right.id, campaign_id: campaign.id, amount: 180, first_name: 'Correct', last_name: 'Person', fulfillment_intent: 'later', is_historical: false });
    await expect(run()).rejects.toThrow(/already has an open pledge/);
  });
});
