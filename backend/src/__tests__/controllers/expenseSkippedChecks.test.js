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

  it('anchors the audit at the first check of the current checkbook', async () => {
    mockChecks(['1595', '1596']);
    const { payload } = await invoke();

    expect(payload.data.range).toEqual({ start: 1593, end: 1596 });
    expect(payload.data.skippedChecks).toEqual([1593, 1594]);
  });

  it('reports no gaps for a contiguous run from the anchor', async () => {
    mockChecks(['1593', '1594', '1595']);
    const { payload } = await invoke();

    expect(payload.success).toBe(true);
    expect(payload.data.skippedChecks).toEqual([]);
    expect(payload.data.range).toEqual({ start: 1593, end: 1595 });
  });

  it('finds the gaps in a broken run', async () => {
    mockChecks(['1593', '1594', '1597']);
    const { payload } = await invoke();

    expect(payload.data.skippedChecks).toEqual([1595, 1596]);
  });

  it('ignores checks written before the current checkbook started', async () => {
    mockChecks(['1002', '1593', '1594']);
    const { payload } = await invoke();

    expect(payload.data.skippedChecks).toEqual([]);
    expect(payload.data.range).toEqual({ start: 1593, end: 1594 });
  });

  it('audits the church checkbook only, not check numbers on member income', async () => {
    mockChecks(['1593']);
    await invoke();

    expect(LedgerEntry.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'expense' }),
      })
    );
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
    mockChecks(['1593', 'void', '1595']);
    const { payload } = await invoke();

    expect(payload.data.skippedChecks).toEqual([1594]);
    expect(payload.data.ignoredNonNumeric).toBe(1);
  });

  it('honors START_CHECK_NUMBER as an override of the default anchor', async () => {
    process.env.START_CHECK_NUMBER = '1600';
    mockChecks(['1593', '1601', '1602']);
    const { payload } = await invoke();

    expect(payload.data.skippedChecks).toEqual([1600]);
    expect(payload.data.range).toEqual({ start: 1600, end: 1602 });
  });

  it('collapses duplicate check numbers without inventing a gap', async () => {
    mockChecks(['1593', '1593', '1594', '1595']);
    const { payload } = await invoke();

    expect(payload.data.skippedChecks).toEqual([]);
    expect(payload.data.range).toEqual({ start: 1593, end: 1595 });
  });

  it('returns 500 when the query fails', async () => {
    LedgerEntry.findAll.mockRejectedValue(new Error('db down'));
    const { payload, statusCode } = await invoke();

    expect(statusCode).toBe(500);
    expect(payload.success).toBe(false);
  });
});
