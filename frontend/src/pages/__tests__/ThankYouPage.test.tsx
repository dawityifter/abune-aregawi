import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import ThankYouPage from '../ThankYouPage';

const mockUseActiveCampaign = jest.fn();
jest.mock('../../hooks/useActiveCampaign', () => ({
  useActiveCampaign: () => mockUseActiveCampaign()
}));

// Capture the props the tracker is handed rather than rendering the real one.
const mockTrackerProps = jest.fn();
jest.mock('../../components/PledgeTracker', () => (props: any) => {
  mockTrackerProps(props);
  return <div>tracker</div>;
});

const CAMPAIGN = {
  id: 7, slug: 'test-drive', name: 'Test Drive', name_ti: null,
  description: null, description_ti: null,
  start_date: '2026-01-01', end_date: '2026-12-31',
  goal_amount: '50000.00', currency: 'usd'
};

const renderPage = () => render(
  <MemoryRouter><ThankYouPage /></MemoryRouter>
);

beforeEach(() => { jest.clearAllMocks(); });

describe('ThankYouPage', () => {
  it('scopes the tracker to the live campaign', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });

    renderPage();

    // Without campaignId the tracker totals every pledge ever recorded,
    // including the closed historical drive.
    expect(mockTrackerProps).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: 7, goalAmount: 50000 })
    );
  });

  it('omits the tracker entirely when no drive is running', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: false, error: null });

    renderPage();

    expect(screen.queryByText('tracker')).not.toBeInTheDocument();
  });
});
