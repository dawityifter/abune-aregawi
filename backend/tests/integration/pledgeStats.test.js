const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

describe('GET /api/pledges/stats', () => {
  beforeAll(async () => { await sequelize.sync({ force: true }); });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await Member.destroy({ where: {} });
    await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000002',
      email: 'tess@example.com',
      is_active: true,
      role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    await Pledge.create({
      amount: 500,
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      pledge_type: 'fundraising'
    });
  });

  it('returns aggregates without any donor names to the public', async () => {
    const res = await request(app).get('/api/pledges/stats');
    expect(res.status).toBe(200);
    expect(res.body.stats.total_pledged).toBe(500);
    // No name must appear anywhere in the public payload.
    expect(JSON.stringify(res.body)).not.toContain('Jane');
    expect(res.body.stats.status_breakdown[0].pledges).toBeUndefined();
  });

  it('rejects ?detail=true without authentication', async () => {
    const res = await request(app).get('/api/pledges/stats?detail=true');
    expect(res.status).toBe(401);
  });

  it('returns per-pledge detail to a treasurer', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: 'tess@example.com' });
    const res = await request(app)
      .get('/api/pledges/stats?detail=true')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.stats.status_breakdown[0].pledges[0].name).toBe('Jane Doe');
  });
});
