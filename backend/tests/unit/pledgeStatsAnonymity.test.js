'use strict';

const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, PledgeCampaign, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

const namesIn = (body) =>
  body.stats.status_breakdown.flatMap((s) => (s.pledges || []).map((p) => p.name));

describe('anonymity masking in pledge stats', () => {
  let campaign;

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

    await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000701',
      email: 'tess@example.test', is_active: true, role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    await Member.create({
      first_name: 'Sam',
      last_name: 'Secretary',
      phone_number: '+15550000702',
      email: 'sam@example.test', is_active: true, role: 'secretary',
      firebase_uid: 'uid-secretary'
    });

    await Pledge.create({
      amount: 400, first_name: 'Discreet', last_name: 'Donor',
      campaign_id: campaign.id, baptism_name: 'Tesfay',
      is_anonymous: true, fulfillment_intent: 'immediate'
    });
  });

  it('shows the real name to a treasurer', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: 'tess@example.test' });
    const res = await request(app).get('/api/pledges/stats?detail=true')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(namesIn(res.body)).toContain('Discreet Donor');
  });

  it('masks the name from a secretary', async () => {
    setVerifyTokenPayload({ uid: 'uid-secretary', email: 'sam@example.test' });
    const res = await request(app).get('/api/pledges/stats?detail=true')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(namesIn(res.body)).toContain('Anonymous');
    expect(namesIn(res.body)).not.toContain('Discreet Donor');
  });
});
