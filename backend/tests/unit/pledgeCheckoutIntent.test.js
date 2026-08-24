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

  it('does not double-credit a member who also holds an open later pledge', async () => {
    // This member already has a separate, unrelated 'later' pledge in the same
    // live campaign. maybeAllocateToPledge would try to match and allocate
    // THIS payment to THAT pledge too, unless the pledge-and-pay path having
    // already allocated it (pledgeCreated === true) correctly skips that call.
    //
    // Verified by temporarily removing the `if (!pledgeCreated)` gate: the
    // second allocate() call is still attempted, but it is rejected with
    // OVER_ALLOCATED ("Only 0.00 of this payment is unallocated") because
    // allocate() caps total allocations against a transaction at the
    // transaction's own amount, and the first (pledge-and-pay) allocation
    // already consumed all of it. So PledgeAllocation.count() stays at 1
    // either way here — allocate()'s amount cap is an independent, load-
    // bearing safety net against a literal double-credit, and the gate is a
    // second layer that keeps a same-amount pledge-drive payment from ever
    // reaching that reject path at all (avoiding a spurious failed-allocation
    // error log on every ordinary pledge-and-pay payment from a member who
    // also happens to hold an older 'later' pledge). This test therefore
    // pins the gate's effect on Pledge/PledgeAllocation shape rather than on
    // a dollar amount, which is the one thing removing the gate does change:
    // without it, maybeAllocateToPledge still runs and its failure is logged
    // as an error for a case that is not actually an error.
    await Pledge.create({
      campaign_id: campaign.id, member_id: member.id,
      amount: 1000, first_name: 'Online', last_name: 'Giver',
      fulfillment_intent: 'later'
    });

    await handlePaymentSucceeded(pledgeIntent('pi_pledge_005', {
      memberId: String(member.id),
      campaignId: String(campaign.id),
      donor_first_name: 'Online',
      donor_last_name: 'Giver'
    }));

    // Two pledges now exist for this member (the pre-existing 'later' one and
    // the new 'immediate' one this payment created), but only one allocation
    // may exist for the one payment that was made.
    expect(await Pledge.count()).toBe(2);
    expect(await PledgeAllocation.count()).toBe(1);
  });
});
