'use strict';
process.env.NODE_ENV = 'test';

jest.mock('../../models', () => ({
  Transaction: { findAndCountAll: jest.fn() },
  Member: {}, LedgerEntry: {}, IncomeCategory: {}, Donation: {}, Pledge: {},
  PledgeAllocation: {},
  // getDialect is real API the sort helper uses to pick the right "is numeric"
  // SQL; postgres here so these assertions cover the production branch, while
  // the integration test covers sqlite.
  sequelize: { literal: jest.fn(), transaction: jest.fn(), getDialect: jest.fn(() => 'postgres') },
}));

const { Transaction, sequelize } = require('../../models');
const { getAllTransactions } = require('../../controllers/transactionController');

async function list(query = {}) {
  let payload;
  const res = { json: (p) => { payload = p; }, status: () => res };
  await getAllTransactions({ query }, res);
  return payload;
}

const orderUsed = () => Transaction.findAndCountAll.mock.calls[0][0].order;

describe('Member payments — sorting by receipt number', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.literal.mockImplementation((sql) => ({ __literal: sql }));
    sequelize.getDialect.mockReturnValue('postgres');
    Transaction.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
  });

  it('still defaults to most recent payment first', async () => {
    await list();
    expect(orderUsed()).toEqual([['payment_date', 'DESC'], ['created_at', 'DESC']]);
  });

  it('sorts receipts numerically, not as text', async () => {
    await list({ sort_by: 'receipt_number', sort_dir: 'asc' });
    const order = orderUsed();

    // Non-receipts are pushed last first, then digits order by length so
    // "999" does not sort after "1000".
    expect(order[0][0].__literal).toMatch(/CASE WHEN/i);
    expect(order[0][1]).toBe('ASC');
    expect(order[1][0].__literal).toMatch(/LENGTH/i);
    expect(order[1][1]).toBe('ASC');
    expect(order[2]).toEqual(['receipt_number', 'ASC']);
  });

  it('sorts descending on request', async () => {
    await list({ sort_by: 'receipt_number', sort_dir: 'desc' });
    const order = orderUsed();

    expect(order[1][0].__literal).toMatch(/LENGTH/i);
    expect(order[1][1]).toBe('DESC');
    expect(order[2]).toEqual(['receipt_number', 'DESC']);
  });

  it('ignores an unrecognized sort column instead of passing it to SQL', async () => {
    await list({ sort_by: 'receipt_number; DROP TABLE transactions', sort_dir: 'asc' });
    expect(orderUsed()).toEqual([['payment_date', 'DESC'], ['created_at', 'DESC']]);
  });

  it('ignores an unrecognized direction, falling back to descending', async () => {
    await list({ sort_by: 'receipt_number', sort_dir: 'sideways' });
    const order = orderUsed();

    // Still the receipt ordering, just not the bogus direction.
    expect(order[1][0].__literal).toMatch(/LENGTH/i);
    expect(order[1][1]).toBe('DESC');
  });
});
