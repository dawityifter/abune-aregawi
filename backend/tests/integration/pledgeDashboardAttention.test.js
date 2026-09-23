const request = require('supertest');
const {
  sequelize, PledgeCampaign, Pledge, Member, Transaction, PledgeAllocation
} = require('../../src/models');

jest.mock('../../src/middleware/auth', () => ({
  firebaseAuthMiddleware: (req, res, next) => {
    req.user = global.__TEST_USER__ || { role: 'treasurer', roles: ['treasurer'] };
    next();
  },
  authMiddleware: (req, res, next) => next()
}));

const app = require('../../src/server');

describe('dashboard attention counts', () => {
  let campaign, member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    global.__TEST_USER__ = { role: 'treasurer', roles: ['treasurer'] };
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
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15555550110',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  const pledgeFor = async (amount, overrides = {}) => Pledge.create({
    amount, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: member.id, fulfillment_intent: 'immediate',
    ...overrides
  });

  const pay = async (pledge, amount, paymentDate) => {
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: paymentDate,
      amount, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: member.id
    });
  };

  const attention = async () => {
    const res = await request(app).get(`/api/pledge-campaigns/${campaign.id}/dashboard`);
    return res.body.dashboard.attention;
  };

  it('counts a part-paid pledge with no payment in 60+ days as stalled', async () => {
    const stalled = await pledgeFor(5000);
    await pay(stalled, 1000, '2026-01-05');     // long ago
    const fresh = await pledgeFor(5000);
    await pay(fresh, 1000, todayISO());

    const a = await attention();
    expect(a.stalled).toBe(1);
  });

  it('counts pledges with nothing received', async () => {
    await pledgeFor(800);
    await pledgeFor(900);
    const a = await attention();
    expect(a.never_started).toBe(2);
  });

  it('counts over-paid pledges', async () => {
    const over = await pledgeFor(1000);
    await pay(over, 1200, todayISO());
    const a = await attention();
    expect(a.overpaid).toBe(1);
  });

  it('counts pledges with no linked member', async () => {
    await Pledge.create({
      amount: 400, first_name: 'Anonymous', last_name: 'Giver',
      pledge_type: 'fundraising', campaign_id: campaign.id, member_id: null,
      is_anonymous: true, fulfillment_intent: 'immediate', baptism_name: 'Gebre Mesqel'
    });
    const a = await attention();
    expect(a.unlinked).toBe(1);
  });

  it('excludes cancelled pledges from every attention count', async () => {
    const doomed = await pledgeFor(800);
    await doomed.update({ lifecycle: 'cancelled' });
    const a = await attention();
    expect(a.never_started).toBe(0);
  });

  it('flags a drive inside its final 30 days', async () => {
    await campaign.update({ end_date: addDays(todayISO(), 10) });
    const a = await attention();
    expect(a.ending_soon).toBe(true);

    await campaign.update({ end_date: addDays(todayISO(), 90) });
    const later = await attention();
    expect(later.ending_soon).toBe(false);
  });

  it('suppresses small attention counts for a tier-2 caller', async () => {
    const over = await pledgeFor(1000);
    await pay(over, 1200, todayISO());

    global.__TEST_USER__ = { role: 'ap_team', roles: ['ap_team'] };
    const a = await attention();
    expect(a.overpaid).toBeNull();
  });
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso, days) {
  return new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10);
}
