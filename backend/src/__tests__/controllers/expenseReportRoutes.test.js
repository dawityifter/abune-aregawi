'use strict';

/**
 * The expense report routes must sit behind the SAME gate as the expense list
 * they summarize — no separate authorization mechanism, and no role that can
 * read aggregated spending without being able to read the expenses themselves.
 *
 * Also pins the route ordering: '/report' and '/report/transactions' have to be
 * registered above '/:id', or that route swallows them as an expense lookup and
 * the report 404s with "Expense not found".
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';

const express = require('express');
const request = require('supertest');

// The role under test is injected per request; the auth middleware itself is
// exercised elsewhere.
// Jest requires the `mock` prefix to reference this from a mock factory.
let mockUser = null;
jest.mock('../../middleware/auth', () => ({
  firebaseAuthMiddleware: (req, res, next) => {
    if (!mockUser) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    req.user = mockUser;
    next();
  }
}));

jest.mock('../../services/expenseReportService', () => ({
  buildExpenseReport: jest.fn(),
  listExpenseReportTransactions: jest.fn()
}));

const expenseRoutes = require('../../routes/expenseRoutes');
const { buildExpenseReport, listExpenseReportTransactions } = require('../../services/expenseReportService');

const app = express();
app.use(express.json());
app.use('/api/expenses', expenseRoutes);

const as = (role) => { mockUser = { id: 1, role, roles: [role] }; };

// The project's jest config resets mock implementations between tests, so the
// service stubs are re-armed here rather than in the mock factory.
beforeEach(() => {
  mockUser = null;
  jest.clearAllMocks();
  buildExpenseReport.mockResolvedValue({ summary: { total: 0 } });
  listExpenseReportTransactions.mockResolvedValue({
    rows: [],
    total: 0,
    pagination: { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 50 }
  });
});

// Deliberately no sequelize.close() here — global teardown owns the connection.

describe('expense report authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/expenses/report');
    expect(res.status).toBe(401);
    expect(buildExpenseReport).not.toHaveBeenCalled();
  });

  // The exact list on expenseRoutes' viewRoles — the report must not widen it.
  it.each([
    'admin', 'treasurer', 'church_leadership', 'secretary',
    'bookkeeper', 'auditor', 'budget_committee', 'ap_team'
  ])('allows %s, who can already view expenses', async (role) => {
    as(role);
    const res = await request(app).get('/api/expenses/report');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it.each(['member', 'guest', 'relationship_department'])(
    'denies %s, who cannot view expenses',
    async (role) => {
      as(role);
      const res = await request(app).get('/api/expenses/report');
      expect(res.status).toBe(403);
      expect(buildExpenseReport).not.toHaveBeenCalled();
    }
  );

  it('gates the drill-down the same way as the report', async () => {
    as('member');
    expect((await request(app).get('/api/expenses/report/transactions')).status).toBe(403);

    as('treasurer');
    expect((await request(app).get('/api/expenses/report/transactions')).status).toBe(200);
  });
});

describe('expense report routing', () => {
  it("does not let '/:id' swallow '/report'", async () => {
    as('treasurer');
    const res = await request(app).get('/api/expenses/report');
    expect(res.status).toBe(200);
    expect(buildExpenseReport).toHaveBeenCalledTimes(1);
  });

  it('passes the filter query through to the service untouched', async () => {
    as('treasurer');
    await request(app).get('/api/expenses/report').query({
      year: '2026',
      start_date: '2026-08-01',
      end_date: '2026-08-31',
      gl_code: 'EXP102',
      payee: 'ABC',
      payment_method: 'check',
      source: 'ledger',
      status: 'matched'
    });

    expect(buildExpenseReport).toHaveBeenCalledWith(expect.objectContaining({
      year: '2026',
      start_date: '2026-08-01',
      end_date: '2026-08-31',
      gl_code: 'EXP102',
      payee: 'ABC',
      payment_method: 'check',
      source: 'ledger',
      status: 'matched'
    }));
  });

  it('returns the drill-down rows, total and pagination', async () => {
    as('treasurer');
    const res = await request(app)
      .get('/api/expenses/report/transactions')
      .query({ year: '2026', month: '2026-08', gl_code: 'EXP102' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: [], total: 0 });
    expect(res.body.pagination).toBeDefined();
    expect(listExpenseReportTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ month: '2026-08', gl_code: 'EXP102' })
    );
  });

  it('surfaces a service failure as a 500 rather than a partial report', async () => {
    as('treasurer');
    buildExpenseReport.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/api/expenses/report');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
