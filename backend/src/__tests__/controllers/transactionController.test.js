const { sequelize, Member, Transaction, IncomeCategory, LedgerEntry } = require('../../models');
const { getAllTransactions, updateTransaction } = require('../../controllers/transactionController');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

async function listWith(query) {
  const res = mockRes();
  await getAllTransactions({ query }, res);
  return res;
}

let collector;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  collector = await Member.create({
    first_name: 'Col', last_name: 'Lector', phone_number: '+15550007001', role: 'treasurer'
  });

  const base = {
    collected_by: collector.id,
    payment_date: '2026-07-20',
    amount: 25.0,
    payment_type: 'donation'
  };
  // Square card (external_id 'square:…')
  await Transaction.create({ ...base, payment_method: 'credit_card', external_id: 'square:sq_A' });
  // Stripe card (payment_intent id, no square prefix)
  await Transaction.create({ ...base, payment_method: 'credit_card', external_id: 'pi_stripe_B' });
  // Manually keyed card (no external_id, no donation_id)
  await Transaction.create({ ...base, payment_method: 'credit_card', external_id: null });
  // Non-card row that also has an external_id — must never match a card_source
  await Transaction.create({ ...base, payment_method: 'zelle', external_id: 'zelle:z_C' });
});

afterAll(async () => {
  try { await sequelize.close(); } catch (e) { /* already closed by global teardown */ }
});

describe('getAllTransactions card_source filter', () => {
  it('returns only Square card payments for card_source=square', async () => {
    const res = await listWith({ card_source: 'square' });
    const txns = res.body.data.transactions;
    expect(txns).toHaveLength(1);
    expect(txns[0].external_id).toBe('square:sq_A');
  });

  it('returns only Stripe card payments for card_source=stripe (excludes Square and the zelle row)', async () => {
    const res = await listWith({ card_source: 'stripe' });
    const txns = res.body.data.transactions;
    expect(txns).toHaveLength(1);
    expect(txns[0].external_id).toBe('pi_stripe_B');
  });

  it('returns only manually keyed card payments for card_source=manual', async () => {
    const res = await listWith({ card_source: 'manual' });
    const txns = res.body.data.transactions;
    expect(txns).toHaveLength(1);
    expect(txns[0].external_id).toBeNull();
    expect(txns[0].payment_method).toBe('credit_card');
  });

  it('returns everything when no card_source is passed', async () => {
    const res = await listWith({});
    expect(res.body.data.transactions.length).toBe(4);
  });
});

describe('updateTransaction — edit type/receipt/note', () => {
  let editCollector;
  beforeAll(async () => {
    editCollector = await Member.create({
      first_name: 'Edit', last_name: 'Collector', phone_number: '+15550008001', role: 'treasurer'
    });
    await IncomeCategory.create({ gl_code: 'INC901', name: 'Donations', payment_type_mapping: 'donation' });
    await IncomeCategory.create({ gl_code: 'INC905', name: 'Membership Dues', payment_type_mapping: 'membership_due' });
  });

  it('remaps income_category_id and the ledger GL code when the payment type changes', async () => {
    const member = await Member.create({
      first_name: 'Due', last_name: 'Payer', phone_number: '+15550008002', role: 'member'
    });
    const tx = await Transaction.create({
      member_id: member.id, collected_by: editCollector.id, payment_date: '2026-08-01',
      amount: 25, payment_type: 'donation', payment_method: 'credit_card', status: 'succeeded'
    });
    await LedgerEntry.create({
      type: 'donation', category: 'INC901', amount: 25, entry_date: '2026-08-01', transaction_id: tx.id
    });

    const res = mockRes();
    await updateTransaction(
      { params: { id: String(tx.id) }, body: { payment_type: 'membership_due', receipt_number: '777', note: 'corrected type' } },
      res
    );
    expect(res.body.success).toBe(true);

    const updated = await Transaction.findByPk(tx.id);
    expect(updated.payment_type).toBe('membership_due');
    expect(updated.receipt_number).toBe('777');
    expect(updated.note).toBe('corrected type');

    const membershipCat = await IncomeCategory.findOne({ where: { payment_type_mapping: 'membership_due' } });
    expect(String(updated.income_category_id)).toBe(String(membershipCat.id));

    const ledger = await LedgerEntry.findOne({ where: { transaction_id: tx.id } });
    expect(ledger.category).toBe('INC905'); // GL code, not the raw payment type
    expect(ledger.type).toBe('membership_due');
  });

  // The earmark decides which year a dues payment is credited to, and it used
  // to be unreachable after entry: not shown anywhere, not editable, so a wrong
  // year could only be corrected by deleting and re-keying the payment.
  it('saves a corrected earmark year', async () => {
    const member = await Member.create({
      first_name: 'Ear',
      last_name: 'Mark',
      role: 'member',
      phone_number: '+15550008003'
    });
    const tx = await Transaction.create({
      member_id: member.id, collected_by: editCollector.id, payment_date: '2026-09-08',
      amount: 1000, payment_type: 'membership_due', payment_method: 'cash',
      status: 'succeeded', receipt_number: '901', for_year: 2025
    });

    const res = mockRes();
    await updateTransaction(
      { params: { id: String(tx.id) }, body: { payment_type: 'membership_due', receipt_number: '901', for_year: 2026 } },
      res
    );
    expect(res.body.success).toBe(true);

    const updated = await Transaction.findByPk(tx.id);
    expect(updated.for_year).toBe(2026);
  });

  it('clears the earmark back to the payment date year', async () => {
    const member = await Member.create({
      first_name: 'Clear',
      last_name: 'Mark',
      role: 'member',
      phone_number: '+15550008004'
    });
    const tx = await Transaction.create({
      member_id: member.id, collected_by: editCollector.id, payment_date: '2026-09-08',
      amount: 1000, payment_type: 'membership_due', payment_method: 'cash',
      status: 'succeeded', receipt_number: '902', for_year: 2025
    });

    const res = mockRes();
    await updateTransaction(
      { params: { id: String(tx.id) }, body: { payment_type: 'membership_due', receipt_number: '902', for_year: null } },
      res
    );
    expect(res.body.success).toBe(true);

    const updated = await Transaction.findByPk(tx.id);
    expect(updated.for_year).toBeNull();
  });

  it('drops the earmark when a due is reclassified to another type', async () => {
    // Only membership dues obey for_year, so a reclassified row must not keep
    // one lying in wait should it ever be classified back.
    const member = await Member.create({
      first_name: 'Reclass',
      last_name: 'Mark',
      role: 'member',
      phone_number: '+15550008005'
    });
    const tx = await Transaction.create({
      member_id: member.id, collected_by: editCollector.id, payment_date: '2026-09-08',
      amount: 1000, payment_type: 'membership_due', payment_method: 'cash',
      status: 'succeeded', receipt_number: '903', for_year: 2025
    });

    const res = mockRes();
    await updateTransaction(
      { params: { id: String(tx.id) }, body: { payment_type: 'donation', receipt_number: '903', for_year: null } },
      res
    );
    expect(res.body.success).toBe(true);

    const updated = await Transaction.findByPk(tx.id);
    expect(updated.payment_type).toBe('donation');
    expect(updated.for_year).toBeNull();
  });

  it('rejects a receipt number already used by another transaction', async () => {
    const a = await Transaction.create({
      collected_by: editCollector.id, payment_date: '2026-08-01', amount: 10,
      payment_type: 'donation', payment_method: 'cash', status: 'succeeded', receipt_number: '555'
    });
    const b = await Transaction.create({
      collected_by: editCollector.id, payment_date: '2026-08-01', amount: 12,
      payment_type: 'donation', payment_method: 'credit_card', status: 'succeeded'
    });
    const res = mockRes();
    await updateTransaction({ params: { id: String(b.id) }, body: { receipt_number: '555' } }, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
    expect(String(a.receipt_number)).toBe('555');
  });
});
