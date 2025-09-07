const request = require('supertest');

// Configure environment BEFORE requiring app/models
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

// Mock middlewares to simulate authenticated user with permissions (match onboarding tests)
jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  firebaseAuthMiddleware: (req, res, next) => {
    req.firebaseUid = 'test_firebase_uid';
    req.user = req.user || {};
    const actorId = process.env.TEST_ACTOR_ID ? Number(process.env.TEST_ACTOR_ID) : 1;
    req.user.id = actorId;
    next();
  },
}));

jest.mock('../../src/middleware/role', () => {
  return (allowed) => (req, res, next) => {
    req.user = req.user || {};
    req.user.role = 'admin';
    return next();
  };
});

const app = require('../../src/server');
const { sequelize, Member } = require('../../src/models');

describe('Outreach routes', () => {
  let member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    // Create an admin actor used by mocked middlewares
    const admin = await Member.create({
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      phone_number: '+19999999999',
      role: 'admin',
      is_welcomed: true,
    });
    process.env.TEST_ACTOR_ID = String(admin.id);
    member = await Member.create({
      first_name: 'Rel',
      last_name: 'User',
      phone_number: '+15555555555',
      email: 'rel@example.com',
      role: 'member'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('creates an outreach note then marks welcomed', async () => {
    const authHeader = 'Bearer fake-id-token';

    const resCreate = await request(app)
      .post(`/api/members/${member.id}/outreach`)
      .set('Authorization', authHeader)
      .send({ note: 'Called on 9/10; family of 4; will attend Sunday.' });
    expect(resCreate.status).toBe(201);
    expect(resCreate.body.success).toBe(true);
    expect(resCreate.body.data).toHaveProperty('member_id', member.id);

    const resMark = await request(app)
      .post(`/api/members/${member.id}/mark-welcomed`)
      .set('Authorization', authHeader)
      .send();
    expect(resMark.status).toBe(200);

    const refreshed = await Member.findByPk(member.id);
    expect(refreshed.is_active).toBe(true);
    // welcomed flags
    // welcomed_at may be null depending on controller implementation, but is_welcomed should be true
    expect(refreshed.is_welcomed).toBe(true);
  });

  it('validates note length', async () => {
    const authHeader = 'Bearer fake-id-token';

    const resBad = await request(app)
      .post(`/api/members/${member.id}/outreach`)
      .set('Authorization', authHeader)
      .send({ note: '' });
    expect(resBad.status).toBe(400);
  });
});
