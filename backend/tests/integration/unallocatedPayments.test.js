const request = require('supertest');
const app = require('../../src/server');
const { PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');
const { reverse } = require('../../src/services/pledgeAllocationService');
const admin = require('firebase-admin');

const asTreasurer = () => {
  admin.auth = jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'uid-treasurer', email: 'tess@example.com' })
  }));
};

describe('GET /api/pledge-allocations/unallocated', () => {
  let campaign, member, pledge;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01',
      end_date: '2026-12-31', status: 'active', default_payment_type: 'pledge_drive'
    });
    await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000002',
      email: 'tess@example.com', is_active: true, role: 'treasurer', firebase_uid: 'uid-treasurer'
    });
    member = await Member.create({
      first_name: 'Ann',
      last_name: 'Giver',
      phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
    pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
      campaign_id: campaign.id, member_id: member.id
    });
  });

  const payment = (over = {}) => Transaction.create({
    member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
    amount: 1000, payment_type: 'pledge_drive', payment_method: 'zelle',
    status: 'succeeded', ...over
  });

  it('lists a fully unallocated payment and suggests the member pledge', async () => {
    const txn = await payment();
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(String(res.body.items[0].transaction.id)).toBe(String(txn.id));
    expect(parseFloat(res.body.items[0].unallocated)).toBe(1000);
    expect(String(res.body.items[0].suggestedPledgeId)).toBe(String(pledge.id));
  });

  it('lists the remainder of a partially allocated payment', async () => {
    const txn = await payment();
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 400,
      source: 'treasurer_manual', allocated_by: member.id
    });
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(parseFloat(res.body.items[0].unallocated)).toBe(600);
  });

  it('omits a fully allocated payment', async () => {
    const txn = await payment();
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000,
      source: 'treasurer_manual', allocated_by: member.id
    });
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.body.items).toHaveLength(0);
  });

  it('omits failed, canceled and refunded payments', async () => {
    await payment({ status: 'failed' });
    await payment({ status: 'canceled' });
    await payment({ status: 'refunded' });
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.body.items).toHaveLength(0);
  });

  it('defaults to the campaign payment type and does not nag about dues', async () => {
    await payment({ payment_type: 'membership_due' });
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.body.items).toHaveLength(0);
  });

  it('shows other types when payment_type=all', async () => {
    await payment({ payment_type: 'membership_due' });
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}&payment_type=all`)
      .set('Authorization', 'Bearer t');
    expect(res.body.items).toHaveLength(1);
  });

  it('brings a fully allocated payment back into the queue after a full reversal', async () => {
    const txn = await payment();
    const allocation = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000,
      source: 'treasurer_manual', allocated_by: member.id
    });
    asTreasurer();

    const before = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(before.body.items).toHaveLength(0);

    await reverse({
      allocationId: allocation.id,
      reason: 'wrong pledge',
      reversedBy: member.id
    });

    const after = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(after.body.items).toHaveLength(1);
    expect(parseFloat(after.body.items[0].unallocated)).toBe(1000);
  });

  it('brings back only the reversed remainder after a partial reversal', async () => {
    const txn = await payment();
    const allocation = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000,
      source: 'treasurer_manual', allocated_by: member.id
    });
    asTreasurer();

    const before = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(before.body.items).toHaveLength(0);

    await reverse({
      allocationId: allocation.id,
      reason: 'partial correction',
      reversedBy: member.id,
      amount: 400
    });

    const after = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(after.body.items).toHaveLength(1);
    expect(parseFloat(after.body.items[0].unallocated)).toBe(400);
  });
});
