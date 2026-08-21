const request = require('supertest');
const app = require('../../src/server');
const { PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const as = (uid, email) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue({ uid, email }) }));
};

describe('Pledge campaign endpoints', () => {
  let active, member;

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

    active = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026 Pledge Drive', start_date: '2026-01-01',
      end_date: '2026-12-31', status: 'active', goal_amount: 10000
    });
    await PledgeCampaign.create({
      slug: '2025-pledge-drive', name: '2025 Pledge Drive',
      start_date: '2025-09-13', status: 'draft'
    });
    await Member.create({
      first_name: 'Adam',
      last_name: 'Admin',
      phone_number: '+15550000003',
      email: 'adam@example.com', is_active: true, role: 'admin', firebase_uid: 'uid-admin'
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
  });

  it('exposes active campaigns publicly without financial detail', async () => {
    const res = await request(app).get('/api/pledge-campaigns/active');
    expect(res.status).toBe(200);
    expect(res.body.campaigns).toHaveLength(1);
    expect(res.body.campaigns[0].slug).toBe('2026-pledge-drive');
    expect(res.body.campaigns[0].total_collected).toBeUndefined();
  });

  it('rejects an unauthenticated full campaign listing', async () => {
    const res = await request(app).get('/api/pledge-campaigns');
    expect(res.status).toBe(401);
  });

  it('returns campaign totals derived from allocations', async () => {
    const pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
      campaign_id: active.id, member_id: member.id
    });
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 2000, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 2000,
      source: 'treasurer_manual', allocated_by: member.id
    });

    as('uid-treasurer', 'tess@example.com');
    const res = await request(app)
      .get(`/api/pledge-campaigns/${active.id}/totals`)
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(parseFloat(res.body.totals.total_pledged)).toBe(5000);
    expect(parseFloat(res.body.totals.total_collected)).toBe(2000);
    expect(parseFloat(res.body.totals.outstanding)).toBe(3000);
  });

  it('lets an admin close a campaign', async () => {
    as('uid-admin', 'adam@example.com');
    const res = await request(app)
      .patch(`/api/pledge-campaigns/${active.id}`)
      .set('Authorization', 'Bearer t')
      .send({ status: 'closed' });
    expect(res.status).toBe(200);
    await active.reload();
    expect(active.status).toBe('closed');
  });

  it('refuses to let a treasurer close a campaign', async () => {
    as('uid-treasurer', 'tess@example.com');
    const res = await request(app)
      .patch(`/api/pledge-campaigns/${active.id}`)
      .set('Authorization', 'Bearer t')
      .send({ status: 'closed' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid status', async () => {
    as('uid-admin', 'adam@example.com');
    const res = await request(app)
      .patch(`/api/pledge-campaigns/${active.id}`)
      .set('Authorization', 'Bearer t')
      .send({ status: 'archived' });
    expect(res.status).toBe(400);
  });
});
