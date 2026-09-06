'use strict';
process.env.NODE_ENV = 'test';

jest.mock('../../models', () => ({
  ExpenseCategory: { findAll: jest.fn(), findOne: jest.fn() },
  LedgerEntry: { findAll: jest.fn(), findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Member: {},
  Employee: {},
  Vendor: {},
  sequelize: { transaction: jest.fn() },
}));

const { ExpenseCategory, LedgerEntry, sequelize } = require('../../models');
const { createExpense, updateExpense } = require('../../controllers/expenseController');

const CATEGORY = { gl_code: 'EXP005', name: 'Utilities', description: 'Utility bills' };

let tx;

function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

function mockExpense(overrides = {}) {
  const row = {
    id: 'exp-1',
    payment_method: 'check',
    check_number: '1042',
    amount: 450,
    memo: 'August electric bill',
    employee_id: null,
    vendor_id: null,
    payee_name: null,
    ...overrides,
  };
  row.update = jest.fn(async (data) => Object.assign(row, data));
  return row;
}

beforeEach(() => {
  jest.clearAllMocks();
  tx = { commit: jest.fn(), rollback: jest.fn() };
  sequelize.transaction.mockResolvedValue(tx);
  ExpenseCategory.findOne.mockResolvedValue(CATEGORY);
  LedgerEntry.findOne.mockResolvedValue(null);
  LedgerEntry.create.mockResolvedValue({ id: 'led-1' });
  LedgerEntry.findByPk.mockResolvedValue({ toJSON: () => ({ id: 'led-1' }) });
});

describe('createExpense — voided check', () => {
  const baseBody = {
    gl_code: 'EXP005',
    expense_date: '2026-08-01',
    payment_method: 'check',
    check_number: '1593',
  };

  const invoke = async (body) => {
    const res = mockRes();
    await createExpense({ body, user: { id: 7 } }, res);
    return res;
  };

  it('accepts a $0.00 expense when the memo says the check was voided', async () => {
    const res = await invoke({ ...baseBody, amount: 0, memo: 'Void' });

    expect(res.statusCode).toBe(201);
    expect(LedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0, check_number: '1593', memo: 'Void' }),
      expect.anything()
    );
  });

  it('accepts a void memo that carries the rest of the explanation', async () => {
    const res = await invoke({
      ...baseBody,
      amount: '0.00',
      memo: 'Void - misprinted, reissued as 1594',
    });

    expect(res.statusCode).toBe(201);
    expect(LedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0 }),
      expect.anything()
    );
  });

  it('still rejects a $0.00 expense whose memo does not mark it void', async () => {
    const res = await invoke({ ...baseBody, amount: 0, memo: 'August electric bill' });

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toMatch(/positive number/i);
    expect(LedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalled();
  });

  it('still rejects a $0.00 expense with no memo at all', async () => {
    const res = await invoke({ ...baseBody, amount: 0 });

    expect(res.statusCode).toBe(400);
    expect(LedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects a negative amount even on a void memo', async () => {
    const res = await invoke({ ...baseBody, amount: -5, memo: 'Void' });

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toMatch(/positive number/i);
    expect(LedgerEntry.create).not.toHaveBeenCalled();
  });

  it('still requires a check number on a voided check', async () => {
    const res = await invoke({ ...baseBody, check_number: '', amount: 0, memo: 'Void' });

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toMatch(/check number is required/i);
    expect(LedgerEntry.create).not.toHaveBeenCalled();
  });
});

describe('createExpense — a rejected ledger write must not report success', () => {
  const baseBody = {
    gl_code: 'EXP005',
    amount: 0,
    memo: 'Void',
    expense_date: '2026-08-01',
    payment_method: 'check',
    check_number: '1593',
  };

  it('returns an error when the model rejects the row, rather than a false 201', async () => {
    // The tolerant catch around the ledger write exists for a missing table
    // during the gradual migration. A validation error is a real rejection:
    // reporting it as success loses the entry silently.
    const { ValidationError, ValidationErrorItem } = require('sequelize');
    LedgerEntry.create.mockRejectedValue(
      new ValidationError('Validation error', [
        new ValidationErrorItem('Amount must be greater than 0', 'Validation error', 'amount'),
      ])
    );

    const res = mockRes();
    await createExpense({ body: baseBody, user: { id: 7 } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.success).toBe(false);
    expect(tx.commit).not.toHaveBeenCalled();
  });

  it('still tolerates a missing ledger_entries table', async () => {
    LedgerEntry.create.mockRejectedValue(new Error('relation "ledger_entries" does not exist'));

    const res = mockRes();
    await createExpense({ body: baseBody, user: { id: 7 } }, res);

    expect(res.statusCode).toBe(201);
  });
});

describe('updateExpense — voided check', () => {
  const invoke = async (body, expense) => {
    LedgerEntry.findOne.mockImplementation(async (opts) => {
      const where = (opts && opts.where) || {};
      if (where.check_number !== undefined) return null;
      return expense;
    });
    const res = mockRes();
    await updateExpense({ params: { id: expense.id }, body }, res);
    return res;
  };

  it('zeroes the amount when the edit also marks the memo void', async () => {
    const expense = mockExpense();
    const res = await invoke({ amount: 0, memo: 'Void - check destroyed' }, expense);

    expect(res.statusCode).toBe(200);
    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0 }),
      expect.anything()
    );
  });

  it('zeroes the amount when the stored memo already marks it void', async () => {
    const expense = mockExpense({ memo: 'Voided at the printer' });
    const res = await invoke({ amount: 0 }, expense);

    expect(res.statusCode).toBe(200);
    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0 }),
      expect.anything()
    );
  });

  it('still rejects zeroing the amount of an ordinary expense', async () => {
    const expense = mockExpense();
    const res = await invoke({ amount: 0 }, expense);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toMatch(/positive number/i);
    expect(expense.update).not.toHaveBeenCalled();
  });
});
