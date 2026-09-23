const request = require('supertest');
const {
  sequelize, PledgeCampaign, Pledge, Member, Transaction, PledgeAllocation
} = require('../../src/models');

jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  firebaseAuthMiddleware: (req, res, next) => {
    req.user = global.__TEST_USER__ || { role: 'treasurer', roles: ['treasurer'] };
    next();
  }
}));

const app = require('../../src/server');

describe('GET /api/pledge-campaigns/:id/dashboard', () => {
  let campaign, head, spouse;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    global.__TEST_USER__ = { role: 'treasurer', roles: ['treasurer'] };
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026 Pledge Drive',
      start_date: '2026-09-01', end_date: '2026-12-31',
      goal_amount: 100000, status: 'active'
    });
    head = await Member.create({
      first_name: 'Abraham', last_name: 'Tesfaye', phone_number: '+15555550100',
      email: 'abraham@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-abraham', family_id: null
    });
    spouse = await Member.create({
      first_name: 'Selam', last_name: 'Tesfaye', phone_number: '+15555550101',
      email: 'selam@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-selam', family_id: head.id
    });
  });

  const pledgeFor = async (memberId, amount) => Pledge.create({
    amount, first_name: 'X', last_name: 'Y', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: memberId, fulfillment_intent: 'immediate'
  });

  const pay = async (pledge, amount) => {
    const txn = await Transaction.create({
      member_id: head.id, collected_by: head.id, payment_date: '2026-09-15',
      amount, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: head.id
    });
  };

  const get = () => request(app).get(`/api/pledge-campaigns/${campaign.id}/dashboard`);

  it('reports money with outstanding_owed clamped and overpaid reported beside it', async () => {
    const over = await pledgeFor(head.id, 1000);
    await pay(over, 1200);                 // overshoots by 200
    const short = await pledgeFor(spouse.id, 5000);
    await pay(short, 1000);                // still owes 4000

    const res = await get();
    expect(res.status).toBe(200);
    const { money } = res.body.dashboard;

    expect(money.pledged).toBe(6000);
    expect(money.collected).toBe(2200);
    // The netted figure would be 3800. The honest one is 4000.
    expect(money.outstanding_owed).toBe(4000);
    expect(money.overpaid).toBe(200);
    expect(money.goal).toBe(100000);
    expect(money.gap_to_goal).toBe(97800);
  });

  it('counts a family once in participation and reports anonymous gifts beside it', async () => {
    await pledgeFor(head.id, 1000);
    await pledgeFor(spouse.id, 500);
    await Pledge.create({
      amount: 750, first_name: 'Anonymous', last_name: 'Giver',
      pledge_type: 'fundraising', campaign_id: campaign.id, member_id: null,
      is_anonymous: true, fulfillment_intent: 'immediate', baptism_name: 'Gebre Mesqel'
    });

    const res = await get();
    const { participation } = res.body.dashboard;

    expect(participation.households).toBe(1);        // one family, two members
    expect(participation.active_households).toBe(1); // one head, spouse is linked
    expect(participation.anonymous_pledges).toBe(1); // reported, not folded in
    expect(participation.family_id_populated).toBe(true);
  });

  it('never reports participation above 100 percent when a pledger is deactivated', async () => {
    await pledgeFor(head.id, 1000);
    const departed = await Member.create({
      first_name: 'Yonas', last_name: 'Gebre', phone_number: '+15555550102',
      email: 'yonas@example.com', is_active: false, role: 'member',
      firebase_uid: 'uid-yonas', family_id: null
    });
    await pledgeFor(departed.id, 500);

    const res = await get();
    const { participation } = res.body.dashboard;
    expect(participation.households).toBeLessThanOrEqual(participation.active_households);
    expect(participation.rate).toBeLessThanOrEqual(100);
  });

  it('computes the campaign timeline in days, not fractions of a year', async () => {
    const res = await get();
    const { timeline } = res.body.dashboard;
    expect(timeline.total_days).toBe(122);          // 2026-09-01 .. 2026-12-31
    expect(timeline.day).toBeGreaterThan(0);
    expect(timeline.day + timeline.days_remaining).toBe(122);
  });

  it('returns a status breakdown carrying both counts and dollars', async () => {
    const paid = await pledgeFor(head.id, 1000);
    await pay(paid, 1000);
    await pledgeFor(spouse.id, 800);

    const res = await get();
    const byStatus = Object.fromEntries(
      res.body.dashboard.breakdown.map((r) => [r.status, r])
    );
    expect(byStatus.fulfilled.pledge_count).toBe(1);
    expect(byStatus.fulfilled.total_collected).toBe(1000);
    expect(byStatus.not_started.pledge_count).toBe(1);
    expect(byStatus.not_started.outstanding_owed).toBe(800);
  });

  it('suppresses a small status bucket for a tier-2 caller but not for a treasurer', async () => {
    // Two pledges in one bucket: identifying at parish scale.
    await pledgeFor(head.id, 1000);
    await pledgeFor(spouse.id, 500);

    global.__TEST_USER__ = { role: 'ap_team', roles: ['ap_team'] };
    const tier2 = await get();
    const t2 = tier2.body.dashboard.breakdown.find((r) => r.status === 'not_started');
    expect(t2.total_pledged).toBeNull();
    expect(t2.pledge_count).toBeNull();

    global.__TEST_USER__ = { role: 'treasurer', roles: ['treasurer'] };
    const tier3 = await get();
    const t3 = tier3.body.dashboard.breakdown.find((r) => r.status === 'not_started');
    expect(t3.total_pledged).toBe(1500);
    expect(t3.pledge_count).toBe(2);
  });

  it('404s for a campaign that does not exist', async () => {
    const res = await request(app).get('/api/pledge-campaigns/999999/dashboard');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('stamps the snapshot with an as_of timestamp', async () => {
    const res = await get();
    expect(Date.parse(res.body.dashboard.as_of)).not.toBeNaN();
  });
});
