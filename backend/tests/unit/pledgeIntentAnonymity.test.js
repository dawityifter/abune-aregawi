'use strict';

const { Pledge, PledgeCampaign, Member, sequelize } = require('../../src/models');

describe('pledge intent and anonymity rules', () => {
  let campaign;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });
    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });
  });

  const base = () => ({
    amount: 500,
    first_name: 'Test',
    last_name: 'Pledger',
    campaign_id: campaign.id
  });

  it('defaults an ordinary pledge to later and not anonymous', async () => {
    const pledge = await Pledge.create(base());
    expect(pledge.fulfillment_intent).toBe('later');
    expect(pledge.is_anonymous).toBe(false);
  });

  it('rejects an anonymous pledge for later fulfillment', async () => {
    await expect(Pledge.create({
      ...base(),
      is_anonymous: true,
      fulfillment_intent: 'later',
      baptism_name: 'Tesfay'
    })).rejects.toThrow(/must be fulfilled immediately/);
  });

  it('rejects an anonymous pledge with no internal identifier', async () => {
    await expect(Pledge.create({
      ...base(),
      is_anonymous: true,
      fulfillment_intent: 'immediate'
    })).rejects.toThrow(/baptism name or a linked member/);
  });

  it('accepts an anonymous immediate pledge identified by baptism name', async () => {
    const pledge = await Pledge.create({
      ...base(),
      is_anonymous: true,
      fulfillment_intent: 'immediate',
      baptism_name: 'Tesfay'
    });
    expect(pledge.baptism_name).toBe('Tesfay');
    // SQLite returns `undefined` (not `null`) for an unset nullable attribute
    // on the in-memory instance right after create(); both mean "no member
    // linked", so pin that semantic rather than a dialect-specific JS value.
    expect(pledge.member_id == null).toBe(true);
  });

  it('accepts an anonymous immediate pledge identified by member link', async () => {
    const member = await Member.create({
      first_name: 'Known', last_name: 'Member',
      phone_number: '+15550000101', is_active: true, role: 'member'
    });
    const pledge = await Pledge.create({
      ...base(),
      member_id: member.id,
      is_anonymous: true,
      fulfillment_intent: 'immediate'
    });
    expect(pledge.member_id).toBe(member.id);
  });

  it('rejects an unknown fulfillment_intent value', async () => {
    await expect(Pledge.create({
      ...base(), fulfillment_intent: 'someday'
    })).rejects.toThrow();
  });
});
