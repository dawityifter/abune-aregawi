'use strict';

const request = require('supertest');
const app = require('../../src/server');
const {
  Member, BankTransaction, Transaction, LedgerEntry, BankMemoMatch, ZelleMemoMatch,
  Pledge, PledgeCampaign, PledgeAllocation, sequelize
} = require('../../src/models');

// The bank row a treasurer is reviewing: a Zelle credit from a member who
// pledged.
const makeBankTxn = (extra = {}) => BankTransaction.create({
  date: new Date('2026-03-01'),
  amount: 250.00,
  description: 'ZELLE FROM TEST PLEDGER',
  type: 'ZELLE',
  status: 'PENDING',
  transaction_hash: `hash-${Math.random().toString(36).slice(2)}`,
  raw_data: {},
  ...extra
});

describe('Bank reconciliation credits an open pledge', () => {
  let caller, pledger, campaign;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {}, force: true, truncate: true });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await BankMemoMatch.destroy({ where: {} });
    await ZelleMemoMatch.destroy({ where: {} });
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await BankTransaction.destroy({ where: {} });
    await Member.destroy({ where: {} });

    // Matches the firebase token mocked in tests/setup.js.
    caller = await Member.create({
      first_name: 'Test',
      last_name: 'Admin',
      email: 'test@example.com',
      firebase_uid: 'test-firebase-uid',
      phone_number: '+15550000501',
      role: 'treasurer',
      is_active: true
    });
    pledger = await Member.create({
      first_name: 'Test',
      last_name: 'Pledger',
      phone_number: '+15550000502',
      is_active: true,
      role: 'member'
    });
    campaign = await PledgeCampaign.create({
      slug: '2026-drive',
      name: 'Test Drive',
      status: 'active',
      start_date: '2026-01-01',
      end_date: null
    });
  });

  const openPledge = (amount = 1000) => Pledge.create({
    member_id: pledger.id,
    campaign_id: campaign.id,
    amount,
    first_name: 'Test',
    last_name: 'Pledger',
    fulfillment_intent: 'later'
  });

  const reconcile = (body) => request(app)
    .post('/api/bank/reconcile')
    .set('Authorization', 'Bearer t')
    .send({ action: 'MATCH', member_id: pledger.id, ...body });

  it('allocates a pledge_drive payment to the member\'s open pledge', async () => {
    const pledge = await openPledge();
    const bankTxn = await makeBankTxn();

    const res = await reconcile({ transaction_id: bankTxn.id, payment_type: 'pledge_drive' });
    expect(res.status).toBe(200);

    const allocations = await PledgeAllocation.findAll({ where: { pledge_id: pledge.id } });
    expect(allocations).toHaveLength(1);
    expect(parseFloat(allocations[0].amount)).toBe(250);
    expect(allocations[0].source).toBe('treasurer_manual');
  });

  it('leaves other payment types alone', async () => {
    const pledge = await openPledge();
    const bankTxn = await makeBankTxn();

    await reconcile({ transaction_id: bankTxn.id, payment_type: 'donation' });

    expect(await PledgeAllocation.count({ where: { pledge_id: pledge.id } })).toBe(0);
  });

  it('opens a pledge and credits it when the member has none', async () => {
    const bankTxn = await makeBankTxn();

    const res = await reconcile({
      transaction_id: bankTxn.id,
      payment_type: 'pledge_drive',
      pledge_amount: 1000
    });
    expect(res.status).toBe(200);

    const pledge = await Pledge.findOne({ where: { member_id: pledger.id } });
    expect(pledge).not.toBeNull();
    expect(parseFloat(pledge.amount)).toBe(1000);
    // $250 of $1,000 — still owed, so it must stay collectable.
    expect(pledge.fulfillment_intent).toBe('later');

    const allocations = await PledgeAllocation.findAll({ where: { pledge_id: pledge.id } });
    expect(allocations).toHaveLength(1);
    expect(parseFloat(allocations[0].amount)).toBe(250);
  });

  it('marks a pledge paid in full when the payment covers it', async () => {
    const bankTxn = await makeBankTxn();

    await reconcile({
      transaction_id: bankTxn.id,
      payment_type: 'pledge_drive',
      pledge_amount: 250
    });

    const pledge = await Pledge.findOne({ where: { member_id: pledger.id } });
    expect(pledge.fulfillment_intent).toBe('immediate');
  });

  it('refuses to open a pledge for a bookkeeper, who may not pledge on behalf', async () => {
    await caller.update({ role: 'bookkeeper' });
    const bankTxn = await makeBankTxn();

    const res = await reconcile({
      transaction_id: bankTxn.id,
      payment_type: 'pledge_drive',
      pledge_amount: 1000
    });

    expect(res.status).toBe(403);
    expect(await Pledge.count()).toBe(0);
    // The money must not be half-recorded either.
    await bankTxn.reload();
    expect(bankTxn.status).toBe('PENDING');
  });

  // Recording money always wins: the payment stands even when the pledge side
  // fails, and the treasurer finds it in the unallocated queue.
  it('still records the payment when the allocation fails', async () => {
    const pledge = await openPledge();
    const bankTxn = await makeBankTxn();

    const allocationService = require('../../src/services/pledgeAllocationService');
    const spy = jest.spyOn(allocationService, 'maybeAllocateToPledge')
      .mockRejectedValue(new Error('allocation exploded'));

    try {
      const res = await reconcile({ transaction_id: bankTxn.id, payment_type: 'pledge_drive' });
      expect(res.status).toBe(200);
    } finally {
      spy.mockRestore();
    }

    await bankTxn.reload();
    expect(bankTxn.status).toBe('MATCHED');
    const donation = await Transaction.findOne({ where: { member_id: pledger.id } });
    expect(donation).not.toBeNull();
    expect(parseFloat(donation.amount)).toBe(250);
    expect(await PledgeAllocation.count({ where: { pledge_id: pledge.id } })).toBe(0);
  });
});
