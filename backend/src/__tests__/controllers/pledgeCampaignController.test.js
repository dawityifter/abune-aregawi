'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign } = require('../../models');
const { listActive } = require('../../controllers/pledgeCampaignController');
const { todayInChurchTz } = require('../../services/pledgeCampaignService');

function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterEach(async () => { await PledgeCampaign.destroy({ where: {}, truncate: true }); });
// Deliberately no sequelize.close() here — see Global Constraints.

describe('GET /api/pledge-campaigns/active', () => {
  it('returns an active campaign whose window contains today', async () => {
    await PledgeCampaign.create({
      slug: 'live-drive', name: 'Live Drive', status: 'active',
      start_date: todayInChurchTz(), end_date: null, goal_amount: 50000
    });

    const res = mockRes();
    await listActive({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.campaigns).toHaveLength(1);
    expect(res.payload.campaigns[0].slug).toBe('live-drive');
  });

  it('returns nothing for an active campaign whose window has passed', async () => {
    await PledgeCampaign.create({
      slug: 'past-drive', name: 'Past Drive', status: 'active',
      start_date: '2020-01-01', end_date: '2020-12-31'
    });

    const res = mockRes();
    await listActive({ query: {} }, res);

    expect(res.payload.campaigns).toEqual([]);
  });

  it('never exposes columns outside the public allow-list', async () => {
    await PledgeCampaign.create({
      slug: 'live-drive', name: 'Live Drive', status: 'active',
      start_date: todayInChurchTz(), end_date: null,
      default_payment_type: 'pledge_drive'
    });

    const res = mockRes();
    await listActive({ query: {} }, res);

    const returned = Object.keys(res.payload.campaigns[0].toJSON
      ? res.payload.campaigns[0].toJSON()
      : res.payload.campaigns[0]);
    expect(returned).not.toContain('default_payment_type');
    expect(returned).not.toContain('income_category_id');
    expect(returned).not.toContain('status');
  });
});

const { create, update } = require('../../controllers/pledgeCampaignController');

describe('campaign overlap enforcement', () => {
  const existingActive = () => PledgeCampaign.create({
    slug: 'existing', name: 'Existing Drive', status: 'active',
    start_date: '2026-01-01', end_date: '2026-06-30'
  });

  // req.user is required because update() writes an ActivityLog on status change.
  const adminReq = (body, params = {}) => ({ body, params, user: { id: 1 }, ip: '127.0.0.1' });

  it('rejects creating a second active campaign over the same dates', async () => {
    await existingActive();

    const res = mockRes();
    await create(adminReq({
      slug: 'clashing', name: 'Clashing Drive', status: 'active',
      start_date: '2026-06-01', end_date: '2026-12-31'
    }), res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('CAMPAIGN_OVERLAP');
    expect(res.payload.message).toContain('Existing Drive');
    expect(await PledgeCampaign.count({ where: { slug: 'clashing' } })).toBe(0);
  });

  it('allows creating a draft campaign over the same dates', async () => {
    await existingActive();

    const res = mockRes();
    await create(adminReq({
      slug: 'next-year', name: 'Next Drive', status: 'draft',
      start_date: '2026-06-01', end_date: '2026-12-31'
    }), res);

    expect(res.statusCode).toBe(201);
  });

  it('rejects activating a draft that overlaps a live campaign', async () => {
    await existingActive();
    const draft = await PledgeCampaign.create({
      slug: 'draft-clash', name: 'Draft Clash', status: 'draft',
      start_date: '2026-02-01', end_date: '2026-03-01'
    });

    const res = mockRes();
    await update(adminReq({ status: 'active' }, { id: String(draft.id) }), res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('CAMPAIGN_OVERLAP');
    await draft.reload();
    expect(draft.status).toBe('draft');
  });

  it('rejects widening an active window until it swallows another live campaign', async () => {
    await existingActive();
    const other = await PledgeCampaign.create({
      slug: 'later', name: 'Later Drive', status: 'active',
      start_date: '2026-07-01', end_date: '2026-08-31'
    });

    const res = mockRes();
    // Moving this one's start back into the existing drive's window.
    await update(adminReq({ start_date: '2026-05-01' }, { id: String(other.id) }), res);

    expect(res.statusCode).toBe(409);
    await other.reload();
    expect(other.start_date).toBe('2026-07-01');
  });

  it('allows editing an active campaign without moving it onto another', async () => {
    const existing = await existingActive();

    const res = mockRes();
    await update(adminReq({ name: 'Renamed Drive' }, { id: String(existing.id) }), res);

    expect(res.statusCode).toBe(200);
    await existing.reload();
    expect(existing.name).toBe('Renamed Drive');
  });
});
