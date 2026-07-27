const { UniqueConstraintError } = require('sequelize');
const { sequelize, SquarePayment, Member, Transaction, LedgerEntry } = require('../../models');
const {
  upsertSquarePayment,
  createSquareTransaction,
  matchSquareBuyer
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

  it('returns EXISTS (not a raw throw) on a concurrent double-confirm race for the same external_id', async () => {
    const member = await Member.create({
      first_name: 'Race', last_name: 'Er', phone_number: '+15550000009', role: 'member'
    });
    const payload = {
      square_payment_id: 'sqpmt_RACE',
      amount: 15.00,
      payment_date: '2026-07-26',
      payment_type: 'donation',
      member_id: member.id
    };
    // Fire both "requests" concurrently: the findOne pre-check in each call
    // races past the other, so the second Transaction.create hits the
    // unique constraint on external_id rather than the up-front EXISTS path.
    const [first, second] = await Promise.all([
      createSquareTransaction(payload, collector.id),
      createSquareTransaction(payload, collector.id)
    ]);
    const outcomes = [first, second];
    const successes = outcomes.filter(r => r.success);
    const exists = outcomes.filter(r => !r.success);
    expect(successes.length).toBe(1);
    expect(exists.length).toBe(1);
    expect(exists[0].code).toBe('EXISTS');
    expect(await Transaction.count({ where: { external_id: 'square:sqpmt_RACE' } })).toBe(1);
  });

  it('translates a SequelizeUniqueConstraintError from Transaction.create into a clean EXISTS response (not a throw)', async () => {
    const member = await Member.create({
      first_name: 'Dup', last_name: 'Licate', phone_number: '+15550000013', role: 'member'
    });
    const winner = await createSquareTransaction({
      square_payment_id: 'sqpmt_MOCK_DUP',
      amount: 20.00,
      payment_date: '2026-07-26',
      payment_type: 'donation',
      member_id: member.id
    }, collector.id);
    expect(winner.success).toBe(true);

    // Force the pre-check to miss (simulating a race) so Transaction.create
    // itself is what raises the unique-constraint violation.
    const findOneSpy = jest.spyOn(Transaction, 'findOne').mockResolvedValueOnce(null);
    const createSpy = jest.spyOn(Transaction, 'create').mockRejectedValueOnce(
      new UniqueConstraintError({ message: 'Validation error', errors: [] })
    );

    const result = await createSquareTransaction({
      square_payment_id: 'sqpmt_MOCK_DUP',
      amount: 20.00,
      payment_date: '2026-07-26',
      payment_type: 'donation',
      member_id: member.id
    }, collector.id);

    findOneSpy.mockRestore();
    createSpy.mockRestore();

    expect(result.success).toBe(false);
    expect(result.code).toBe('EXISTS');
    expect(result.id).toBe(winner.id);
  });
});

describe('matchSquareBuyer — email matching', () => {
  it('matches a single member by a case/whitespace-normalized email (high confidence, auto path)', async () => {
    await Member.create({
      first_name: 'Sol', last_name: 'Oh', phone_number: '+15550000010', role: 'member',
      email: 'sol.oh@example.org'
    });

    const result = await matchSquareBuyer({ buyer_name: null, buyer_email: '  Sol.Oh@Example.ORG  ' });
    expect(result.confidence).toBe('high');
    expect(result.source).toBe('SQUARE_EMAIL');
    expect(result.member_id).toBeTruthy();
  });

  it('does NOT auto-match when two members share the same email (falls through instead of guessing)', async () => {
    const sharedEmail = 'family.shared@example.org';
    await Member.create({
      first_name: 'Fam', last_name: 'One', phone_number: '+15550000011', role: 'member', email: sharedEmail
    });
    await Member.create({
      first_name: 'Fam', last_name: 'Two', phone_number: '+15550000012', role: 'member', email: sharedEmail
    });

    const result = await matchSquareBuyer({ buyer_name: null, buyer_email: sharedEmail });
    expect(result.source).not.toBe('SQUARE_EMAIL');
    expect(result.confidence).not.toBe('high');
  });
});
