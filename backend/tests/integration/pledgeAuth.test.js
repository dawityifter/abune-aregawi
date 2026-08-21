const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

describe('Pledge route authorization', () => {
  let memberUser, treasurerUser, pledge;

  beforeAll(async () => { await sequelize.sync({ force: true }); });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await Member.destroy({ where: {} });

    memberUser = await Member.create({
      first_name: 'Plain',
      last_name: 'Member',
      phone_number: '+15550000001',
      email: 'plain@example.com',
      is_active: true,
      role: 'member',
      firebase_uid: 'uid-member'
    });
    treasurerUser = await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000002',
      email: 'tess@example.com',
      is_active: true,
      role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    pledge = await Pledge.create({
      amount: 500,
      first_name: 'Anon',
      last_name: 'Pledger',
      email: 'anon@example.com',
      pledge_type: 'fundraising'
    });
  });

  it('rejects unauthenticated listing of pledges', async () => {
    const res = await request(app).get('/api/pledges');
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated pledge updates', async () => {
    const res = await request(app).put(`/api/pledges/${pledge.id}`).send({ notes: 'hacked' });
    expect(res.status).toBe(401);
  });

  it('rejects a plain member listing all pledges', async () => {
    setVerifyTokenPayload({ uid: 'uid-member', email: memberUser.email });
    const res = await request(app).get('/api/pledges').set('Authorization', 'Bearer t');
    expect(res.status).toBe(403);
  });

  it('allows a treasurer to list pledges', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurerUser.email });
    const res = await request(app).get('/api/pledges').set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('still allows an unauthenticated visitor to create a pledge', async () => {
    const res = await request(app).post('/api/pledges').send({
      amount: 250,
      first_name: 'Visitor',
      last_name: 'Guest',
      email: 'visitor@example.com'
    });
    expect(res.status).toBe(201);
  });
});
