'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const {
  sequelize, PledgeCampaign, Pledge, Member, Transaction, PledgeAllocation
} = require('../../models');
const { createPledgeViews } = require('../../database/pledgeViews');
const { maybeAllocateToPledge } = require('../../services/pledgeAllocationService');
const { todayInChurchTz } = require('../../services/pledgeCampaignService');

let campaign;
let member;
let pledge;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await createPledgeViews(sequelize.getQueryInterface());
});

beforeEach(async () => {
  await PledgeAllocation.destroy({ where: {}, truncate: true, cascade: true });
  await Transaction.destroy({ where: {}, truncate: true, cascade: true });
  await Pledge.destroy({ where: {}, truncate: true, cascade: true });
  await PledgeCampaign.destroy({ where: {}, truncate: true, cascade: true });
  await Member.destroy({ where: {}, truncate: true, cascade: true });

  campaign = await PledgeCampaign.create({
    slug: 'live-drive', name: 'Live Drive', status: 'active',
    start_date: todayInChurchTz(), end_date: null
  });
  // Synthetic member — never a real one.
  member = await Member.create({
    first_name: 'Test',
    last_name: 'Pledger',
    phone_number: '+15550000101'
  });
  pledge = await Pledge.create({
    campaign_id: campaign.id, member_id: member.id, amount: 500,
    first_name: 'Test', last_name: 'Pledger'
  });
});
// Deliberately no sequelize.close() here — see Global Constraints.

const makeTxn = (overrides = {}) => Transaction.create({
  member_id: member.id,
  // Transaction.collected_by is a required FK to members; not part of the
  // rule under test, just a fixture requirement. Reusing the payer here is
  // fine since these transactions are synthetic.
  collected_by: member.id,
  amount: 200,
  payment_type: 'pledge_drive',
  payment_method: 'cash',
  // The model's beforeValidate hook requires a receipt_number for cash/check
  // payments regardless of what this suite is testing; not part of the rule
  // under test, just a fixture requirement.
  receipt_number: 'TEST-0001',
  status: 'succeeded',
  payment_date: new Date(),
  ...overrides
});

describe('maybeAllocateToPledge', () => {
  it('allocates a pledge_drive payment to the live-campaign pledge', async () => {
    const txn = await makeTxn();

    const allocation = await maybeAllocateToPledge(txn, { source: 'treasurer_manual', allocatedBy: 1 });

    expect(allocation).not.toBeNull();
    expect(String(allocation.pledge_id)).toBe(String(pledge.id));
    expect(parseFloat(allocation.amount)).toBe(200);
    expect(allocation.source).toBe('treasurer_manual');
  });

  it('allocates the full amount even when it exceeds the remaining balance', async () => {
    // Decided in the spec: the donor gave this much to the drive and the
    // record should say so, rather than splitting one payment in two.
    const txn = await makeTxn({ amount: 900 });

    const allocation = await maybeAllocateToPledge(txn, { source: 'stripe_auto' });

    expect(parseFloat(allocation.amount)).toBe(900);
  });

  it('is idempotent for one transaction', async () => {
    const txn = await makeTxn();

    const first = await maybeAllocateToPledge(txn, { source: 'stripe_auto' });
    const second = await maybeAllocateToPledge(txn, { source: 'stripe_auto' });

    expect(String(second.id)).toBe(String(first.id));
    expect(await PledgeAllocation.count()).toBe(1);
  });

  it('does nothing for a payment of another type', async () => {
    const txn = await makeTxn({ payment_type: 'membership_due' });

    expect(await maybeAllocateToPledge(txn, { source: 'treasurer_manual', allocatedBy: 1 })).toBeNull();
    expect(await PledgeAllocation.count()).toBe(0);
  });

  it('does nothing for a payment that has not succeeded', async () => {
    const txn = await makeTxn({ status: 'pending' });

    expect(await maybeAllocateToPledge(txn, { source: 'stripe_auto' })).toBeNull();
  });

  it('does nothing for an anonymous payment', async () => {
    const txn = await makeTxn({ member_id: null });

    expect(await maybeAllocateToPledge(txn, { source: 'stripe_auto' })).toBeNull();
  });

  it('does nothing when the member has no pledge in the live campaign', async () => {
    await pledge.destroy();
    const txn = await makeTxn();

    expect(await maybeAllocateToPledge(txn, { source: 'stripe_auto' })).toBeNull();
  });

  it('does nothing when no campaign is live', async () => {
    await campaign.update({ status: 'draft' });
    const txn = await makeTxn();

    expect(await maybeAllocateToPledge(txn, { source: 'stripe_auto' })).toBeNull();
  });

  it('ignores a cancelled pledge', async () => {
    await pledge.update({ lifecycle: 'cancelled' });
    const txn = await makeTxn();

    expect(await maybeAllocateToPledge(txn, { source: 'stripe_auto' })).toBeNull();
  });
});

const { createTransactionRecord } = require('../../services/transactionService');

describe('createTransactionRecord allocating to a pledge', () => {
  it('creates the allocation alongside the payment', async () => {
    const txn = await createTransactionRecord({
      member_id: member.id,
      collected_by: member.id,
      amount: 150,
      payment_type: 'pledge_drive',
      payment_method: 'cash',
      // createTransactionRecord's own validation (not just the model hook)
      // requires a receipt_number for cash/check; '000' is the documented
      // no-receipt placeholder that also skips the duplicate-receipt check.
      // Not part of the rule under test, just a fixture requirement.
      receipt_number: '000',
      payment_date: '2026-08-22'
    });

    const allocations = await PledgeAllocation.findAll({ where: { transaction_id: txn.id } });
    expect(allocations).toHaveLength(1);
    expect(parseFloat(allocations[0].amount)).toBe(150);
    expect(allocations[0].source).toBe('treasurer_manual');
  });

  it('records the payment even when allocation is impossible', async () => {
    // Recording money always wins: no live campaign means no allocation, but
    // the payment must still exist.
    await campaign.update({ status: 'closed' });

    const txn = await createTransactionRecord({
      member_id: member.id,
      collected_by: member.id,
      amount: 150,
      payment_type: 'pledge_drive',
      payment_method: 'cash',
      receipt_number: '000',
      payment_date: '2026-08-22'
    });

    expect(txn.id).toBeDefined();
    expect(await Transaction.findByPk(txn.id)).not.toBeNull();
    expect(await PledgeAllocation.count({ where: { transaction_id: txn.id } })).toBe(0);
  });

  it('leaves other payment types alone', async () => {
    const txn = await createTransactionRecord({
      member_id: member.id,
      collected_by: member.id,
      amount: 150,
      payment_type: 'membership_due',
      payment_method: 'cash',
      receipt_number: '000',
      payment_date: '2026-08-22'
    });

    expect(await PledgeAllocation.count({ where: { transaction_id: txn.id } })).toBe(0);
  });
});
