'use strict';

const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, PledgeCampaign, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

describe('POST /api/pledges requires a signed-in member', () => {
  let campaign, pledger, treasurer, otherMember;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });
    pledger = await Member.create({
      first_name: 'Selam',
      last_name: 'Pledger',
      phone_number: '+15550000301',
      email: 'selam@example.test', is_active: true, role: 'member',
      firebase_uid: 'uid-pledger'
    });
    treasurer = await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000302',
      email: 'tess@example.test', is_active: true, role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    otherMember = await Member.create({
      first_name: 'Other',
      last_name: 'Person',
      phone_number: '+15550000303',
      email: 'other@example.test', is_active: true, role: 'member',
      firebase_uid: 'uid-other'
    });
  });

  const body = (extra = {}) => ({
    amount: 500, first_name: 'Selam', last_name: 'Pledger', ...extra
  });

  it('rejects an unauthenticated pledge', async () => {
    const res = await request(app).post('/api/pledges').send(body());
    expect(res.status).toBe(401);
  });

  it('links the pledge to the caller resolved from their token', async () => {
    setVerifyTokenPayload({ uid: 'uid-pledger', email: pledger.email });
    const res = await request(app).post('/api/pledges')
      .set('Authorization', 'Bearer t').send(body());

    expect(res.status).toBe(201);
    const pledge = await Pledge.findByPk(res.body.pledge.id);
    expect(String(pledge.member_id)).toBe(String(pledger.id));
    expect(pledge.fulfillment_intent).toBe('later');
  });

  it('ignores a member_id supplied by an ordinary member', async () => {
    setVerifyTokenPayload({ uid: 'uid-pledger', email: pledger.email });
    const res = await request(app).post('/api/pledges')
      .set('Authorization', 'Bearer t')
      .send(body({ member_id: otherMember.id }));

    expect(res.status).toBe(201);
    const pledge = await Pledge.findByPk(res.body.pledge.id);
    expect(String(pledge.member_id)).toBe(String(pledger.id));
  });

  it('honors a member_id supplied by a treasurer pledging on behalf', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const res = await request(app).post('/api/pledges')
      .set('Authorization', 'Bearer t')
      .send(body({ member_id: otherMember.id, first_name: 'Other', last_name: 'Person' }));

    expect(res.status).toBe(201);
    const pledge = await Pledge.findByPk(res.body.pledge.id);
    expect(String(pledge.member_id)).toBe(String(otherMember.id));
  });

  it('refuses an anonymous pledge for later fulfillment', async () => {
    setVerifyTokenPayload({ uid: 'uid-pledger', email: pledger.email });
    const res = await request(app).post('/api/pledges')
      .set('Authorization', 'Bearer t')
      .send(body({ is_anonymous: true }));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/paid at the same time/i);
  });
});
