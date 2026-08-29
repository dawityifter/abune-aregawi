const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, PledgeCampaign, PledgeAllocation, Transaction, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

// A2: an anonymous giver's real identity is visible to admin and treasurer
// only. GET /api/pledges and GET /api/pledges/:id are open to all nine view
// roles, and for an ONLINE anonymous gift first_name/last_name hold the name
// on the card — the giver's real legal name.
describe('anonymous pledges in the pledge read endpoints', () => {
  let campaign, anonymousPledge, linkedMember;

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
      slug: '2026-drive', name: '2026 Drive', status: 'active', start_date: '2026-01-01'
    });
    await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000801',
      email: 'tess.treasurer@example.test',
      is_active: true, role: 'treasurer', firebase_uid: 'uid-treasurer'
    });
    await Member.create({
      first_name: 'Sam',
      last_name: 'Secretary',
      phone_number: '+15550000802',
      email: 'sam.secretary@example.test',
      is_active: true, role: 'secretary', firebase_uid: 'uid-secretary'
    });
    linkedMember = await Member.create({
      first_name: 'Quiet',
      last_name: 'Benefactor',
      phone_number: '+15550000803',
      is_active: true, role: 'member', firebase_uid: 'uid-benefactor'
    });
    anonymousPledge = await Pledge.create({
      campaign_id: campaign.id,
      member_id: linkedMember.id,
      amount: 750,
      // What the card gave us: the giver's real legal name.
      first_name: 'Quiet',
      last_name: 'Benefactor',
      email: 'quiet.benefactor@example.test',
      phone: '+15550000803',
      address: '1 Example Way',
      zip_code: '75001',
      is_anonymous: true,
      // Free text a treasurer typed into `note` when recording the pledge.
      // This is where a donor's name actually ends up in practice, so it is
      // masked alongside the structured identity fields.
      notes: 'Envelope handed in by Quiet Benefactor after liturgy',
      fulfillment_intent: 'immediate'
    });
  });

  it('hides the donor from a secretary listing all pledges', async () => {
    setVerifyTokenPayload({ uid: 'uid-secretary', email: 'sam.secretary@example.test' });
    const res = await request(app).get('/api/pledges').set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('Benefactor');
    expect(body).not.toContain('quiet.benefactor@example.test');
    expect(body).not.toContain('+15550000803');

    const row = res.body.pledges.find(p => p.id === anonymousPledge.id);
    expect(row.first_name).toBe('Anonymous');
    expect(row.is_anonymous).toBe(true);
    expect(row.member).toBeNull();
    expect(row.member_id).toBeNull();
    expect(row.notes).toBeNull();
  });

  it('hides the donor from a secretary reading one pledge', async () => {
    setVerifyTokenPayload({ uid: 'uid-secretary', email: 'sam.secretary@example.test' });
    const res = await request(app)
      .get(`/api/pledges/${anonymousPledge.id}`).set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('Benefactor');
    expect(res.body.pledge.first_name).toBe('Anonymous');
    expect(res.body.pledge.is_anonymous).toBe(true);
    expect(res.body.pledge.address).toBeNull();
    expect(res.body.pledge.zip_code).toBeNull();
    expect(res.body.pledge.email).toBeNull();
    // The free-text note is where a donor's name is most likely to be written.
    expect(res.body.pledge.notes).toBeNull();
  });

  it('shows the donor to a treasurer', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: 'tess.treasurer@example.test' });
    const res = await request(app)
      .get(`/api/pledges/${anonymousPledge.id}`).set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(res.body.pledge.last_name).toBe('Benefactor');
    expect(res.body.pledge.is_anonymous).toBe(true);
    expect(res.body.pledge.member_id).toBe(linkedMember.id);
    // Admin and treasurer still see the note; masking it is scoped to the
    // seven non-piercing view roles.
    expect(res.body.pledge.notes).toContain('after liturgy');
  });

  it('leaves a named pledge untouched for every view role', async () => {
    const named = await Pledge.create({
      campaign_id: campaign.id,
      amount: 200,
      first_name: 'Open',
      last_name: 'Donor',
      email: 'open.donor@example.test'
    });

    setVerifyTokenPayload({ uid: 'uid-secretary', email: 'sam.secretary@example.test' });
    const res = await request(app)
      .get(`/api/pledges/${named.id}`).set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(res.body.pledge.last_name).toBe('Donor');
    expect(res.body.pledge.email).toBe('open.donor@example.test');
    expect(res.body.pledge.is_anonymous).toBe(false);
  });
});
