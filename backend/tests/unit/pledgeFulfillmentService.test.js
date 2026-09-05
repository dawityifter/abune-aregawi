'use strict';

const {
  Pledge, PledgeCampaign, PledgeBalance, PledgeAllocation, Member, Transaction, sequelize
} = require('../../src/models');
const { createPledgeWithPayment } = require('../../src/services/pledgeFulfillmentService');

describe('createPledgeWithPayment', () => {
  let campaign, member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    // PledgeAllocation rows (created by createPledgeWithPayment itself) must be
    // cleared before Transaction, or the FK from pledge_allocations.transaction_id
    // blocks the delete — same ordering the sibling pledge test files use.
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });
    member = await Member.create({
      first_name: 'Immediate', last_name: 'Giver',
      phone_number: '+15550000401', is_active: true, role: 'member'
    });
  });

  const makeTransaction = (overrides = {}) => Transaction.create({
    member_id: member.id,
    collected_by: member.id,
    payment_date: '2026-06-01',
    amount: 300,
    payment_type: 'pledge_drive',
    payment_method: 'credit_card',
    status: 'succeeded',
    ...overrides
  });

  it('creates a pledge that pledge_balances reports as fully fulfilled', async () => {
    const txn = await makeTransaction();

    const { pledge, allocation } = await sequelize.transaction((t) =>
      createPledgeWithPayment({
        campaignId: campaign.id, amount: 300, transactionId: txn.id,
        memberId: member.id, firstName: 'Immediate', lastName: 'Giver',
        source: 'stripe_auto'
      }, { transaction: t }));

    expect(pledge.fulfillment_intent).toBe('immediate');
    expect(parseFloat(allocation.amount)).toBe(300);

    const balance = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(balance.paid_amount)).toBe(300);
    expect(balance.derived_status).toBe('fulfilled');
  });

  it('allocates an anonymous pledge that has no member link', async () => {
    // allocate() normally refuses a pledge whose member does not match the
    // payer (MEMBER_MISMATCH). A null member_id can never match, so the service
    // must supply a reason — this test is what proves it does.
    const txn = await makeTransaction({ member_id: null, collected_by: null });

    const { pledge, allocation } = await sequelize.transaction((t) =>
      createPledgeWithPayment({
        campaignId: campaign.id, amount: 300, transactionId: txn.id,
        memberId: null, firstName: 'Anonymous', lastName: 'Giver',
        baptismName: 'Tesfay', isAnonymous: true,
        source: 'stripe_auto'
      }, { transaction: t }));

    expect(pledge.member_id).toBeNull();
    expect(pledge.is_anonymous).toBe(true);
    expect(pledge.baptism_name).toBe('Tesfay');
    expect(allocation.reason).toMatch(/one transaction/i);
  });

  it('leaves no orphan pledge when allocation fails', async () => {
    const txn = await makeTransaction({ amount: 50 });

    // Allocating 300 against a 50 payment is an over-allocation, which
    // allocate() refuses. The pledge insert must roll back with it.
    await expect(sequelize.transaction((t) =>
      createPledgeWithPayment({
        campaignId: campaign.id, amount: 300, transactionId: txn.id,
        memberId: member.id, firstName: 'Immediate', lastName: 'Giver',
        source: 'stripe_auto'
      }, { transaction: t }))).rejects.toThrow();

    expect(await Pledge.count()).toBe(0);
  });
});
