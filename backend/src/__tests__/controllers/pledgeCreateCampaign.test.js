'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign, Pledge, Member } = require('../../models');
const { createPledge } = require('../../controllers/pledgeController');
const { todayInChurchTz } = require('../../services/pledgeCampaignService');

function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

// Synthetic donor — never a real member.
const body = (overrides = {}) => ({
  amount: 250, first_name: 'Test', last_name: 'Donor', ...overrides
});

// createPledge now runs only behind firebaseAuthMiddleware, which guarantees
// req.user. A bare { body, ip } request can no longer reach it, so the mock
// below carries the member the middleware would have resolved from the
// token. Not truncated by afterEach (only Pledge/PledgeCampaign are), so one
// member fixture serves all three tests.
let pledger;
const mockReq = (overrides = {}) => ({
  body: body(overrides),
  ip: '127.0.0.1',
  user: { id: pledger.id, member_id: pledger.id, roles: ['member'] }
});

beforeAll(async () => {
  await sequelize.sync({ force: true });
  pledger = await Member.create({
    first_name: 'Test',
    last_name: 'Pledger',
    phone_number: '+15550001234',
    email: 'test-pledger@example.test',
    is_active: true,
    role: 'member',
    firebase_uid: 'uid-campaign-binding-pledger'
  });
});
afterEach(async () => {
  await Pledge.destroy({ where: {}, truncate: true, cascade: true });
  await PledgeCampaign.destroy({ where: {}, truncate: true, cascade: true });
});
// Deliberately no sequelize.close() here — see Global Constraints.

describe('POST /api/pledges campaign binding', () => {
  it('attaches the pledge to the live campaign', async () => {
    const live = await PledgeCampaign.create({
      slug: 'live-drive', name: 'Live Drive', status: 'active',
      start_date: todayInChurchTz(), end_date: null
    });

    const res = mockRes();
    await createPledge(mockReq(), res);

    expect(res.statusCode).toBe(201);
    const stored = await Pledge.findByPk(res.payload.pledge.id);
    expect(String(stored.campaign_id)).toBe(String(live.id));
  });

  it('ignores a client-supplied campaign_id', async () => {
    const live = await PledgeCampaign.create({
      slug: 'live-drive', name: 'Live Drive', status: 'active',
      start_date: todayInChurchTz(), end_date: null
    });
    const draft = await PledgeCampaign.create({
      slug: 'draft-drive', name: 'Draft Drive', status: 'draft',
      start_date: '2027-01-01', end_date: '2027-12-31'
    });

    const res = mockRes();
    await createPledge(mockReq({ campaign_id: draft.id }), res);

    const stored = await Pledge.findByPk(res.payload.pledge.id);
    expect(String(stored.campaign_id)).toBe(String(live.id));
  });

  it('refuses the pledge when no campaign is live', async () => {
    await PledgeCampaign.create({
      slug: 'draft-drive', name: 'Draft Drive', status: 'draft',
      start_date: todayInChurchTz(), end_date: null
    });

    const res = mockRes();
    await createPledge(mockReq(), res);

    expect(res.statusCode).toBe(503);
    expect(await Pledge.count()).toBe(0);
  });
});
