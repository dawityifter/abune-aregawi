const request = require('supertest');

// Mock auth and role middlewares to simulate an authenticated relationship/admin user
jest.mock('../../src/middleware/auth', () => ({
  // We won't use JWT middleware here
  authMiddleware: (req, res, next) => next(),
  // Simulate firebase auth by attaching a firebaseUid and a user object
  firebaseAuthMiddleware: (req, res, next) => {
    req.firebaseUid = 'test_firebase_uid';
    req.user = req.user || {};
    // Use TEST_ACTOR_ID if provided (set by tests after seeding)
    const actorId = process.env.TEST_ACTOR_ID ? Number(process.env.TEST_ACTOR_ID) : 1;
    req.user.id = actorId;
    next();
  },
}));

jest.mock('../../src/middleware/role', () => {
  return (allowed) => (req, res, next) => {
    // Simulate a user with the highest permission for these tests
    req.user = req.user || {};
    req.user.role = 'admin';
    return next();
  };
});

const app = require('../../src/server');
const { Member, sequelize } = require('../../src/models');

describe('Onboarding (Pending Welcomes and Mark Welcomed)', () => {
  let members = [];

  beforeAll(async () => {
    // Ensure DB is available
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await Member.destroy({ where: {} });
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

    // Seed: two pending, one already welcomed
    members = await Member.bulkCreate([
      {
        first_name: 'Alpha',
        last_name: 'User',
        email: 'alpha@example.com',
        phone_number: '+10000000001',
        role: 'member',
        is_welcomed: false,
        welcomed_at: null,
        welcomed_by: null,
      },
      {
        first_name: 'Beta',
        last_name: 'User',
        email: 'beta@example.com',
        phone_number: '+10000000002',
        role: 'member',
        is_welcomed: false,
        welcomed_at: null,
        welcomed_by: null,
      },
      {
        first_name: 'Welcomed',
        last_name: 'Member',
        email: 'welcomed@example.com',
        phone_number: '+10000000003',
        role: 'member',
        is_welcomed: true,
        welcomed_at: new Date(),
        welcomed_by: null,
      },
    ], { returning: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('GET /api/members/onboarding/pending returns only unwelcomed members', async () => {
    const res = await request(app)
      .get('/api/members/onboarding/pending')
      .set('Authorization', 'Bearer fake-id-token') // satisfied by mocked firebaseAuthMiddleware
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    const list = res.body.data?.members || res.body.data || [];
    expect(Array.isArray(list)).toBe(true);
    // Should include 2 pending
    const emails = list.map((m) => m.email).sort();
    expect(emails).toEqual(['alpha@example.com', 'beta@example.com']);
  });

  test('POST /api/members/:id/mark-welcomed marks a member and excludes from pending', async () => {
    const target = members.find((m) => m.email === 'alpha@example.com');

    const markRes = await request(app)
      .post(`/api/members/${encodeURIComponent(target.id)}/mark-welcomed`)
      .set('Authorization', 'Bearer fake-id-token')
      .expect(200);

    expect(markRes.body).toHaveProperty('success', true);

    const updated = await Member.findByPk(target.id);
    expect(updated.is_welcomed).toBe(true);
    expect(updated.welcomed_at).not.toBeNull();
    expect(updated.welcomed_by).not.toBeNull();

    const pendingRes = await request(app)
      .get('/api/members/onboarding/pending')
      .set('Authorization', 'Bearer fake-id-token')
      .expect(200);
    const list = pendingRes.body.data?.members || pendingRes.body.data || [];
    const emails = list.map((m) => m.email).sort();
    expect(emails).toEqual(['beta@example.com']);
  });
});
