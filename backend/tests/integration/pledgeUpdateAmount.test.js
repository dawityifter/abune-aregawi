'use strict';

const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, PledgeCampaign, ActivityLog, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

describe('PUT /api/pledges/:id amount correction', () => {
  let campaign, treasurer, pledger;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await ActivityLog.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });
    treasurer = await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000401',
      email: 'tess@example.test',
      is_active: true,
      role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    pledger = await Member.create({
      first_name: 'Selam',
      last_name: 'Pledger',
      phone_number: '+15550000402',
      email: 'selam@example.test',
      is_active: true,
      role: 'member',
      firebase_uid: 'uid-pledger'
    });

    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
  });

  const makePledge = (extra = {}) => Pledge.create({
    member_id: pledger.id, campaign_id: campaign.id, amount: 500,
    first_name: 'Selam', last_name: 'Pledger', fulfillment_intent: 'later', ...extra
  });

  it('lets a treasurer correct a mistyped amount', async () => {
    const pledge = await makePledge();

    const res = await request(app)
      .put(`/api/pledges/${pledge.id}`)
      .set('Authorization', 'Bearer t')
      .send({ amount: 1500 });

    expect(res.status).toBe(200);
    await pledge.reload();
    expect(parseFloat(pledge.amount)).toBe(1500);
  });

  it('rejects an amount below the $1.00 minimum', async () => {
    const pledge = await makePledge();

    const res = await request(app)
      .put(`/api/pledges/${pledge.id}`)
      .set('Authorization', 'Bearer t')
      .send({ amount: 0 });

    expect(res.status).toBe(400);
    await pledge.reload();
    expect(parseFloat(pledge.amount)).toBe(500);
  });

  // On a historical row the balances view reads paid_amount from p.amount via
  // legacy_status, so editing the amount silently rewrites recorded giving for
  // a drive that has already closed its books.
  it('refuses to edit the amount of a historical pledge', async () => {
    const pledge = await makePledge({ is_historical: true, legacy_status: 'fulfilled' });

    const res = await request(app)
      .put(`/api/pledges/${pledge.id}`)
      .set('Authorization', 'Bearer t')
      .send({ amount: 2000 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/historical/i);
    await pledge.reload();
    expect(parseFloat(pledge.amount)).toBe(500);
  });

  it('records the previous and new amount in the activity log', async () => {
    const pledge = await makePledge();

    await request(app)
      .put(`/api/pledges/${pledge.id}`)
      .set('Authorization', 'Bearer t')
      .send({ amount: 750 });

    const log = await ActivityLog.findOne({
      where: { entity_type: 'Pledge', entity_id: String(pledge.id) }
    });
    expect(log).not.toBeNull();
    expect(log.details.amount).toEqual({ from: '500.00', to: '750.00' });
  });

  it('leaves the amount alone when the request only cancels the pledge', async () => {
    const pledge = await makePledge();

    const res = await request(app)
      .put(`/api/pledges/${pledge.id}`)
      .set('Authorization', 'Bearer t')
      .send({ lifecycle: 'cancelled' });

    expect(res.status).toBe(200);
    await pledge.reload();
    expect(pledge.lifecycle).toBe('cancelled');
    expect(parseFloat(pledge.amount)).toBe(500);
  });
});
