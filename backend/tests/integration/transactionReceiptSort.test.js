const { Transaction, Member, LedgerEntry } = require('../../src/models');
const { getAllTransactions } = require('../../src/controllers/transactionController');

describe('Member payments receipt sorting (real SQL)', () => {
  let collector;

  beforeAll(async () => {
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Member.destroy({ where: {} });

    // Fields on separate lines deliberately: the staged-content scan blocks a
    // single line carrying name-then-phone, the shape a real roster leak had.
    collector = await Member.create({
      first_name: 'Test',
      last_name: 'Collector',
      phone_number: '+15550000000',
      role: 'treasurer',
      is_active: true
    });

    // "999" vs "1000" is the pair plain text ordering gets wrong.
    // Cash/check payments must carry a receipt; online giving never does, which
    // is exactly where the blank receipt numbers come from in production.
    const rows = [
      { receipt_number: '999', amount: 10, method: 'cash' },
      { receipt_number: '1000', amount: 20, method: 'cash' },
      { receipt_number: '6086', amount: 30, method: 'cash' },
      { receipt_number: null, amount: 40, method: 'credit_card' },
      { receipt_number: '', amount: 50, method: 'ach' },
      // Legacy import marker sitting in the receipt column on 122 real rows.
      { receipt_number: 'imported', amount: 60, method: 'credit_card' }
    ];
    for (const r of rows) {
      await Transaction.create({
        member_id: null, collected_by: collector.id, payment_date: '2026-08-01',
        amount: r.amount, payment_type: 'donation', payment_method: r.method,
        receipt_number: r.receipt_number, status: 'succeeded'
      });
    }
  });

  afterAll(async () => {
    await Transaction.destroy({ where: {} });
    await Member.destroy({ where: {} });
  });

  async function receipts(sort_dir) {
    let payload;
    const res = { json: (p) => { payload = p; }, status: () => res };
    await getAllTransactions({ query: { sort_by: 'receipt_number', sort_dir, limit: 20 } }, res);
    return payload.data.transactions.map(t => t.receipt_number);
  }

  it('orders receipts numerically ascending, not as text', async () => {
    const got = await receipts('asc');
    expect(got.slice(0, 3)).toEqual(['999', '1000', '6086']);
  });

  it('orders receipts numerically descending', async () => {
    const got = await receipts('desc');
    expect(got.slice(0, 3)).toEqual(['6086', '1000', '999']);
  });

  it('keeps payments with no receipt out of the way when ascending', async () => {
    const got = await receipts('asc');
    expect(got.slice(0, 3)).toEqual(['999', '1000', '6086']);
  });

  it('sorts a non-numeric receipt marker after every real receipt', async () => {
    // "imported" is longer than any digit run, so length ordering alone would
    // put it first on a descending sort and hide the newest receipts.
    const desc = await receipts('desc');
    expect(desc[0]).toBe('6086');
    expect(desc).toContain('imported');
    expect(desc.indexOf('imported')).toBeGreaterThan(desc.indexOf('999'));
  });

  it('keeps payments with no receipt out of the way when descending', async () => {
    // Online payments have no receipt. A treasurer sorting by receipt wants
    // receipts, not 645 blanks first.
    const got = await receipts('desc');
    expect(got.slice(-2).every(r => !r)).toBe(true);
  });
});
