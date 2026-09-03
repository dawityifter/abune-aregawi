/**
 * A cleared check that has no matching hand-entered expense is not merely
 * "pending review" — it is unreconciled, and the treasurer needs to know why:
 * nothing was entered, or something was entered for a different amount.
 */
const request = require('supertest');
const app = require('../../src/server');
const {
  Member,
  BankTransaction,
  LedgerEntry,
  ExpenseCategory
} = require('../../src/models');

describe('Check reconciliation status on the bank list', () => {
  beforeAll(async () => {
    await LedgerEntry.destroy({ where: {} });
    await BankTransaction.destroy({ where: {} });
    await Member.destroy({ where: {} });

    await Member.create({
      first_name: 'Test',
      last_name: 'Admin',
      email: 'test@example.com',
      firebase_uid: 'test-firebase-uid',
      phone_number: '+1234567890',
      role: 'admin',
      is_active: true
    });

    await ExpenseCategory.findOrCreate({
      where: { gl_code: 'EXP100' },
      defaults: { gl_code: 'EXP100', name: 'Utilities', is_active: true }
    });
  });

  beforeEach(async () => {
    await LedgerEntry.destroy({ where: {} });
    await BankTransaction.destroy({ where: {} });
  });

  async function fetchRow(hash) {
    const res = await request(app)
      .get('/api/bank/transactions')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);
    return res.body.data.transactions.find((t) => t.transaction_hash === hash);
  }

  async function pendingCheck({ checkNumber, amount, hash }) {
    return BankTransaction.create({
      date: new Date('2025-02-10'),
      amount,
      description: `CHECK #${checkNumber}`,
      type: 'CHECK_PAID',
      status: 'PENDING',
      check_number: checkNumber,
      transaction_hash: hash,
      raw_data: {}
    });
  }

  describe('expense details on a reconciled bank row', () => {
    async function matchedCheckWithExpense({ sourceSystem }) {
      const hash = `bankhash-detail-${sourceSystem}`;
      await BankTransaction.create({
        date: new Date('2025-02-10'), amount: -120.00, description: 'CHECK #1701',
        type: 'CHECK_PAID', status: 'MATCHED', check_number: '1701',
        reconciled_source: 'AUTO_CHECK_MATCH', reconciled_at: new Date('2025-02-12'),
        transaction_hash: hash, raw_data: {}
      });
      await LedgerEntry.create({
        type: 'expense', category: 'EXP100', amount: 120.00, entry_date: '2025-02-09',
        payment_method: 'check', check_number: '1701', receipt_number: '7001',
        payee_name: 'Dallas Utilities', memo: 'February power bill',
        external_id: hash, source_system: sourceSystem
      });
      return hash;
    }

    it('shows the expense for a check the treasurer entered by hand', async () => {
      // The match-only flow links a MANUAL expense. The lookup used to require
      // source_system 'bank_reconciliation', so these showed nothing at all.
      const hash = await matchedCheckWithExpense({ sourceSystem: 'manual' });

      const row = await fetchRow(hash);

      expect(row.reconciled_expense).toBeTruthy();
      expect(row.reconciled_expense.payee_name).toBe('Dallas Utilities');
    });

    it('still shows the expense for one the bank reconciliation created', async () => {
      const hash = await matchedCheckWithExpense({ sourceSystem: 'bank_reconciliation' });

      const row = await fetchRow(hash);

      expect(row.reconciled_expense.payee_name).toBe('Dallas Utilities');
    });

    it('carries the full expense record, not just payee and memo', async () => {
      const hash = await matchedCheckWithExpense({ sourceSystem: 'manual' });

      const row = await fetchRow(hash);

      expect(row.reconciled_expense).toMatchObject({
        category: 'EXP100',
        category_name: 'Utilities',
        check_number: '1701',
        receipt_number: '7001',
        payment_method: 'check',
        memo: 'February power bill'
      });
      expect(Number(row.reconciled_expense.amount)).toBe(120);
      expect(row.reconciled_expense.id).toBeDefined();
    });

    it('reports nothing for a bank row with no linked expense', async () => {
      await BankTransaction.create({
        date: new Date('2025-02-10'), amount: -55.00, description: 'CHECK #1702',
        type: 'CHECK_PAID', status: 'MATCHED', check_number: '1702',
        transaction_hash: 'bankhash-detail-none', raw_data: {}
      });

      const row = await fetchRow('bankhash-detail-none');

      expect(row.reconciled_expense).toBeFalsy();
    });
  });

  it('flags a cleared check with no hand-entered expense as unreconciled', async () => {
    await pendingCheck({ checkNumber: '1593', amount: -120.00, hash: 'bankhash-status-none' });

    const row = await fetchRow('bankhash-status-none');
    expect(row.check_status).toEqual(
      expect.objectContaining({ state: 'NOT_RECONCILED', reason: 'NO_MANUAL_ENTRY', check_number: '1593' })
    );
  });

  it('explains an amount disagreement instead of just saying unreconciled', async () => {
    await LedgerEntry.create({
      type: 'expense', category: 'EXP100', amount: 205.00, entry_date: '2025-02-08',
      payment_method: 'check', check_number: '1594', memo: 'Utilities', source_system: 'manual'
    });
    await pendingCheck({ checkNumber: '1594', amount: -250.00, hash: 'bankhash-status-amt' });

    const row = await fetchRow('bankhash-status-amt');
    expect(row.check_status.state).toBe('NOT_RECONCILED');
    expect(row.check_status.reason).toBe('AMOUNT_MISMATCH');
    expect(Number(row.check_status.expense_amount)).toBe(205);
    expect(Number(row.check_status.bank_amount)).toBe(250);
  });

  it('says nothing about check status for a non-check debit', async () => {
    await BankTransaction.create({
      date: new Date('2025-02-11'),
      amount: -75.00,
      description: 'ORIG CO NAME:SOME VENDOR IND NAME:CHURCH',
      type: 'ACH_DEBIT',
      status: 'PENDING',
      transaction_hash: 'bankhash-status-ach',
      raw_data: {}
    });

    const row = await fetchRow('bankhash-status-ach');
    expect(row.check_status).toBeUndefined();
  });

  it('reports a matched check as reconciled', async () => {
    await LedgerEntry.create({
      type: 'expense', category: 'EXP100', amount: 90.00, entry_date: '2025-02-08',
      payment_method: 'check', check_number: '1595', memo: 'Utilities',
      source_system: 'manual', external_id: 'bankhash-status-ok'
    });
    const txn = await pendingCheck({ checkNumber: '1595', amount: -90.00, hash: 'bankhash-status-ok' });
    await txn.update({
      status: 'MATCHED',
      reconciled_source: 'AUTO_CHECK_MATCH',
      reconciled_meta: { check_number: '1595', created: false }
    });

    const row = await fetchRow('bankhash-status-ok');
    expect(row.check_status).toEqual(
      expect.objectContaining({ state: 'RECONCILED', check_number: '1595' })
    );
  });
});
