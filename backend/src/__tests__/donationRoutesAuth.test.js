process.env.NODE_ENV = 'test';

const request = require('supertest');

// Firebase has to look initialised, or the auth middleware answers 500 for a
// missing-config reason and the test would pass for the wrong one. verifyIdToken
// is never reached here: these requests carry no Authorization header at all.
jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  credential: { cert: jest.fn(), applicationDefault: jest.fn() },
  auth: () => ({
    verifyIdToken: jest.fn().mockRejectedValue(new Error('should not be called')),
  }),
}));

jest.mock('../models', () => {
  const Donation = { findAndCountAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn() };
  const Member = { findByPk: jest.fn(), findOne: jest.fn() };
  const Transaction = { findOne: jest.fn(), create: jest.fn() };
  const LedgerEntry = { findOne: jest.fn(), create: jest.fn() };
  const IncomeCategory = { findOne: jest.fn() };
  const sequelize = {
    authenticate: jest.fn().mockResolvedValue(undefined),
    sync: jest.fn().mockResolvedValue(undefined),
    showAllSchemas: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
    transaction: jest.fn(),
  };
  return { Donation, Member, Transaction, LedgerEntry, IncomeCategory, sequelize };
});

const { Donation } = require('../models');
const app = require('../server');

/**
 * These routes were reachable by anyone. `GET /api/donations/` was marked
 * "admin only" in a comment but carried no middleware, and returned every
 * donor's name, email and amount — 121 records in production, with the page
 * size chosen by the caller. donationRoutes.js was the only financial router
 * with no router.use(firebaseAuthMiddleware).
 *
 * Asserting the model was never touched is the point: a 401 alone would not
 * prove the rows stayed in the database.
 */
describe('donation records are not publicly readable', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refuses an anonymous request for the donation list', async () => {
    const res = await request(app).get('/api/donations/');

    expect(res.status).toBe(401);
    expect(Donation.findAndCountAll).not.toHaveBeenCalled();
  });

  it('refuses an anonymous request for a single donation', async () => {
    const res = await request(app).get('/api/donations/1');

    expect(res.status).toBe(401);
    expect(Donation.findByPk).not.toHaveBeenCalled();
  });

  it('refuses a request carrying a junk bearer token', async () => {
    const res = await request(app)
      .get('/api/donations/')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(Donation.findAndCountAll).not.toHaveBeenCalled();
  });

  // The other half of the fix: an anonymous giver has no token when they reach
  // the payment form, so locking the whole router would have silently ended
  // walk-up giving. A 400 here is the validator rejecting an empty body, which
  // means the request got *past* auth — exactly what must stay true.
  it('still lets an anonymous giver reach the payment form', async () => {
    const res = await request(app).post('/api/donations/create-payment-intent').send({});

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(400);
  });

  it('still lets an anonymous giver reach payment confirmation', async () => {
    const res = await request(app).post('/api/donations/confirm-payment').send({});

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
