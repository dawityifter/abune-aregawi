import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PledgeDashboard from '../PledgeDashboard';
import * as api from '../../../utils/pledgeDashboardApi';

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

  it('raises the chosen filter to its parent', async () => {
    const onFilterChange = jest.fn();
    jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
    render(<PledgeDashboard onFilterChange={onFilterChange} />);
    await waitFor(() => expect(screen.getByTestId('attention-stalled')).toBeInTheDocument());
    screen.getByTestId('attention-stalled').click();
    await waitFor(() => expect(onFilterChange).toHaveBeenCalledWith('stalled'));
  });
});
