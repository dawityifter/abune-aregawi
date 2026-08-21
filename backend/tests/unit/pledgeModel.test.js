const { Pledge, PledgeCampaign, Member, sequelize } = require('../../src/models');

describe('Pledge model with campaigns', () => {
  let campaign, member;

  beforeAll(async () => { await sequelize.sync({ force: true }); });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });
    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026 Pledge Drive', start_date: '2026-01-01'
    });
    member = await Member.create({
      first_name: 'Ann',
      last_name: 'Giver',
      phone_number: '+15550000010',
      email: 'ann@example.com',
      is_active: true,
      role: 'member',
      firebase_uid: 'uid-ann'
    });
  });

  const base = { amount: 500, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising' };

  it('defaults lifecycle to active and is_historical to false', async () => {
    const p = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id });
    expect(p.lifecycle).toBe('active');
    expect(p.is_historical).toBe(false);
  });

  it('rejects a second active pledge for the same member in the same campaign', async () => {
    await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id });
    await expect(
      Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id })
    ).rejects.toThrow();
  });

  it('allows a second pledge once the first is cancelled', async () => {
    const first = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id });
    await first.update({ lifecycle: 'cancelled' });
    const second = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id });
    expect(second.id).not.toBe(first.id);
  });

  it('allows multiple anonymous pledges in one campaign', async () => {
    await Pledge.create({ ...base, campaign_id: campaign.id, member_id: null });
    const second = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: null });
    expect(second.id).toBeDefined();
  });

  it('exempts historical rows from the uniqueness rule', async () => {
    await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id, is_historical: true });
    const second = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id, is_historical: true });
    expect(second.id).toBeDefined();
  });

  it('rejects an unknown lifecycle value', async () => {
    await expect(Pledge.create({
      ...base, campaign_id: campaign.id, member_id: member.id, lifecycle: 'paused'
    })).rejects.toThrow();
  });
});
