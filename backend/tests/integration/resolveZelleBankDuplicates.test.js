'use strict';

// scripts/resolve-zelle-bank-duplicates.js — a Zelle payment recorded once from
// its email and again by bank reconciliation. All data synthetic.
const {
  sequelize, Member, Transaction, LedgerEntry, ZelleEmailQueue, BankTransaction
} = require('../../src/models');
const {
  findDuplicatePairs, resolveDuplicatePair
} = require('../../scripts/resolve-zelle-bank-duplicates');

describe('resolve-zelle-bank-duplicates', () => {
  let member;
  let other;
  let seq = 0;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    member = await Member.create({ first_name: 'Dup', last_name: 'Giver', phone_number: '+15555550194', is_active: true });
    other = await Member.create({ first_name: 'Other', last_name: 'Giver', phone_number: '+15555550195', is_active: true });
  });

  beforeEach(async () => {
    await ZelleEmailQueue.destroy({ where: {} });
    await BankTransaction.destroy({ where: {} });
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
  });

  async function payment({ memberId = member.id, externalId, date, receipt = null }) {
    const tx = await Transaction.create({
      member_id: memberId, collected_by: member.id, amount: 60, payment_date: date,
      payment_type: 'donation', payment_method: 'zelle', status: 'succeeded',
      external_id: externalId, receipt_number: receipt
    });
    await LedgerEntry.create({
      type: 'donation', category: 'INC001', amount: 60, entry_date: date,
      member_id: memberId, payment_method: 'zelle', transaction_id: tx.id, memo: 'synthetic'
    });
    return tx;
  }

  // The older auto-created shape: email row with a transaction, no payer name.
  async function emailCreated({ date = '2026-08-20', memberId, receipt } = {}) {
    seq += 1;
    const externalId = `gmail:<dup-${seq}@example.com>`;
    const tx = await payment({ memberId, externalId, date, receipt });
    const row = await ZelleEmailQueue.create({
      external_id: externalId, payer_name: null, amount: 60, payment_date: date,
      status: 'AUTO_CREATED', transaction_id: tx.id
    });
    return { row, tx };
  }

  // A bank row the treasurer approved, which created a second transaction.
  async function bankCreated({ date = '2026-08-22', memberId } = {}) {
    seq += 1;
    const hash = `${String(seq).padStart(4, '0')}${'b'.repeat(28)}`;
    const bank = await BankTransaction.create({
      transaction_hash: hash, date, amount: 60, type: 'ZELLE', status: 'MATCHED',
      description: 'Zelle payment from RELATIVE OF GIVER QWERTYUIOPAS',
      payer_name: 'RELATIVE OF GIVER', external_ref_id: 'QWERTYUIOPAS', reconciled_source: 'MANUAL'
    });
    const tx = await payment({ memberId, externalId: hash, date });
    return { bank, tx };
  }

  const resolve = async (args) => {
    const t = await sequelize.transaction();
    try {
      const log = await resolveDuplicatePair(args, t);
      await t.commit();
      return log;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  };

  test('reports an email-created payment that bank reconciliation recorded again', async () => {
    const { row, tx: emailTx } = await emailCreated();
    const { bank, tx: bankTx } = await bankCreated();

    const pairs = await findDuplicatePairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({
      queueRow: { id: row.id }, emailTx: { id: emailTx.id }, bankRow: { id: bank.id }, bankTx: { id: bankTx.id }, problems: []
    });
  });

  test('does not report a different amount, a date outside the window, or a bank row already linked to the email', async () => {
    await emailCreated({ date: '2026-08-01' });
    await bankCreated({ date: '2026-08-10' }); // 9 days later

    const { row, tx } = await emailCreated({ date: '2026-08-20' });
    const { bank } = await bankCreated({ date: '2026-08-21' });
    await bank.update({ amount: 61 });

    // Properly linked: one transaction, carrying the bank hash.
    const linked = await bankCreated({ date: '2026-08-21' });
    await LedgerEntry.destroy({ where: { transaction_id: linked.tx.id } });
    await linked.tx.destroy();
    await row.update({ bank_transaction_id: linked.bank.id });
    await tx.update({ external_id: linked.bank.transaction_hash });

    expect(await findDuplicatePairs()).toHaveLength(0);
  });

  test('keeps the bank-confirmed transaction, deletes the email one, and points the email at it', async () => {
    const { row, tx: emailTx } = await emailCreated();
    const { bank, tx: bankTx } = await bankCreated();

    await resolve({ bankTransactionId: bank.id });

    expect(await Transaction.findByPk(emailTx.id)).toBeNull();
    expect(await LedgerEntry.count({ where: { transaction_id: emailTx.id } })).toBe(0);
    expect(await Transaction.findByPk(bankTx.id)).not.toBeNull();
    expect(await LedgerEntry.count({ where: { transaction_id: bankTx.id } })).toBe(1);

    await row.reload();
    expect(row.transaction_id).toBe(bankTx.id);
    expect(row.bank_transaction_id).toBe(bank.id);
    expect(row.status).toBe('BANK_POSTED');
    expect(row.payer_name).toBe('RELATIVE OF GIVER');

    await bank.reload();
    expect(bank.status).toBe('MATCHED');
    expect(await findDuplicatePairs()).toHaveLength(0);
  });

  test('carries the email entry\'s receipt number over when the bank entry has none', async () => {
    await emailCreated({ receipt: '4321' });
    const { bank, tx: bankTx } = await bankCreated();
    await resolve({ bankTransactionId: bank.id });
    expect((await Transaction.findByPk(bankTx.id)).receipt_number).toBe('4321');
  });

  test('refuses when the two entries credit different members', async () => {
    const { tx: emailTx } = await emailCreated({ memberId: other.id });
    const { bank } = await bankCreated();

    expect((await findDuplicatePairs())[0].problems).toEqual([expect.stringMatching(/different members/)]);
    await expect(resolve({ bankTransactionId: bank.id })).rejects.toThrow(/different members/);
    expect(await Transaction.findByPk(emailTx.id)).not.toBeNull();
  });

  test('of several same-amount emails, the one crediting the same member is the pair', async () => {
    const mine = await emailCreated({ date: '2026-08-20' });
    const someoneElse = await emailCreated({ date: '2026-08-21', memberId: other.id });
    const { bank } = await bankCreated({ date: '2026-08-22' });
    await bankCreated({ date: '2026-08-22', memberId: other.id }); // the other person's own bank row

    const pairs = await findDuplicatePairs();
    expect(pairs.map((p) => [p.queueRow.id, p.problems])).toEqual(expect.arrayContaining([
      [mine.row.id, []], [someoneElse.row.id, []]
    ]));
    expect(pairs).toHaveLength(2);
    expect(pairs.every((p) => !p.ambiguous)).toBe(true);

    await resolve({ bankTransactionId: bank.id });
    expect(await Transaction.findByPk(mine.tx.id)).toBeNull();
    expect(await Transaction.findByPk(someoneElse.tx.id)).not.toBeNull();
  });

  test('refuses to guess when two emails fit one bank row, and resolves the one named', async () => {
    const first = await emailCreated({ date: '2026-08-20' });
    await emailCreated({ date: '2026-08-21' });
    const { bank } = await bankCreated({ date: '2026-08-22' });

    await expect(resolve({ bankTransactionId: bank.id })).rejects.toThrow(/--email/);
    await resolve({ bankTransactionId: bank.id, queueId: first.row.id });
    expect(await Transaction.findByPk(first.tx.id)).toBeNull();
  });
});
