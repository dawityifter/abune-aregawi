import { formatFigure, fetchDashboard, fetchMonthly } from '../pledgeDashboardApi';

jest.mock('../../firebase', () => ({
  auth: { currentUser: { getIdToken: async () => 'test-token' } }
}));

describe('formatFigure', () => {
  // The whole point of the formatter. A suppressed figure and a real zero are
  // different answers, and rendering the first as the second is the single
  // most misleading thing this dashboard could do.
  it('renders a suppressed figure as an em dash, never as zero', () => {
    expect(formatFigure(null, 'money')).toBe('—');
    expect(formatFigure(null, 'count')).toBe('—');
    expect(formatFigure(null, 'percent')).toBe('—');
  });

  it('renders a real zero as zero', () => {
    expect(formatFigure(0, 'money')).toBe('$0');
    expect(formatFigure(0, 'count')).toBe('0');
    expect(formatFigure(0, 'percent')).toBe('0%');
  });

  it('formats money without cents', () => {
    expect(formatFigure(45581, 'money')).toBe('$45,581');
    expect(formatFigure(45581.62, 'money')).toBe('$45,582');
  });

  it('formats counts and percentages', () => {
    expect(formatFigure(1234, 'count')).toBe('1,234');
    expect(formatFigure(84.6, 'percent')).toBe('84.6%');
    expect(formatFigure(60, 'percent')).toBe('60%');
  });
});

describe('fetchDashboard', () => {
  afterEach(() => { (global.fetch as jest.Mock)?.mockRestore?.(); });

  it('returns the dashboard payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, dashboard: { campaign: { id: '2' } } })
    }) as any;

    const result = await fetchDashboard(2);
    expect(result.campaign.id).toBe('2');
  });

  it('throws with the server message on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ success: false, message: 'Failed to build the pledge dashboard' })
    }) as any;

    await expect(fetchDashboard(2)).rejects.toThrow('Failed to build the pledge dashboard');
  });
});

describe('fetchMonthly', () => {
  afterEach(() => { (global.fetch as jest.Mock)?.mockRestore?.(); });

  // 403 is what a tier-2 role gets by design — these two series are tier 3 only
  // because a cumulative cannot be protected by small-number suppression. It is
  // an expected state the UI explains, not a failure it reports.
  it('returns null on 403 rather than throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 403, json: async () => ({ success: false })
    }) as any;

    await expect(fetchMonthly(2)).resolves.toBeNull();
  });

  it('still throws on a genuine error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({ success: false, message: 'boom' })
    }) as any;

    await expect(fetchMonthly(2)).rejects.toThrow('boom');
  });
});
