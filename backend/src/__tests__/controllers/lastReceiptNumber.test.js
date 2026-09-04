'use strict';
process.env.NODE_ENV = 'test';

jest.mock('../../models', () => ({
  Transaction: { findAll: jest.fn() },
  Member: {}, LedgerEntry: {}, IncomeCategory: {}, Donation: {}, Pledge: {},
  PledgeAllocation: {},
  sequelize: { literal: jest.fn(), transaction: jest.fn(), getDialect: jest.fn(() => 'postgres') },
}));

const { Transaction } = require('../../models');
const { getLastReceiptNumber } = require('../../controllers/transactionController');

function mockReceipts(values) {
  Transaction.findAll.mockResolvedValue(values.map(v => ({ receipt_number: v })));
}

async function invoke() {
  let payload; let statusCode = 200;
  const res = { json: (p) => { payload = p; }, status: (c) => { statusCode = c; return res; } };
  await getLastReceiptNumber({ query: {} }, res);
  return { payload, statusCode };
}

describe('getLastReceiptNumber', () => {
  const original = process.env.START_RECEIPT_NUMBER;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.START_RECEIPT_NUMBER;
  });

  afterAll(() => {
    if (original === undefined) delete process.env.START_RECEIPT_NUMBER;
    else process.env.START_RECEIPT_NUMBER = original;
  });

  it('returns the highest receipt and the number expected next', async () => {
    mockReceipts(['6010', '6012', '6011']);
    const { payload } = await invoke();

    expect(payload.data).toEqual({ last_receipt_number: 6012, next_expected: 6013 });
  });

  it('ignores the legacy import marker sitting in the receipt column', async () => {
    mockReceipts(['6010', 'imported', 'Imported']);
    const { payload } = await invoke();

    expect(payload.data.last_receipt_number).toBe(6010);
  });

  it('ignores receipts from the previous book, below the start number', async () => {
    mockReceipts(['5000', '5672', '5680']);
    const { payload } = await invoke();

    expect(payload.data.last_receipt_number).toBe(5680);
  });

  it('reports an empty book so the form can skip the warning entirely', async () => {
    mockReceipts([]);
    const { payload } = await invoke();

    expect(payload.data.last_receipt_number).toBeNull();
    expect(payload.data.next_expected).toBe(5680);
  });

  it('honours START_RECEIPT_NUMBER when the church starts a new book', async () => {
    process.env.START_RECEIPT_NUMBER = '7000';
    mockReceipts(['6999', '7005']);
    const { payload } = await invoke();

    expect(payload.data.last_receipt_number).toBe(7005);
  });

  it('returns 500 when the query fails', async () => {
    Transaction.findAll.mockRejectedValue(new Error('db down'));
    const { payload, statusCode } = await invoke();

    expect(statusCode).toBe(500);
    expect(payload.success).toBe(false);
  });
});
