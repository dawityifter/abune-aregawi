const request = require('supertest');
const app = require('../../src/server');
const { PledgeAllocation, PledgeBalance, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};
const asTreasurer = () => setVerifyTokenPayload({ uid: 'uid-treasurer', email: 'tess@example.com' });
const asMember = () => setVerifyTokenPayload({ uid: 'uid-ann', email: 'ann@example.com' });

describe('Pledge allocation endpoints', () => {
  let campaign, closed, treasurer, member, pledge, oldPledge, txn;

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
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01', status: 'active'
    });
    closed = await PledgeCampaign.create({
      slug: '2025-pledge-drive', name: '2025', start_date: '2025-09-13', status: 'closed'
    });
    treasurer = await Member.create({
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
    const base = { amount: 5000, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising' };
    pledge = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id });
    oldPledge = await Pledge.create({ ...base, campaign_id: closed.id, member_id: member.id, is_historical: true });
    txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 1000, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
  });

  it('lets a treasurer allocate a payment', async () => {
    asTreasurer();
    const res = await request(app)
      .post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t')
      .send({ transaction_id: txn.id, amount: 1000 });
    expect(res.status).toBe(201);

    const b = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(b.paid_amount)).toBe(1000);
    expect(b.derived_status).toBe('partially_fulfilled');
  });

  it('rejects a plain member allocating', async () => {
    asMember();
    const res = await request(app)
      .post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t')
      .send({ transaction_id: txn.id, amount: 1000 });
    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated allocation', async () => {
    const res = await request(app)
      .post(`/api/pledges/${pledge.id}/allocations`)
      .send({ transaction_id: txn.id, amount: 1000 });
    expect(res.status).toBe(401);
  });

  it('blocks allocation against the closed 2025 campaign', async () => {
    asTreasurer();
    const res = await request(app)
      .post(`/api/pledges/${oldPledge.id}/allocations`)
      .set('Authorization', 'Bearer t')
      .send({ transaction_id: txn.id, amount: 500 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CAMPAIGN_CLOSED');
  });

  it('blocks editing a 2025 pledge', async () => {
    asTreasurer();
    const res = await request(app)
      .put(`/api/pledges/${oldPledge.id}`)
      .set('Authorization', 'Bearer t')
      .send({ notes: 'should not be editable' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CAMPAIGN_CLOSED');
  });

  it('returns 422 when over-allocating', async () => {
    asTreasurer();
    await request(app).post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t').send({ transaction_id: txn.id, amount: 800 });
    const res = await request(app).post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t').send({ transaction_id: txn.id, amount: 300 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('OVER_ALLOCATED');
  });

  it('records an offline payment and allocates it atomically', async () => {
    asTreasurer();
    const res = await request(app)
      .post(`/api/pledges/${pledge.id}/payments`)
      .set('Authorization', 'Bearer t')
      .send({ amount: 750, payment_date: '2026-03-01', payment_method: 'check', receipt_number: '1001' });
    expect(res.status).toBe(201);

    const b = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(b.paid_amount)).toBe(750);
  });

  it('creates no transaction when the offline payment fails validation', async () => {
    asTreasurer();
    // cash with no receipt number must fail
    const res = await request(app)
      .post(`/api/pledges/${pledge.id}/payments`)
      .set('Authorization', 'Bearer t')
      .send({ amount: 750, payment_date: '2026-03-01', payment_method: 'cash' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await Transaction.count({ where: { payment_method: 'cash' } })).toBe(0);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(typeof res.body.message).toBe('string');
  });

  it('reverses an allocation through the API', async () => {
    asTreasurer();
    const created = await request(app).post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t').send({ transaction_id: txn.id, amount: 1000 });

    const res = await request(app)
      .post(`/api/pledge-allocations/${created.body.allocation.id}/reverse`)
      .set('Authorization', 'Bearer t')
      .send({ reason: 'Applied to the wrong pledge' });
    expect(res.status).toBe(201);

    const b = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(b.paid_amount)).toBe(0);
  });

  it('refuses a reversal with no reason', async () => {
    asTreasurer();
    const created = await request(app).post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t').send({ transaction_id: txn.id, amount: 1000 });
    const res = await request(app)
      .post(`/api/pledge-allocations/${created.body.allocation.id}/reverse`)
      .set('Authorization', 'Bearer t').send({});
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('REASON_REQUIRED');
  });

  it('returns the audit trail for a pledge', async () => {
    asTreasurer();
    await request(app).post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t').send({ transaction_id: txn.id, amount: 1000 });
    const res = await request(app).get(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.allocations).toHaveLength(1);
    expect(res.body.allocations[0].allocated_by).toBeDefined();
  });
});
