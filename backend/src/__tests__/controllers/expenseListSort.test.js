'use strict';
process.env.NODE_ENV = 'test';

jest.mock('../../models', () => ({
  ExpenseCategory: { findAll: jest.fn(), findOne: jest.fn() },
  LedgerEntry: { findAndCountAll: jest.fn(), findAll: jest.fn() },
  Member: {},
  Employee: {},
  Vendor: {},
  sequelize: { literal: jest.fn((sql) => ({ __literal: sql })) },
}));

const { ExpenseCategory, LedgerEntry, sequelize } = require('../../models');
const { getExpenses, getExpensePaymentMethods } = require('../../controllers/expenseController');

function mockRows(rows) {
  LedgerEntry.findAndCountAll.mockResolvedValue({
    count: rows.length,
    rows: rows.map((r) => ({ ...r, toJSON: () => r })),
  });
}

async function list(query = {}) {
  const req = { query };
  let payload;
  const res = {
    json: (p) => { payload = p; },
    status: () => res,
  };
  await getExpenses(req, res);
  return payload;
}

function orderUsed() {
  return LedgerEntry.findAndCountAll.mock.calls[0][0].order;
}

describe('getExpenses sorting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // jest.config.js sets resetMocks, which strips the factory implementation.
    sequelize.literal.mockImplementation((sql) => ({ __literal: sql }));
    mockRows([]);
    ExpenseCategory.findAll.mockResolvedValue([]);
  });

  it('defaults to newest expense first', async () => {
    await list();
    expect(orderUsed()).toEqual([['entry_date', 'DESC'], ['created_at', 'DESC']]);
  });

  it('sorts by amount ascending on request', async () => {
    await list({ sort_by: 'amount', sort_dir: 'asc' });
    expect(orderUsed()[0]).toEqual(['amount', 'ASC']);
  });

  it('sorts by payment method', async () => {
    await list({ sort_by: 'payment_method', sort_dir: 'desc' });
    expect(orderUsed()[0]).toEqual(['payment_method', 'DESC']);
  });

  it('sorts by category', async () => {
    await list({ sort_by: 'category', sort_dir: 'asc' });
    expect(orderUsed()[0]).toEqual(['category', 'ASC']);
  });

  it('sorts check numbers numerically rather than as text', async () => {
    await list({ sort_by: 'check_number', sort_dir: 'asc' });
    const order = orderUsed();
    // "999" must not sort after "1000": shorter digit strings come first.
    expect(order[0][0].__literal).toMatch(/LENGTH/i);
    expect(order[0][1]).toBe('ASC');
    expect(order[1]).toEqual(['check_number', 'ASC']);
  });

  it('sorts by payee across the free-text, vendor and employee names', async () => {
    await list({ sort_by: 'payee', sort_dir: 'asc' });
    const sql = orderUsed()[0][0].__literal;
    expect(sql).toMatch(/COALESCE/i);
    expect(sql).toMatch(/payee_name/);
    expect(sql).toMatch(/vendor/);
    expect(sql).toMatch(/employee/);
  });

  it('ignores an unrecognized sort column instead of passing it to SQL', async () => {
    await list({ sort_by: 'amount; DROP TABLE ledger_entries', sort_dir: 'asc' });
    expect(orderUsed()).toEqual([['entry_date', 'DESC'], ['created_at', 'DESC']]);
  });

  it('ignores an unrecognized sort direction', async () => {
    await list({ sort_by: 'amount', sort_dir: 'sideways' });
    expect(orderUsed()[0]).toEqual(['amount', 'DESC']);
  });
});

describe('getExpenses reconciliation flag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.literal.mockImplementation((sql) => ({ __literal: sql }));
    ExpenseCategory.findAll.mockResolvedValue([]);
  });

  it('marks an expense linked to a bank row as reconciled', async () => {
    mockRows([{ id: 'a', category: 'GL1', external_id: 'bankhash-1' }]);
    const payload = await list();
    expect(payload.data[0].is_reconciled).toBe(true);
  });

  it('marks an expense with no bank link as not reconciled', async () => {
    mockRows([{ id: 'b', category: 'GL1', external_id: null }]);
    const payload = await list();
    expect(payload.data[0].is_reconciled).toBe(false);
  });
});

function whereUsed() {
  return LedgerEntry.findAndCountAll.mock.calls[0][0].where;
}

describe('getExpenses payment method filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.literal.mockImplementation((sql) => ({ __literal: sql }));
    mockRows([]);
    ExpenseCategory.findAll.mockResolvedValue([]);
  });

  it('narrows the query to the requested method', async () => {
    await list({ payment_method: 'ach' });
    expect(whereUsed().payment_method).toBe('ach');
  });

  it('accepts a method the expense form cannot produce but the bank can', async () => {
    await list({ payment_method: 'debit_card' });
    expect(whereUsed().payment_method).toBe('debit_card');
  });

  it('normalizes the method to lower case', async () => {
    await list({ payment_method: 'CHECK' });
    expect(whereUsed().payment_method).toBe('check');
  });

  it('ignores a method outside the known set rather than querying for it', async () => {
    await list({ payment_method: "check' OR 1=1--" });
    expect(whereUsed().payment_method).toBeUndefined();
  });

  it('returns every expense when no method is given', async () => {
    await list({});
    expect(whereUsed().payment_method).toBeUndefined();
  });
});

describe('getExpensePaymentMethods', () => {
  async function invoke() {
    let payload;
    const res = { json: (p) => { payload = p; }, status: () => res };
    await getExpensePaymentMethods({ query: {} }, res);
    return payload;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only the methods expenses actually use', async () => {
    LedgerEntry.findAll.mockResolvedValue([
      { payment_method: 'check' },
      { payment_method: 'ach' }
    ]);

    const payload = await invoke();

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(['ach', 'check']);
  });

  it('drops rows with no recorded method', async () => {
    LedgerEntry.findAll.mockResolvedValue([
      { payment_method: 'cash' },
      { payment_method: null }
    ]);

    const payload = await invoke();

    expect(payload.data).toEqual(['cash']);
  });

  it('looks at expenses only, not income entries', async () => {
    LedgerEntry.findAll.mockResolvedValue([]);
    await invoke();

    expect(LedgerEntry.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'expense' }) })
    );
  });
});
