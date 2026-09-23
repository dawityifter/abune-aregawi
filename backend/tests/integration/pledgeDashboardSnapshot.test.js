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

  it('computes percent_to_goal, fulfillment_rate and pace figures for a goaled campaign', async () => {
    const paid = await pledgeFor(head.id, 4000);
    await pay(paid, 4000);                 // fully collected
    const partial = await pledgeFor(spouse.id, 6000);
    await pay(partial, 2000);              // 4000 still owed

    const res = await get();
    const { money, timeline } = res.body.dashboard;

    expect(money.pledged).toBe(10000);
    expect(money.collected).toBe(6000);
    expect(money.goal).toBe(100000);
    expect(money.percent_to_goal).toBe(6);      // 6000 / 100000 * 100
    expect(money.fulfillment_rate).toBe(60);    // 6000 / 10000 * 100
    expect(money.gap_to_goal).toBe(94000);      // 100000 - 6000

    // linear_pace_target / required_run_rate follow the same day-of-campaign
    // maths the timeline test above pins. Recomputed here independently from
    // the timeline this same response reports (rather than trusting money's
    // own numbers), so a wrong variable — e.g. total_days instead of
    // elapsed_fraction — would still fail this assertion.
    const round2 = (v) => Math.round(v * 100) / 100;
    expect(money.linear_pace_target).toBe(round2(money.goal * timeline.elapsed_fraction));
    expect(money.required_run_rate).toBe(
      timeline.days_remaining > 0 ? round2(money.gap_to_goal / timeline.days_remaining) : null
    );
    expect(typeof money.linear_pace_target).toBe('number');
    expect(typeof money.required_run_rate).toBe('number');
  });

  it('suppresses money.overpaid for a tier-2 caller against the same count attention.overpaid uses, but not for a treasurer', async () => {
    const over = await pledgeFor(head.id, 1000);
    await pay(over, 1200);                 // one overpaid pledge, by $200

    global.__TEST_USER__ = { role: 'ap_team', roles: ['ap_team'] };
    const tier2 = await get();
    expect(tier2.body.dashboard.attention.overpaid).toBeNull();
    expect(tier2.body.dashboard.money.overpaid).toBeNull();

    global.__TEST_USER__ = { role: 'treasurer', roles: ['treasurer'] };
    const tier3 = await get();
    expect(tier3.body.dashboard.attention.overpaid).toBe(1);
    expect(tier3.body.dashboard.money.overpaid).toBe(200);
  });

  it('suppresses anonymous participation figures for a tier-2 caller but not for a treasurer', async () => {
    await pledgeFor(head.id, 1000);
    await Pledge.create({
      amount: 750, first_name: 'Anonymous', last_name: 'Giver',
      pledge_type: 'fundraising', campaign_id: campaign.id, member_id: null,
      is_anonymous: true, fulfillment_intent: 'immediate', baptism_name: 'Gebre Mesqel'
    });

    global.__TEST_USER__ = { role: 'ap_team', roles: ['ap_team'] };
    const tier2 = await get();
    expect(tier2.body.dashboard.participation.anonymous_pledges).toBeNull();
    expect(tier2.body.dashboard.participation.anonymous_collected).toBeNull();

    global.__TEST_USER__ = { role: 'treasurer', roles: ['treasurer'] };
    const tier3 = await get();
    expect(tier3.body.dashboard.participation.anonymous_pledges).toBe(1);
    expect(tier3.body.dashboard.participation.anonymous_collected).toBe(0);
  });

  it('suppresses at least two status buckets when one alone would leak by subtraction from the money totals', async () => {
    // not_started: 2 pledges, $2,000 total — small enough to suppress alone.
    await pledgeFor(head.id, 1000);
    await pledgeFor(spouse.id, 1000);

    // fulfilled: 5 pledges, $5,000 total, all paid — exactly at the
    // suppression threshold, so it would NOT be suppressed on its own.
    // Without complementary suppression, a tier-2 caller could recover the
    // hidden not_started total via money.pledged (7000) - this bucket's
    // total_pledged (5000) = 2000.
    // Each phone number is written out literally (not template-interpolated)
    // in the reserved fictional block, on its own line, so the pre-commit
    // sensitive-data guard's exemption for that range applies per line.
    const payers = await Promise.all([
      Member.create({
        first_name: 'Payer', last_name: 'One', email: 'payer1@example.com',
        phone_number: '+15555550103',
        is_active: true, role: 'member', firebase_uid: 'uid-payer-1'
      }),
      Member.create({
        first_name: 'Payer', last_name: 'Two', email: 'payer2@example.com',
        phone_number: '+15555550104',
        is_active: true, role: 'member', firebase_uid: 'uid-payer-2'
      }),
      Member.create({
        first_name: 'Payer', last_name: 'Three', email: 'payer3@example.com',
        phone_number: '+15555550105',
        is_active: true, role: 'member', firebase_uid: 'uid-payer-3'
      }),
      Member.create({
        first_name: 'Payer', last_name: 'Four', email: 'payer4@example.com',
        phone_number: '+15555550106',
        is_active: true, role: 'member', firebase_uid: 'uid-payer-4'
      }),
      Member.create({
        first_name: 'Payer', last_name: 'Five', email: 'payer5@example.com',
        phone_number: '+15555550107',
        is_active: true, role: 'member', firebase_uid: 'uid-payer-5'
      })
    ]);
    for (const payer of payers) {
      const p = await pledgeFor(payer.id, 1000);
      await pay(p, 1000);
    }

    global.__TEST_USER__ = { role: 'ap_team', roles: ['ap_team'] };
    const res = await get();
    const { breakdown, money } = res.body.dashboard;

    // The headline totals stay visible — they are not the privacy surface.
    expect(money.pledged).toBe(7000);
    expect(money.collected).toBe(5000);

    const notStarted = breakdown.find((r) => r.status === 'not_started');
    const fulfilled = breakdown.find((r) => r.status === 'fulfilled');
    expect(notStarted.total_pledged).toBeNull();
    expect(fulfilled.total_pledged).toBeNull();

    const suppressedCount = breakdown.filter((r) => r.total_pledged === null).length;
    expect(suppressedCount).toBeGreaterThanOrEqual(2);
  });

  it('handles a campaign with no end_date without dividing by anything', async () => {
    const openEnded = await PledgeCampaign.create({
      slug: '2026-open-ended', name: 'Open Ended Drive',
      start_date: '2026-09-01', end_date: null,
      goal_amount: 50000, status: 'active'
    });

    const res = await request(app).get(`/api/pledge-campaigns/${openEnded.id}/dashboard`);
    expect(res.status).toBe(200);
    const { timeline, money } = res.body.dashboard;

    // Strict null, not a loose falsy check — NaN is falsy too and would slip
    // through `.toBeFalsy()`.
    expect(timeline.total_days).toBeNull();
    expect(timeline.days_remaining).toBeNull();
    expect(timeline.elapsed_fraction).toBeNull();
    // `day` is a real count, not a stand-in for "unknown" — it must be a
    // positive, finite number, never NaN or Infinity.
    expect(typeof timeline.day).toBe('number');
    expect(Number.isFinite(timeline.day)).toBe(true);
    expect(timeline.day).toBeGreaterThan(0);

    expect(money.linear_pace_target).toBeNull();
    expect(money.required_run_rate).toBeNull();
  });
});
