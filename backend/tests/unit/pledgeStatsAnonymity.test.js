'use strict';

const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, PledgeCampaign, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

const namesIn = (body) =>
  body.stats.status_breakdown.flatMap((s) => (s.pledges || []).map((p) => p.name));

const allPledgesIn = (body) =>
  body.stats.status_breakdown.flatMap((s) => s.pledges || []);

// The anonymous fixture pledge is the only one flagged is_anonymous, so this
// picks it out of either serialization (status_breakdown or recent_pledges)
// regardless of ordering.
const anonymousBreakdownEntry = (body) =>
  allPledgesIn(body).find((p) => p.is_anonymous);

const anonymousRecentEntry = (body) =>
  body.stats.recent_pledges.find((p) => p.is_anonymous);

describe('anonymity masking in pledge stats', () => {
  let campaign;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });

    await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000701',
      email: 'tess@example.test', is_active: true, role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    await Member.create({
      first_name: 'Sam',
      last_name: 'Secretary',
      phone_number: '+15550000702',
      email: 'sam@example.test', is_active: true, role: 'secretary',
      firebase_uid: 'uid-secretary'
    });

    // Linked member for the anonymous pledge, so recent_pledges.member and
    // the linked spouse_name both have something real to leak if the masking
    // ever regresses. An anonymous pledge with a member_id (no baptism_name
    // needed) still satisfies the model's identifiability validation.
    const donorMember = await Member.create({
      first_name: 'Discreet',
      last_name: 'DonorMember',
      phone_number: '+15550000703',
      email: 'discreet@example.test', is_active: true, role: 'member',
      firebase_uid: 'uid-donor-member',
      spouse_name: 'Selam Gebre'
    });

    await Pledge.create({
      amount: 400, first_name: 'Discreet', last_name: 'Donor',
      campaign_id: campaign.id, member_id: donorMember.id,
      is_anonymous: true, fulfillment_intent: 'immediate'
    });

    // An ordinary, non-anonymous pledge, so the tests also demonstrate that
    // the masking gate has a working negative branch — this donor's name
    // must stay visible to every role.
    await Pledge.create({
      amount: 250, first_name: 'Open', last_name: 'Giver',
      campaign_id: campaign.id, is_anonymous: false, fulfillment_intent: 'later'
    });
  });

  it('shows the real name and details to a treasurer', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: 'tess@example.test' });
    const res = await request(app).get('/api/pledges/stats?detail=true')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(namesIn(res.body)).toContain('Discreet Donor');
    expect(namesIn(res.body)).toContain('Open Giver');

    const breakdownEntry = anonymousBreakdownEntry(res.body);
    expect(breakdownEntry.name).toBe('Discreet Donor');
    expect(breakdownEntry.spouse_name).toBe('Selam Gebre');

    const recentEntry = anonymousRecentEntry(res.body);
    expect(recentEntry.name).toBe('Discreet Donor');
    expect(recentEntry.member).toEqual({ first_name: 'Discreet', last_name: 'DonorMember' });
  });

  it('masks the name, spouse name, and linked member from a secretary', async () => {
    setVerifyTokenPayload({ uid: 'uid-secretary', email: 'sam@example.test' });
    const res = await request(app).get('/api/pledges/stats?detail=true')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(namesIn(res.body)).toContain('Anonymous');
    expect(namesIn(res.body)).not.toContain('Discreet Donor');
    // The ordinary donor is not anonymous, so their name must still show —
    // masking must not over-apply to every pledge.
    expect(namesIn(res.body)).toContain('Open Giver');

    const breakdownEntry = anonymousBreakdownEntry(res.body);
    expect(breakdownEntry.name).toBe('Anonymous');
    expect(breakdownEntry.spouse_name).toBeNull();

    const recentEntry = anonymousRecentEntry(res.body);
    expect(recentEntry.name).toBe('Anonymous');
    expect(recentEntry.member).toBeNull();
  });

  it('keeps aggregate totals identical regardless of caller role', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: 'tess@example.test' });
    const treasurerRes = await request(app).get('/api/pledges/stats?detail=true')
      .set('Authorization', 'Bearer t');

    setVerifyTokenPayload({ uid: 'uid-secretary', email: 'sam@example.test' });
    const secretaryRes = await request(app).get('/api/pledges/stats?detail=true')
      .set('Authorization', 'Bearer t');

    expect(treasurerRes.status).toBe(200);
    expect(secretaryRes.status).toBe(200);

    expect(secretaryRes.body.stats.total_pledged).toBe(treasurerRes.body.stats.total_pledged);
    expect(secretaryRes.body.stats.total_fulfilled).toBe(treasurerRes.body.stats.total_fulfilled);
    expect(secretaryRes.body.stats.total_remaining).toBe(treasurerRes.body.stats.total_remaining);
    expect(secretaryRes.body.stats.fulfillment_rate).toBe(treasurerRes.body.stats.fulfillment_rate);
  });
});
