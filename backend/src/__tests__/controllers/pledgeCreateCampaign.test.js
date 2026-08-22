'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign, Pledge } = require('../../models');
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

beforeAll(async () => { await sequelize.sync({ force: true }); });
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
    await createPledge({ body: body(), ip: '127.0.0.1' }, res);

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
    await createPledge({ body: body({ campaign_id: draft.id }), ip: '127.0.0.1' }, res);

    const stored = await Pledge.findByPk(res.payload.pledge.id);
    expect(String(stored.campaign_id)).toBe(String(live.id));
  });

  it('refuses the pledge when no campaign is live', async () => {
    await PledgeCampaign.create({
      slug: 'draft-drive', name: 'Draft Drive', status: 'draft',
      start_date: todayInChurchTz(), end_date: null
    });

    const res = mockRes();
    await createPledge({ body: body(), ip: '127.0.0.1' }, res);

    expect(res.statusCode).toBe(503);
    expect(await Pledge.count()).toBe(0);
  });
});
