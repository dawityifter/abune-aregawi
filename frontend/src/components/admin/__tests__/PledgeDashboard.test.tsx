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

// Returns the key, followed by any interpolated values, so a test can see
// what a formatted figure was rendered as (e.g. a withheld "—").
jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key} ${Object.values(params).join(' ')}` : key,
    language: 'en'
  })
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
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(api, 'fetchDashboard').mockRejectedValue(new Error('Failed to load the dashboard'));
    render(<PledgeDashboard onFilterChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('dashboard-error')).toBeInTheDocument());
    expect(screen.queryByText('$0')).not.toBeInTheDocument();
  });

  // Final review M3: the box shows a translated message; the server's own
  // (English, possibly technical) message goes to the console, not the page.
  it('shows a translated load failure and logs the server message', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(api, 'fetchDashboard').mockRejectedValue(new Error('relation "x" does not exist'));
    render(<PledgeDashboard onFilterChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('dashboard-error')).toBeInTheDocument());
    expect(screen.getByTestId('dashboard-error')).toHaveTextContent('pledgeDashboard.loadFailed');
    expect(screen.queryByText(/relation "x"/)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(expect.anything(), 'relation "x" does not exist');
  });

  // Final review I3 + M9: Received is defined on its own card. With a
  // run-rate line the definition is a second line; at goal the run-rate line
  // says so instead of "needs $0/day".
  describe('Received KPI', () => {
    const receivedCard = () =>
      screen.getAllByText('pledgeDashboard.kpi.received')
        .map((el) => el.closest('div') as HTMLElement)
        .find((card) => card.textContent?.includes('kpi.receivedDefinition')) as HTMLElement;

    it('keeps the run-rate line and adds the definition beneath it', async () => {
      jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
      render(<PledgeDashboard onFilterChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByText('2026 Pledge Drive')).toBeInTheDocument());
      expect(receivedCard()).toHaveTextContent('pledgeDashboard.kpi.runRate $545 100');
      expect(receivedCard()).toHaveTextContent('pledgeDashboard.kpi.receivedDefinition');
    });

    it('shows the definition alone when no run-rate applies', async () => {
      jest.spyOn(api, 'fetchDashboard').mockResolvedValue({
        ...snapshot, money: { ...snapshot.money, required_run_rate: null }
      });
      render(<PledgeDashboard onFilterChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByText('2026 Pledge Drive')).toBeInTheDocument());
      expect(receivedCard()).not.toHaveTextContent('kpi.runRate');
      expect(receivedCard()).toHaveTextContent('pledgeDashboard.kpi.receivedDefinition');
    });

    it('says the goal is reached instead of "needs $0/day"', async () => {
      jest.spyOn(api, 'fetchDashboard').mockResolvedValue({
        ...snapshot, money: { ...snapshot.money, required_run_rate: 0, gap_to_goal: 0 }
      });
      render(<PledgeDashboard onFilterChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByText('2026 Pledge Drive')).toBeInTheDocument());
      expect(receivedCard()).toHaveTextContent('pledgeDashboard.kpi.goalReached');
      expect(receivedCard()).not.toHaveTextContent('kpi.runRate');
    });
  });

  // Final review I8: a withheld (null) anonymous or overpaid figure keeps its
  // secondary line and shows "—", matching AttentionPanel — dropping it would
  // read as "none".
  it('keeps the anonymous line with an em dash when the count is withheld', async () => {
    jest.spyOn(api, 'fetchDashboard').mockResolvedValue({
      ...snapshot,
      participation: { ...snapshot.participation, anonymous_pledges: null, anonymous_collected: null }
    });
    render(<PledgeDashboard onFilterChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('kpi-participation')).toBeInTheDocument());
    expect(screen.getByTestId('kpi-participation')).toHaveTextContent('pledgeDashboard.kpi.anonymous —');
  });

  it('keeps the overpaid line with an em dash when the figure is withheld', async () => {
    jest.spyOn(api, 'fetchDashboard').mockResolvedValue({
      ...snapshot, money: { ...snapshot.money, overpaid: null }
    });
    render(<PledgeDashboard onFilterChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('2026 Pledge Drive')).toBeInTheDocument());
    expect(screen.getByText('pledgeDashboard.kpi.overpaid —')).toBeInTheDocument();
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
    jest.spyOn(console, 'error').mockImplementation(() => {});
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

    // Fix round 1, finding 1: fetchMonthly rejects on a non-403 failure
    // (readError throws for a 500). The container must catch it — an
    // unhandled rejection here would otherwise leave the section stuck on
    // its loading note forever, with no sign anything went wrong.
    it('shows an error note when the monthly fetch fails, instead of hanging on the loading note', async () => {
      jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
      const fetchMonthly = jest.spyOn(api, 'fetchMonthly')
        .mockRejectedValue(new Error('Failed to load monthly collections'));
      render(<PledgeDashboard onFilterChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByTestId('monthly-toggle')).toBeInTheDocument());

      await userEvent.click(screen.getByTestId('monthly-toggle'));
      // If this promise rejection went uncaught, Jest/jsdom would report it
      // as a test failure (or an "unhandled promise rejection" warning) —
      // reaching the assertion below at all is part of what this test checks.
      await waitFor(() => expect(screen.getByTestId('monthly-error')).toBeInTheDocument());
      expect(fetchMonthly).toHaveBeenCalledTimes(1);
    });

    // Fix round 1, finding 2: the prior drive is the LATEST campaign whose
    // start_date is strictly before the current one's — a drive starting on
    // the exact same date must be excluded, and among several qualifying
    // drives the later one wins.
    it('picks the later of two earlier drives and excludes one starting the same day', async () => {
      jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
      const olderDrive = { id: 1, slug: '2024-pledge-drive', name: '2024', name_ti: null,
        description: null, description_ti: null, start_date: '2024-09-01',
        end_date: '2025-01-01', goal_amount: null, currency: 'USD',
        status: 'closed' as const, default_payment_type: null, income_category_id: null, totals: null };
      const laterEarlierDrive = { id: 2, slug: '2025-pledge-drive', name: '2025', name_ti: null,
        description: null, description_ti: null, start_date: '2025-09-13',
        end_date: '2026-01-12', goal_amount: null, currency: 'USD',
        status: 'closed' as const, default_payment_type: null, income_category_id: null, totals: null };
      const sameDayDrive = { id: 3, slug: 'same-day-drive', name: 'Same day', name_ti: null,
        description: null, description_ti: null, start_date: snapshot.campaign.start_date,
        end_date: null, goal_amount: null, currency: 'USD',
        status: 'closed' as const, default_payment_type: null, income_category_id: null, totals: null };
      jest.spyOn(campaignApi, 'fetchAllCampaigns')
        .mockResolvedValue([olderDrive, laterEarlierDrive, sameDayDrive]);
      const fetchComparison = jest.spyOn(api, 'fetchComparison').mockResolvedValue(null);
      render(<PledgeDashboard onFilterChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByTestId('yoy-toggle')).toBeInTheDocument());

      await userEvent.click(screen.getByTestId('yoy-toggle'));
      await waitFor(() =>
        expect(fetchComparison).toHaveBeenCalledWith(mockCampaign.id, laterEarlierDrive.id));
      expect(fetchComparison).not.toHaveBeenCalledWith(mockCampaign.id, olderDrive.id);
      expect(fetchComparison).not.toHaveBeenCalledWith(mockCampaign.id, sameDayDrive.id);
    });

    // Fix round 1, finding 1 (year-over-year side): fetchComparison rejects
    // on a non-403 failure. Same contract as the monthly section.
    it('shows an error note when the comparison fetch fails', async () => {
      jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
      jest.spyOn(campaignApi, 'fetchAllCampaigns').mockResolvedValue([
        { id: 1, slug: '2025-pledge-drive', name: '2025', name_ti: null,
          description: null, description_ti: null, start_date: '2025-09-13',
          end_date: '2026-01-12', goal_amount: null, currency: 'USD',
          status: 'closed', default_payment_type: null, income_category_id: null, totals: null }
      ]);
      jest.spyOn(api, 'fetchComparison').mockRejectedValue(new Error('Failed to load the comparison'));
      render(<PledgeDashboard onFilterChange={jest.fn()} />);
      await waitFor(() => expect(screen.getByTestId('yoy-toggle')).toBeInTheDocument());

      await userEvent.click(screen.getByTestId('yoy-toggle'));
      await waitFor(() => expect(screen.getByTestId('yoy-error')).toBeInTheDocument());
    });
  });
});
