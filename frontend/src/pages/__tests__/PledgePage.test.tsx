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

jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => ({ user: null, currentUser: null })
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
