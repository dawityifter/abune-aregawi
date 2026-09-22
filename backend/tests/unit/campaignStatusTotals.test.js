const {
  CampaignStatusTotal, PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize
} = require('../../src/models');

describe('campaign_status_totals view', () => {
  let campaign, member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01',
      goal_amount: 100000, status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15555550100',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  const pledgeFor = async (amount) => Pledge.create({
    amount, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: member.id, fulfillment_intent: 'immediate'
  });

  const pay = async (pledge, amount) => {
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: member.id
    });
  };

  const byStatus = async () => {
    const rows = await CampaignStatusTotal.findAll({ where: { campaign_id: campaign.id } });
    return Object.fromEntries(rows.map((r) => [r.status, r]));
  };

  it('splits counts and dollars across the three live statuses', async () => {
    const paid = await pledgeFor(1000);
    await pay(paid, 1000);
    const partial = await pledgeFor(5000);
    await pay(partial, 2000);
    await pledgeFor(800);                 // untouched

    const s = await byStatus();

    expect(s.fulfilled.pledge_count).toBe(1);
    expect(parseFloat(s.fulfilled.total_pledged)).toBe(1000);
    expect(parseFloat(s.fulfilled.total_collected)).toBe(1000);
    expect(parseFloat(s.fulfilled.outstanding_positive)).toBe(0);

    expect(s.partially_fulfilled.pledge_count).toBe(1);
    expect(parseFloat(s.partially_fulfilled.total_pledged)).toBe(5000);
    expect(parseFloat(s.partially_fulfilled.total_collected)).toBe(2000);
    expect(parseFloat(s.partially_fulfilled.outstanding_positive)).toBe(3000);

    expect(s.not_started.pledge_count).toBe(1);
    expect(parseFloat(s.not_started.total_collected)).toBe(0);
    expect(parseFloat(s.not_started.outstanding_positive)).toBe(800);
  });

  it('reports cancelled pledges as their own row, owing nothing', async () => {
    const doomed = await pledgeFor(1000);
    await doomed.update({ lifecycle: 'cancelled' });

    const s = await byStatus();
    expect(s.cancelled.pledge_count).toBe(1);
    expect(parseFloat(s.cancelled.total_pledged)).toBe(1000);
    // A cancelled pledge owes nothing. Its $1000 unpaid remainder must not be
    // reported as money the drive is still waiting on.
    expect(parseFloat(s.cancelled.outstanding_positive)).toBe(0);
  });

  it('emits no rows for a campaign with no pledges', async () => {
    const rows = await CampaignStatusTotal.findAll({ where: { campaign_id: campaign.id } });
    expect(rows).toHaveLength(0);
  });

  it('never reports negative outstanding on an over-paid status bucket', async () => {
    const over = await pledgeFor(1000);
    await pay(over, 1200);

    const s = await byStatus();
    expect(parseFloat(s.fulfilled.outstanding_positive)).toBe(0);
  });

  it('counts a family once per status bucket', async () => {
    const spouse = await Member.create({
      first_name: 'Selam', last_name: 'Giver', phone_number: '+15555550101',
      email: 'selam@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-selam2', family_id: member.id
    });
    await pledgeFor(500);
    await Pledge.create({
      amount: 700, first_name: 'Selam', last_name: 'Giver', pledge_type: 'fundraising',
      campaign_id: campaign.id, member_id: spouse.id, fulfillment_intent: 'immediate'
    });

    const s = await byStatus();
    expect(s.not_started.pledge_count).toBe(2);
    expect(s.not_started.household_count).toBe(1);
  });
});
