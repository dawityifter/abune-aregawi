'use strict';
process.env.NODE_ENV = 'test';

jest.mock('../../models', () => ({
  ExpenseCategory: { findOne: jest.fn(), findAll: jest.fn() },
  LedgerEntry: { findOne: jest.fn() },
  BankTransaction: { findOne: jest.fn() },
  Member: {},
  Employee: {},
  Vendor: {},
  sequelize: { literal: jest.fn() },
}));

const { ExpenseCategory, LedgerEntry, BankTransaction } = require('../../models');
const { getExpenseById } = require('../../controllers/expenseController');

const BANK_ROW = {
  id: 'bt-9',
  date: '2026-08-31',
  description: 'CHECK #1601',
  amount: -125.0,
  type: 'CHECK_PAID',
  check_number: '1601',
  status: 'MATCHED',
  reconciled_source: 'AUTO_CHECK_MATCH',
  reconciled_at: '2026-09-01T10:00:00Z',
};

function mockExpense(overrides = {}) {
  const row = {
    id: 'exp-1', type: 'expense', category: 'EXP100', amount: 125.0,
    entry_date: '2026-08-30', payment_method: 'check', check_number: '1601',
    external_id: 'bankhash-1', ...overrides,
  };
  LedgerEntry.findOne.mockResolvedValue({ ...row, toJSON: () => row });
  return row;
}

async function fetchOne() {
  let payload; let statusCode = 200;
  const res = { json: (p) => { payload = p; }, status: (c) => { statusCode = c; return res; } };
  await getExpenseById({ params: { id: 'exp-1' } }, res);
  return { payload, statusCode };
}

describe('getExpenseById bank reconciliation details', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ExpenseCategory.findOne.mockResolvedValue({ name: 'Utilities', description: 'Power' });
    BankTransaction.findOne.mockResolvedValue(BANK_ROW);
  });

  it('returns the bank transaction the expense was reconciled against', async () => {
    mockExpense();
    const { payload } = await fetchOne();

    expect(payload.data.bank_transaction).toMatchObject({
      id: 'bt-9',
      description: 'CHECK #1601',
      type: 'CHECK_PAID',
      reconciled_source: 'AUTO_CHECK_MATCH',
    });
  });

  it('looks the bank row up by the hash stored on the expense', async () => {
    mockExpense();
    await fetchOne();

    expect(BankTransaction.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { transaction_hash: 'bankhash-1' } })
    );
  });

  it('reports the amounts agreeing, comparing absolute values', async () => {
    mockExpense();
    const { payload } = await fetchOne();

    // The bank stores a debit as negative; the expense stores it positive.
    expect(payload.data.bank_transaction.amount_matches).toBe(true);
  });

  it('flags a disagreement between the expense and the bank', async () => {
    mockExpense({ amount: 205.0 });
    const { payload } = await fetchOne();

    expect(payload.data.bank_transaction.amount_matches).toBe(false);
  });

  it('returns no bank transaction for an unreconciled expense', async () => {
    mockExpense({ external_id: null });
    const { payload } = await fetchOne();

    expect(payload.data.bank_transaction).toBeNull();
    expect(BankTransaction.findOne).not.toHaveBeenCalled();
  });

  it('survives a stale link whose bank row no longer exists', async () => {
    mockExpense();
    BankTransaction.findOne.mockResolvedValue(null);

    const { payload, statusCode } = await fetchOne();

    expect(statusCode).toBe(200);
    expect(payload.data.bank_transaction).toBeNull();
  });
});
