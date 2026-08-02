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

/** An expense row as updateExpense sees it: plain fields plus a spy-able update(). */
function mockExpense(overrides = {}) {
  const row = {
    id: 'exp-1',
    payment_method: 'check',
    check_number: '1042',
    employee_id: 'emp-1',
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
  LedgerEntry.findOne.mockResolvedValue(null); // no duplicate by default
  LedgerEntry.create.mockResolvedValue({ id: 'led-1' });
  LedgerEntry.findByPk.mockResolvedValue({ toJSON: () => ({ id: 'led-1' }) });
});

describe('createExpense — check number', () => {
  const baseBody = {
    gl_code: 'EXP005',
    amount: 450,
    expense_date: '2026-08-01',
    payment_method: 'check',
  };

  const invoke = async (body) => {
    const res = mockRes();
    await createExpense({ body, user: { id: 7 } }, res);
    return res;
  };

  it('rejects a check payment with no check number', async () => {
    const res = await invoke({ ...baseBody, check_number: '' });

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toMatch(/check number is required/i);
    expect(LedgerEntry.create).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalled();
  });

  it('rejects a check payment whose check number is only whitespace', async () => {
    const res = await invoke({ ...baseBody, check_number: '   ' });

    expect(res.statusCode).toBe(400);
    expect(LedgerEntry.create).not.toHaveBeenCalled();
  });

  it('accepts a cash payment with no check number and stores null', async () => {
    const res = await invoke({ ...baseBody, payment_method: 'cash' });

    expect(res.statusCode).toBe(201);
    expect(LedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ check_number: null }),
      expect.anything()
    );
  });

  it('rejects a duplicate check number with 409', async () => {
    LedgerEntry.findOne.mockResolvedValue({ id: 'other' });
    const res = await invoke({ ...baseBody, check_number: '1042' });

    expect(res.statusCode).toBe(409);
    expect(res.payload.message).toMatch(/already been used/i);
    expect(LedgerEntry.create).not.toHaveBeenCalled();
  });

  it('stores a trimmed check number on success', async () => {
    const res = await invoke({ ...baseBody, check_number: ' 1042 ' });

    expect(res.statusCode).toBe(201);
    expect(LedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ check_number: '1042' }),
      expect.anything()
    );
  });
});

describe('updateExpense — check number', () => {
  const invoke = async (body, expense) => {
    LedgerEntry.findOne.mockImplementation(async (opts) => {
      // First call resolves the expense being edited; later calls are duplicate lookups.
      if (opts && opts.where && opts.where.type === 'expense') return expense;
      return null;
    });
    const res = mockRes();
    await updateExpense({ params: { id: expense.id }, body }, res);
    return res;
  };

  it('leaves an existing check number alone when only the amount changes', async () => {
    const expense = mockExpense();
    const res = await invoke({ amount: 500 }, expense);

    expect(res.statusCode).toBe(200);
    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500, check_number: '1042' }),
      expect.anything()
    );
  });

  it('does not collide with itself when the check number is unchanged', async () => {
    const expense = mockExpense();
    await invoke({ memo: 'corrected memo' }, expense);

    const dupLookup = LedgerEntry.findOne.mock.calls
      .map(([opts]) => opts)
      .find((opts) => opts && opts.where && opts.where.check_number);

    expect(dupLookup.where.id).toBeDefined(); // excludeId applied
  });

  it('rejects a check number already used by another expense', async () => {
    const expense = mockExpense();
    LedgerEntry.findOne.mockImplementation(async (opts) => {
      if (opts && opts.where && opts.where.type === 'expense') return expense;
      return { id: 'other-expense' };
    });

    const res = mockRes();
    await updateExpense({ params: { id: expense.id }, body: { check_number: '1099' } }, res);

    expect(res.statusCode).toBe(409);
    expect(expense.update).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalled();
  });

  it('persists a new, free check number', async () => {
    const expense = mockExpense();
    const res = await invoke({ check_number: '1099' }, expense);

    expect(res.statusCode).toBe(200);
    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ check_number: '1099' }),
      expect.anything()
    );
  });

  it('rejects switching cash to check without a check number', async () => {
    const expense = mockExpense({ payment_method: 'cash', check_number: null });
    const res = await invoke({ payment_method: 'check' }, expense);

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toMatch(/check number is required/i);
    expect(expense.update).not.toHaveBeenCalled();
  });

  it('clears the stored check number when switching check to cash', async () => {
    const expense = mockExpense();
    const res = await invoke({ payment_method: 'cash' }, expense);

    expect(res.statusCode).toBe(200);
    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'cash', check_number: null }),
      expect.anything()
    );
  });

  it('ignores attempts to change the payee', async () => {
    const expense = mockExpense();
    await invoke(
      { employee_id: 'emp-999', vendor_id: 'ven-999', payee_name: 'Someone Else' },
      expense
    );

    const updateData = expense.update.mock.calls[0][0];
    expect(updateData).not.toHaveProperty('employee_id');
    expect(updateData).not.toHaveProperty('vendor_id');
    expect(updateData).not.toHaveProperty('payee_name');
  });

  it('persists an invoice number', async () => {
    const expense = mockExpense();
    await invoke({ invoice_number: 'INV-2026-001' }, expense);

    expect(expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ invoice_number: 'INV-2026-001' }),
      expect.anything()
    );
  });
});
