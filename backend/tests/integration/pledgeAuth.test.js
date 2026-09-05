const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, PledgeCampaign, ActivityLog, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

describe('Pledge route authorization', () => {
  let memberUser, treasurerUser, pledge, campaign;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    // Must be live (active AND inside its date window) for pledge creation to
    // be accepted — see services/pledgeCampaignService.
    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026 Pledge Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });

    memberUser = await Member.create({
      first_name: 'Plain',
      last_name: 'Member',
      phone_number: '+15550000001',
      email: 'plain@example.com',
      is_active: true,
      role: 'member',
      firebase_uid: 'uid-member'
    });
    treasurerUser = await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000002',
      email: 'tess@example.com',
      is_active: true,
      role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    pledge = await Pledge.create({
      amount: 500,
      first_name: 'Anon',
      last_name: 'Pledger',
      email: 'anon@example.com',
      pledge_type: 'fundraising',
      campaign_id: campaign.id
    });
  });

  it('rejects unauthenticated listing of pledges', async () => {
    const res = await request(app).get('/api/pledges');
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated pledge updates', async () => {
    const res = await request(app).put(`/api/pledges/${pledge.id}`).send({ notes: 'hacked' });
    expect(res.status).toBe(401);
  });

  it('rejects a plain member listing all pledges', async () => {
    setVerifyTokenPayload({ uid: 'uid-member', email: memberUser.email });
    const res = await request(app).get('/api/pledges').set('Authorization', 'Bearer t');
    expect(res.status).toBe(403);
  });

  it('allows a treasurer to list pledges', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurerUser.email });
    const res = await request(app).get('/api/pledges').set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects an unauthenticated visitor creating a pledge', async () => {
    const res = await request(app).post('/api/pledges').send({
      amount: 250,
      first_name: 'Visitor',
      last_name: 'Guest',
      email: 'visitor@example.com'
    });
    expect(res.status).toBe(401);
  });

  it('rejects a status/legacy_status field on update — lifecycle is the only mutable state', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurerUser.email });
    const res = await request(app)
      .put(`/api/pledges/${pledge.id}`)
      .set('Authorization', 'Bearer t')
      .send({ status: 'fulfilled', donation_id: 999, fulfilled_date: '2026-01-01' });
    expect(res.status).toBe(200);
    await pledge.reload();
    expect(pledge.legacy_status).toBeNull();
    expect(pledge.donation_id).toBeNull();
    expect(pledge.fulfilled_date).toBeNull();
  });

  it('rejects an invalid lifecycle value', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurerUser.email });
    const res = await request(app)
      .put(`/api/pledges/${pledge.id}`)
      .set('Authorization', 'Bearer t')
      .send({ lifecycle: 'fulfilled' });
    expect(res.status).toBe(400);
  });

  it('lets a treasurer cancel a pledge and logs the lifecycle change', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurerUser.email });
    const res = await request(app)
      .put(`/api/pledges/${pledge.id}`)
      .set('Authorization', 'Bearer t')
      .send({ lifecycle: 'cancelled' });
    expect(res.status).toBe(200);
    await pledge.reload();
    expect(pledge.lifecycle).toBe('cancelled');

    const log = await ActivityLog.findOne({ where: { entity_type: 'Pledge', entity_id: String(pledge.id) } });
    expect(log).not.toBeNull();
    expect(log.action).toBe('UPDATE');
    expect(log.details).toEqual({ from: 'active', to: 'cancelled' });
    expect(log.user_id).toBe(treasurerUser.id);
  });

  it('does not log an ActivityLog row when lifecycle is unchanged', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurerUser.email });
    const res = await request(app)
      .put(`/api/pledges/${pledge.id}`)
      .set('Authorization', 'Bearer t')
      .send({ lifecycle: 'active', notes: 'still active' });
    expect(res.status).toBe(200);
    const log = await ActivityLog.findOne({ where: { entity_type: 'Pledge', entity_id: String(pledge.id) } });
    expect(log).toBeNull();
  });
});
