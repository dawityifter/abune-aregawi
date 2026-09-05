'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign, Member } = require('../../models');
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

// A campaign is only *live* when it is active AND today sits inside its window
// (services/pledgeCampaignService.isLive). So flipping a long-finished drive
// back to 'active' changes the admin list and nothing else: the pledge page
// still reports no campaign and the header link stays hidden. That silent
// no-op is what these tests refuse.
describe('reactivating a closed campaign', () => {
  // A real member row: update() writes an ActivityLog whose user_id is a
  // foreign key into members, and these cases are the first here that get far
  // enough to reach it.
  let actor;
  beforeAll(async () => {
    actor = await Member.create({
      first_name: 'Campaign', last_name: 'Admin',
      phone_number: '+15550000902', is_active: true, role: 'admin'
    });
  });

  const adminReq = (body, params = {}) => ({ body, params, user: { id: actor.id }, ip: '127.0.0.1' });

  const shiftDays = (isoDate, days) => {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const today = () => todayInChurchTz();

  it('reactivates a closed campaign whose window still contains today', async () => {
    const closed = await PledgeCampaign.create({
      slug: 'closed-early', name: 'Closed Early', status: 'closed',
      start_date: shiftDays(today(), -10), end_date: shiftDays(today(), 30)
    });

    const res = mockRes();
    await update(adminReq({ status: 'active' }, { id: String(closed.id) }), res);

    expect(res.statusCode).toBe(200);
    await closed.reload();
    expect(closed.status).toBe('active');
  });

  it('reactivates a closed campaign that has no end date', async () => {
    const closed = await PledgeCampaign.create({
      slug: 'open-ended', name: 'Open Ended', status: 'closed',
      start_date: shiftDays(today(), -10), end_date: null
    });

    const res = mockRes();
    await update(adminReq({ status: 'active' }, { id: String(closed.id) }), res);

    expect(res.statusCode).toBe(200);
    await closed.reload();
    expect(closed.status).toBe('active');
  });

  it('refuses to reactivate a campaign whose window has already passed', async () => {
    const stale = await PledgeCampaign.create({
      slug: 'last-year', name: 'Last Year Drive', status: 'closed',
      start_date: shiftDays(today(), -400), end_date: shiftDays(today(), -30)
    });

    const res = mockRes();
    await update(adminReq({ status: 'active' }, { id: String(stale.id) }), res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('CAMPAIGN_WINDOW_PASSED');
    await stale.reload();
    expect(stale.status).toBe('closed');
  });

  // The same guard must not fire on a stale draft either: activating one has
  // exactly the same invisible result.
  it('refuses to activate a draft whose window has already passed', async () => {
    const stale = await PledgeCampaign.create({
      slug: 'stale-draft', name: 'Stale Draft', status: 'draft',
      start_date: shiftDays(today(), -400), end_date: shiftDays(today(), -30)
    });

    const res = mockRes();
    await update(adminReq({ status: 'active' }, { id: String(stale.id) }), res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('CAMPAIGN_WINDOW_PASSED');
  });

  // Reactivating together with a new window is the documented repair, so the
  // guard has to read the resulting dates rather than the stored ones.
  it('reactivates when the same request also extends the window', async () => {
    const stale = await PledgeCampaign.create({
      slug: 'extend-me', name: 'Extend Me', status: 'closed',
      start_date: shiftDays(today(), -400), end_date: shiftDays(today(), -30)
    });

    const res = mockRes();
    await update(
      adminReq({ status: 'active', end_date: shiftDays(today(), 30) }, { id: String(stale.id) }),
      res
    );

    expect(res.statusCode).toBe(200);
    await stale.reload();
    expect(stale.status).toBe('active');
  });

  // The guard is scoped to transitions INTO active. Without that scoping an
  // admin could no longer fix an already-active expired drive — including
  // PATCHing the very dates that would repair it.
  it('still lets an admin extend an already-active campaign whose window passed', async () => {
    const expired = await PledgeCampaign.create({
      slug: 'expired-active', name: 'Expired Active', status: 'active',
      start_date: shiftDays(today(), -400), end_date: shiftDays(today(), -30)
    });

    const res = mockRes();
    await update(
      adminReq({ end_date: shiftDays(today(), 30) }, { id: String(expired.id) }),
      res
    );

    expect(res.statusCode).toBe(200);
    await expired.reload();
    expect(expired.end_date).toBe(shiftDays(today(), 30));
  });
});
