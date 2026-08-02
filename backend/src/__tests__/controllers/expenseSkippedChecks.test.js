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

const { LedgerEntry } = require('../../models');
const { getSkippedChecks } = require('../../controllers/expenseController');

function mockChecks(values) {
  LedgerEntry.findAll.mockResolvedValue(values.map((v) => ({ check_number: v })));
}

async function invoke() {
  const req = { query: {} };
  let payload;
  let statusCode = 200;
  const res = {
    json: (p) => { payload = p; },
    status: (c) => { statusCode = c; return res; },
  };
  await getSkippedChecks(req, res);
  return { payload, statusCode };
}

describe('getSkippedChecks', () => {
  const originalStart = process.env.START_CHECK_NUMBER;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.START_CHECK_NUMBER;
  });

  afterAll(() => {
    if (originalStart === undefined) delete process.env.START_CHECK_NUMBER;
    else process.env.START_CHECK_NUMBER = originalStart;
  });

  it('reports no gaps for a contiguous run', async () => {
    mockChecks(['1001', '1002', '1003', '1004', '1005']);
    const { payload } = await invoke();

    expect(payload.success).toBe(true);
    expect(payload.data.skippedChecks).toEqual([]);
    expect(payload.data.range).toEqual({ start: 1001, end: 1005 });
  });

  it('finds the gaps in a broken run', async () => {
    mockChecks(['1001', '1002', '1005']);
    const { payload } = await invoke();

    expect(payload.data.skippedChecks).toEqual([1003, 1004]);
    expect(payload.data.range).toEqual({ start: 1001, end: 1005 });
  });

  it('normalizes prefixed and punctuated check numbers', async () => {
    mockChecks(['CHK-1001', '#1002', '1004']);
    const { payload } = await invoke();

    expect(payload.data.skippedChecks).toEqual([1003]);
    expect(payload.data.range).toEqual({ start: 1001, end: 1004 });
  });

  it('returns an empty result when nothing has a check number', async () => {
    mockChecks([]);
    const { payload, statusCode } = await invoke();

    expect(statusCode).toBe(200);
    expect(payload.data.skippedChecks).toEqual([]);
    expect(payload.data.range).toBeNull();
    expect(payload.data.ignoredNonNumeric).toBe(0);
  });

  it('excludes values with no digits and counts them separately', async () => {
    mockChecks(['1001', 'void', '1003']);
    const { payload } = await invoke();

    expect(payload.data.skippedChecks).toEqual([1002]);
    expect(payload.data.ignoredNonNumeric).toBe(1);
  });

  it('honors START_CHECK_NUMBER below the lowest recorded check', async () => {
    process.env.START_CHECK_NUMBER = '1000';
    mockChecks(['1001', '1002']);
    const { payload } = await invoke();

    expect(payload.data.skippedChecks).toEqual([1000]);
    expect(payload.data.range).toEqual({ start: 1000, end: 1002 });
  });

  it('collapses duplicate check numbers without inventing a gap', async () => {
    mockChecks(['1001', '1001', '1002', '1003']);
    const { payload } = await invoke();

    expect(payload.data.skippedChecks).toEqual([]);
    expect(payload.data.range).toEqual({ start: 1001, end: 1003 });
  });

  it('returns 500 when the query fails', async () => {
    LedgerEntry.findAll.mockRejectedValue(new Error('db down'));
    const { payload, statusCode } = await invoke();

    expect(statusCode).toBe(500);
    expect(payload.success).toBe(false);
  });
});
