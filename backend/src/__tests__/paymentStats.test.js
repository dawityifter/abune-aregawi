process.env.NODE_ENV = 'test';

const request = require('supertest');

// Mock models
jest.mock('../models', () => {
    const Member = {
        findOne: jest.fn(),
        findAll: jest.fn(),
        findByPk: jest.fn(),
        count: jest.fn(),
    };
    const Dependent = {
        findOne: jest.fn(),
    };
    const Transaction = {
        findAll: jest.fn(),
        sum: jest.fn(),
    };
    const MemberPayment = {
        findOne: jest.fn(),
        count: jest.fn(),
        sum: jest.fn(),
        findAndCountAll: jest.fn(),
    };
    const LedgerEntry = {
        sum: jest.fn(),
        findAll: jest.fn(),
    };
    const Title = {
        findOne: jest.fn(),
    };
    const IncomeCategory = {
        findOne: jest.fn(),
    };

    const sequelize = {
        authenticate: jest.fn().mockResolvedValue(undefined),
        sync: jest.fn().mockResolvedValue(undefined),
        showAllSchemas: jest.fn().mockResolvedValue([]),
        close: jest.fn().mockResolvedValue(undefined),
        define: jest.fn(() => MemberPayment),
    };

    return {
        Member,
        Dependent,
        Transaction,
        MemberPayment,
        LedgerEntry,
        Title,
        IncomeCategory,
        sequelize
    };
});

const app = require('../server');

// These are smoke tests that only verify routes exist and respond
// (auth layer runs before DB, so 401 is acceptable for protected routes)

describe('Payment stats endpoints', () => {
  it('GET /api/payments/stats?year=2025 route exists', async () => {
    const res = await request(app)
      .get('/api/payments/stats?year=2025')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).not.toBe(404);
  });

  it('GET /api/payments/stats?year=abc route exists (invalid year)', async () => {
    const res = await request(app)
      .get('/api/payments/stats?year=abc')
      .set('Authorization', 'Bearer invalid-token');
    // Even if auth rejects first (401), the route must exist (not 404)
    expect(res.status).not.toBe(404);
  });

  it('GET /api/payments/stats/years route exists', async () => {
    const res = await request(app)
      .get('/api/payments/stats/years')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).not.toBe(404);
  });
});
