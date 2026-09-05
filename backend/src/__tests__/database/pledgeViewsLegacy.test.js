'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign, Pledge, PledgeBalance, CampaignTotal } = require('../../models');
const { createPledgeViews } = require('../../database/pledgeViews');

let legacyCampaign;
let modernCampaign;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await createPledgeViews(sequelize.getQueryInterface());

  legacyCampaign = await PledgeCampaign.create({
    slug: 'legacy-drive', name: 'Legacy Drive', status: 'closed',
    start_date: '2025-09-13', end_date: '2026-01-12', goal_amount: 1000
  });
  modernCampaign = await PledgeCampaign.create({
    slug: 'modern-drive', name: 'Modern Drive', status: 'active',
    start_date: '2026-01-01', end_date: '2026-12-31'
  });

  // Synthetic donors only — never real member names.
  await Pledge.create({
    campaign_id: legacyCampaign.id, amount: 600, first_name: 'Test', last_name: 'LegacyPaid',
    is_historical: true, legacy_status: 'fulfilled'
  });
  await Pledge.create({
    campaign_id: legacyCampaign.id, amount: 400, first_name: 'Test', last_name: 'LegacyUnpaid',
    is_historical: true, legacy_status: 'pending'
  });
  // A current-drive pledge with no allocations: still genuinely unpaid.
  await Pledge.create({
    campaign_id: modernCampaign.id, amount: 250, first_name: 'Test', last_name: 'ModernDonor',
    is_historical: false
  });
});

// Deliberately no sequelize.close() here — see Global Constraints.

describe('pledge_balances for pre-modernization drives', () => {
  const balanceFor = async (lastName) => {
    const rows = await PledgeBalance.findAll({
      include: [{ model: Pledge, as: 'pledge', where: { last_name: lastName }, required: true }]
    });
    return rows[0];
  };

  it('credits a legacy fulfilled pledge at its full amount', async () => {
    // pledge_allocations is empty for the 2025 drive: fulfilment was recorded
    // as a flag, and allocations cannot be backfilled because they require a
    // real transaction row. legacy_status is the only surviving record.
    const balance = await balanceFor('LegacyPaid');

    expect(parseFloat(balance.paid_amount)).toBe(600);
    expect(parseFloat(balance.remaining_amount)).toBe(0);
    expect(balance.derived_status).toBe('fulfilled');
  });

  it('leaves a legacy pending pledge uncredited', async () => {
    const balance = await balanceFor('LegacyUnpaid');

    expect(parseFloat(balance.paid_amount)).toBe(0);
    expect(balance.derived_status).toBe('not_started');
  });

  it('still requires real allocations for a current drive', async () => {
    const balance = await balanceFor('ModernDonor');

    expect(parseFloat(balance.paid_amount)).toBe(0);
    expect(balance.derived_status).toBe('not_started');
  });

  it('rolls the legacy credit up into campaign_totals', async () => {
    const totals = await CampaignTotal.findOne({ where: { campaign_id: legacyCampaign.id } });

    expect(parseFloat(totals.total_pledged)).toBe(1000);
    expect(parseFloat(totals.total_collected)).toBe(600);
    expect(parseFloat(totals.outstanding)).toBe(400);
    expect(parseFloat(totals.percent_to_goal)).toBe(60);
  });
});
