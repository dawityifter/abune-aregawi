'use strict';

// scripts/resolve-bank-deposit-duplicates.js — one bank deposit recorded as
// several transactions (Gmail automation, Add Payment, bank reconciliation).
// All data synthetic.
const {
  sequelize, Member, Transaction, LedgerEntry, ZelleEmailQueue, BankTransaction, IncomeCategory
} = require('../../src/models');
const {
  findDepositDuplicates, resolveDepositDuplicates
} = require('../../scripts/resolve-bank-deposit-duplicates');
const { undoAutoReconciliation } = require('../../src/services/autoReconcileService');

describe('resolve-bank-deposit-duplicates', () => {
  let member;
  let other;
  let seq = 0;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    member = await Member.create({ first_name: 'Dep', last_name: 'Giver', phone_number: '+15555550196', is_active: true, role: 'admin' });
    other = await Member.create({ first_name: 'Other', last_name: 'Giver', phone_number: '+15555550197', is_active: true });
    for (const [type, gl] of [['membership_due', 'INC001'], ['tithe', 'INC002'], ['donation', 'INC003']]) {
      await IncomeCategory.create({ name: type, payment_type_mapping: type, gl_code: gl });
    }
  });

  beforeEach(async () => {
    await ZelleEmailQueue.destroy({ where: {} });
    await BankTransaction.destroy({ where: {} });
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
  });

  async function entry({
    memberId = member.id, date = '2026-01-01', type = 'membership_due', method = 'zelle',
    externalId, receipt = null, amount = 50
  } = {}) {
    seq += 1;
    const tx = await Transaction.create({
      member_id: memberId, collected_by: member.id, amount, payment_date: date,
      payment_type: type, payment_method: method, status: 'succeeded',
      external_id: externalId === undefined ? `gmail:<dep-${seq}@example.com>` : externalId,
      receipt_number: receipt
    });
    await LedgerEntry.create({
      type, category: 'INC001', amount, entry_date: date, member_id: memberId,
      payment_method: method, transaction_id: tx.id, memo: 'synthetic',
      external_id: externalId === undefined ? `gmail:<dep-${seq}@example.com>` : externalId
    });
    return tx;
  }

  // A deposit the automatic pass matched by creating a transaction.
  async function deposit({
    date = '2026-01-02', type = 'membership_due', source = 'AUTO_MEMBER', memberId = member.id,
    payer = 'DEP GIVER', amount = 50, status = 'MATCHED'
  } = {}) {
    seq += 1;
    const hash = `${String(seq).padStart(4, '0')}${'c'.repeat(28)}`;
    const bank = await BankTransaction.create({
      transaction_hash: hash, date, amount, type: 'ZELLE', status,
      description: `Zelle payment from ${payer} REF${seq}`, payer_name: payer, external_ref_id: `REF${seq}`,
      reconciled_source: status === 'MATCHED' ? source : null
    });
    if (status !== 'MATCHED') return { bank, tx: null };
    const tx = await entry({ memberId, date, type, externalId: hash, amount });
    await bank.update({
      member_id: memberId,
      reconciled_meta: source === 'AUTO_MEMBER' ? { transaction_id: tx.id, created: true } : { transaction_id: tx.id }
    });
    return { bank, tx };
  }

  const resolve = async (args) => {
    const t = await sequelize.transaction();
    try {
      const log = await resolveDepositDuplicates(args, t);
      await t.commit();
      return log;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  };

  test('keeps the earlier entry and moves the bank deposit onto it', async () => {
    const earlier = await entry({ date: '2026-01-01' });
    const { bank, tx: auto } = await deposit({ date: '2026-01-02' });

    const groups = await findDepositDuplicates();
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ bankRow: { id: bank.id }, keep: { id: earlier.id }, problems: [] });
    expect(groups[0].remove.map((t) => t.id)).toEqual([auto.id]);

    await resolve({ bankTransactionId: bank.id });

    expect(await Transaction.findByPk(auto.id)).toBeNull();
    expect(await LedgerEntry.count({ where: { transaction_id: auto.id } })).toBe(0);
    await earlier.reload();
    expect(earlier.external_id).toBe(bank.transaction_hash);
    const ledger = await LedgerEntry.findOne({ where: { transaction_id: earlier.id } });
    expect(ledger.external_id).toBe(bank.transaction_hash);
    expect(ledger.statement_date).toBe('2026-01-02');

    await bank.reload();
    expect(bank.status).toBe('MATCHED');
    expect(bank.reconciled_source).toBe('AUTO_LINKED');
    expect(bank.reconciled_meta).toMatchObject({ transaction_id: earlier.id, created: false, prev_external_id: expect.stringMatching(/^gmail:/) });
    expect(await findDepositDuplicates()).toHaveLength(0);
  });

  test('the kept entry gets a ledger entry when it never had one, so the income stays on the ledger', async () => {
    const earlier = await entry();
    await LedgerEntry.destroy({ where: { transaction_id: earlier.id } });
    const { bank } = await deposit();

    await resolve({ bankTransactionId: bank.id });
    const ledger = await LedgerEntry.findAll({ where: { transaction_id: earlier.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      type: 'membership_due', category: 'INC001', member_id: member.id,
      external_id: bank.transaction_hash, statement_date: '2026-01-02'
    });
    expect(Number(ledger[0].amount)).toBe(50);
    expect(await LedgerEntry.count()).toBe(1);
  });

  test('undoing the deposit afterwards unlinks the kept entry instead of deleting it', async () => {
    const earlier = await entry();
    const { bank } = await deposit();
    const prev = earlier.external_id;
    await resolve({ bankTransactionId: bank.id });

    await undoAutoReconciliation(bank.id, member);
    await earlier.reload();
    expect(earlier.external_id).toBe(prev);
    await bank.reload();
    expect(bank.status).toBe('PENDING');
  });

  test('a hand-entered receipt wins over older entries; every other entry goes', async () => {
    const gmail = await entry({ date: '2025-12-28' });
    const receipt = await entry({ date: '2025-12-28', method: 'other', externalId: 'man_1', receipt: '5687' });
    const { bank, tx: auto } = await deposit({ date: '2025-12-29' });

    const [group] = await findDepositDuplicates();
    expect(group.keep.id).toBe(receipt.id);
    expect(group.remove.map((t) => t.id).sort()).toEqual([gmail.id, auto.id].sort());

    await resolve({ bankTransactionId: bank.id });
    expect(await Transaction.count({ where: { member_id: member.id } })).toBe(1);
    expect((await Transaction.findByPk(receipt.id)).external_id).toBe(bank.transaction_hash);
  });

  test('an "imported" receipt is not a receipt: the oldest entry is kept', async () => {
    const imported = await entry({ externalId: '22898157584', receipt: 'imported' });
    const { bank } = await deposit();
    const [group] = await findDepositDuplicates();
    expect(group.keep.id).toBe(imported.id);
    await resolve({ bankTransactionId: bank.id });
  });

  test('a type clash is listed and needs --type; the kept entry and its ledger take that type', async () => {
    const earlier = await entry({ type: 'membership_due' });
    const { bank } = await deposit({ type: 'tithe' });

    const [group] = await findDepositDuplicates();
    expect(group.problems).toEqual([expect.stringMatching(/types differ/)]);
    await expect(resolve({ bankTransactionId: bank.id })).rejects.toThrow(/--type/);

    await resolve({ bankTransactionId: bank.id, paymentType: 'tithe' });
    await earlier.reload();
    expect(earlier.payment_type).toBe('tithe');
    const ledger = await LedgerEntry.findOne({ where: { transaction_id: earlier.id } });
    expect(ledger).toMatchObject({ type: 'tithe', category: 'INC002' });
  });

  test('--type with no income category of its own falls back like the app (INC999)', async () => {
    const earlier = await entry({ type: 'membership_due' });
    const { bank } = await deposit({ type: 'tithe' });
    await resolve({ bankTransactionId: bank.id, paymentType: 'tigray_hunger_fundraiser' });
    const ledger = await LedgerEntry.findOne({ where: { transaction_id: earlier.id } });
    expect(ledger).toMatchObject({ type: 'tigray_hunger_fundraiser', category: 'INC999' });
  });

  test('choosing the kept entry\'s own type leaves its ledger category alone', async () => {
    const earlier = await entry({ type: 'membership_due' });
    await LedgerEntry.update({ category: 'INC042' }, { where: { transaction_id: earlier.id } });
    const { bank } = await deposit({ type: 'tithe' });
    await resolve({ bankTransactionId: bank.id, paymentType: 'membership_due' });
    expect((await LedgerEntry.findOne({ where: { transaction_id: earlier.id } })).category).toBe('INC042');
  });

  test('rejects a --type that is not a payment type', async () => {
    await entry({ type: 'membership_due' });
    const { bank } = await deposit({ type: 'tithe' });
    await expect(resolve({ bankTransactionId: bank.id, paymentType: 'tithes' })).rejects.toThrow(/not a payment type/);
  });

  test('refuses when two entries carry real receipt numbers', async () => {
    await entry({ method: 'other', externalId: 'man_a', receipt: '100' });
    await entry({ method: 'other', externalId: 'man_b', receipt: '101' });
    const { bank } = await deposit();
    const [group] = await findDepositDuplicates();
    expect(group.problems).toEqual([expect.stringMatching(/receipts/)]);
    await expect(resolve({ bankTransactionId: bank.id })).rejects.toThrow(/receipts/);
  });

  test('refuses when the same sender has another deposit of that amount in the window', async () => {
    await entry({ date: '2026-02-01' });
    const { bank } = await deposit({ date: '2026-02-02' });
    await deposit({ date: '2026-02-02', status: 'PENDING' });

    const [group] = await findDepositDuplicates();
    expect(group.problems).toEqual([expect.stringMatching(/another deposit/)]);
    await expect(resolve({ bankTransactionId: bank.id })).rejects.toThrow(/another deposit/);
  });

  test('ignores other members, other amounts, entries outside the window, and entries confirmed by another deposit', async () => {
    await entry({ memberId: other.id });
    await entry({ amount: 51 });
    await entry({ date: '2025-12-20' });
    await deposit({ date: '2026-01-02' });
    // Two bank deposits, each with its own entry: two real payments.
    await deposit({ date: '2026-03-02', payer: 'SECOND SENDER' });
    await deposit({ date: '2026-03-02', payer: 'THIRD SENDER' });

    const groups = await findDepositDuplicates();
    expect(groups).toHaveLength(0);
  });

  test('Zelle Review emails of removed entries point at the kept one and its deposit', async () => {
    const earlier = await entry();
    const { bank, tx: auto } = await deposit();
    const q = await ZelleEmailQueue.create({
      external_id: 'gmail:<q@example.com>', amount: 50, payment_date: '2026-01-02', status: 'CREATED', transaction_id: auto.id
    });

    await resolve({ bankTransactionId: bank.id });
    await q.reload();
    expect(q.transaction_id).toBe(earlier.id);
    expect(q.bank_transaction_id).toBe(bank.id);
  });
});
