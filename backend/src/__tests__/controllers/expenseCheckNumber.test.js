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
const { createExpense, getCheckNumberAvailability } = require('../../controllers/expenseController');

const CATEGORY = { gl_code: 'GL5010', name: 'Utilities', description: 'Power and water' };

function makeRes() {
  const res = { statusCode: 200, payload: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

async function create(body) {
  const req = { body, user: { id: 7 } };
  const res = makeRes();
  await createExpense(req, res);
  return res;
}

function baseBody(overrides = {}) {
  return {
    gl_code: 'GL5010',
    amount: '125.00',
    expense_date: '2026-01-15',
    payment_method: 'check',
    ...overrides,
  };
}

describe('createExpense check number rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() });
    ExpenseCategory.findOne.mockResolvedValue(CATEGORY);
    LedgerEntry.findOne.mockResolvedValue(null);
    LedgerEntry.create.mockImplementation(async (values) => ({ id: 'exp-1', ...values }));
    LedgerEntry.findByPk.mockResolvedValue({
      toJSON: () => ({ id: 'exp-1' }),
    });
  });

  it('rejects a check number containing letters', async () => {
    const res = await create(baseBody({ check_number: 'CHK-1593' }));

    expect(res.statusCode).toBe(400);
    expect(res.payload.message).toMatch(/numeric/i);
    expect(LedgerEntry.create).not.toHaveBeenCalled();
  });

  it('stores a check number written with a leading hash as digits only', async () => {
    await create(baseBody({ check_number: '#1593' }));

    expect(LedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ check_number: '1593' }),
      expect.anything()
    );
  });

  it('drops leading zeros so 01593 and 1593 are the same check', async () => {
    await create(baseBody({ check_number: '01593' }));

    expect(LedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ check_number: '1593' }),
      expect.anything()
    );
  });

  it('rejects a check number already used by another expense', async () => {
    LedgerEntry.findOne.mockResolvedValue({ id: 'exp-existing' });

    const res = await create(baseBody({ check_number: '1593' }));

    expect(res.statusCode).toBe(409);
    expect(LedgerEntry.create).not.toHaveBeenCalled();
  });

  it('looks for duplicates only among expenses, not member income entries', async () => {
    await create(baseBody({ check_number: '1593' }));

    expect(LedgerEntry.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'expense', check_number: '1593' }),
      })
    );
  });

  it('rejects a check number of zero', async () => {
    const res = await create(baseBody({ check_number: '0' }));

    expect(res.statusCode).toBe(400);
    expect(LedgerEntry.create).not.toHaveBeenCalled();
  });
});

describe('getCheckNumberAvailability', () => {
  async function invoke(query) {
    let payload;
    let statusCode = 200;
    const res = {
      json: (p) => { payload = p; },
      status: (c) => { statusCode = c; return res; },
    };
    await getCheckNumberAvailability({ query }, res);
    return { payload, statusCode };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    LedgerEntry.findOne.mockResolvedValue(null);
  });

  it('reports a free check number as available', async () => {
    const { payload } = await invoke({ check_number: '1593' });

    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({ check_number: '1593', available: true, reason: null });
  });

  it('reports a used check number as unavailable', async () => {
    LedgerEntry.findOne.mockResolvedValue({ id: 'exp-existing' });

    const { payload } = await invoke({ check_number: '1593' });

    expect(payload.data.available).toBe(false);
    expect(payload.data.reason).toBe('DUPLICATE');
  });

  it('answers for the canonical form, so 01593 collides with 1593', async () => {
    await invoke({ check_number: '01593' });

    expect(LedgerEntry.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'expense', check_number: '1593' }),
      })
    );
  });

  it('ignores check numbers on member income when answering', async () => {
    await invoke({ check_number: '1593' });

    expect(LedgerEntry.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'expense' }) })
    );
  });

  it('rejects a non-numeric check number', async () => {
    const { payload } = await invoke({ check_number: 'abc' });

    expect(payload.data.available).toBe(false);
    expect(payload.data.reason).toBe('NON_NUMERIC');
    expect(LedgerEntry.findOne).not.toHaveBeenCalled();
  });

  it('treats a missing check number as nothing to answer', async () => {
    const { payload, statusCode } = await invoke({});

    expect(statusCode).toBe(400);
    expect(payload.success).toBe(false);
  });

  it('excludes the expense being edited so it does not collide with itself', async () => {
    await invoke({ check_number: '1593', exclude_id: 'exp-1' });

    const where = LedgerEntry.findOne.mock.calls[0][0].where;
    expect(where.id).toBeDefined();
  });
});
