'use strict';

const {
  Pledge, PledgeCampaign, Member, Transaction, sequelize
} = require('../../src/models');
const { maybeAllocateToPledge } = require('../../src/services/pledgeAllocationService');

describe('pledge lookups ignore already-paid immediate pledges', () => {
  let campaign, member, laterPledge;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });
    member = await Member.create({
      first_name: 'Both', last_name: 'Pledges',
      phone_number: '+15550000201', is_active: true, role: 'member'
    });

    // The member already gave once on the spot...
    await Pledge.create({
      amount: 100, first_name: 'Both', last_name: 'Pledges',
      campaign_id: campaign.id, member_id: member.id,
      fulfillment_intent: 'immediate'
    });
    // ...and also holds an outstanding promise.
    laterPledge = await Pledge.create({
      amount: 500, first_name: 'Both', last_name: 'Pledges',
      campaign_id: campaign.id, member_id: member.id,
      fulfillment_intent: 'later'
    });
  });

  it('allocates a new payment to the outstanding later pledge', async () => {
    const txn = await Transaction.create({
      member_id: member.id,
      collected_by: member.id,
      payment_date: '2026-06-01',
      amount: 200,
      payment_type: 'pledge_drive',
      payment_method: 'credit_card',
      status: 'succeeded'
    });

    const allocation = await maybeAllocateToPledge(txn, { source: 'stripe_auto' });

    expect(allocation).not.toBeNull();
    expect(String(allocation.pledge_id)).toBe(String(laterPledge.id));
  });
});
