'use strict';

// scripts/delete-duplicate-transaction.js — deleting a duplicate payment. All data synthetic.
const {
  sequelize, Member, Transaction, LedgerEntry, Pledge, PledgeCampaign, PledgeAllocation
} = require('../../src/models');
const { deleteDuplicateTransaction } = require('../../scripts/delete-duplicate-transaction');

describe('delete-duplicate-transaction', () => {
  let member, tx;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {}, force: true, truncate: true });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Member.destroy({ where: {} });

    member = await Member.create({ first_name: 'Test', last_name: 'Member', phone_number: '+15555550191', is_active: true });
    tx = await Transaction.create({
      member_id: member.id, amount: 190, payment_date: '2025-02-09',
      payment_type: 'membership_due', payment_method: 'other', status: 'succeeded'
    });
    await LedgerEntry.create({
      type: 'membership_due', category: 'INC001', amount: 190, entry_date: '2025-02-09',
      member_id: member.id, payment_method: 'other', transaction_id: tx.id, memo: 'duplicate'
    });
  });

  const run = async (extra = {}) => {
    const t = await sequelize.transaction();
    try {
      const log = await deleteDuplicateTransaction({ transactionId: tx.id, ...extra }, t);
      await t.commit();
      return log;
    } catch (e) { await t.rollback(); throw e; }
  };

  it('deletes the transaction and its ledger entry', async () => {
    const log = await run({ reason: 'duplicate of #843' });
    expect(log.join('\n')).toMatch(/deleted 1 ledger entry/);
    expect(log.join('\n')).toMatch(/duplicate of #843/);
    expect(await Transaction.findByPk(tx.id)).toBeNull();
    expect(await LedgerEntry.count({ where: { transaction_id: tx.id } })).toBe(0);
  });

  it('refuses when the transaction is allocated to a pledge', async () => {
    const campaign = await PledgeCampaign.create({ slug: 'drive', name: 'Drive', status: 'active', start_date: '2026-01-01' });
    const pledge = await Pledge.create({ member_id: member.id, campaign_id: campaign.id, amount: 190, first_name: 'Test', last_name: 'Member', fulfillment_intent: 'later' });
    await PledgeAllocation.create({ pledge_id: pledge.id, transaction_id: tx.id, amount: 190, source: 'treasurer_manual', idempotency_key: `txn:${tx.id}` });

    await expect(run()).rejects.toThrow(/allocated to a pledge/);
    expect(await Transaction.findByPk(tx.id)).not.toBeNull();
  });

  it('a rolled-back run (dry run) changes nothing', async () => {
    const t = await sequelize.transaction();
    await deleteDuplicateTransaction({ transactionId: tx.id }, t);
    await t.rollback();
    expect(await Transaction.findByPk(tx.id)).not.toBeNull();
    expect(await LedgerEntry.count({ where: { transaction_id: tx.id } })).toBe(1);
  });
});
