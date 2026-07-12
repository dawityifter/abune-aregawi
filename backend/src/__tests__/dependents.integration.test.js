process.env.NODE_ENV = 'test';

const request = require('supertest');

// Mock Firebase so the dependents routes' token verification passes and the
// caller resolves to a staff member (authorized by authorizeDependentAccess).
jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  credential: { cert: jest.fn(), applicationDefault: jest.fn() },
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'staff-uid',
      email: 'admin@test.com',
      phone_number: '+15550001111',
    }),
    getUser: jest.fn().mockResolvedValue({ phoneNumber: '+15550001111' }),
  }),
}));

// Mock models used by controllers
jest.mock('../models', () => {
  const Member = {
    findByPk: jest.fn(),
    // authorizeDependentAccess resolves the caller via findOne
    findOne: jest.fn(),
  };
  const Dependent = {
    create: jest.fn(),
    findByPk: jest.fn(),
  };
  // Minimal sequelize stub to satisfy server import
  const sequelize = {
    authenticate: jest.fn().mockResolvedValue(undefined),
    sync: jest.fn().mockResolvedValue(undefined),
    showAllSchemas: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return { Member, Dependent, sequelize };
});

const { Member, Dependent } = require('../models');
const app = require('../server');

describe('Dependents API sanitization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Caller is church staff → authorized to manage any household's dependents
    Member.findOne.mockResolvedValue({ id: 999, role: 'admin', roles: ['admin'] });
  });

  test('POST /api/members/:memberId/dependents coerces empty email to null', async () => {
    Member.findByPk.mockResolvedValue({ id: 1, firstName: 'Head', lastName: 'Member' });
    Dependent.create.mockImplementation(async (payload) => ({ id: 10, ...payload }));

    const res = await request(app)
      .post('/api/members/1/dependents')
      .send({
        firstName: 'Kid',
        lastName: 'Test',
        dateOfBirth: '2015-05-05',
        relationship: 'Son',
        email: '   ',
      })
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer testtoken');

    expect(res.status).toBe(201);
    expect(Dependent.create).toHaveBeenCalled();
    const passed = Dependent.create.mock.calls[0][0];
    expect(passed.email).toBeNull();
    expect(res.body.success).toBe(true);
    expect(res.body.data.dependent.email).toBeNull();
  });

  test('PATCH /api/members/dependents/:dependentId coerces empty email to null', async () => {
    const fakeDependent = {
      id: 42,
      email: 'old@example.com',
      update: jest.fn(async function (updates) {
        Object.assign(this, updates);
        return this;
      }),
    };
    Dependent.findByPk.mockResolvedValue(fakeDependent);

    const res = await request(app)
      .patch('/api/members/dependents/42')
      .send({ email: '' })
      .set('Content-Type', 'application/json')
      .set('Authorization', 'Bearer testtoken');

    expect(res.status).toBe(200);
    expect(Dependent.findByPk).toHaveBeenCalledWith('42');
    expect(fakeDependent.update).toHaveBeenCalled();
    const updates = fakeDependent.update.mock.calls[0][0];
    expect(updates.email).toBeNull();
    expect(res.body.success).toBe(true);
    expect(res.body.data.dependent.email).toBeNull();
  });

  test('rejects unauthenticated dependent access with 401', async () => {
    const res = await request(app)
      .get('/api/members/1/dependents');

    expect(res.status).toBe(401);
    expect(Dependent.findByPk).not.toHaveBeenCalled();
  });

  test('rejects a caller outside the household with 403', async () => {
    // Caller is a plain member in a different family
    Member.findOne.mockResolvedValue({ id: 5, role: 'member', roles: ['member'], family_id: 5 });
    // Target member (id 1) belongs to a different family
    Member.findByPk.mockResolvedValue({ id: 1, family_id: 1 });

    const res = await request(app)
      .get('/api/members/1/dependents')
      .set('Authorization', 'Bearer testtoken');

    expect(res.status).toBe(403);
  });
});
