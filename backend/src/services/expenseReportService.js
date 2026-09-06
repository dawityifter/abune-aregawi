'use strict';

/**
 * Category-level expense reporting.
 *
 * The Monthly Summary (GET /api/bank/summary/monthly) already answers "how much
 * did we spend each month" straight off bank_transactions. It cannot answer
 * "on what", because a bank row carries no GL code. This service adds that
 * dimension without recomputing the monthly totals a second way.
 *
 * WHAT COUNTS AS AN EXPENSE
 * -------------------------
 * Two populations, joined by the link auto-reconcile already maintains
 * (ledger_entries.external_id = bank_transactions.transaction_hash):
 *
 *   1. Every ledger expense entry (type='expense'). Covers hand-entered
 *      expenses AND the ones auto-reconcile recorded from a bank debit. Both
 *      carry a GL code, so both are categorized.
 *
 *   2. Every bank debit with NO ledger entry pointing at it. These are the
 *      debits auto-reconcile could not classify — real money out, invisible to
 *      every other expense screen. They become the synthetic UNCATEGORIZED
 *      bucket rather than being silently dropped.
 *
 * A debit that IS linked is deliberately excluded from (2): its money is
 * already counted once in (1). That is the whole double-count defense, and it
 * reuses the existing link rather than inventing a second one. A check written
 * in August that clears in September is counted in August only, which is why
 * the linked-set lookup is NOT restricted to the reporting date range.
 *
 * Returned deposited items are excluded entirely: those reverse income the
 * church received (a donor's check bounced), not money the church spent —
 * the same call bankParserService/autoReconcileService already make.
 *
 * IGNORED bank debits ARE counted, flagged as dismissed in the drill-down.
 * The treasurer dismissed the row from the reconciliation queue, but the money
 * still left the account, so excluding it would understate spending.
 *
 * MONEY
 * -----
 * Every total is accumulated in integer cents. Floats never touch an
 * accumulator; the conversion back to dollars happens once, at the edge, when
 * the payload is built. Percentages are computed from cents in basis points.
 */

const { Op } = require('sequelize');
const {
  LedgerEntry,
  BankTransaction,
  ExpenseCategory,
  Employee,
  Vendor,
  sequelize
} = require('../models');
const { isReturnedItem } = require('./bankParserService');

/** The synthetic category for bank debits nothing has classified. */
const UNCATEGORIZED = 'UNCATEGORIZED';
const UNCATEGORIZED_NAME = 'Uncategorized / Needs Review';

// Payment methods a report filter may be given. Ledger entries only ever store
// the first two on the manual path; the rest are what paymentMethodForBankTxn
// derives for a bank row (and what reconcileExpense then stores).
const REPORT_PAYMENT_METHODS = ['cash', 'check', 'ach', 'debit_card', 'credit_card', 'other'];

const REPORT_SOURCES = ['all', 'ledger', 'bank'];
const REPORT_STATUSES = ['all', 'matched', 'recorded', 'imported', 'dismissed'];

// ---------------------------------------------------------------------------
// Exact money
// ---------------------------------------------------------------------------

/**
 * Decimal string/number -> integer cents, without going through float.
 *
 * Postgres hands DECIMAL back as a string ("2500.00") and SUM() as a string
 * too; sqlite hands back a number. Parsing the digits directly keeps
 * 0.1 + 0.2 problems out of every total in this file.
 */
function toCents(value) {
  if (value === null || value === undefined || value === '') return 0;

  const text = String(value).trim();
  const parsed = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(text);
  if (!parsed) {
    // Exponential notation or similar: fall back rather than silently drop it.
    const n = Number(text);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  const sign = parsed[1] === '-' ? -1 : 1;
  const whole = parsed[2] || '0';
  const frac = parsed[3] || '';
  // Amounts are DECIMAL(10,2), so a third decimal should not exist. Round it
  // rather than truncate if the column type ever widens.
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  const rounding = frac.length > 2 && Number(frac[2]) >= 5 ? 1 : 0;
  return sign * (cents + rounding);
}

/** Integer cents -> a JSON-safe dollar number. The one float in the pipeline. */
const toDollars = (cents) => Number((cents / 100).toFixed(2));

/** Share of a total, as a percentage with two decimals, computed from cents. */
function percentOf(cents, totalCents) {
  if (!totalCents) return 0;
  return Number(((cents * 10000) / totalCents / 100).toFixed(2));
}

// ---------------------------------------------------------------------------
// Range and month bucketing
// ---------------------------------------------------------------------------

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

/**
 * Resolve the reporting window to plain 'YYYY-MM-DD' strings.
 *
 * Kept as strings on purpose. entry_date and bank_transactions.date are
 * DATEONLY, and comparing them against a JS Date reintroduces the timezone
 * shift getMonthlySummary documents — a Date built from '2026-06-01' is UTC
 * midnight, which lands on May 31 in Central Time.
 */
function resolveRange({ year, start_date, end_date }) {
  const explicitStart = isIsoDate(start_date) ? start_date : null;
  const explicitEnd = isIsoDate(end_date) ? end_date : null;

  const parsedYear = parseInt(year, 10);
  const resolvedYear = Number.isFinite(parsedYear) && parsedYear >= 1900 && parsedYear <= 9999
    ? parsedYear
    : new Date().getFullYear();

  const start = explicitStart || `${resolvedYear}-01-01`;
  const end = explicitEnd || `${resolvedYear}-12-31`;

  // A backwards range would silently report zero everywhere; swap instead.
  return start <= end
    ? { start, end, year: resolvedYear }
    : { start: end, end: start, year: resolvedYear };
}

/** 'YYYY-MM' for a DATEONLY value, however the dialect hands it back. */
function monthKey(value) {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return String(value).slice(0, 7);
}

/** 'YYYY-MM-DD' for a DATEONLY value. */
function dayKey(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/**
 * Every month the range touches, in order, whether or not it has activity —
 * an empty month has to appear as $0.00, not vanish from the table.
 */
function monthsInRange(start, end) {
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);

  const months = [];
  let year = startYear;
  let month = startMonth;
  // Bounded so a malformed range can never spin here.
  while ((year < endYear || (year === endYear && month <= endMonth)) && months.length < 600) {
    const at = new Date(year, month - 1, 1);
    months.push({
      month: `${year}-${String(month).padStart(2, '0')}`,
      short_label: at.toLocaleString('en-US', { month: 'short' }),
      label: at.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      long_label: at.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/**
 * How many months of the range have actually begun, for the monthly average.
 * Averaging a partial year over 12 understates every month that has happened.
 */
function elapsedMonthCount(months) {
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const started = months.filter((m) => m.month <= currentKey).length;
  return Math.max(started, 1);
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** Normalize the query string into the filter set both endpoints share. */
function parseFilters(query = {}) {
  const range = resolveRange(query);

  const glCode = String(query.gl_code || '').trim().toUpperCase() || null;
  const method = String(query.payment_method || '').trim().toLowerCase();
  const source = String(query.source || 'all').trim().toLowerCase();
  const status = String(query.status || 'all').trim().toLowerCase();
  const payee = String(query.payee || '').trim();
  const month = /^\d{4}-\d{2}$/.test(String(query.month || '')) ? String(query.month) : null;

  return {
    ...range,
    gl_code: glCode,
    payee: payee || null,
    // Whitelisted rather than passed through: these land in a where clause.
    payment_method: REPORT_PAYMENT_METHODS.includes(method) ? method : null,
    source: REPORT_SOURCES.includes(source) ? source : 'all',
    status: REPORT_STATUSES.includes(status) ? status : 'all',
    month
  };
}

/**
 * Narrow the range to a single month when one is requested (drill-down), so a
 * cell click and the matrix cell it came from read the same rows.
 */
function applyMonthWindow(filters) {
  if (!filters.month) return filters;

  const [year, month] = filters.month.split('-').map(Number);
  const monthStart = `${filters.month}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${filters.month}-${String(lastDay).padStart(2, '0')}`;

  return {
    ...filters,
    start: monthStart > filters.start ? monthStart : filters.start,
    end: monthEnd < filters.end ? monthEnd : filters.end
  };
}

/** True when the filters can only ever select uncategorized bank rows. */
const wantsUncategorizedOnly = (filters) => filters.gl_code === UNCATEGORIZED;

/** True when the ledger half of the report is in scope at all. */
function includesLedger(filters) {
  if (filters.source === 'bank') return false;
  if (wantsUncategorizedOnly(filters)) return false;
  if (filters.status === 'imported' || filters.status === 'dismissed') return false;
  return true;
}

/** True when the uncategorized bank half is in scope at all. */
function includesBank(filters) {
  if (filters.source === 'ledger') return false;
  if (filters.gl_code && filters.gl_code !== UNCATEGORIZED) return false;
  if (filters.status === 'matched' || filters.status === 'recorded') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Ledger side
// ---------------------------------------------------------------------------

/**
 * 'YYYY-MM' from a DATEONLY column, in whichever dialect is running.
 * Postgres stores a real date (needs to_char); sqlite stores the ISO text.
 */
function monthExpression(column) {
  return sequelize.getDialect() === 'postgres'
    ? sequelize.fn('to_char', sequelize.col(column), 'YYYY-MM')
    : sequelize.fn('substr', sequelize.col(column), 1, 7);
}

function ledgerWhere(filters) {
  const where = {
    type: 'expense',
    entry_date: { [Op.gte]: filters.start, [Op.lte]: filters.end }
  };

  if (filters.gl_code && filters.gl_code !== UNCATEGORIZED) {
    where.category = filters.gl_code;
  }
  if (filters.payment_method) {
    where.payment_method = filters.payment_method;
  }
  // 'matched' = a bank row cleared it; 'recorded' = entered but not yet seen
  // by the bank (an outstanding check).
  if (filters.status === 'matched') {
    where.external_id = { [Op.ne]: null };
  } else if (filters.status === 'recorded') {
    where.external_id = null;
  }

  if (filters.payee) {
    const likeOp = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
    const pattern = `%${filters.payee}%`;
    where[Op.or] = [
      { payee_name: { [likeOp]: pattern } },
      { '$employee.first_name$': { [likeOp]: pattern } },
      { '$employee.last_name$': { [likeOp]: pattern } },
      { '$vendor.name$': { [likeOp]: pattern } }
    ];
  }

  return where;
}

/**
 * A payee filter has to reach the employee and vendor names too, the same way
 * the Expenses list does. Joined with no attributes so the GROUP BY stays on
 * the ledger columns alone.
 */
const payeeIncludes = (filters) => (filters.payee
  ? [
    { model: Employee, as: 'employee', attributes: [] },
    { model: Vendor, as: 'vendor', attributes: [] }
  ]
  : []);

/**
 * Ledger expenses aggregated by month and GL code, summed in the database.
 * One grouped query for the whole report rather than a SUM per month.
 */
async function aggregateLedger(filters) {
  if (!includesLedger(filters)) return [];

  const rows = await LedgerEntry.findAll({
    where: ledgerWhere(filters),
    include: payeeIncludes(filters),
    attributes: [
      'category',
      [monthExpression('LedgerEntry.entry_date'), 'month'],
      [sequelize.fn('SUM', sequelize.col('LedgerEntry.amount')), 'total'],
      [sequelize.fn('COUNT', sequelize.col('LedgerEntry.id')), 'count']
    ],
    group: ['LedgerEntry.category', monthExpression('LedgerEntry.entry_date')],
    raw: true,
    subQuery: false
  });

  return rows.map((row) => ({
    gl_code: row.category,
    month: monthKey(row.month),
    cents: toCents(row.total),
    count: parseInt(row.count, 10) || 0
  }));
}

// ---------------------------------------------------------------------------
// Bank side
// ---------------------------------------------------------------------------

/**
 * Bank debits in the range that no ledger expense points at.
 *
 * The anti-join runs in SQL (NOT EXISTS on the unique external_id index) so
 * only the genuinely unclassified rows come back — a linked debit is already
 * counted through its ledger entry. Note that the subquery is deliberately
 * unrestricted by date: an August check clearing in September must still be
 * recognized as linked when September alone is being reported.
 *
 * Returned items are filtered in JS rather than SQL so isReturnedItem stays
 * the single definition of what a return is.
 */
async function fetchUnlinkedDebits(filters) {
  if (!includesBank(filters)) return [];

  const where = {
    amount: { [Op.lt]: 0 },
    date: { [Op.gte]: filters.start, [Op.lte]: filters.end },
    [Op.and]: sequelize.literal(
      'NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.external_id = "BankTransaction"."transaction_hash")'
    )
  };

  if (filters.status === 'imported') where.status = { [Op.ne]: 'IGNORED' };
  if (filters.status === 'dismissed') where.status = 'IGNORED';

  if (filters.payee) {
    const likeOp = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
    const pattern = `%${filters.payee}%`;
    where[Op.or] = [
      { payer_name: { [likeOp]: pattern } },
      { description: { [likeOp]: pattern } }
    ];
  }

  const rows = await BankTransaction.findAll({
    where,
    attributes: [
      'id', 'date', 'amount', 'description', 'type', 'status',
      'check_number', 'payer_name', 'transaction_hash'
    ],
    order: [['date', 'DESC'], ['id', 'ASC']],
    raw: true
  });

  const { paymentMethodForBankTxn } = require('./autoReconcileService');

  return rows
    .filter((row) => !isReturnedItem(row))
    .map((row) => ({ ...row, payment_method: paymentMethodForBankTxn(row) }))
    .filter((row) => !filters.payment_method || row.payment_method === filters.payment_method);
}

// ---------------------------------------------------------------------------
// Report assembly
// ---------------------------------------------------------------------------

/** GL code -> display name, for the codes actually present in the results. */
async function categoryNames(glCodes) {
  const codes = [...new Set(glCodes.filter((code) => code && code !== UNCATEGORIZED))];
  if (codes.length === 0) return new Map();

  const categories = await ExpenseCategory.findAll({
    where: { gl_code: { [Op.in]: codes } },
    attributes: ['gl_code', 'name']
  });
  return new Map(categories.map((c) => [c.gl_code, c.name]));
}

/**
 * Bank debits over the range, unfiltered — the exact basis the Monthly Summary
 * uses for its expense column. Reported alongside the report total so the
 * treasurer can see, rather than guess at, why the two differ.
 */
async function bankDebitTotals(filters) {
  const rows = await BankTransaction.findAll({
    where: {
      amount: { [Op.lt]: 0 },
      date: { [Op.gte]: filters.start, [Op.lte]: filters.end }
    },
    attributes: ['amount', 'description', 'type'],
    raw: true
  });

  let totalCents = 0;
  let returnedCents = 0;
  for (const row of rows) {
    const cents = Math.abs(toCents(row.amount));
    totalCents += cents;
    if (isReturnedItem(row)) returnedCents += cents;
  }
  return { totalCents, returnedCents };
}

/**
 * Ledger expenses in the range that no bank row has cleared. Two kinds: a
 * check written but still outstanding, and a cash expense, which will never
 * appear on a statement at all. Together they are the main reason the report
 * total runs above the Monthly Summary's bank-debit total.
 */
async function unlinkedLedger(filters) {
  const rows = await LedgerEntry.findAll({
    where: {
      type: 'expense',
      external_id: null,
      entry_date: { [Op.gte]: filters.start, [Op.lte]: filters.end }
    },
    attributes: ['amount'],
    raw: true
  });
  return {
    cents: rows.reduce((sum, row) => sum + toCents(row.amount), 0),
    count: rows.length
  };
}

/**
 * Build the whole report: summary cards, monthly trend, month x category
 * matrix, and the YTD category breakdown — all off one pass of aggregates so
 * every section is guaranteed to reconcile with the others.
 */
async function buildExpenseReport(query = {}) {
  const filters = applyMonthWindow(parseFilters(query));
  const months = monthsInRange(filters.start, filters.end);
  const monthIndex = new Map(months.map((m, i) => [m.month, i]));

  const [ledgerRows, bankRows] = await Promise.all([
    aggregateLedger(filters),
    fetchUnlinkedDebits(filters)
  ]);

  // cells: gl_code -> month -> cents. Counts tracked per category for the
  // "number of expenses" card and the category table.
  const cells = new Map();
  const categoryCents = new Map();
  const categoryCount = new Map();
  const monthCents = new Array(months.length).fill(0);
  const monthCount = new Array(months.length).fill(0);

  const add = (glCode, month, cents, count) => {
    const index = monthIndex.get(month);
    if (index === undefined) return; // outside the reported window

    if (!cells.has(glCode)) cells.set(glCode, new Array(months.length).fill(0));
    cells.get(glCode)[index] += cents;

    categoryCents.set(glCode, (categoryCents.get(glCode) || 0) + cents);
    categoryCount.set(glCode, (categoryCount.get(glCode) || 0) + count);
    monthCents[index] += cents;
    monthCount[index] += count;
  };

  for (const row of ledgerRows) {
    add(row.gl_code, row.month, row.cents, row.count);
  }

  let uncategorizedCents = 0;
  let uncategorizedCount = 0;
  let dismissedCents = 0;
  let dismissedCount = 0;
  for (const row of bankRows) {
    // Debits are stored negative; an expense report states them positive.
    const cents = Math.abs(toCents(row.amount));
    add(UNCATEGORIZED, monthKey(row.date), cents, 1);
    uncategorizedCents += cents;
    uncategorizedCount += 1;
    if (row.status === 'IGNORED') {
      dismissedCents += cents;
      dismissedCount += 1;
    }
  }

  const grandCents = monthCents.reduce((sum, cents) => sum + cents, 0);
  const names = await categoryNames([...categoryCents.keys()]);

  const nameFor = (glCode) => (glCode === UNCATEGORIZED
    ? UNCATEGORIZED_NAME
    : names.get(glCode) || glCode || 'Unknown');

  // Highest spending first; the uncategorized bucket sorts on its amount like
  // any other row rather than being pinned somewhere flattering.
  const orderedCodes = [...categoryCents.keys()].sort((a, b) => {
    const diff = categoryCents.get(b) - categoryCents.get(a);
    return diff !== 0 ? diff : String(a).localeCompare(String(b));
  });

  const categories = orderedCodes.map((glCode) => ({
    gl_code: glCode,
    name: nameFor(glCode),
    total: toDollars(categoryCents.get(glCode)),
    count: categoryCount.get(glCode) || 0,
    percent: percentOf(categoryCents.get(glCode), grandCents),
    is_uncategorized: glCode === UNCATEGORIZED
  }));

  const matrixRows = orderedCodes.map((glCode) => ({
    gl_code: glCode,
    name: nameFor(glCode),
    cells: cells.get(glCode).map(toDollars),
    total: toDollars(categoryCents.get(glCode)),
    is_uncategorized: glCode === UNCATEGORIZED
  }));

  const elapsed = elapsedMonthCount(months);
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentIndex = monthIndex.get(currentKey);

  const [bankDebits, unlinked] = await Promise.all([
    bankDebitTotals(filters),
    unlinkedLedger(filters)
  ]);

  const categorizedCents = grandCents - uncategorizedCents;
  const expenseCount = categoryCount.size === 0
    ? 0
    : [...categoryCount.values()].reduce((sum, count) => sum + count, 0);

  return {
    range: {
      start: filters.start,
      end: filters.end,
      year: filters.year
    },
    filters: {
      gl_code: filters.gl_code,
      payee: filters.payee,
      payment_method: filters.payment_method,
      source: filters.source,
      status: filters.status
    },
    months: months.map((m, i) => ({
      ...m,
      total: toDollars(monthCents[i]),
      count: monthCount[i]
    })),
    categories,
    matrix: {
      months: months.map((m) => ({ month: m.month, short_label: m.short_label, label: m.label })),
      rows: matrixRows,
      month_totals: monthCents.map(toDollars),
      grand_total: toDollars(grandCents)
    },
    summary: {
      total: toDollars(grandCents),
      categorized_total: toDollars(categorizedCents),
      uncategorized_total: toDollars(uncategorizedCents),
      uncategorized_count: uncategorizedCount,
      uncategorized_percent: percentOf(uncategorizedCents, grandCents),
      dismissed_total: toDollars(dismissedCents),
      dismissed_count: dismissedCount,
      current_month: currentIndex === undefined ? 0 : toDollars(monthCents[currentIndex]),
      current_month_label: currentIndex === undefined ? null : months[currentIndex].label,
      // Averaged over months that have actually started, so a part-year range
      // is not diluted by months that have not happened yet.
      average_monthly: toDollars(Math.round(grandCents / elapsed)),
      months_elapsed: elapsed,
      expense_count: expenseCount,
      largest_category: categories.length > 0
        ? {
          gl_code: categories[0].gl_code,
          name: categories[0].name,
          total: categories[0].total,
          percent: categories[0].percent
        }
        : null
    },
    // The report and the Monthly Summary count different things on purpose:
    // the summary is pure bank activity, the report adds expenses recorded but
    // not yet cleared and drops returned deposited items. Both numbers are
    // stated, with the gap broken into its named parts, so the difference is
    // explained rather than discovered.
    //
    //   difference = unlinked ledger - returned items + timing
    //
    // 'timing' is the remainder: a check written in one period and cleared in
    // another sits in the ledger on one side of the boundary and in the bank
    // on the other.
    reconciliation: {
      // The bank-debit side is the whole statement for the range and cannot be
      // narrowed the way the report can — a category or payee filter has no
      // meaning against a raw bank row. Comparing a filtered report total
      // against it would show a difference that means nothing, so the flag
      // tells the UI when this comparison is worth showing at all.
      applies: !(filters.gl_code || filters.payee || filters.payment_method
        || filters.source !== 'all' || filters.status !== 'all'),
      bank_debits: toDollars(bankDebits.totalCents),
      report_total: toDollars(grandCents),
      difference: toDollars(grandCents - bankDebits.totalCents),
      unlinked_ledger_total: toDollars(unlinked.cents),
      unlinked_ledger_count: unlinked.count,
      returned_item_total: toDollars(bankDebits.returnedCents),
      timing_difference: toDollars(
        (grandCents - bankDebits.totalCents) - unlinked.cents + bankDebits.returnedCents
      ),
      needs_review_count: uncategorizedCount
    }
  };
}

// ---------------------------------------------------------------------------
// Drill-down
// ---------------------------------------------------------------------------

/**
 * The individual transactions behind a category/month total, from both
 * populations, in one list. Same filters as the report so a cell and its
 * drill-down can never disagree.
 */
async function listExpenseReportTransactions(query = {}) {
  const filters = applyMonthWindow(parseFilters(query));
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);

  const [ledgerEntries, bankRows] = await Promise.all([
    includesLedger(filters)
      ? LedgerEntry.findAll({
        where: ledgerWhere(filters),
        include: [
          { model: Employee, as: 'employee', attributes: ['id', 'first_name', 'last_name'] },
          { model: Vendor, as: 'vendor', attributes: ['id', 'name'] }
        ],
        order: [['entry_date', 'DESC'], ['id', 'DESC']]
      })
      : [],
    fetchUnlinkedDebits(filters)
  ]);

  const glCodes = ledgerEntries.map((entry) => entry.category);
  const names = await categoryNames(glCodes);

  const ledgerListed = ledgerEntries.map((entry) => {
    const plain = entry.toJSON();
    const payee = plain.payee_name
      || (plain.vendor ? plain.vendor.name : null)
      || (plain.employee ? `${plain.employee.first_name} ${plain.employee.last_name}`.trim() : null);

    return {
      key: `ledger:${plain.id}`,
      source: 'ledger',
      // 'Chase + Expense' once a bank row has cleared it; recorded but
      // outstanding until then.
      source_label: plain.external_id ? 'Chase + Expense' : 'Expense',
      status: plain.external_id ? 'MATCHED' : 'RECORDED',
      date: dayKey(plain.entry_date),
      gl_code: plain.category,
      category_name: names.get(plain.category) || plain.category,
      payee: payee || null,
      amount: toDollars(toCents(plain.amount)),
      payment_method: plain.payment_method || null,
      check_number: plain.check_number || null,
      memo: plain.memo || null,
      ledger_entry_id: plain.id,
      bank_transaction_hash: plain.external_id || null
    };
  });

  const bankListed = bankRows.map((row) => ({
    key: `bank:${row.id}`,
    source: 'bank',
    source_label: 'Chase',
    status: row.status === 'IGNORED' ? 'DISMISSED' : 'IMPORTED',
    date: dayKey(row.date),
    gl_code: UNCATEGORIZED,
    category_name: UNCATEGORIZED_NAME,
    payee: row.payer_name || null,
    amount: toDollars(Math.abs(toCents(row.amount))),
    payment_method: row.payment_method || null,
    check_number: row.check_number || null,
    memo: row.description || null,
    bank_transaction_id: row.id,
    bank_transaction_hash: row.transaction_hash
  }));

  const rows = [...ledgerListed, ...bankListed].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.amount - a.amount;
  });

  const totalCents = rows.reduce((sum, row) => sum + toCents(row.amount), 0);
  const offset = (page - 1) * limit;

  return {
    rows: rows.slice(offset, offset + limit),
    total: toDollars(totalCents),
    pagination: {
      currentPage: page,
      totalPages: Math.max(Math.ceil(rows.length / limit), 1),
      totalItems: rows.length,
      itemsPerPage: limit
    }
  };
}

module.exports = {
  UNCATEGORIZED,
  UNCATEGORIZED_NAME,
  REPORT_PAYMENT_METHODS,
  buildExpenseReport,
  listExpenseReportTransactions,
  // Exported for tests
  toCents,
  toDollars,
  percentOf,
  resolveRange,
  monthsInRange,
  parseFilters
};
