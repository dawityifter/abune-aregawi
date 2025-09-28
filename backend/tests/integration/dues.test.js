const request = require('supertest');
const app = require('../../src/server');
const { Member, Dependent, Transaction, sequelize } = require('../../src/models');

// Note: firebase-admin is mocked in tests/setup.js. We override token payload per test as needed.
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  const verifyMock = jest.fn().mockResolvedValue(payload);
  const authMock = jest.fn(() => ({ verifyIdToken: verifyMock }));
  // Ensure admin.auth() returns our stub for this test
  admin.auth = authMock;
  return { verifyMock, authMock };
};

const currentYear = new Date().getFullYear();

describe('Dues Endpoints', () => {
  let headMember;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await Transaction.destroy({ where: {} });
    await Dependent.destroy({ where: {} });
    await Member.destroy({ where: {} });

    headMember = await Member.create({
      first_name: 'Head',
      last_name: 'Member',
      phone_number: '+15551234567',
      email: 'head@example.com',
      is_active: true,
      role: 'member',
      yearly_pledge: 1200,
      firebase_uid: 'head-firebase-uid'
    });
  });

  it('allows a dependent linked by phone to view head-of-household dues', async () => {
    const dep = await Dependent.create({
      firstName: 'Spouse',
      lastName: 'Member',
      relationship: 'Spouse',
      phone: '+15551234567',
      email: 'spouse@example.com',
      memberId: headMember.id,
      linkedMemberId: headMember.id
    });

    // Add a membership_due transaction in current year
    await Transaction.create({
      member_id: headMember.id,
      collected_by: headMember.id,
      payment_date: new Date(currentYear, 0, 15),
      amount: 100,
      payment_type: 'membership_due',
      payment_method: 'card'
    });

    // Override token to include the spouse phone number
    setVerifyTokenPayload({ uid: 'dependent-firebase-uid', phone_number: '+15551234567' });

    const res = await request(app)
      .get(`/api/members/dues/by-member/${headMember.id}`)
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('member');
    expect(res.body.data.member.id).toBe(headMember.id);
    expect(res.body.data.payment).toHaveProperty('year', currentYear);
  });

  it('returns 403 when dependent is not linked to target member', async () => {
    // Dependent with different phone
    await Dependent.create({
      firstName: 'Other',
      lastName: 'Person',
      relationship: 'Spouse',
      phone: '+15550000000',
      email: 'other@example.com',
      memberId: headMember.id,
      linkedMemberId: headMember.id
    });

    // Token phone does not match dependent phone in DB
    setVerifyTokenPayload({ uid: 'dependent-firebase-uid', phone_number: '+19999999999' });

    const res = await request(app)
      .get(`/api/members/dues/by-member/${headMember.id}`)
      .set('Authorization', 'Bearer fake-token')
      .expect(403);

    expect(res.body).toHaveProperty('success', false);
  });

  it('allows the member themselves (by firebase_uid) to view their dues', async () => {
    setVerifyTokenPayload({ uid: 'head-firebase-uid' });

    const res = await request(app)
      .get(`/api/members/dues/by-member/${headMember.id}`)
      .set('Authorization', 'Bearer fake-token')
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data.member.id).toBe(headMember.id);
  });
});
