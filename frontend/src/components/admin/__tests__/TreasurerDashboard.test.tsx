import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TreasurerDashboard from '../TreasurerDashboard';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const FIREBASE_USER = { uid: 'u1', getIdToken: () => Promise.resolve('mock-token') };
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'u1', email: 't@example.com' },
    firebaseUser: FIREBASE_USER,
    getUserProfile: () => Promise.resolve({ data: { member: { roles: ['treasurer'] } } }),
  }),
}));

// Children are irrelevant to the refresh behavior under test; stub the heavy ones.
jest.mock('../../finance/BankUpload', () => () => <div />);
jest.mock('../../finance/BankTransactionList', () => () => <div />);
jest.mock('../../finance/MonthlyBankSummary', () => () => <div />);
jest.mock('../TransactionList', () => () => <div />);
jest.mock('../PaymentStats', () => () => <div data-testid="payment-stats" />);
jest.mock('../PaymentReports', () => () => <div />);
jest.mock('../AddPaymentModal', () => () => <div />);
jest.mock('../WeeklyCollectionReport', () => () => <div />);
jest.mock('../ZelleReview', () => () => <div />);
jest.mock('../SquareReview', () => () => <div />);
jest.mock('../MemberSearch', () => () => <div />);
jest.mock('../MemberDuesViewer', () => () => <div />);
jest.mock('../EmployeeList', () => () => <div />);
jest.mock('../VendorList', () => () => <div />);
jest.mock('../LoansPage', () => () => <div />);
jest.mock('../LedgerSheetsPanel', () => () => <div />);
jest.mock('../ExpenseList', () => () => <div data-testid="expense-list" />);

// Exposes the modal's success callback so a save can be simulated from a test.
let triggerExpenseSuccess: (() => void) | null = null;
jest.mock('../AddExpenseModal', () => (props: any) => {
  triggerExpenseSuccess = props.onSuccess;
  return <div data-testid="add-expense-modal" />;
});

const urlsHit = (fragment: string) =>
  (global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).includes(fragment));

beforeEach(() => {
  jest.clearAllMocks();
  triggerExpenseSuccess = null;
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('/skipped-checks')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { skippedChecks: [1003], range: { start: 1001, end: 1005 } } }),
      });
    }
    if (String(url).includes('/skipped-receipts')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { skippedReceipts: [], range: null } }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
  }) as any;
});

const goToExpensesTab = async () => {
  render(<TreasurerDashboard />);
  const tab = await screen.findByText('treasurerDashboard.tabs.expenses');
  fireEvent.click(tab);
  await screen.findByTestId('expense-list');
};

describe('TreasurerDashboard — refresh scoping', () => {
  it('does not refetch payment stats when an expense is saved from the Expenses tab', async () => {
    await goToExpensesTab();

    // Guards against a vacuous pass: stats must be reachable in this harness,
    // otherwise "no extra fetch" would prove nothing.
    await waitFor(() => expect(urlsHit('/api/payments/stats').length).toBeGreaterThan(0));
    const statsBefore = urlsHit('/api/payments/stats').length;

    fireEvent.click(screen.getByText('treasurerDashboard.actions.addExpense'));
    await waitFor(() => expect(triggerExpenseSuccess).not.toBeNull());
    triggerExpenseSuccess!();

    await waitFor(() => expect(urlsHit('/skipped-checks').length).toBeGreaterThan(1));
    // Stats aren't on screen here, so they're marked stale rather than refetched
    expect(urlsHit('/api/payments/stats').length).toBe(statsBefore);
  });

  it('does not refetch skipped receipts when an expense is saved', async () => {
    await goToExpensesTab();

    const receiptsBefore = urlsHit('/skipped-receipts').length;

    fireEvent.click(screen.getByText('treasurerDashboard.actions.addExpense'));
    await waitFor(() => expect(triggerExpenseSuccess).not.toBeNull());
    triggerExpenseSuccess!();

    await waitFor(() => expect(urlsHit('/skipped-checks').length).toBeGreaterThan(1));
    // Receipts come from transactions — an expense cannot change them
    expect(urlsHit('/skipped-receipts').length).toBe(receiptsBefore);
  });

  it('fetches skipped checks only once the Expenses tab is opened', async () => {
    render(<TreasurerDashboard />);
    await screen.findByText('treasurerDashboard.tabs.expenses');

    expect(urlsHit('/skipped-checks').length).toBe(0);

    fireEvent.click(screen.getByText('treasurerDashboard.tabs.expenses'));
    await waitFor(() => expect(urlsHit('/skipped-checks').length).toBe(1));
  });

  it('shows the skipped check numbers button when gaps exist', async () => {
    await goToExpensesTab();

    expect(await screen.findByText('treasurer.skippedChecks.button')).toBeInTheDocument();
  });

  it('hides the skipped check numbers button when there are no gaps', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (String(url).includes('/skipped-checks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { skippedChecks: [], range: null } }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
    });

    await goToExpensesTab();

    expect(screen.queryByText('treasurer.skippedChecks.button')).not.toBeInTheDocument();
  });
});
