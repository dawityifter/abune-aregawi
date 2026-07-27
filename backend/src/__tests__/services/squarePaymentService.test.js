const { sequelize, SquarePayment, Member, Transaction, LedgerEntry } = require('../../models');
const {
  upsertSquarePayment,
  createSquareTransaction
} = require('../../services/squarePaymentService');

let collector;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  collector = await Member.create({
    first_name: 'Col', last_name: 'Lector', phone_number: '+15550000001', role: 'treasurer'
  });
});
afterAll(async () => {
  // The global Jest teardown (tests/setup.js) also closes this shared
  // sqlite in-memory connection after every test file; guard against the
  // resulting double-close (SQLITE_MISUSE) the same way it does.
  try { await sequelize.close(); } catch (e) { /* already closed by global teardown */ }
});

function completedPayment(id, over = {}) {
  return {
    id, status: 'COMPLETED', location_id: 'LOC1',
    created_at: '2026-07-26T12:00:00Z',
    amount_money: { amount: 4000, currency: 'USD' },
    ...over
  };
}

describe('upsertSquarePayment', () => {
  it('inserts a COMPLETED payment as NEEDS_REVIEW and is idempotent', async () => {
    const first = await upsertSquarePayment(completedPayment('sqpmt_A'));
    expect(first.created).toBe(true);
    expect(first.row.status).toBe('NEEDS_REVIEW');

    const second = await upsertSquarePayment(completedPayment('sqpmt_A'));
    expect(second.created).toBe(false);
    const count = await SquarePayment.count({ where: { square_payment_id: 'sqpmt_A' } });
    expect(count).toBe(1);
  });

  it('skips non-COMPLETED payments', async () => {
    const res = await upsertSquarePayment(completedPayment('sqpmt_PENDING', { status: 'PENDING' }));
    expect(res.row).toBeNull();
    const count = await SquarePayment.count({ where: { square_payment_id: 'sqpmt_PENDING' } });
    expect(count).toBe(0);
  });
});

describe('createSquareTransaction', () => {
  it('creates a credit_card Transaction + LedgerEntry keyed by square: external_id', async () => {
    const member = await Member.create({
      first_name: 'Mem', last_name: 'Ber', phone_number: '+15550000002', role: 'member'
    });
    const res = await createSquareTransaction({
      square_payment_id: 'sqpmt_TX',
      amount: 40.00,
      payment_date: '2026-07-26',
      note: 'donation',
      member_id: member.id,
      payment_type: 'donation'
    }, collector.id);

    expect(res.success).toBe(true);
    const tx = await Transaction.findByPk(res.id);
    expect(tx.payment_method).toBe('credit_card');
    expect(tx.external_id).toBe('square:sqpmt_TX');
    const ledger = await LedgerEntry.findOne({ where: { transaction_id: tx.id } });
    expect(ledger).toBeTruthy();
  });

  it('is insert-only: a duplicate square_payment_id returns EXISTS', async () => {
    const res = await createSquareTransaction({
      square_payment_id: 'sqpmt_TX',
      amount: 40.00,
      payment_date: '2026-07-26',
      payment_type: 'donation'
    }, collector.id);
    expect(res.success).toBe(false);
    expect(res.code).toBe('EXISTS');
  });
});
