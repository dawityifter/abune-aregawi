import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PledgeDashboard from '../PledgeDashboard';
import * as api from '../../../utils/pledgeDashboardApi';
import * as campaignApi from '../../../utils/pledgeCampaignApi';

// Hoisted so the mock factory can return the same object on every call.
// A fresh object each render would make the container's [campaignId] effect
// (or a naive [campaign] one) see a "new" dependency and refetch forever.
const mockCampaign = { id: 2, name: '2026 Pledge Drive' };

jest.mock('../../../hooks/useActiveCampaign', () => ({
  useActiveCampaign: () => ({ campaign: mockCampaign, loading: false })
}));

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en' })
}));

const snapshot: api.DashboardSnapshot = {
  campaign: { id: '2', slug: '2026-pledge-drive', name: '2026 Pledge Drive', name_ti: null,
    start_date: '2026-09-01', end_date: '2026-12-31', status: 'active', goal_amount: 100000 },
  timeline: { day: 22, total_days: 122, days_remaining: 100, elapsed_fraction: 0.18 },
  money: { pledged: 53881, collected: 45581, outstanding_owed: 9000, overpaid: 700,
    goal: 100000, gap_to_goal: 54419, percent_to_goal: 45.6, fulfillment_rate: 84.6,
    linear_pace_target: 18033, required_run_rate: 545 },
  participation: { households: 99, active_households: 310, rate: 31.9,
    anonymous_pledges: 17, anonymous_collected: 4200, family_id_populated: true },
  breakdown: [
    { status: 'fulfilled', pledge_count: 97, household_count: 83,
      total_pledged: 44881, total_collected: 44881, outstanding_owed: 0 }
  ],
  attention: { stalled: 12, never_started: 47, overpaid: 2, unlinked: 3, ending_soon: false },
  as_of: '2026-09-22T23:57:07.481Z'
};

describe('PledgeDashboard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders the band once the snapshot loads', async () => {
    jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
    render(<PledgeDashboard onFilterChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('2026 Pledge Drive')).toBeInTheDocument());
    // $45,581 appears twice: the money-bar legend and the Received KPI.
    expect(screen.getAllByText('$45,581')).toHaveLength(2);
  });

  it('reports a failure without pretending the numbers are zero', async () => {
    jest.spyOn(api, 'fetchDashboard').mockRejectedValue(new Error('Failed to load the dashboard'));
    render(<PledgeDashboard onFilterChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('dashboard-error')).toBeInTheDocument());
    expect(screen.queryByText('$0')).not.toBeInTheDocument();
  });

  // Spec section 5: participation must say "members" when family_id is not
  // populated, because the figure is then a member count wearing a household
  // label. The API returns the flag precisely so the UI can tell the truth.
  it('labels participation as members when family_id is unpopulated', async () => {
    jest.spyOn(api, 'fetchDashboard').mockResolvedValue({
      ...snapshot,
      participation: { ...snapshot.participation, family_id_populated: false }
    });
    render(<PledgeDashboard onFilterChange={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('kpi-participation')).toHaveTextContent(/members/i));
  });

  // A refresh can fail after a snapshot has already loaded. load() keeps the
  // last-good snapshot rather than clearing it, so a silent failure here
  // would leave the treasurer looking at stale numbers with no indication
  // anything went wrong.
  it('keeps showing the last snapshot and flags a failed refresh', async () => {
    jest.spyOn(api, 'fetchDashboard')
      .mockResolvedValueOnce(snapshot)
      .mockRejectedValueOnce(new Error('Failed to load the dashboard'));
    render(<PledgeDashboard onFilterChange={jest.fn()} />);

    await waitFor(() => expect(screen.getAllByText('$45,581')).toHaveLength(2));

    await userEvent.click(screen.getByRole('button', { name: 'pledgeDashboard.header.refresh' }));

    await waitFor(() =>
      expect(screen.getByTestId('dashboard-refresh-error')).toBeInTheDocument());
    // The figures from the successful load are still on screen.
    expect(screen.getAllByText('$45,581')).toHaveLength(2);
  });

  it('raises the chosen filter to its parent', async () => {
    const onFilterChange = jest.fn();
    jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
    render(<PledgeDashboard onFilterChange={onFilterChange} />);
    await waitFor(() => expect(screen.getByTestId('attention-stalled')).toBeInTheDocument());
    screen.getByTestId('attention-stalled').click();
    await waitFor(() => expect(onFilterChange).toHaveBeenCalledWith('stalled'));
  });

  // Task 7 / R8: both below-the-fold sections start collapsed, and their
  // endpoints (tier-3 only) must not be called until a caller actually opens
  // the section — a tier-2 role would otherwise pay for two 403s on every
  // page view of the dashboard.
  describe('monthly collections and year-over-year (collapsed by default)', () => {
    it('collapses both sections by default', async () => {
      jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
      render(<PledgeDashboard onFilterChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByTestId('monthly-toggle')).toBeInTheDocument());
      expect(screen.getByTestId('monthly-toggle')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('yoy-toggle')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('monthly-restricted')).not.toBeInTheDocument();
    });

    it('does not fetch monthly collections until the section is opened, then fetches exactly once', async () => {
      jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
      const fetchMonthly = jest.spyOn(api, 'fetchMonthly').mockResolvedValue({
        available: true, reason: null, partial_historical: false,
        months: [{ month: '2026-09', collected: 1000, cumulative: 1000 }]
      });
      render(<PledgeDashboard onFilterChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByTestId('monthly-toggle')).toBeInTheDocument());

      expect(fetchMonthly).not.toHaveBeenCalled();

      await userEvent.click(screen.getByTestId('monthly-toggle'));
      // Wait for the fetched series to actually land in state, not just for
      // the call to have been made — otherwise the next two clicks below can
      // race the pending promise and the section re-fetches.
      await waitFor(() => expect(screen.getByTestId('month-2026-09')).toBeInTheDocument());
      expect(fetchMonthly).toHaveBeenCalledTimes(1);
      expect(fetchMonthly).toHaveBeenCalledWith(mockCampaign.id);

      // Close, then reopen: the same series is reused rather than re-fetched.
      await userEvent.click(screen.getByTestId('monthly-toggle'));
      await userEvent.click(screen.getByTestId('monthly-toggle'));
      await waitFor(() => expect(screen.getByTestId('month-2026-09')).toBeInTheDocument());
      expect(fetchMonthly).toHaveBeenCalledTimes(1);
    });

    it('shows the restricted note when monthly collections come back withheld', async () => {
      jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
      jest.spyOn(api, 'fetchMonthly').mockResolvedValue(null);
      render(<PledgeDashboard onFilterChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByTestId('monthly-toggle')).toBeInTheDocument());

      await userEvent.click(screen.getByTestId('monthly-toggle'));
      await waitFor(() => expect(screen.getByTestId('monthly-restricted')).toBeInTheDocument());
    });

    // Not required by the brief, but the same lazy-fetch contract applies to
    // the year-over-year section, including the prior-drive lookup.
    it('looks up the prior drive and fetches the comparison only once the section opens', async () => {
      jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
      const fetchAllCampaigns = jest.spyOn(campaignApi, 'fetchAllCampaigns').mockResolvedValue([
        { id: 1, slug: '2025-pledge-drive', name: '2025', name_ti: null,
          description: null, description_ti: null, start_date: '2025-09-13',
          end_date: '2026-01-12', goal_amount: null, currency: 'USD',
          status: 'closed', default_payment_type: null, income_category_id: null, totals: null }
      ]);
      const fetchComparison = jest.spyOn(api, 'fetchComparison').mockResolvedValue(null);
      render(<PledgeDashboard onFilterChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByTestId('yoy-toggle')).toBeInTheDocument());

      expect(fetchAllCampaigns).not.toHaveBeenCalled();

      await userEvent.click(screen.getByTestId('yoy-toggle'));
      await waitFor(() => expect(fetchComparison).toHaveBeenCalledWith(mockCampaign.id, 1));
      await waitFor(() => expect(screen.getByTestId('yoy-restricted')).toBeInTheDocument());

      await userEvent.click(screen.getByTestId('yoy-toggle'));
      await userEvent.click(screen.getByTestId('yoy-toggle'));
      expect(fetchAllCampaigns).toHaveBeenCalledTimes(1);
      expect(fetchComparison).toHaveBeenCalledTimes(1);
    });

    it('shows a note instead of fetching when there is no earlier drive', async () => {
      jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
      jest.spyOn(campaignApi, 'fetchAllCampaigns').mockResolvedValue([]);
      const fetchComparison = jest.spyOn(api, 'fetchComparison');
      render(<PledgeDashboard onFilterChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByTestId('yoy-toggle')).toBeInTheDocument());

      await userEvent.click(screen.getByTestId('yoy-toggle'));
      await waitFor(() => expect(screen.getByTestId('yoy-no-prior')).toBeInTheDocument());
      expect(fetchComparison).not.toHaveBeenCalled();
    });
  });
});
