const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, PledgeCampaign, PledgeAllocation, Transaction, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

describe('GET /api/pledges/stats', () => {
  let campaign;

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
      slug: '2026-pledge-drive', name: '2026 Pledge Drive', start_date: '2026-01-01'
    });
    await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000002',
      email: 'tess@example.com',
      is_active: true,
      role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    await Pledge.create({
      amount: 500,
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      pledge_type: 'fundraising',
      campaign_id: campaign.id
    });
  });

  it('returns aggregates without any donor names to the public', async () => {
    const res = await request(app).get('/api/pledges/stats');
    expect(res.status).toBe(200);
    expect(res.body.stats.total_pledged).toBe(500);
    // No payments have been allocated yet, so nothing is actually fulfilled.
    expect(res.body.stats.total_fulfilled).toBe(0);
    expect(res.body.stats.total_remaining).toBe(500);
    // No name must appear anywhere in the public payload.
    expect(JSON.stringify(res.body)).not.toContain('Jane');
    expect(res.body.stats.status_breakdown[0].pledges).toBeUndefined();
  });

  it('rejects ?detail=true without authentication', async () => {
    const res = await request(app).get('/api/pledges/stats?detail=true');
    expect(res.status).toBe(401);
  });

  it('returns per-pledge detail to a treasurer', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: 'tess@example.com' });
    const res = await request(app)
      .get('/api/pledges/stats?detail=true')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.stats.status_breakdown[0].pledges[0].name).toBe('Jane Doe');
  });

  it('reflects the actual cash received once a payment is allocated', async () => {
    const member = await Member.create({
      first_name: 'Ann',
      last_name: 'Giver',
      phone_number: '+15550000010',
      email: 'ann@example.com',
      is_active: true,
      role: 'member',
      firebase_uid: 'uid-ann'
    });
    const pledge = await Pledge.create({
      amount: 500,
      first_name: 'Ann',
      last_name: 'Giver',
      email: 'ann@example.com',
      pledge_type: 'fundraising',
      campaign_id: campaign.id,
      member_id: member.id
    });
    const txn = await Transaction.create({
      member_id: member.id,
      collected_by: member.id,
      payment_date: '2026-02-01',
      amount: 500,
      payment_type: 'pledge_drive',
      payment_method: 'zelle',
      status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id,
      transaction_id: txn.id,
      amount: 500,
      source: 'treasurer_manual',
      allocated_by: member.id
    });

    const res = await request(app).get('/api/pledges/stats');
    expect(res.status).toBe(200);
    // Two pledges of 500 each: one untouched (Jane), one fully paid (Ann).
    expect(res.body.stats.total_pledged).toBe(1000);
    expect(res.body.stats.total_fulfilled).toBe(500);
    expect(res.body.stats.total_remaining).toBe(500);

    const fulfilled = res.body.stats.status_breakdown.find(s => s.status === 'fulfilled');
    expect(fulfilled.count).toBe(1);
    expect(fulfilled.total_amount).toBe(500);
  });
});
