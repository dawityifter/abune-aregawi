const { sequelize, Member, Transaction } = require('../../models');
const { getAllTransactions } = require('../../controllers/transactionController');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

async function listWith(query) {
  const res = mockRes();
  await getAllTransactions({ query }, res);
  return res;
}

let collector;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  collector = await Member.create({
    first_name: 'Col', last_name: 'Lector', phone_number: '+15550007001', role: 'treasurer'
  });

  const base = {
    collected_by: collector.id,
    payment_date: '2026-07-20',
    amount: 25.0,
    payment_type: 'donation'
  };
  // Square card (external_id 'square:…')
  await Transaction.create({ ...base, payment_method: 'credit_card', external_id: 'square:sq_A' });
  // Stripe card (payment_intent id, no square prefix)
  await Transaction.create({ ...base, payment_method: 'credit_card', external_id: 'pi_stripe_B' });
  // Manually keyed card (no external_id, no donation_id)
  await Transaction.create({ ...base, payment_method: 'credit_card', external_id: null });
  // Non-card row that also has an external_id — must never match a card_source
  await Transaction.create({ ...base, payment_method: 'zelle', external_id: 'zelle:z_C' });
});

afterAll(async () => {
  try { await sequelize.close(); } catch (e) { /* already closed by global teardown */ }
});

describe('getAllTransactions card_source filter', () => {
  it('returns only Square card payments for card_source=square', async () => {
    const res = await listWith({ card_source: 'square' });
    const txns = res.body.data.transactions;
    expect(txns).toHaveLength(1);
    expect(txns[0].external_id).toBe('square:sq_A');
  });

  it('returns only Stripe card payments for card_source=stripe (excludes Square and the zelle row)', async () => {
    const res = await listWith({ card_source: 'stripe' });
    const txns = res.body.data.transactions;
    expect(txns).toHaveLength(1);
    expect(txns[0].external_id).toBe('pi_stripe_B');
  });

  it('returns only manually keyed card payments for card_source=manual', async () => {
    const res = await listWith({ card_source: 'manual' });
    const txns = res.body.data.transactions;
    expect(txns).toHaveLength(1);
    expect(txns[0].external_id).toBeNull();
    expect(txns[0].payment_method).toBe('credit_card');
  });

  it('returns everything when no card_source is passed', async () => {
    const res = await listWith({});
    expect(res.body.data.transactions.length).toBe(4);
  });
});
