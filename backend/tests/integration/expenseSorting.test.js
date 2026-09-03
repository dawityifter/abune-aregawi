/**
 * Exercises the expense list's ORDER BY clauses against a real database.
 * The unit tests assert which clause is built; these assert the SQL is valid
 * and orders rows the way the treasurer expects.
 */
const { LedgerEntry, ExpenseCategory, Vendor, Member } = require('../../src/models');
const { getExpenses, getExpensePaymentMethods } = require('../../src/controllers/expenseController');

async function list(query) {
  let payload;
  const res = {
    json: (p) => { payload = p; },
    status: () => res
  };
  await getExpenses({ query }, res);
  if (!payload || payload.success !== true) {
    throw new Error(`getExpenses failed: ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

describe('Expense list sorting (real SQL)', () => {
  beforeAll(async () => {
    await LedgerEntry.destroy({ where: {} });
    await ExpenseCategory.findOrCreate({
      where: { gl_code: 'EXP200' },
      defaults: { gl_code: 'EXP200', name: 'Supplies', is_active: true }
    });
    await ExpenseCategory.findOrCreate({
      where: { gl_code: 'EXP100' },
      defaults: { gl_code: 'EXP100', name: 'Utilities', is_active: true }
    });

    const vendor = await Vendor.create({ name: 'Alpha Supply', vendor_type: 'other' });

    await LedgerEntry.create({
      type: 'expense', category: 'EXP200', amount: 50.00, entry_date: '2025-03-01',
      payment_method: 'check', check_number: '999', payee_name: 'Zeta Services',
      memo: 'z', source_system: 'manual'
    });
    await LedgerEntry.create({
      type: 'expense', category: 'EXP100', amount: 1500.00, entry_date: '2025-01-01',
      payment_method: 'cash', check_number: null, payee_name: null,
      vendor_id: vendor.id, memo: 'a', source_system: 'manual'
    });
    await LedgerEntry.create({
      type: 'expense', category: 'EXP100', amount: 300.00, entry_date: '2025-02-01',
      payment_method: 'check', check_number: '1000', payee_name: 'Mid Vendor',
      memo: 'm', source_system: 'manual', external_id: 'bankhash-sorted'
    });
  });

  afterAll(async () => {
    await LedgerEntry.destroy({ where: {} });
  });

  it('sorts check numbers numerically, not as text', async () => {
    const rows = await list({ sort_by: 'check_number', sort_dir: 'asc' });
    const numbers = rows.map((r) => r.check_number).filter(Boolean);
    expect(numbers).toEqual(['999', '1000']);
  });

  it('sorts by amount', async () => {
    const rows = await list({ sort_by: 'amount', sort_dir: 'asc' });
    expect(rows.map((r) => Number(r.amount))).toEqual([50, 300, 1500]);
  });

  it('sorts by payee across free-text and vendor names', async () => {
    const rows = await list({ sort_by: 'payee', sort_dir: 'asc' });
    const names = rows.map((r) => r.payee_name || r.vendor?.name);
    expect(names).toEqual(['Alpha Supply', 'Mid Vendor', 'Zeta Services']);
  });

  it('sorts by category', async () => {
    const rows = await list({ sort_by: 'category', sort_dir: 'asc' });
    expect(rows[0].category).toBe('EXP100');
  });

  it('sorts by payment method', async () => {
    const rows = await list({ sort_by: 'payment_method', sort_dir: 'asc' });
    expect(rows[0].payment_method).toBe('cash');
  });

  it('defaults to newest first', async () => {
    const rows = await list({});
    expect(rows.map((r) => String(r.entry_date).slice(0, 10)))
      .toEqual(['2025-03-01', '2025-02-01', '2025-01-01']);
  });

  it('reports which expenses are reconciled against the bank', async () => {
    const rows = await list({ sort_by: 'amount', sort_dir: 'asc' });
    expect(rows.map((r) => r.is_reconciled)).toEqual([false, true, false]);
  });
});

describe('Expense payment method filter (real SQL)', () => {
  beforeAll(async () => {
    await LedgerEntry.destroy({ where: {} });
    await ExpenseCategory.findOrCreate({
      where: { gl_code: 'EXP100' },
      defaults: { gl_code: 'EXP100', name: 'Utilities', is_active: true }
    });

    const rows = [
      { payment_method: 'check', check_number: '1593', amount: 10 },
      { payment_method: 'cash', check_number: null, amount: 20 },
      { payment_method: 'ach', check_number: null, amount: 30 },
      { payment_method: 'debit_card', check_number: null, amount: 40 }
    ];
    for (const row of rows) {
      await LedgerEntry.create({
        type: 'expense', category: 'EXP100', entry_date: '2025-04-01',
        memo: row.payment_method, source_system: 'manual', ...row
      });
    }
  });

  afterAll(async () => {
    await LedgerEntry.destroy({ where: {} });
  });

  it('returns only expenses paid the requested way', async () => {
    const rows = await list({ payment_method: 'ach' });
    expect(rows).toHaveLength(1);
    expect(rows[0].payment_method).toBe('ach');
  });

  it('finds bank-recorded card expenses the manual form cannot create', async () => {
    const rows = await list({ payment_method: 'debit_card' });
    expect(rows.map((r) => Number(r.amount))).toEqual([40]);
  });

  it('returns everything when no method is requested', async () => {
    const rows = await list({});
    expect(rows).toHaveLength(4);
  });

  it('lists the distinct methods actually in use', async () => {
    let payload;
    const res = { json: (p) => { payload = p; }, status: () => res };
    await getExpensePaymentMethods({ query: {} }, res);

    expect(payload.data).toEqual(['ach', 'cash', 'check', 'debit_card']);
  });
});
