process.env.NODE_ENV = 'test';
// Read at module load, so it is set before the server is required. Production
// runs a deliberately generous default; the mechanism is what is under test.
process.env.DONATION_RATE_LIMIT_MAX = '2';

const request = require('supertest');

jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  credential: { cert: jest.fn(), applicationDefault: jest.fn() },
  auth: () => ({ verifyIdToken: jest.fn() }),
}));

jest.mock('../models', () => {
  const Donation = { findAndCountAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() };
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

const app = require('../server');

/**
 * The payment form is public by design — anonymous giving needs it — but it
 * sat behind only the global 5000-per-15-minutes limiter while the survey
 * endpoint, which risks far less, had a dedicated cap of 20. A public payment
 * endpoint with a ceiling that high is an invitation to card testing, where
 * stolen card numbers are validated in bulk against whatever form will take
 * them. The cost lands as chargebacks and Stripe account standing.
 */
describe('donation payment endpoints are rate limited', () => {
  it('stops a caller hammering the payment form, without blocking normal use', async () => {
    const post = () => request(app)
      .post('/api/donations/create-payment-intent')
      .send({});

    // Under the cap the request reaches the validator — 400, not 429. This is
    // the half that matters most: a limiter that rejects genuine givers is
    // worse than the abuse it prevents.
    const first = await post();
    const second = await post();
    expect(first.status).toBe(400);
    expect(second.status).toBe(400);

    // Over the cap, refused before any Stripe work happens.
    const third = await post();
    expect(third.status).toBe(429);
    expect(third.body.success).toBe(false);
  });

  it('leaves endpoints outside the giving flow alone', async () => {
    // The limiter is scoped to the payment routes, so an unrelated endpoint
    // must not inherit a cap meant for card-testing defence.
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
