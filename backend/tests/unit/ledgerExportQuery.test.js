'use strict';

const { extractYear } = require('../../src/jobs/ledgerSheets/ledgerExportQuery');

describe('ledger export year extraction', () => {
  test('extracts year from DATEONLY string', () => {
    expect(extractYear('2026-03-31')).toBe(2026);
  });

  test('extracts year from Date instance', () => {
    expect(extractYear(new Date('2025-01-15T00:00:00.000Z'))).toBe(2025);
  });

  test('returns null for invalid date-like values', () => {
    expect(extractYear('Invalid date')).toBeNull();
    expect(extractYear('NaN-01-01')).toBeNull();
    expect(extractYear(null)).toBeNull();
  });
});
