'use strict';

// Pledge Drive payments created from the Zelle Review screen behave as they do
// in Bank Reconciliation and Add Payment: credit the open pledge, or open one
// with the payment. And the later bank link must not credit them again.
// All data synthetic.
jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: class { setCredentials() {} } },
    youtube: () => ({}),
    gmail: () => ({ users: { labels: {}, messages: {} } })
  }
}));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/server');
const {
  Member, BankTransaction, Transaction, LedgerEntry, BankMemoMatch, ZelleMemoMatch, ZelleEmailQueue,
  Pledge, PledgeCampaign, PledgeAllocation, sequelize
} = require('../../src/models');

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Zelle Review create with Pledge Drive', () => {
  let caller, pledger, campaign;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {}, force: true, truncate: true });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await ZelleEmailQueue.destroy({ where: {} });
    await BankMemoMatch.destroy({ where: {} });
    await ZelleMemoMatch.destroy({ where: {} });
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await BankTransaction.destroy({ where: {} });
    await Member.destroy({ where: {} });

    caller = await Member.create({
      first_name: 'Test', last_name: 'Admin', email: 'test@example.com',
      firebase_uid: 'test-firebase-uid', phone_number: '+15555550174', role: 'treasurer', is_active: true
    });
    pledger = await Member.create({
      first_name: 'Test', last_name: 'Pledger', phone_number: '+15555550175', is_active: true, role: 'member'
    });
    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active', start_date: '2026-01-01', end_date: null
    });
  });

  const queueRow = () => ZelleEmailQueue.create({
    external_id: 'zelle:70070070070', payer_name: 'TEST PLEDGER', amount: 250,
    payment_date: '2026-08-20', status: 'NEEDS_REVIEW'
  });

  const create = (row, body = {}) => request(app)
    .post(`/api/zelle/queue/${row.id}/create-transaction`)
    .set(AUTH)
    .send({ member_id: pledger.id, payment_type: 'pledge_drive', ...body });

  const bankRowFor = () => BankTransaction.create({
    transaction_hash: crypto.randomBytes(16).toString('hex'),
    date: '2026-08-21', amount: 250, type: 'ZELLE', status: 'PENDING',
    description: 'Zelle payment from TEST PLEDGER QWERTYUIOPAS',
    payer_name: 'TEST PLEDGER', external_ref_id: 'QWERTYUIOPAS'
  });

  it('credits the member\'s open pledge', async () => {
    const pledge = await Pledge.create({
      member_id: pledger.id, campaign_id: campaign.id, amount: 1000,
      first_name: 'Test', last_name: 'Pledger', fulfillment_intent: 'later'
    });
    const res = await create(await queueRow()).expect(201);
    expect(res.body.pledge_error).toBeNull();

    const allocations = await PledgeAllocation.findAll({ where: { pledge_id: pledge.id } });
    expect(allocations).toHaveLength(1);
    expect(Number(allocations[0].amount)).toBe(250);
  });

  it('opens a pledge with the payment when asked, leaving the balance collectable', async () => {
    const res = await create(await queueRow(), { pledge_amount: 1000 }).expect(201);
    expect(res.body.pledge_error).toBeNull();

    const pledges = await Pledge.findAll({ where: { member_id: pledger.id } });
    expect(pledges).toHaveLength(1);
    expect(Number(pledges[0].amount)).toBe(1000);
    expect(pledges[0].fulfillment_intent).toBe('later');

    const allocations = await PledgeAllocation.findAll({ where: { pledge_id: pledges[0].id } });
    expect(allocations).toHaveLength(1);
    expect(String(allocations[0].transaction_id)).toBe(String(res.body.data.id));
  });

  it('the later bank link does not credit the pledge a second time', async () => {
    const res = await create(await queueRow(), { pledge_amount: 1000 }).expect(201);
    const bank = await bankRowFor();

    // Linked by hand from the bank screen — the path that reports pledge errors.
    const link = await request(app).post('/api/bank/reconcile').set(AUTH)
      .send({ transaction_id: bank.id, existing_transaction_id: res.body.data.id }).expect(200);
    expect(link.body.pledgeError).toBeNull();
    expect((await Transaction.findByPk(res.body.data.id)).external_id).toBe(bank.transaction_hash);
    expect(await PledgeAllocation.count()).toBe(1);
  });

  it('refuses a pledge amount on another payment type, or below $1, before writing anything', async () => {
    const row = await queueRow();
    expect((await create(row, { payment_type: 'donation', pledge_amount: 500 }).expect(400)).body.code).toBe('INVALID_PLEDGE');
    expect((await create(row, { pledge_amount: 0.5 }).expect(400)).body.code).toBe('INVALID_PLEDGE');
    expect(await Transaction.count()).toBe(0);
  });

  it('records the payment and reports the pledge failure when no drive is open', async () => {
    await campaign.update({ status: 'closed' });
    const res = await create(await queueRow(), { pledge_amount: 1000 }).expect(201);
    expect(res.body.pledge_error).toMatch(/No pledge drive is currently open/);
    expect(await Transaction.count()).toBe(1);
    expect(await Pledge.count()).toBe(0);
  });
});
