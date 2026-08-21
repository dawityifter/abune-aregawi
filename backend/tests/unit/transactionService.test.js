const { createTransactionRecord } = require('../../src/services/transactionService');
const { Transaction, LedgerEntry, Member, sequelize } = require('../../src/models');

describe('createTransactionRecord', () => {
  let member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Member.destroy({ where: {} });
    member = await Member.create({
      first_name: 'Ann',
      last_name: 'Giver',
      phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'treasurer', firebase_uid: 'uid-ann'
    });
  });

  const base = () => ({
    member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
    amount: 250, payment_type: 'pledge_drive', payment_method: 'zelle'
  });

  it('creates a transaction and its ledger entry', async () => {
    const txn = await createTransactionRecord(base());
    expect(parseFloat(txn.amount)).toBe(250);
    const entries = await LedgerEntry.findAll({ where: { transaction_id: txn.id } });
    expect(entries).toHaveLength(1);
  });

  it('requires a receipt number for cash', async () => {
    await expect(
      createTransactionRecord({ ...base(), payment_method: 'cash' })
    ).rejects.toThrow(/receipt/i);
  });

  it('rolls back the transaction and the ledger entry together on failure', async () => {
    const t = await sequelize.transaction();
    await createTransactionRecord(base(), { transaction: t });
    await t.rollback();
    expect(await Transaction.count()).toBe(0);
    expect(await LedgerEntry.count()).toBe(0);
  });
});
