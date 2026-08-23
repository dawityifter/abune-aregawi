import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import DonatePage from '../DonatePage';

const mockUsePledgeBalance = jest.fn();
jest.mock('../../hooks/usePledgeBalance', () => ({
  usePledgeBalance: () => mockUsePledgeBalance()
}));

const mockAuth = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => mockAuth()
}));

// Capture what the payment components are told to charge for.
const mockStripeProps = jest.fn();
jest.mock('../StripePayment', () => (props: any) => {
  mockStripeProps(props);
  return <div>stripe</div>;
});
jest.mock('../ACHPayment', () => () => <div>ach</div>);

const BALANCE = {
  id: 1, campaign_id: 2, campaign_name: 'Live Drive',
  pledged_amount: 500, paid_amount: 200, remaining_amount: 300
};

const renderPage = () => render(
  <MemoryRouter><I18nProvider><LanguageProvider><DonatePage /></LanguageProvider></I18nProvider></MemoryRouter>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { uid: 'test-uid' }, currentUser: { uid: 'test-uid' } });
  mockUsePledgeBalance.mockReturnValue({ balance: BALANCE, loading: false, error: null });
});

describe('DonatePage pledge option', () => {
  it('offers to apply the gift to an outstanding pledge', () => {
    renderPage();

    expect(screen.getByText(/apply to my pledge/i)).toBeInTheDocument();
    expect(screen.getByText(/\$300/)).toBeInTheDocument();
  });

  it('sends the pledge purpose once the option is ticked', async () => {
    renderPage();

    await userEvent.click(screen.getByLabelText(/apply to my pledge/i));

    // Without this the webhook types the payment 'donation' and the rule
    // never fires.
    const lastCall = mockStripeProps.mock.calls[mockStripeProps.mock.calls.length - 1][0];
    expect(lastCall.purpose).toBe('pledge_drive');
  });

  it('says nothing about pledges to a visitor who is not signed in', () => {
    mockAuth.mockReturnValue({ user: null, currentUser: null });
    mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false, error: null });

    renderPage();

    expect(screen.queryByText(/apply to my pledge/i)).not.toBeInTheDocument();
  });

  it('says nothing when the member has no outstanding pledge', () => {
    mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false, error: null });

    renderPage();

    expect(screen.queryByText(/apply to my pledge/i)).not.toBeInTheDocument();
  });

  it('says nothing when the pledge is already fully paid', () => {
    mockUsePledgeBalance.mockReturnValue({
      balance: { ...BALANCE, paid_amount: 500, remaining_amount: 0 }, loading: false, error: null
    });

    renderPage();

    expect(screen.queryByText(/apply to my pledge/i)).not.toBeInTheDocument();
  });
});
