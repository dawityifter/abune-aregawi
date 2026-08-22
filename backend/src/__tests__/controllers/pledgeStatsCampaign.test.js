'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign, Pledge } = require('../../models');
const { createPledgeViews } = require('../../database/pledgeViews');
const { getPledgeStats } = require('../../controllers/pledgeController');

function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

let campaignA;
let campaignB;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  // getPledgeStats reads the pledge_balances VIEW, which sync() does not
  // create — PledgeBalance.sync is a deliberate no-op. Without this the suite
  // fails with "no such table: pledge_balances".
  await createPledgeViews(sequelize.getQueryInterface());

  campaignA = await PledgeCampaign.create({
    slug: 'drive-a', name: 'Drive A', status: 'active',
    start_date: '2026-01-01', end_date: '2026-12-31'
  });
  campaignB = await PledgeCampaign.create({
    slug: 'drive-b', name: 'Drive B', status: 'closed',
    start_date: '2025-01-01', end_date: '2025-12-31'
  });

  // Synthetic donors only — never real member names.
  await Pledge.create({
    campaign_id: campaignA.id, amount: 300, first_name: 'Test', last_name: 'DonorOne'
  });
  await Pledge.create({
    campaign_id: campaignB.id, amount: 700, first_name: 'Test', last_name: 'DonorTwo'
  });
});

// Deliberately no sequelize.close() here — see Global Constraints.

describe('GET /api/pledges/stats?campaign_id=', () => {
  it('totals only the requested campaign', async () => {
    const res = mockRes();
    await getPledgeStats({ query: { campaign_id: String(campaignA.id) } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.stats.total_pledged).toBe(300);
  });

  it('totals every campaign when campaign_id is omitted', async () => {
    const res = mockRes();
    await getPledgeStats({ query: {} }, res);

    expect(res.payload.stats.total_pledged).toBe(1000);
  });

  it('returns zeroed totals for a campaign with no pledges', async () => {
    const empty = await PledgeCampaign.create({
      slug: 'drive-c', name: 'Drive C', status: 'draft',
      start_date: '2027-01-01', end_date: '2027-12-31'
    });

    const res = mockRes();
    await getPledgeStats({ query: { campaign_id: String(empty.id) } }, res);

    expect(res.payload.stats.total_pledged).toBe(0);
    expect(res.payload.stats.status_breakdown).toEqual([]);
  });
});

describe('detail rows for the donor list', () => {
  it('carries per-donor paid and remaining amounts, not just the pledged total', async () => {
    const res = mockRes();
    await getPledgeStats(
      { query: { campaign_id: String(campaignA.id), detail: 'true' } },
      res
    );

    const rows = res.payload.stats.status_breakdown.flatMap((s) => s.pledges || []);
    expect(rows).toHaveLength(1);
    // Without these the UI can show who pledged but not who actually paid.
    expect(rows[0]).toMatchObject({
      amount: 300,
      paid_amount: 0,
      remaining_amount: 300
    });
    expect(rows[0].name).toBe('Test DonorOne');
  });

  it('omits donor rows entirely when detail is not requested', async () => {
    const res = mockRes();
    await getPledgeStats({ query: { campaign_id: String(campaignA.id) } }, res);

    // Donor names are member PII — the public tracker must never receive them.
    expect(res.payload.stats.status_breakdown[0].pledges).toBeUndefined();
    expect(res.payload.stats.recent_pledges).toBeUndefined();
  });
});
