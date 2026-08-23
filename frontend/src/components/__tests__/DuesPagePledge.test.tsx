import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import DuesPage from '../DuesPage';

const mockUsePledgeBalance = jest.fn();
jest.mock('../../hooks/usePledgeBalance', () => ({
  usePledgeBalance: () => mockUsePledgeBalance()
}));

jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => ({ user: { uid: 'test-uid' }, currentUser: { uid: 'test-uid' } })
}));

const renderPage = () => render(
  <MemoryRouter><I18nProvider><LanguageProvider><DuesPage /></LanguageProvider></I18nProvider></MemoryRouter>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePledgeBalance.mockReturnValue({
    balance: {
      id: 1, campaign_id: 2, campaign_name: 'Live Drive',
      pledged_amount: 500, paid_amount: 200, remaining_amount: 300
    },
    loading: false, error: null
  });
});

describe('DuesPage pledge banner', () => {
  it('points a member with an outstanding pledge at the donate page', () => {
    renderPage();

    expect(screen.getByText(/\$300/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /pledge/i });
    expect(link).toHaveAttribute('href', '/donate');
  });

  it('shows nothing when there is no outstanding pledge', () => {
    mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false, error: null });

    renderPage();

    expect(screen.queryByText(/pledge/i)).not.toBeInTheDocument();
  });
});
