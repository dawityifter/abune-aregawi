const request = require('supertest');
const {
  sequelize, PledgeCampaign, Pledge, Member, Transaction, PledgeAllocation
} = require('../../src/models');

jest.mock('../../src/middleware/auth', () => ({
  firebaseAuthMiddleware: (req, res, next) => {
    req.user = { role: 'treasurer', roles: ['treasurer'] };
    next();
  },
  authMiddleware: (req, res, next) => next()
}));

const app = require('../../src/server');

describe('GET /api/pledge-campaigns/:id/monthly', () => {
  let campaign, member;

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
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-09-01',
      end_date: '2026-12-31', goal_amount: 100000, status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15555550120',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  const pledgeFor = async (amount, overrides = {}) => Pledge.create({
    amount, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: member.id, fulfillment_intent: 'immediate',
    ...overrides
  });

  const pay = async (pledge, amount, paymentDate, status = 'succeeded') => {
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: paymentDate,
      amount, payment_type: 'donation', payment_method: 'zelle', status
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: member.id
    });
  };

  const series = async () => {
    const res = await request(app).get(`/api/pledge-campaigns/${campaign.id}/monthly`);
    expect(res.status).toBe(200);
    return res.body.series;
  };

  it('groups receipts by calendar month and carries a running cumulative', async () => {
    const p = await pledgeFor(10000);
    await pay(p, 1000, '2026-09-10');
    await pay(p, 500, '2026-09-20');
    await pay(p, 2000, '2026-11-03');

    const s = await series();
    expect(s.available).toBe(true);
    expect(s.partial_historical).toBe(false);
    expect(s.months).toEqual([
      { month: '2026-09', collected: 1500, cumulative: 1500 },
      { month: '2026-11', collected: 2000, cumulative: 3500 }
    ]);
  });

  it('ignores allocations whose transaction did not succeed', async () => {
    const p = await pledgeFor(10000);
    await pay(p, 1000, '2026-09-10');
    await pay(p, 5000, '2026-09-11', 'failed');

    const s = await series();
    expect(s.months).toEqual([{ month: '2026-09', collected: 1000, cumulative: 1000 }]);
  });

  it('nets a reversing allocation out of its month', async () => {
    const p = await pledgeFor(10000);
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-09-10',
      amount: 1000, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
    const original = await PledgeAllocation.create({
      pledge_id: p.id, transaction_id: txn.id, amount: 1000,
      source: 'treasurer_manual', allocated_by: member.id
    });
    await PledgeAllocation.create({
      pledge_id: p.id, transaction_id: txn.id, amount: -400,
      source: 'treasurer_manual', allocated_by: member.id,
      reverses_allocation_id: original.id, reason: 'partial refund'
    });

    const s = await series();
    expect(s.months).toEqual([{ month: '2026-09', collected: 600, cumulative: 600 }]);
  });

  it('reports unavailable for a drive whose pledges predate the allocation model', async () => {
    await pledgeFor(5000, { is_historical: true, legacy_status: 'fulfilled' });

    const s = await series();
    expect(s.available).toBe(false);
    expect(s.reason).toBe('historical_campaign');
    expect(s.partial_historical).toBe(false);
    expect(s.months).toEqual([]);
  });

  it('flags a partial series when only some of the drive\'s pledges are historical', async () => {
    await pledgeFor(5000, { is_historical: true, legacy_status: 'fulfilled' });
    const modern = await pledgeFor(10000);
    await pay(modern, 1000, '2026-09-10');

    const s = await series();
    expect(s.available).toBe(true);
    expect(s.partial_historical).toBe(true);
    expect(s.months).toEqual([{ month: '2026-09', collected: 1000, cumulative: 1000 }]);
  });

  it('returns an empty but available series for a drive with no payments yet', async () => {
    await pledgeFor(5000);
    const s = await series();
    expect(s.available).toBe(true);
    expect(s.months).toEqual([]);
  });

  it('404s for a campaign that does not exist', async () => {
    const res = await request(app).get('/api/pledge-campaigns/999999/monthly');
    expect(res.status).toBe(404);
  });
});
