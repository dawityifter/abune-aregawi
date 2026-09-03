'use strict';
process.env.NODE_ENV = 'test';

jest.mock('../../models', () => ({
  Transaction: {},
  Member: { findByPk: jest.fn() },
  LedgerEntry: { create: jest.fn() },
  IncomeCategory: { findOne: jest.fn(), findByPk: jest.fn() },
  Donation: {},
  sequelize: {},
}));

const { LedgerEntry } = require('../../models');
const { createLedgerEntryForTransaction } = require('../../services/transactionService');

const RESOLVED = { glCode: 'INC004', normalizedReceiptNumber: '6102' };

function payload(overrides = {}) {
  return {
    payment_type: 'donation',
    amount: '200.00',
    payment_date: '2026-08-30',
    payment_method: 'check',
    note: 'Sunday offering',
    collected_by: 7,
    member_id: null,
    ...overrides,
  };
}

async function record(overrides) {
  await createLedgerEntryForTransaction({ id: 1543 }, payload(overrides), RESOLVED, {});
  return LedgerEntry.create.mock.calls[0]?.[0];
}

describe('payer check serial on incoming payments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    LedgerEntry.create.mockResolvedValue({ id: 1 });
  });

  it('records the check serial the donor wrote on their check', async () => {
    const entry = await record({ check_number: '1397' });

    expect(entry.check_number).toBe('1397');
  });

  it('canonicalizes a serial written with a hash or padding', async () => {
    const entry = await record({ check_number: '#01397' });

    expect(entry.check_number).toBe('1397');
  });

  it('stores nothing when the payment was not made by check', async () => {
    const entry = await record({ payment_method: 'cash', check_number: '1397' });

    expect(entry.check_number).toBeNull();
  });

  it('stores nothing when no serial was supplied', async () => {
    const entry = await record({});

    expect(entry.check_number).toBeNull();
  });

  it('ignores an unusable serial rather than failing the payment', async () => {
    // Incoming serials are typed off a paper check; a bad one must not block
    // recording the gift.
    const entry = await record({ check_number: 'n/a' });

    expect(entry.check_number).toBeNull();
  });

  it('does not require the serial to be unique across donors', async () => {
    // Two donors can each write their own check 1397 — unlike the church's own
    // outgoing checks, these carry no uniqueness rule.
    const first = await record({ check_number: '1397' });
    expect(first.check_number).toBe('1397');

    LedgerEntry.create.mockClear();
    await createLedgerEntryForTransaction({ id: 1544 }, payload({ check_number: '1397' }), RESOLVED, {});
    expect(LedgerEntry.create.mock.calls[0][0].check_number).toBe('1397');
  });
});
