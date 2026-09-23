const request = require('supertest');
const {
  sequelize, PledgeCampaign, Pledge, Member, Transaction, PledgeAllocation
} = require('../../src/models');

jest.mock('../../src/middleware/auth', () => ({
  firebaseAuthMiddleware: (req, res, next) => {
    req.user = { role: 'treasurer', roles: ['treasurer'] };
    next();
  },
  authMiddleware: (req, res, next) => next()
}));

const app = require('../../src/server');

describe('GET /api/pledge-campaigns/:id/compare', () => {
  let current, prior, member;

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

    prior = await PledgeCampaign.create({
      slug: '2025-pledge-drive', name: '2025', start_date: '2025-09-13',
      end_date: '2026-01-12', status: 'closed'          // no goal, like the real one
    });
    current = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-09-01',
      end_date: '2026-12-31', goal_amount: 100000, status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15555550130',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  const pledgeIn = async (campaign, amount, overrides = {}) => Pledge.create({
    amount, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: member.id, fulfillment_intent: 'immediate',
    ...overrides
  });

  const compare = async () => {
    const res = await request(app)
      .get(`/api/pledge-campaigns/${current.id}/compare?to=${prior.id}`);
    expect(res.status).toBe(200);
    return res.body.comparison;
  };

  it('marks goal and collections incomparable against a historical drive with no goal', async () => {
    await pledgeIn(prior, 5000, { is_historical: true, legacy_status: 'fulfilled' });
    await pledgeIn(current, 1000);

    const c = await compare();
    expect(c.comparable.goal).toBe(false);          // prior has no goal_amount
    expect(c.comparable.collections).toBe(false);   // prior has no payment dates
    expect(c.comparable.partial).toBe(false);       // prior is binary paid/unpaid
    expect(c.comparable.pledging_curve).toBe(true); // created_at exists on both
  });

  it('reports both windows so the UI can say they are the same length', async () => {
    const c = await compare();
    expect(c.campaigns.current.total_days).toBe(122);
    expect(c.campaigns.prior.total_days).toBe(122);
    expect(c.campaigns.current.in_progress).toBe(true);
    expect(c.campaigns.prior.in_progress).toBe(false);
  });

  it('returns the comparable figures side by side', async () => {
    await pledgeIn(prior, 4000, { is_historical: true, legacy_status: 'fulfilled' });
    await pledgeIn(current, 1000);
    await pledgeIn(current, 3000);

    const c = await compare();
    expect(c.figures.total_pledged.prior).toBe(4000);
    expect(c.figures.total_pledged.current).toBe(4000);
    expect(c.figures.total_collected.prior).toBe(4000);
    expect(c.figures.total_collected.current).toBe(0);
    expect(c.figures.pledge_count.prior).toBe(1);
    expect(c.figures.pledge_count.current).toBe(2);
  });

  it('builds a cumulative pledged curve keyed on day of campaign', async () => {
    await pledgeIn(current, 1000, { created_at: '2026-09-01T12:00:00Z' });
    await pledgeIn(current, 500, { created_at: '2026-09-03T12:00:00Z' });

    const c = await compare();
    expect(c.pledging_curve.current).toEqual([
      { day: 1, cumulative_pledged: 1000 },
      { day: 3, cumulative_pledged: 1500 }
    ]);
  });

  it('excludes cancelled pledges from the figures and the curve', async () => {
    const doomed = await pledgeIn(current, 9999);
    await doomed.update({ lifecycle: 'cancelled' });

    const c = await compare();
    expect(c.figures.total_pledged.current).toBe(0);
    expect(c.pledging_curve.current).toEqual([]);
  });

  it('400s when the `to` campaign is not supplied', async () => {
    const res = await request(app).get(`/api/pledge-campaigns/${current.id}/compare`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('404s when either campaign does not exist', async () => {
    const res = await request(app)
      .get(`/api/pledge-campaigns/${current.id}/compare?to=999999`);
    expect(res.status).toBe(404);
  });
});
