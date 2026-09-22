const {
  CampaignTotal, PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize
} = require('../../src/models');

describe('campaign_totals over-payment columns', () => {
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
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15555550110',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  // `immediate` intent keeps the partial unique index off our back, so one
  // member can hold several pledges in a single drive.
  const pledgeFor = async (amount, memberId = member.id) => Pledge.create({
    amount, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: memberId, fulfillment_intent: 'immediate'
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

  const totals = async () => CampaignTotal.findOne({ where: { campaign_id: campaign.id } });

  it('never reports negative money still owed', async () => {
    const over = await pledgeFor(1000);
    await pay(over, 1200);          // overshoots by 200
    const under = await pledgeFor(5000);
    await pay(under, 1000);         // still owes 4000

    const t = await totals();
    // outstanding nets the overshoot against the shortfall: 3800
    expect(parseFloat(t.outstanding)).toBe(3800);
    // outstanding_positive counts only real shortfall: 4000
    expect(parseFloat(t.outstanding_positive)).toBe(4000);
    expect(parseFloat(t.overpaid_amount)).toBe(200);
  });

  it('reports zero over-payment when every pledge is short', async () => {
    const p = await pledgeFor(5000);
    await pay(p, 1000);

    const t = await totals();
    expect(parseFloat(t.outstanding_positive)).toBe(4000);
    expect(parseFloat(t.overpaid_amount)).toBe(0);
  });

  it('reports zero on both columns for a drive with no pledges', async () => {
    const t = await totals();
    expect(parseFloat(t.outstanding_positive)).toBe(0);
    expect(parseFloat(t.overpaid_amount)).toBe(0);
  });
});
