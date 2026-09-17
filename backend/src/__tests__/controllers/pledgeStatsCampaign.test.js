'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign, Pledge, PledgeAllocation, Transaction, Member } = require('../../models');
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
    // Lets the UI mark rows whose figures come from legacy_status rather
    // than from real allocations.
    expect(rows[0].is_historical).toBe(false);
  });

  it('omits donor rows entirely when detail is not requested', async () => {
    const res = mockRes();
    await getPledgeStats({ query: { campaign_id: String(campaignA.id) } }, res);

    // Donor names are member PII — the public tracker must never receive them.
    expect(res.payload.stats.status_breakdown[0].pledges).toBeUndefined();
    expect(res.payload.stats.recent_pledges).toBeUndefined();
  });
});

// The donor table shows how each pledge was actually paid, so the row has to
// carry the payment methods behind its collected figure.
describe('payment methods on donor rows', () => {
  let payer;
  let methodPledge;

  let receiptSeq = 0;

  const allocate = async (pledgeId, { method, amount, status = 'succeeded', reverses = null }) => {
    const txn = await Transaction.create({
      member_id: payer.id,
      amount,
      payment_type: 'pledge_drive',
      payment_method: method,
      status,
      payment_date: '2026-03-01',
      collected_by: payer.id,
      // The model requires one on cash and check; harmless on the rest.
      receipt_number: `TEST-${++receiptSeq}`
    });
    return PledgeAllocation.create({
      pledge_id: pledgeId,
      transaction_id: txn.id,
      amount,
      source: 'treasurer_manual',
      allocated_by: payer.id,
      reverses_allocation_id: reverses
    });
  };

  // Mirrors pledgeAllocationService.reverse: a negative row against the SAME
  // transaction, never a negative transaction of its own.
  const reverse = (allocation) => PledgeAllocation.create({
    pledge_id: allocation.pledge_id,
    transaction_id: allocation.transaction_id,
    amount: -Number(allocation.amount),
    source: 'treasurer_manual',
    allocated_by: payer.id,
    reason: 'test reversal',
    reverses_allocation_id: allocation.id
  });

  const rowsFor = async (campaignId) => {
    const res = mockRes();
    await getPledgeStats({ query: { campaign_id: String(campaignId), detail: 'true' } }, res);
    return res.payload.stats.status_breakdown.flatMap((s) => s.pledges || []);
  };

  beforeAll(async () => {
    payer = await Member.create({
      first_name: 'Test', last_name: 'Treasurer',
      phone_number: '+15550000001', email: 'test.treasurer@example.com'
    });
  });

  it('lists every method a pledge was paid with', async () => {
    const campaign = await PledgeCampaign.create({
      slug: 'drive-methods', name: 'Drive Methods', status: 'active',
      start_date: '2026-03-01', end_date: '2026-03-31'
    });
    methodPledge = await Pledge.create({
      campaign_id: campaign.id, amount: 500, first_name: 'Test', last_name: 'DonorMixed'
    });
    await allocate(methodPledge.id, { method: 'zelle', amount: 200 });
    await allocate(methodPledge.id, { method: 'check', amount: 100 });

    const [row] = await rowsFor(campaign.id);
    expect(row.payment_methods.sort()).toEqual(['check', 'zelle']);
  });

  it('does not repeat a method paid more than once', async () => {
    const campaign = await PledgeCampaign.create({
      slug: 'drive-repeat', name: 'Drive Repeat', status: 'active',
      start_date: '2026-04-01', end_date: '2026-04-30'
    });
    const pledge = await Pledge.create({
      campaign_id: campaign.id, amount: 400, first_name: 'Test', last_name: 'DonorRepeat'
    });
    await allocate(pledge.id, { method: 'cash', amount: 50 });
    await allocate(pledge.id, { method: 'cash', amount: 75 });

    const [row] = await rowsFor(campaign.id);
    expect(row.payment_methods).toEqual(['cash']);
  });

  // Allocations are append-only: a correction is a negative reversing row, so
  // a method whose money was taken back must stop being reported as paid.
  it('drops a method whose allocation was fully reversed', async () => {
    const campaign = await PledgeCampaign.create({
      slug: 'drive-reversed', name: 'Drive Reversed', status: 'active',
      start_date: '2026-05-01', end_date: '2026-05-31'
    });
    const pledge = await Pledge.create({
      campaign_id: campaign.id, amount: 400, first_name: 'Test', last_name: 'DonorReversed'
    });
    const original = await allocate(pledge.id, { method: 'check', amount: 120 });
    await reverse(original);
    await allocate(pledge.id, { method: 'zelle', amount: 120 });

    const [row] = await rowsFor(campaign.id);
    expect(row.payment_methods).toEqual(['zelle']);
  });

  // A payment that never settled is not money received.
  it('ignores allocations against a transaction that did not succeed', async () => {
    const campaign = await PledgeCampaign.create({
      slug: 'drive-pending', name: 'Drive Pending', status: 'active',
      start_date: '2026-06-01', end_date: '2026-06-30'
    });
    const pledge = await Pledge.create({
      campaign_id: campaign.id, amount: 400, first_name: 'Test', last_name: 'DonorPending'
    });
    await allocate(pledge.id, { method: 'ach', amount: 90, status: 'pending' });

    const [row] = await rowsFor(campaign.id);
    expect(row.payment_methods).toEqual([]);
  });

  it('gives a pledge with nothing collected an empty list rather than omitting the field', async () => {
    const rows = await rowsFor(campaignA.id);
    expect(rows[0].payment_methods).toEqual([]);
  });

  it('does not attach payment methods when detail is not requested', async () => {
    const res = mockRes();
    await getPledgeStats({ query: { campaign_id: String(campaignA.id) } }, res);

    expect(res.payload.stats.status_breakdown[0].pledges).toBeUndefined();
  });
});
