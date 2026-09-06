'use strict';

/**
 * Expense report aggregation, against a real sqlite database rather than
 * mocked models — the whole point of these tests is that the SQL (the
 * NOT EXISTS anti-join, the dialect month expression, the GROUP BY) behaves,
 * which a mock cannot tell us.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';

const {
  sequelize,
  LedgerEntry,
  BankTransaction,
  ExpenseCategory
} = require('../../models');
const {
  buildExpenseReport,
  listExpenseReportTransactions,
  toCents,
  monthsInRange,
  resolveRange
} = require('../../services/expenseReportService');

const YEAR = 2026;

// One of each shape the report has to get right.
async function seed() {
  await ExpenseCategory.bulkCreate([
    { gl_code: 'EXP001', name: 'Salary/Allowance' },
    { gl_code: 'EXP005', name: 'Utility' },
    { gl_code: 'EXP102', name: 'Building Repairs & Maintenance' }
  ]);

  await LedgerEntry.bulkCreate([
    // Hand-entered check that later cleared: linked to its bank row, so the
    // two must together count as ONE $2,500 expense.
    {
      type: 'expense', category: 'EXP102', amount: 2500.00, entry_date: '2026-08-10',
      payment_method: 'check', check_number: '1234', payee_name: 'ABC Construction',
      external_id: 'hash-cleared-check'
    },
    // Hand-entered, not yet cleared by the bank (outstanding check).
    {
      type: 'expense', category: 'EXP005', amount: 120.50, entry_date: '2026-08-20',
      payment_method: 'check', check_number: '1235', payee_name: 'City Utility'
    },
    // Recorded by auto-reconcile from a bank debit it could classify.
    {
      type: 'expense', category: 'EXP001', amount: 5000.00, entry_date: '2026-07-01',
      payment_method: 'ach', payee_name: 'Payroll', external_id: 'hash-payroll'
    },
    // Boundary: first and last day of the year must both be inside the range.
    {
      type: 'expense', category: 'EXP005', amount: 10.00, entry_date: '2026-01-01',
      payment_method: 'cash', payee_name: 'Jan First'
    },
    {
      type: 'expense', category: 'EXP005', amount: 20.00, entry_date: '2026-12-31',
      payment_method: 'cash', payee_name: 'Dec Last'
    },
    // Just outside the year on both sides — must be excluded.
    {
      type: 'expense', category: 'EXP005', amount: 999.00, entry_date: '2025-12-31',
      payment_method: 'cash', payee_name: 'Prior Year'
    },
    {
      type: 'expense', category: 'EXP005', amount: 888.00, entry_date: '2027-01-01',
      payment_method: 'cash', payee_name: 'Next Year'
    },
    // Income lives in the same table and must never reach an expense report.
    {
      type: 'membership_due', category: 'membership_due', amount: 400.00,
      entry_date: '2026-08-05', payment_method: 'cash'
    }
  ]);

  await BankTransaction.bulkCreate([
    // The debit that cleared the hand-entered check. Linked -> already counted.
    {
      transaction_hash: 'hash-cleared-check', date: '2026-08-15', amount: -2500.00,
      description: 'CHECK 1234', type: 'CHECK', status: 'MATCHED', check_number: '1234'
    },
    // The debit auto-reconcile classified as payroll. Linked -> already counted.
    {
      transaction_hash: 'hash-payroll', date: '2026-07-01', amount: -5000.00,
      description: 'ORIG CO NAME:PAYROLL CO', type: 'ACH_DEBIT', status: 'MATCHED'
    },
    // Unclassified debit -> Uncategorized.
    {
      transaction_hash: 'hash-unknown', date: '2026-08-12', amount: -1750.25,
      description: 'ORIG CO NAME:XYZ MATERIALS', type: 'ACH_DEBIT', status: 'PENDING'
    },
    // Dismissed by the treasurer: still money out, still counted.
    {
      transaction_hash: 'hash-ignored', date: '2026-09-02', amount: -40.00,
      description: 'SERVICE FEE', type: 'FEE_TRANSACTION', status: 'IGNORED'
    },
    // A donor's bounced check. Reverses income, is not a church expense.
    {
      transaction_hash: 'hash-return', date: '2026-08-03', amount: -300.00,
      description: 'DEPOSITED ITEM RETURNED CHK SER# 1397',
      type: 'MISC_DEBIT', status: 'PENDING'
    },
    // A credit is never an expense.
    {
      transaction_hash: 'hash-credit', date: '2026-08-04', amount: 900.00,
      description: 'Zelle payment from A DONOR 123', type: 'ZELLE', status: 'PENDING'
    }
  ]);
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await seed();
});

// Deliberately no sequelize.close() here — global teardown owns the connection.

// Ledger in range: 2500 + 120.50 + 5000 + 10 + 20            = 7650.50
// Uncategorized:   1750.25 (unknown) + 40 (dismissed)        = 1790.25
// Report total                                               = 9440.75
const EXPECTED_TOTAL = 9440.75;
const EXPECTED_UNCATEGORIZED = 1790.25;

describe('toCents', () => {
  it('parses the decimal strings Postgres returns without float drift', () => {
    expect(toCents('2500.00')).toBe(250000);
    expect(toCents('0.10')).toBe(10);
    expect(toCents('0.20')).toBe(20);
    expect(toCents('-1750.25')).toBe(-175025);
    expect(toCents(1750.25)).toBe(175025);
    expect(toCents(null)).toBe(0);
    expect(toCents('')).toBe(0);
  });

  it('accumulates exactly where floats would not', () => {
    const cents = ['0.10', '0.20', '0.30'].reduce((sum, v) => sum + toCents(v), 0);
    expect(cents).toBe(60);
    expect(Number((cents / 100).toFixed(2))).toBe(0.6);
  });
});

describe('range and month handling', () => {
  it('defaults to the calendar year and honours explicit dates', () => {
    expect(resolveRange({ year: 2026 })).toEqual({
      start: '2026-01-01', end: '2026-12-31', year: 2026
    });
    expect(resolveRange({ start_date: '2026-03-05', end_date: '2026-04-09' }))
      .toMatchObject({ start: '2026-03-05', end: '2026-04-09' });
  });

  it('swaps a backwards range instead of reporting nothing', () => {
    expect(resolveRange({ start_date: '2026-09-01', end_date: '2026-02-01' }))
      .toMatchObject({ start: '2026-02-01', end: '2026-09-01' });
  });

  it('emits every month in the range, including ones spanning a year end', () => {
    expect(monthsInRange('2026-01-01', '2026-12-31')).toHaveLength(12);
    const spanning = monthsInRange('2025-11-15', '2026-02-02');
    expect(spanning.map((m) => m.month))
      .toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('buildExpenseReport totals', () => {
  let report;
  beforeAll(async () => {
    report = await buildExpenseReport({ year: YEAR });
  });

  it('counts a hand-entered expense and its cleared bank debit exactly once', () => {
    const building = report.categories.find((c) => c.gl_code === 'EXP102');
    expect(building.total).toBe(2500.00);
    expect(building.count).toBe(1);
    // If the linked debit were double counted the grand total would be 11940.75
    expect(report.summary.total).toBe(EXPECTED_TOTAL);
  });

  it('reconciles: sum of monthly totals equals the YTD total', () => {
    const summed = report.months.reduce((sum, m) => sum + Math.round(m.total * 100), 0);
    expect(summed).toBe(Math.round(EXPECTED_TOTAL * 100));
    expect(report.matrix.grand_total).toBe(EXPECTED_TOTAL);
  });

  it('reconciles: sum of category totals equals the YTD total', () => {
    const summed = report.categories.reduce((sum, c) => sum + Math.round(c.total * 100), 0);
    expect(summed).toBe(Math.round(EXPECTED_TOTAL * 100));
  });

  it('reconciles: categorized + uncategorized equals the YTD total', () => {
    const { categorized_total: cat, uncategorized_total: unc, total } = report.summary;
    expect(Math.round(cat * 100) + Math.round(unc * 100)).toBe(Math.round(total * 100));
    expect(unc).toBe(EXPECTED_UNCATEGORIZED);
  });

  it('reconciles: every matrix row sums across to its YTD column', () => {
    for (const row of report.matrix.rows) {
      const across = row.cells.reduce((sum, v) => sum + Math.round(v * 100), 0);
      expect(across).toBe(Math.round(row.total * 100));
    }
  });

  it('reconciles: every matrix column sums down to its month total', () => {
    report.matrix.month_totals.forEach((monthTotal, i) => {
      const down = report.matrix.rows
        .reduce((sum, row) => sum + Math.round(row.cells[i] * 100), 0);
      expect(down).toBe(Math.round(monthTotal * 100));
    });
  });

  it('percentages of the category breakdown add up to 100', () => {
    const summed = report.categories.reduce((sum, c) => sum + c.percent, 0);
    expect(Math.abs(summed - 100)).toBeLessThan(0.05);
  });
});

describe('what the report includes and excludes', () => {
  let report;
  beforeAll(async () => {
    report = await buildExpenseReport({ year: YEAR });
  });

  it('surfaces unclassified bank debits instead of dropping them', () => {
    const uncategorized = report.categories.find((c) => c.is_uncategorized);
    expect(uncategorized).toBeDefined();
    expect(uncategorized.total).toBe(EXPECTED_UNCATEGORIZED);
    expect(uncategorized.count).toBe(2);
    expect(report.reconciliation.needs_review_count).toBe(2);
  });

  it('counts a dismissed (IGNORED) debit and reports it separately', () => {
    expect(report.summary.dismissed_total).toBe(40.00);
    expect(report.summary.dismissed_count).toBe(1);
  });

  it('excludes returned deposited items, which reverse income', () => {
    // August: 2500 (check) + 120.50 (utility) + 1750.25 (unknown) = 4370.75.
    // The -300 return would push it to 4670.75 if it were counted.
    const august = report.months.find((m) => m.month === '2026-08');
    expect(august.total).toBe(4370.75);
    expect(report.reconciliation.returned_item_total).toBe(300.00);
  });

  it('excludes bank credits and non-expense ledger entries', () => {
    expect(report.categories.map((c) => c.gl_code)).not.toContain('membership_due');
    expect(report.summary.total).toBe(EXPECTED_TOTAL);
  });

  it('includes both date boundaries and excludes the days either side', () => {
    expect(report.months.find((m) => m.month === '2026-01').total).toBe(10.00);
    expect(report.months.find((m) => m.month === '2026-12').total).toBe(20.00);
    // The 2025-12-31 and 2027-01-01 entries would show up as extra months.
    expect(report.months).toHaveLength(12);
  });

  it('shows months with no activity as zero rather than omitting them', () => {
    const march = report.months.find((m) => m.month === '2026-03');
    expect(march).toBeDefined();
    expect(march.total).toBe(0);
    expect(march.count).toBe(0);
  });

  it('ranks categories by spend, highest first', () => {
    expect(report.categories[0].gl_code).toBe('EXP001'); // 5000
    expect(report.summary.largest_category.gl_code).toBe('EXP001');
    const totals = report.categories.map((c) => c.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it('explains the gap against the Monthly Summary rather than hiding it', () => {
    const r = report.reconciliation;
    // Bank debits: 2500 + 5000 + 1750.25 + 40 + 300 = 9590.25
    expect(r.bank_debits).toBe(9590.25);
    expect(r.report_total).toBe(EXPECTED_TOTAL);
    // difference = unlinked ledger - returned + timing, exactly.
    const identity = Math.round(r.unlinked_ledger_total * 100)
      - Math.round(r.returned_item_total * 100)
      + Math.round(r.timing_difference * 100);
    expect(identity).toBe(Math.round(r.difference * 100));
    // The outstanding check plus the two cash expenses — none of which the
    // bank statement has seen: 120.50 + 10 + 20.
    expect(r.unlinked_ledger_total).toBe(150.50);
    expect(r.unlinked_ledger_count).toBe(3);
  });
});

describe('filters', () => {
  it('narrows to a single category, uncategorized included', async () => {
    const one = await buildExpenseReport({ year: YEAR, gl_code: 'EXP001' });
    expect(one.summary.total).toBe(5000.00);
    expect(one.categories).toHaveLength(1);

    const unc = await buildExpenseReport({ year: YEAR, gl_code: 'UNCATEGORIZED' });
    expect(unc.summary.total).toBe(EXPECTED_UNCATEGORIZED);
    expect(unc.categories.every((c) => c.is_uncategorized)).toBe(true);
  });

  it('narrows to a date range, and every section respects it', async () => {
    const august = await buildExpenseReport({
      year: YEAR, start_date: '2026-08-01', end_date: '2026-08-31'
    });
    expect(august.months).toHaveLength(1);
    expect(august.summary.total).toBe(4370.75);
    expect(august.matrix.grand_total).toBe(4370.75);
    const summed = august.categories
      .reduce((sum, c) => sum + Math.round(c.total * 100), 0);
    expect(summed).toBe(Math.round(4370.75 * 100));
  });

  it('narrows by payment method across both sources', async () => {
    const checks = await buildExpenseReport({ year: YEAR, payment_method: 'check' });
    expect(checks.summary.total).toBe(2620.50); // 2500 + 120.50

    const cash = await buildExpenseReport({ year: YEAR, payment_method: 'cash' });
    expect(cash.summary.total).toBe(30.00); // 10 + 20
  });

  it('narrows by source', async () => {
    const ledgerOnly = await buildExpenseReport({ year: YEAR, source: 'ledger' });
    expect(ledgerOnly.summary.total).toBe(7650.50);
    expect(ledgerOnly.summary.uncategorized_total).toBe(0);

    const bankOnly = await buildExpenseReport({ year: YEAR, source: 'bank' });
    expect(bankOnly.summary.total).toBe(EXPECTED_UNCATEGORIZED);
  });

  it('narrows by reconciliation status', async () => {
    const matched = await buildExpenseReport({ year: YEAR, status: 'matched' });
    expect(matched.summary.total).toBe(7500.00); // 2500 + 5000

    const outstanding = await buildExpenseReport({ year: YEAR, status: 'recorded' });
    expect(outstanding.summary.total).toBe(150.50); // 120.50 + 10 + 20

    const dismissed = await buildExpenseReport({ year: YEAR, status: 'dismissed' });
    expect(dismissed.summary.total).toBe(40.00);
  });

  it('narrows by payee across ledger and bank descriptions', async () => {
    const ledgerPayee = await buildExpenseReport({ year: YEAR, payee: 'ABC Construction' });
    expect(ledgerPayee.summary.total).toBe(2500.00);

    const bankPayee = await buildExpenseReport({ year: YEAR, payee: 'XYZ MATERIALS' });
    expect(bankPayee.summary.total).toBe(1750.25);
  });

  it('averages over months that have started, not the whole range', async () => {
    const report = await buildExpenseReport({
      year: YEAR, start_date: '2026-08-01', end_date: '2026-08-31'
    });
    expect(report.summary.months_elapsed).toBe(1);
    expect(report.summary.average_monthly).toBe(4370.75);
  });
});

describe('drill-down', () => {
  it('lists the transactions behind a category and month, from both sources', async () => {
    const { rows, total } = await listExpenseReportTransactions({
      year: YEAR, month: '2026-08'
    });
    expect(total).toBe(4370.75);
    expect(rows).toHaveLength(3);

    const matched = rows.find((r) => r.gl_code === 'EXP102');
    expect(matched).toMatchObject({
      source: 'ledger',
      source_label: 'Chase + Expense',
      status: 'MATCHED',
      payee: 'ABC Construction',
      amount: 2500.00,
      check_number: '1234'
    });

    const imported = rows.find((r) => r.gl_code === 'UNCATEGORIZED');
    expect(imported).toMatchObject({
      source: 'bank',
      source_label: 'Chase',
      status: 'IMPORTED',
      amount: 1750.25
    });

    const recorded = rows.find((r) => r.gl_code === 'EXP005');
    expect(recorded).toMatchObject({ status: 'RECORDED', amount: 120.50 });
  });

  it('a drill-down total equals the matrix cell it came from', async () => {
    const report = await buildExpenseReport({ year: YEAR });
    const augustIndex = report.matrix.months.findIndex((m) => m.month === '2026-08');
    const buildingRow = report.matrix.rows.find((r) => r.gl_code === 'EXP102');

    const { total } = await listExpenseReportTransactions({
      year: YEAR, month: '2026-08', gl_code: 'EXP102'
    });
    expect(total).toBe(buildingRow.cells[augustIndex]);
  });

  it('paginates without changing the reported total', async () => {
    const { rows, total, pagination } = await listExpenseReportTransactions({
      year: YEAR, month: '2026-08', limit: 2
    });
    expect(rows).toHaveLength(2);
    expect(pagination.totalItems).toBe(3);
    expect(pagination.totalPages).toBe(2);
    expect(total).toBe(4370.75); // the whole cell, not just this page
  });
});
