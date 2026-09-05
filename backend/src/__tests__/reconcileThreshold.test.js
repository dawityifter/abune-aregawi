process.env.NODE_ENV = 'test';

const request = require('supertest');

// Firebase verifies the token and resolves an active admin caller.
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

jest.mock('../models', () => {
  const ChurchSetting = { findByPk: jest.fn(), upsert: jest.fn() };
  const Member = { findOne: jest.fn() };
  const sequelize = {
    authenticate: jest.fn().mockResolvedValue(undefined),
    sync: jest.fn().mockResolvedValue(undefined),
    showAllSchemas: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
    define: jest.fn(),
  };
  return { ChurchSetting, Member, sequelize };
});

const { ChurchSetting, Member } = require('../models');
const app = require('../server');

describe('Reconcile threshold settings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Member.findOne.mockResolvedValue({
      id: 1,
      role: 'admin',
      roles: ['admin'],
      is_active: true,
      firebase_uid: 'staff-uid',
      email: 'admin@test.com',
      phone_number: '+15550001111',
    });
  });

  it('GET returns the default $50 when unset', async () => {
    ChurchSetting.findByPk.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/settings/reconcile-threshold')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.data.dollars).toBe(50);
  });

  it('GET returns the stored value', async () => {
    ChurchSetting.findByPk.mockResolvedValue({ value: '125' });
    const res = await request(app)
      .get('/api/settings/reconcile-threshold')
      .set('Authorization', 'Bearer t');
    expect(res.body.data.dollars).toBe(125);
  });

  it('PUT rejects a negative value without writing', async () => {
    const res = await request(app)
      .put('/api/settings/reconcile-threshold')
      .send({ dollars: -5 })
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(400);
    expect(ChurchSetting.upsert).not.toHaveBeenCalled();
  });

  it('PUT stores a valid value', async () => {
    ChurchSetting.upsert.mockResolvedValue([{}, true]);
    const res = await request(app)
      .put('/api/settings/reconcile-threshold')
      .send({ dollars: 75 })
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.data.dollars).toBe(75);
    expect(ChurchSetting.upsert).toHaveBeenCalledWith({
      key: 'reconcile_threshold_dollars',
      value: '75',
    });
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/settings/reconcile-threshold');
    expect(res.status).toBe(401);
  });
});
