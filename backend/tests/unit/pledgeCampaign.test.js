const { PledgeCampaign, sequelize } = require('../../src/models');

describe('PledgeCampaign model', () => {
  beforeAll(async () => { await sequelize.sync({ force: true }); });
  beforeEach(async () => { await PledgeCampaign.destroy({ where: {} }); });

  it('creates a campaign with a unique slug', async () => {
    const c = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026 Pledge Drive',
      start_date: '2026-01-01', end_date: '2026-12-31',
      goal_amount: 100000, status: 'draft', default_payment_type: 'pledge_drive'
    });
    expect(c.slug).toBe('2026-pledge-drive');
    expect(c.currency).toBe('usd');
  });

  it('rejects a duplicate slug', async () => {
    await PledgeCampaign.create({ slug: 'dup', name: 'A', start_date: '2026-01-01' });
    await expect(
      PledgeCampaign.create({ slug: 'dup', name: 'B', start_date: '2026-01-01' })
    ).rejects.toThrow();
  });

  it('rejects an unknown status', async () => {
    await expect(PledgeCampaign.create({
      slug: 'bad-status', name: 'Bad', start_date: '2026-01-01', status: 'archived'
    })).rejects.toThrow();
  });

  it('defaults status to draft', async () => {
    const c = await PledgeCampaign.create({ slug: 'd', name: 'D', start_date: '2026-01-01' });
    expect(c.status).toBe('draft');
  });
});
