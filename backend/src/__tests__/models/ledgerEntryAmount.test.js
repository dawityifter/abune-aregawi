'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { LedgerEntry } = require('../../models');

/** Runs the model's own validators without touching a database. */
const validate = (overrides) =>
  LedgerEntry.build({
    type: 'expense',
    category: 'EXP005',
    amount: 450,
    entry_date: '2026-08-01',
    payment_method: 'check',
    ...overrides,
  }).validate();

describe('LedgerEntry amount validation', () => {
  it('accepts an ordinary positive amount', async () => {
    await expect(validate({})).resolves.toBeDefined();
  });

  it('accepts $0.00 when the memo marks the entry as a voided check', async () => {
    await expect(validate({ amount: 0, memo: 'Void - misprinted' })).resolves.toBeDefined();
  });

  it('rejects $0.00 when the memo does not mark it void', async () => {
    await expect(validate({ amount: 0, memo: 'August water bill' })).rejects.toThrow();
  });

  it('rejects $0.00 with no memo at all', async () => {
    await expect(validate({ amount: 0, memo: null })).rejects.toThrow();
  });

  it('rejects a negative amount even on a void memo', async () => {
    await expect(validate({ amount: -5, memo: 'Void' })).rejects.toThrow();
  });
});
