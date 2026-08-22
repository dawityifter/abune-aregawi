import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useActiveCampaign } from '../useActiveCampaign';

const Probe: React.FC = () => {
  const { campaign, loading, error } = useActiveCampaign();
  if (loading) return <div>loading</div>;
  if (error) return <div>error:{error}</div>;
  return <div>campaign:{campaign ? campaign.name : 'none'}</div>;
};

const mockFetchOnce = (payload: unknown, ok = true) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: async () => payload
  }) as unknown as typeof fetch;
};

afterEach(() => { jest.restoreAllMocks(); });

describe('useActiveCampaign', () => {
  it('exposes the live campaign', async () => {
    mockFetchOnce({
      success: true,
      campaigns: [{
        id: 7, slug: 'test-drive', name: 'Test Drive', name_ti: null,
        description: null, description_ti: null,
        start_date: '2026-01-01', end_date: '2026-12-31',
        goal_amount: '50000.00', currency: 'usd'
      }]
    });

    render(<Probe />);
    expect(await screen.findByText('campaign:Test Drive')).toBeInTheDocument();
  });

  it('reports no campaign when none is live', async () => {
    mockFetchOnce({ success: true, campaigns: [] });

    render(<Probe />);
    expect(await screen.findByText('campaign:none')).toBeInTheDocument();
  });

  it('reports an error when the request fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    render(<Probe />);
    await waitFor(() => {
      expect(screen.getByText(/^error:/)).toBeInTheDocument();
    });
  });
});
