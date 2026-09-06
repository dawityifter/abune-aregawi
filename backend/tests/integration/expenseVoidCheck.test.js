/**
 * The void-check path end to end against a real database: create through the
 * controller, then read it back through the list the treasurer actually uses.
 * The unit tests mock LedgerEntry.create, so only this level catches the model
 * rejecting a $0.00 row.
 */
const { LedgerEntry, ExpenseCategory, Member } = require('../../src/models');
const { createExpense, getExpenses } = require('../../src/controllers/expenseController');

function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

async function create(body, userId) {
  const res = mockRes();
  await createExpense({ body, user: { id: userId } }, res);
  return res;
}

async function list(query) {
  const res = mockRes();
  await getExpenses({ query }, res);
  if (!res.payload || res.payload.success !== true) {
    throw new Error(`getExpenses failed: ${JSON.stringify(res.payload)}`);
  }
  return res.payload.data;
}

let collectorId;

describe('Voided check, end to end', () => {
  beforeAll(async () => {
    await LedgerEntry.destroy({ where: {} });
    await ExpenseCategory.findOrCreate({
      where: { gl_code: 'EXP300' },
      defaults: { gl_code: 'EXP300', name: 'Utilities', is_active: true }
    });
    // collected_by is a real FK, so the collector row has to exist.
    const collector = await Member.create({
      first_name: 'Test',
      last_name: 'Treasurer',
      email: 'treasurer@example.com',
      phone_number: '+15550000300',
      role: 'treasurer',
      is_active: true
    });
    collectorId = collector.id;
  });

  beforeEach(async () => {
    await LedgerEntry.destroy({ where: {} });
  });

  const voidBody = {
    gl_code: 'EXP300',
    amount: 0,
    memo: 'Void - misprinted, reissued as 1594',
    expense_date: '2026-08-01',
    payment_method: 'check',
    check_number: '1593'
  };

  it('actually persists a $0.00 voided check', async () => {
    const res = await create(voidBody, collectorId);

    expect(res.statusCode).toBe(201);
    const stored = await LedgerEntry.findOne({ where: { check_number: '1593' } });
    expect(stored).not.toBeNull();
    expect(Number(stored.amount)).toBe(0);
  });

  it('shows the voided check first when the list is sorted by amount ascending', async () => {
    await create({ ...voidBody }, collectorId);
    await create({
      ...voidBody, amount: 125.5, memo: 'August water bill', check_number: '1594'
    }, collectorId);

    const rows = await list({ sort_by: 'amount', sort_dir: 'asc' });

    expect(rows.map((r) => r.check_number)).toEqual(['1593', '1594']);
    expect(Number(rows[0].amount)).toBe(0);
  });

  it('includes the voided check when sorted by amount descending too', async () => {
    await create({ ...voidBody }, collectorId);
    await create({
      ...voidBody, amount: 125.5, memo: 'August water bill', check_number: '1594'
    }, collectorId);

    const rows = await list({ sort_by: 'amount', sort_dir: 'desc' });

    expect(rows.map((r) => r.check_number)).toEqual(['1594', '1593']);
  });

  it('rejects a $0.00 expense whose memo does not mark it void, and stores nothing', async () => {
    const res = await create({ ...voidBody, memo: 'August water bill' }, collectorId);

    expect(res.statusCode).toBe(400);
    expect(res.payload.success).toBe(false);
    expect(await LedgerEntry.count()).toBe(0);
  });
});
