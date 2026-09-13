import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionDetail from '../BankTransactionDetail';
import { BankTransaction } from '../BankTransactionList';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import { I18nProvider } from '../../../i18n/I18nProvider';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } })
}));

const mockFetchBalance = jest.fn();
jest.mock('../../../utils/pledgeBalanceApi', () => ({
  fetchPledgeBalance: (memberId?: number) => mockFetchBalance(memberId)
}));

global.fetch = jest.fn();

const renderDetail = (ui: React.ReactElement) => render(
  <I18nProvider><LanguageProvider>{ui}</LanguageProvider></I18nProvider>
);

// A pending Zelle credit whose payer is already matched to a member, which is
// the state a treasurer reviews. Synthetic name.
const pendingZelle: BankTransaction = {
  id: 42,
  date: '2026-03-28',
  amount: 250,
  description: 'ZELLE FROM TEST PLEDGER ON 03/28 REF#ABC123',
  type: 'ZELLE',
  status: 'PENDING',
  payer_name: 'Test Pledger',
  check_number: null,
  suggested_match: { member: { id: 99, first_name: 'Test', last_name: 'Pledger' } }
} as BankTransaction;

const selectPledgeDrive = () => fireEvent.change(
  screen.getByRole('combobox', { name: /payment type/i }),
  { target: { value: 'pledge_drive' } }
);

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchBalance.mockResolvedValue(null);
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true, json: () => Promise.resolve({ success: true })
  });
});

describe('BankTransactionDetail — pledge reconciliation', () => {
  it('offers Pledge Drive as a payment type', () => {
    renderDetail(<BankTransactionDetail txn={pendingZelle} onClose={jest.fn()} onSuccess={jest.fn()} />);

    expect(screen.getByRole('option', { name: /pledge drive/i })).toBeInTheDocument();
  });

  it('shows the member\'s open pledge once Pledge Drive is chosen', async () => {
    mockFetchBalance.mockResolvedValue({
      id: 7, campaign_id: 3, campaign_name: 'Test Drive',
      pledged_amount: 1000, paid_amount: 250, remaining_amount: 750
    });
    renderDetail(<BankTransactionDetail txn={pendingZelle} onClose={jest.fn()} onSuccess={jest.fn()} />);

    selectPledgeDrive();

    expect(await screen.findByText(/open pledge/i)).toBeInTheDocument();
    expect(screen.getByText(/\$750/)).toBeInTheDocument();
    await waitFor(() => expect(mockFetchBalance).toHaveBeenCalledWith(99));
  });

  it('does not look up a pledge for any other payment type', async () => {
    renderDetail(<BankTransactionDetail txn={pendingZelle} onClose={jest.fn()} onSuccess={jest.fn()} />);

    fireEvent.change(screen.getByRole('combobox', { name: /payment type/i }), {
      target: { value: 'tithe' }
    });

    await waitFor(() => expect(mockFetchBalance).not.toHaveBeenCalled());
    expect(screen.queryByText(/open pledge/i)).not.toBeInTheDocument();
  });

  it('reconciles without a pledge_amount when the pledge already exists', async () => {
    mockFetchBalance.mockResolvedValue({
      id: 7, campaign_id: 3, campaign_name: 'Test Drive',
      pledged_amount: 1000, paid_amount: 250, remaining_amount: 750
    });
    renderDetail(<BankTransactionDetail txn={pendingZelle} onClose={jest.fn()} onSuccess={jest.fn()} />);

    selectPledgeDrive();
    await screen.findByText(/open pledge/i);
    fireEvent.click(screen.getByRole('button', { name: /^approve/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bank/reconcile'),
      expect.objectContaining({ method: 'POST' })
    ));
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.payment_type).toBe('pledge_drive');
    expect(body.pledge_amount).toBeUndefined();
  });

  it('offers to open a pledge when the member has none, defaulting to the payment', async () => {
    renderDetail(<BankTransactionDetail txn={pendingZelle} onClose={jest.fn()} onSuccess={jest.fn()} />);

    selectPledgeDrive();

    expect(await screen.findByText(/no open pledge/i)).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', { name: /record a pledge/i });
    fireEvent.click(checkbox);
    expect(screen.getByLabelText(/pledge amount/i)).toHaveValue(250);
  });

  it('sends the pledge amount when opening a pledge with the payment', async () => {
    renderDetail(<BankTransactionDetail txn={pendingZelle} onClose={jest.fn()} onSuccess={jest.fn()} />);

    selectPledgeDrive();
    await screen.findByText(/no open pledge/i);
    fireEvent.click(screen.getByRole('checkbox', { name: /record a pledge/i }));
    fireEvent.change(screen.getByLabelText(/pledge amount/i), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /^approve/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.pledge_amount).toBe(1000);
    expect(body.payment_type).toBe('pledge_drive');
  });

  it('warns when the payment was recorded but the pledge could not be', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, pledgeError: 'No pledge drive is currently open' })
    });
    renderDetail(<BankTransactionDetail txn={pendingZelle} onClose={jest.fn()} onSuccess={jest.fn()} />);

    selectPledgeDrive();
    await screen.findByText(/no open pledge/i);
    fireEvent.click(screen.getByRole('button', { name: /^approve/i }));

    expect(await screen.findByText(/no pledge drive is currently open/i)).toBeInTheDocument();
  });
});
