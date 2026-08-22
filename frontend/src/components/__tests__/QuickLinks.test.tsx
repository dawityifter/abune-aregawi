import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import QuickLinks from '../QuickLinks';

const mockUseActiveCampaign = jest.fn();
jest.mock('../../hooks/useActiveCampaign', () => ({
  useActiveCampaign: () => mockUseActiveCampaign()
}));

const CAMPAIGN = {
  id: 7, slug: 'test-drive', name: 'Test Building Drive', name_ti: null,
  description: 'Help us finish the hall.', description_ti: null,
  start_date: '2026-01-01', end_date: '2026-12-31',
  goal_amount: '50000.00', currency: 'usd'
};

const renderWithProviders = () => render(
  <BrowserRouter><I18nProvider><LanguageProvider><QuickLinks /></LanguageProvider></I18nProvider></BrowserRouter>
);

beforeEach(() => {
  mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: false, error: null });
});

describe('QuickLinks', () => {
  it('links to the survey page', () => {
    renderWithProviders();
    const link = screen.getByText('Church Services Survey').closest('a');
    expect(link).toHaveAttribute('href', '/survey');
  });

  it('shows a pledge card named for the running campaign', async () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });

    renderWithProviders();

    const link = (await screen.findByText('Test Building Drive')).closest('a');
    expect(link).toHaveAttribute('href', '/pledge');
    expect(screen.getByText('Help us finish the hall.')).toBeInTheDocument();
  });

  it('shows no pledge card when no campaign is running', () => {
    renderWithProviders();
    expect(screen.queryByText(/pledge/i)).not.toBeInTheDocument();
  });

  it('shows no pledge card while the campaign is still loading', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: true, error: null });

    renderWithProviders();
    expect(screen.queryByText(/pledge/i)).not.toBeInTheDocument();
  });

  it('fails closed: shows no pledge card when the lookup errored', async () => {
    // A broken card on the parish home page is worse than no card.
    mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: false, error: 'offline' });

    renderWithProviders();
    await waitFor(() => {
      expect(screen.queryByText(/pledge/i)).not.toBeInTheDocument();
    });
  });
});
