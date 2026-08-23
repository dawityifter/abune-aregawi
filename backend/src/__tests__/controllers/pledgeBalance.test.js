'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign, Pledge, Member } = require('../../models');
const { createPledgeViews } = require('../../database/pledgeViews');
const { getPledgeBalance } = require('../../controllers/pledgeController');
const { todayInChurchTz } = require('../../services/pledgeCampaignService');

function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

let campaign;
let member;
let other;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await createPledgeViews(sequelize.getQueryInterface());
});

beforeEach(async () => {
  await Pledge.destroy({ where: {}, truncate: true, cascade: true });
  await PledgeCampaign.destroy({ where: {}, truncate: true, cascade: true });
  await Member.destroy({ where: {}, truncate: true, cascade: true });

  campaign = await PledgeCampaign.create({
    slug: 'live-drive', name: 'Live Drive', status: 'active',
    start_date: todayInChurchTz(), end_date: null
  });
  // Synthetic members only.
  member = await Member.create({
    first_name: 'Test',
    last_name: 'Pledger',
    phone_number: '+15550000201'
  });
  other = await Member.create({
    first_name: 'Test',
    last_name: 'Other',
    phone_number: '+15550000202'
  });
  await Pledge.create({
    campaign_id: campaign.id, member_id: member.id, amount: 500,
    first_name: 'Test', last_name: 'Pledger'
  });
});
// Deliberately no sequelize.close() here — see Global Constraints.

describe('GET /api/pledges/balance', () => {
  it('returns the caller\'s own pledge without needing a role', async () => {
    const res = mockRes();
    await getPledgeBalance({ query: {}, user: { member_id: member.id, roles: ['member'] } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.pledge.pledged_amount).toBe(500);
    expect(res.payload.pledge.paid_amount).toBe(0);
    expect(res.payload.pledge.remaining_amount).toBe(500);
    expect(res.payload.pledge.campaign_name).toBe('Live Drive');
  });

  it('returns null when the caller has no pledge', async () => {
    const res = mockRes();
    await getPledgeBalance({ query: {}, user: { member_id: other.id, roles: ['member'] } }, res);

    expect(res.payload.pledge).toBeNull();
  });

  it('returns null when no campaign is live', async () => {
    await campaign.update({ status: 'draft' });

    const res = mockRes();
    await getPledgeBalance({ query: {}, user: { member_id: member.id, roles: ['member'] } }, res);

    expect(res.payload.pledge).toBeNull();
  });

  it('refuses another member\'s pledge without a view role', async () => {
    const res = mockRes();
    await getPledgeBalance(
      { query: { member_id: String(member.id) }, user: { member_id: other.id, roles: ['member'] } },
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('allows a treasurer to read another member\'s pledge', async () => {
    const res = mockRes();
    await getPledgeBalance(
      { query: { member_id: String(member.id) }, user: { member_id: other.id, roles: ['treasurer'] } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.payload.pledge.remaining_amount).toBe(500);
  });
});
