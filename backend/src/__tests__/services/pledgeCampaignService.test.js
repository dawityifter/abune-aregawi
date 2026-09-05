'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign } = require('../../models');
const {
  isLive, findLiveCampaign, findOverlappingActive, todayInChurchTz
} = require('../../services/pledgeCampaignService');

// Fixed reference day used for every isLive() assertion, so these tests do not
// change meaning as the calendar moves.
const TODAY = '2026-06-15';

const campaign = (overrides = {}) => ({
  status: 'active',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  ...overrides
});

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterEach(async () => { await PledgeCampaign.destroy({ where: {}, truncate: true }); });
// Deliberately no sequelize.close() here — see Global Constraints.

describe('isLive', () => {
  it('is not live the day before it starts', () => {
    expect(isLive(campaign({ start_date: '2026-06-16' }), TODAY)).toBe(false);
  });

  it('is live on its first day', () => {
    expect(isLive(campaign({ start_date: TODAY }), TODAY)).toBe(true);
  });

  it('is live on its last day', () => {
    expect(isLive(campaign({ end_date: TODAY }), TODAY)).toBe(true);
  });

  it('is not live the day after it ends', () => {
    expect(isLive(campaign({ end_date: '2026-06-14' }), TODAY)).toBe(false);
  });

  it('is live with no end date', () => {
    expect(isLive(campaign({ end_date: null }), TODAY)).toBe(true);
  });

  it('is not live while draft, even inside the window', () => {
    expect(isLive(campaign({ status: 'draft' }), TODAY)).toBe(false);
  });

  it('is not live once closed, even inside the window', () => {
    expect(isLive(campaign({ status: 'closed' }), TODAY)).toBe(false);
  });
});

describe('todayInChurchTz', () => {
  it('returns a YYYY-MM-DD date in the church timezone', () => {
    expect(todayInChurchTz()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses America/Chicago, not UTC', () => {
    // 01:30 UTC on Jan 2 is still Jan 1 in Dallas. A campaign ending Jan 1 must
    // still be live for its final evening — the bug this pins down.
    jest.useFakeTimers().setSystemTime(new Date('2026-01-02T01:30:00Z'));
    try {
      expect(todayInChurchTz()).toBe('2026-01-01');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('findLiveCampaign', () => {
  it('returns null when nothing is active', async () => {
    await PledgeCampaign.create({
      slug: 'draft-drive', name: 'Draft Drive', status: 'draft',
      start_date: '2026-01-01', end_date: '2026-12-31'
    });
    expect(await findLiveCampaign()).toBeNull();
  });

  it('returns the active campaign whose window contains today', async () => {
    const today = todayInChurchTz();
    await PledgeCampaign.create({
      slug: 'live-drive', name: 'Live Drive', status: 'active',
      start_date: today, end_date: null
    });
    const found = await findLiveCampaign();
    expect(found).not.toBeNull();
    expect(found.slug).toBe('live-drive');
  });

  it('ignores an active campaign whose window has passed', async () => {
    await PledgeCampaign.create({
      slug: 'past-drive', name: 'Past Drive', status: 'active',
      start_date: '2020-01-01', end_date: '2020-12-31'
    });
    expect(await findLiveCampaign()).toBeNull();
  });
});

describe('findOverlappingActive', () => {
  const makeActive = () => PledgeCampaign.create({
    slug: 'existing', name: 'Existing Drive', status: 'active',
    start_date: '2026-01-01', end_date: '2026-06-30'
  });

  it('finds an active campaign overlapping the candidate window', async () => {
    await makeActive();
    const clash = await findOverlappingActive({
      start_date: '2026-06-01', end_date: '2026-12-31'
    });
    expect(clash).not.toBeNull();
    expect(clash.slug).toBe('existing');
  });

  it('allows an adjacent, non-overlapping window', async () => {
    await makeActive();
    expect(await findOverlappingActive({
      start_date: '2026-07-01', end_date: '2026-12-31'
    })).toBeNull();
  });

  it('treats a null end date as unbounded', async () => {
    await makeActive();
    expect(await findOverlappingActive({
      start_date: '2026-07-01', end_date: null
    })).toBeNull();
    expect(await findOverlappingActive({
      start_date: '2025-01-01', end_date: null
    })).not.toBeNull();
  });

  it('ignores draft and closed campaigns', async () => {
    await PledgeCampaign.create({
      slug: 'drafty', name: 'Drafty', status: 'draft',
      start_date: '2026-01-01', end_date: '2026-12-31'
    });
    expect(await findOverlappingActive({
      start_date: '2026-01-01', end_date: '2026-12-31'
    })).toBeNull();
  });

  it('excludes the campaign being updated from its own overlap check', async () => {
    const existing = await makeActive();
    expect(await findOverlappingActive({
      id: existing.id, start_date: '2026-01-01', end_date: '2026-06-30'
    })).toBeNull();
  });
});
