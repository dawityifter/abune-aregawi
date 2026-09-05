const request = require('supertest');

// Configure environment BEFORE requiring app/models
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  firebaseAuthMiddleware: (req, res, next) => {
    req.firebaseUid = 'test_firebase_uid';
    req.user = req.user || {};
    req.user.id = 1;
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

describe('GET /api/members/search — cross-field name matching', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    // Create an admin member so the mocked user ID (1) resolves to a real record
    await Member.create({
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      phone_number: '+19999999999',
      role: 'admin',
    });
  });

  beforeEach(async () => {
    await Member.destroy({ where: {}, truncate: false });
    await Member.create({
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      phone_number: '+19999999999',
      role: 'admin',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('returns member when searching "FirstName L" (first name + last name initial)', async () => {
    await Member.create({
      first_name: 'Dawit',
      last_name: 'Yifter',
      phone_number: '+15550000001',
      email: 'dawit@example.com',
      role: 'member',
    });

    const res = await request(app)
      .get('/api/members/search?q=Dawit+Y')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    expect(res.body.success).toBe(true);
    const names = res.body.data.results.map(r => r.name);
    expect(names).toContain('Dawit Yifter');
  });

  test('does not return unrelated members for a cross-field query', async () => {
    await Member.bulkCreate([
      {
        first_name: 'Dawit',
        last_name: 'Yifter',
        phone_number: '+15550000001',
        email: 'dawit@example.com',
        role: 'member',
      },
      {
        first_name: 'Miriam',
        last_name: 'Tesfaye',
        phone_number: '+15550000002',
        email: 'miriam@example.com',
        role: 'member',
      },
    ]);

    const res = await request(app)
      .get('/api/members/search?q=Dawit+Y')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    const names = res.body.data.results.map(r => r.name);
    expect(names).toContain('Dawit Yifter');
    expect(names).not.toContain('Miriam Tesfaye');
  });

  test('still returns a member by single-word token search', async () => {
    await Member.create({
      first_name: 'Solomon',
      last_name: 'Girma',
      phone_number: '+15550000003',
      email: 'solomon@example.com',
      role: 'member',
    });

    const res = await request(app)
      .get('/api/members/search?q=Solomon')
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    const names = res.body.data.results.map(r => r.name);
    expect(names).toContain('Solomon Girma');
  });

  test('returns 400 when query is shorter than 3 characters', async () => {
    const res = await request(app)
      .get('/api/members/search?q=Da')
      .set('Authorization', 'Bearer fake-token')
      .expect(400);

    expect(res.body.success).toBe(false);
  });
});
