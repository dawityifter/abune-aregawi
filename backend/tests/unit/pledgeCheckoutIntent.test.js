'use strict';

const {
  Pledge, PledgeCampaign, PledgeBalance, PledgeAllocation, Member, Transaction, sequelize
} = require('../../src/models');
const { handlePaymentSucceeded } = require('../../src/controllers/donationController');

const pledgeIntent = (id, metadata) => ({
  id,
  amount: 40000,
  amount_received: 40000,
  created: Math.floor(Date.now() / 1000),
  metadata: {
    purpose: 'pledge_drive',
    pledgeIntent: 'immediate',
    ...metadata
  }
});

describe('online pledge-and-pay', () => {
  let campaign, member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    // Delete allocations before the transactions/pledges they reference — the
    // FK constraint is enforced (SQLite foreign_keys pragma), matching the
    // teardown order used by the sibling pledgeAllocate/pledgeFulfillmentService tests.
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
      first_name: 'Online',
      last_name: 'Giver',
      phone_number: '+15550000601',
      email: 'online@example.test', is_active: true, role: 'member'
    });
  });

  it('creates a fully fulfilled pledge for a signed-in member', async () => {
    await handlePaymentSucceeded(pledgeIntent('pi_pledge_001', {
      memberId: String(member.id),
      campaignId: String(campaign.id),
      donor_first_name: 'Online',
      donor_last_name: 'Giver'
    }));

    const pledge = await Pledge.findOne({ where: { member_id: member.id } });
    expect(pledge).not.toBeNull();
    expect(pledge.fulfillment_intent).toBe('immediate');
    expect(parseFloat(pledge.amount)).toBe(400);

    const balance = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(balance.derived_status).toBe('fulfilled');
  });

  it('creates an anonymous pledge for a giver with no account', async () => {
    await handlePaymentSucceeded(pledgeIntent('pi_pledge_002', {
      campaignId: String(campaign.id),
      isAnonymous: 'true',
      baptismName: 'Tesfay',
      donor_first_name: 'Anonymous',
      donor_last_name: 'Giver'
    }));

    const pledge = await Pledge.findOne({ where: { is_anonymous: true } });
    expect(pledge).not.toBeNull();
    expect(pledge.member_id).toBeNull();
    expect(pledge.baptism_name).toBe('Tesfay');

    const balance = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(balance.derived_status).toBe('fulfilled');
  });

  it('is idempotent when the webhook is redelivered', async () => {
    const intent = pledgeIntent('pi_pledge_003', {
      memberId: String(member.id), campaignId: String(campaign.id),
      donor_first_name: 'Online', donor_last_name: 'Giver'
    });
    await handlePaymentSucceeded(intent);
    await handlePaymentSucceeded(intent);

    expect(await Pledge.count()).toBe(1);
    expect(await Transaction.count()).toBe(1);
  });

  it('keeps the payment when the pledge cannot be created', async () => {
    // Anonymous with no baptism name violates the model validation, so the
    // pledge fails. The money must still be on the books — an unlinked payment
    // is recoverable, lost money is not.
    await handlePaymentSucceeded(pledgeIntent('pi_pledge_004', {
      campaignId: String(campaign.id),
      isAnonymous: 'true',
      donor_first_name: 'Anonymous', donor_last_name: 'Giver'
    }));

    expect(await Pledge.count()).toBe(0);
    const txn = await Transaction.findOne({ where: { external_id: 'pi_pledge_004' } });
    expect(txn).not.toBeNull();
    expect(txn.status).toBe('succeeded');
  });
});
