import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import PledgePage from '../PledgePage';

const mockUseActiveCampaign = jest.fn();
jest.mock('../../hooks/useActiveCampaign', () => ({
  useActiveCampaign: () => mockUseActiveCampaign()
}));

const mockUseAuth = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => mockUseAuth()
}));

const mockUsePledgeBalance = jest.fn();
jest.mock('../../hooks/usePledgeBalance', () => ({
  usePledgeBalance: () => mockUsePledgeBalance()
}));

// The tracker fetches on mount; keep it quiet and irrelevant to these cases.
jest.mock('../../components/PledgeTracker', () => () => <div>tracker</div>);

const CAMPAIGN = {
  id: 7, slug: 'test-drive', name: 'Test Building Drive', name_ti: null,
  description: 'Help us finish the hall.', description_ti: null,
  start_date: '2026-01-01', end_date: '2026-12-31',
  goal_amount: '50000.00', currency: 'usd'
};

const renderPage = () => render(
  <MemoryRouter><I18nProvider><LanguageProvider><PledgePage /></LanguageProvider></I18nProvider></MemoryRouter>
);

// Shared default: a signed-out visitor with no pledge balance, unless a test
// overrides it. Keeps the pre-existing tests below meaningful without forcing
// every one of them to restate the auth/balance boilerplate.
beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: null, currentUser: null });
  mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false });
});

describe('PledgePage', () => {
  it('shows the pledge form while a drive is running', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });

    renderPage();

    expect(screen.getByText('Test Building Drive')).toBeInTheDocument();
    expect(screen.queryByText(/no fundraising drive/i)).not.toBeInTheDocument();
  });

  it('explains that no drive is running instead of showing a form', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: false, error: null });

    renderPage();

    expect(screen.getByText(/no fundraising drive/i)).toBeInTheDocument();
    expect(screen.queryByText('Pledge Amount *')).not.toBeInTheDocument();
  });
});

describe('PledgePage intent chooser', () => {
  beforeEach(() => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });
    mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false });
    mockUseAuth.mockReturnValue({ user: null, currentUser: null });
  });

  it('offers sign-in and anonymous giving to a signed-out visitor', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /give anonymously now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to pledge/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pledge for later$/i })).not.toBeInTheDocument();
  });

  it('offers all three choices to a signed-in member with no pledge', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1 }, currentUser: { id: 1 } });
    renderPage();

    expect(screen.getByRole('button', { name: /pledge for later/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pledge and pay now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /give anonymously now/i })).toBeInTheDocument();
  });

  it('offers to pay an existing pledge instead of creating a second one', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1 }, currentUser: { id: 1 } });
    mockUsePledgeBalance.mockReturnValue({
      balance: { id: 3, campaign_name: 'Test Building Drive',
                 pledged_amount: 500, paid_amount: 200, remaining_amount: 300 },
      loading: false
    });

    renderPage();

    expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pledge for later/i })).not.toBeInTheDocument();
  });

  it('does not promise a confirmation email that is never sent', () => {
    renderPage();
    expect(screen.queryByText(/confirmation email/i)).not.toBeInTheDocument();
  });
});
