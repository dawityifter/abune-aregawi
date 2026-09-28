'use strict';

// scripts/report-learned-sender-mismatches.js — read-only review list. All data synthetic.
const {
  sequelize, Member, Transaction, BankTransaction, BankMemoMatch, ZelleMemoMatch
} = require('../../src/models');
const { buildReport } = require('../../scripts/report-learned-sender-mismatches');

describe('report-learned-sender-mismatches', () => {
  let sender, pledger, tx;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await BankMemoMatch.destroy({ where: {} });
    await ZelleMemoMatch.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await BankTransaction.destroy({ where: {} });
    await Member.destroy({ where: {} });

    sender = await Member.create({ first_name: 'Abel', last_name: 'Sender', phone_number: '+15555550195', is_active: true });
    pledger = await Member.create({ first_name: 'Hana', last_name: 'Pledger', phone_number: '+15555550196', is_active: true });

    await BankTransaction.create({
      transaction_hash: 'c'.repeat(32), date: '2026-09-21', amount: 300, type: 'ZELLE', status: 'MATCHED',
      description: 'Zelle payment from ABEL T SENDER 39990000001', payer_name: 'ABEL T SENDER', member_id: pledger.id
    });
    tx = await Transaction.create({
      member_id: pledger.id, amount: 300, payment_date: '2026-09-21', payment_type: 'donation',
      payment_method: 'zelle', status: 'succeeded', external_id: 'c'.repeat(32), collected_by: pledger.id
    });

    // Suspicious: remembered for someone the name doesn't resemble, legacy disagrees.
    await BankMemoMatch.create({ match_key: 'ZELLE:PAYER:ABEL T SENDER', source_type: 'ZELLE', member_id: pledger.id });
    await ZelleMemoMatch.create({ member_id: sender.id, memo: 'ABEL T SENDER' });
    // Fine: the member's own account.
    await BankMemoMatch.create({ match_key: 'ZELLE:PAYER:HANA PLEDGER', source_type: 'ZELLE', member_id: pledger.id });
  });

  it('lists senders remembered for a member they do not resemble, with the evidence', async () => {
    const rows = await buildReport();

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.payer).toBe('ABEL T SENDER');
    expect(String(row.member.id)).toBe(String(pledger.id));
    expect(row.resembles).toBe(false);
    expect(String(row.legacy_owner.id)).toBe(String(sender.id));
    expect(row.credited).toEqual([{ member: expect.objectContaining({ id: pledger.id }), count: 1 }]);
    expect(row.resembling_members.map((m) => String(m.id))).toEqual([String(sender.id)]);
    expect(String(row.latest_transaction_id)).toBe(String(tx.id));
  });

  it('--all includes senders that resemble their member', async () => {
    expect(await buildReport({ includeResembling: true })).toHaveLength(2);
  });

  it('writes nothing', async () => {
    const before = await BankMemoMatch.count();
    await buildReport({ includeResembling: true });
    expect(await BankMemoMatch.count()).toBe(before);
  });
});
