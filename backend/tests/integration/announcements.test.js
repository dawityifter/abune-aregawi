const request = require('supertest');

// Configure environment BEFORE requiring app/models
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => next(),
  firebaseAuthMiddleware: (req, res, next) => {
    req.user = { id: process.env.TEST_ACTOR_ID ? Number(process.env.TEST_ACTOR_ID) : null, role: 'relationship', roles: ['relationship'] };
    next();
  },
}));

jest.mock('../../src/middleware/role', () => {
  return (allowed) => (req, res, next) => {
    req.user = req.user || {};
    req.user.role = 'relationship';
    return next();
  };
});

const app = require('../../src/server');
const { sequelize, Announcement, ChurchSetting, Member } = require('../../src/models');

beforeAll(async () => {
  await sequelize.sync({ force: true });
  // Create actor referenced by auth mock (id must exist for FK constraint)
  const actor = await Member.create({
    first_name: 'Test', last_name: 'Actor',
    phone_number: '+19999999999', email: 'actor@test.com', role: 'relationship'
  });
  process.env.TEST_ACTOR_ID = String(actor.id);
});

describe('Announcement API', () => {
  beforeEach(async () => {
    await Announcement.destroy({ where: {} });
  });

  it('POST /api/announcements creates an announcement', async () => {
    const res = await request(app).post('/api/announcements').send({
      title: 'Test', description: '<p>Hello</p>', start_date: '2026-01-01', end_date: '2099-12-31'
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Test');
    expect(res.body.data.status).toBe('active');
  });

  it('GET /api/announcements/active returns only date-valid active announcements', async () => {
    const { v4: uuidv4 } = require('uuid');
    await Announcement.create({ id: uuidv4(), title: 'Active', start_date: '2026-01-01', end_date: '2099-12-31', status: 'active' });
    await Announcement.create({ id: uuidv4(), title: 'Expired', start_date: '2020-01-01', end_date: '2020-12-31', status: 'active' });
    const res = await request(app).get('/api/announcements/active');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe('Active');
  });

  it('PATCH /api/announcements/:id/cancel soft-cancels the announcement', async () => {
    const { v4: uuidv4 } = require('uuid');
    const ann = await Announcement.create({ id: uuidv4(), title: 'ToCancel', start_date: '2026-01-01', end_date: '2099-12-31', status: 'active' });
    const res = await request(app).patch(`/api/announcements/${ann.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    const reloaded = await Announcement.findByPk(ann.id);
    expect(reloaded.status).toBe('cancelled');
  });

  it('GET /api/announcements?status=cancelled returns only cancelled', async () => {
    const { v4: uuidv4 } = require('uuid');
    await Announcement.create({ id: uuidv4(), title: 'Active', start_date: '2026-01-01', end_date: '2099-12-31', status: 'active' });
    await Announcement.create({ id: uuidv4(), title: 'Cancelled', start_date: '2026-01-01', end_date: '2099-12-31', status: 'cancelled' });
    const res = await request(app).get('/api/announcements?status=cancelled');
    expect(res.status).toBe(200);
    expect(res.body.data.every((a) => a.status === 'cancelled')).toBe(true);
  });
});

describe('Church Settings API', () => {
  beforeAll(async () => {
    await ChurchSetting.upsert({ key: 'tv_rotation_interval_seconds', value: '30' });
  });

  it('GET /api/settings/tv-rotation-interval returns default 30', async () => {
    const res = await request(app).get('/api/settings/tv-rotation-interval');
    expect(res.status).toBe(200);
    expect(res.body.data.seconds).toBe(30);
  });

  it('PUT /api/settings/tv-rotation-interval updates the value', async () => {
    const res = await request(app).put('/api/settings/tv-rotation-interval').send({ seconds: 45 });
    expect(res.status).toBe(200);
    expect(res.body.data.seconds).toBe(45);
    const setting = await ChurchSetting.findByPk('tv_rotation_interval_seconds');
    expect(setting.value).toBe('45');
  });

  it('PUT /api/settings/tv-rotation-interval rejects value < 5', async () => {
    const res = await request(app).put('/api/settings/tv-rotation-interval').send({ seconds: 2 });
    expect(res.status).toBe(400);
  });
});
