'use strict';

const request = require('supertest');
const app = require('../../src/server');
const {
  Member, Pledge, PledgeCampaign, PledgeBalance, PledgeAllocation, Transaction, sequelize
} = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

describe('POST /api/pledges/with-payment', () => {
  let campaign, treasurer, plainMember;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    // Allocations FK-reference both transactions and pledges, so they must go
    // first — matching pledgeAllocations.test.js's cleanup order.
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null,
      default_payment_type: 'pledge_drive'
    });
    treasurer = await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000501',
      email: 'tess@example.test', is_active: true, role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    plainMember = await Member.create({
      first_name: 'Plain',
      last_name: 'Member',
      phone_number: '+15550000502',
      email: 'plain@example.test', is_active: true, role: 'member',
      firebase_uid: 'uid-plain'
    });
  });

  const body = (extra = {}) => ({
    pledge_amount: 400,
    amount: 400,
    payment_date: '2026-06-01',
    payment_method: 'cash',
    receipt_number: '1001',
    first_name: 'Anonymous',
    last_name: 'Giver',
    baptism_name: 'Tesfay',
    is_anonymous: true,
    ...extra
  });

  it('rejects a plain member', async () => {
    setVerifyTokenPayload({ uid: 'uid-plain', email: plainMember.email });
    const res = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t').send(body());
    expect(res.status).toBe(403);
  });

  it('creates an anonymous pledge, its payment, and its allocation', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const res = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t').send(body());

    expect(res.status).toBe(201);

    const pledge = await Pledge.findByPk(res.body.pledge.id);
    expect(pledge.is_anonymous).toBe(true);
    expect(pledge.baptism_name).toBe('Tesfay');
    expect(pledge.member_id).toBeNull();

    const balance = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(balance.paid_amount)).toBe(400);
    expect(balance.derived_status).toBe('fulfilled');

    const txn = await Transaction.findByPk(res.body.transaction.id);
    expect(txn.donor_name).toBe('Tesfay');
    expect(String(txn.collected_by)).toBe(String(treasurer.id));
  });

  it('refuses a part payment against a new anonymous pledge', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const res = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t')
      .send(body({ pledge_amount: 400, amount: 100 }));

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/paid in full/i);
    expect(await Pledge.count()).toBe(0);
    expect(await Transaction.count()).toBe(0);
  });

  it('allows a part payment against a new named pledge', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const res = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t')
      .send(body({
        is_anonymous: false, baptism_name: null,
        member_id: plainMember.id, first_name: 'Plain', last_name: 'Member',
        pledge_amount: 400, amount: 100, receipt_number: '1002'
      }));

    expect(res.status).toBe(201);
    const balance = await PledgeBalance.findOne({ where: { pledge_id: res.body.pledge.id } });
    expect(parseFloat(balance.paid_amount)).toBe(100);
    expect(balance.derived_status).toBe('partially_fulfilled');
  });
});
