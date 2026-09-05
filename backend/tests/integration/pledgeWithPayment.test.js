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

  it('names the missing field when a named pledge has no member selected', async () => {
    // AddPaymentModal's shape when "also record this as a pledge" is ticked
    // for a named gift with no member chosen: the undefined name keys are
    // dropped by JSON.stringify and member_id serialises as null, so the
    // request looks valid until Pledge.first_name's NOT NULL rejects it.
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const res = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t')
      .send({
        pledge_amount: 400,
        amount: 400,
        payment_date: '2026-06-01',
        payment_method: 'cash',
        receipt_number: '1003',
        member_id: null,
        is_anonymous: false
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('MISSING_FIELD');
    expect(res.body.message).toMatch(/first and last name/i);
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

  it('leaves a part-paid named pledge visible as an outstanding balance', async () => {
    // §5.5 allows a part payment against a new NAMED pledge, but Task 3
    // narrowed getPledgeBalance, maybeAllocateToPledge and listUnallocated to
    // fulfillment_intent: 'later'. Recorded as 'immediate', the 300 still owing
    // was invisible to all three: no member could see it on /pledge, no later
    // payment could be allocated to it automatically, and no treasurer was
    // ever offered it.
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const created = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t')
      .send(body({
        is_anonymous: false, baptism_name: null,
        member_id: plainMember.id, first_name: 'Plain', last_name: 'Member',
        pledge_amount: 400, amount: 100, receipt_number: '1004'
      }));
    expect(created.status).toBe(201);

    const pledge = await Pledge.findByPk(created.body.pledge.id);
    expect(pledge.fulfillment_intent).toBe('later');

    setVerifyTokenPayload({ uid: 'uid-plain', email: plainMember.email });
    const balance = await request(app)
      .get('/api/pledges/balance').set('Authorization', 'Bearer t');

    expect(balance.status).toBe(200);
    expect(balance.body.pledge).not.toBeNull();
    expect(balance.body.pledge.pledged_amount).toBe(400);
    expect(balance.body.pledge.paid_amount).toBe(100);
    expect(balance.body.pledge.remaining_amount).toBe(300);
  });

  it('keeps a fully paid named pledge out of the outstanding-balance lookup', async () => {
    // The other half of the rule: a pledge the payment covered is settled, and
    // must never become an allocation target (§6.2).
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const created = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t')
      .send(body({
        is_anonymous: false, baptism_name: null,
        member_id: plainMember.id, first_name: 'Plain', last_name: 'Member',
        pledge_amount: 400, amount: 400, receipt_number: '1005'
      }));
    expect(created.status).toBe(201);

    const pledge = await Pledge.findByPk(created.body.pledge.id);
    expect(pledge.fulfillment_intent).toBe('immediate');

    setVerifyTokenPayload({ uid: 'uid-plain', email: plainMember.email });
    const balance = await request(app)
      .get('/api/pledges/balance').set('Authorization', 'Bearer t');

    expect(balance.status).toBe(200);
    expect(balance.body.pledge).toBeNull();
  });

  it('answers a second outstanding pledge for the same member with 409', async () => {
    // Recording a part-paid named pledge as 'later' brings it under
    // pledges_one_active_per_member_per_campaign, so this is now reachable.
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const partial = body({
      is_anonymous: false, baptism_name: null,
      member_id: plainMember.id, first_name: 'Plain', last_name: 'Member',
      pledge_amount: 400, amount: 100
    });

    const first = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t').send({ ...partial, receipt_number: '1006' });
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t').send({ ...partial, receipt_number: '1007' });

    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/already has an outstanding pledge/i);
    expect(await Pledge.count()).toBe(1);
  });
});
