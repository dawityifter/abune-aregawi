import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
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
// Counts mounts so a test can prove the Bank tab is not torn down and rebuilt
// (which is how the table used to lose its filters and page).
let mockBankListMounts = 0;
jest.mock('../../finance/BankTransactionList', () => () => {
  const ReactLib = require('react');
  ReactLib.useEffect(() => {
    mockBankListMounts += 1;
  }, []);
  return <div data-testid="bank-transaction-list" />;
});
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
// The pledge band and table are stubbed to their filter contract: the band
// raises a filter and echoes the active one; the table echoes what it got.
jest.mock('../PledgeDashboard', () => (props: any) => (
  <div>
    <button data-testid="band-pick-fulfilled" onClick={() => props.onFilterChange('fulfilled')} />
    <span data-testid="band-active-filter">{String(props.activeFilter)}</span>
  </div>
));
jest.mock('../TreasurerPledges', () => (props: any) => (
  <div data-testid="pledge-table">{String(props.filter)}</div>
));

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
  mockBankListMounts = 0;
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

const goToBankTab = async () => {
  render(<TreasurerDashboard />);
  const tab = await screen.findByText('treasurerDashboard.tabs.bank');
  fireEvent.click(tab);
  await screen.findByTestId('bank-transaction-list');
};

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

  it('does not tear down the Bank tab when a payment refresh fires', async () => {
    await goToBankTab();
    expect(mockBankListMounts).toBe(1);

    await act(async () => {
      window.dispatchEvent(new CustomEvent('payments:refresh'));
    });

    expect(screen.getByTestId('bank-transaction-list')).toBeInTheDocument();
    // A remount here would reset the table's filters and pagination.
    expect(mockBankListMounts).toBe(1);
  });

  it('does not refetch payment stats when a payment refresh fires off the Overview tab', async () => {
    await goToBankTab();

    // Guards against a vacuous pass: stats must be reachable in this harness.
    await waitFor(() => expect(urlsHit('/api/payments/stats').length).toBeGreaterThan(0));
    const statsBefore = urlsHit('/api/payments/stats').length;

    await act(async () => {
      window.dispatchEvent(new CustomEvent('payments:refresh'));
    });

    expect(urlsHit('/api/payments/stats').length).toBe(statsBefore);
  });

  it('keeps the dashboard on screen while a stats refresh is in flight', async () => {
    render(<TreasurerDashboard />);
    await screen.findByTestId('payment-stats');

    // Hold the refresh open so the loading flag is still set while we assert.
    let releaseStats: () => void = () => {};
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (String(url).includes('/api/payments/stats')) {
        return new Promise((resolve) => {
          releaseStats = () => resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('payments:refresh'));
    });

    expect(screen.getByTestId('payment-stats')).toBeInTheDocument();

    await act(async () => {
      releaseStats();
    });
  });
});

// Final review I2: choosing a filter in the band marks it in the band and
// brings the donor table into view — without that, the table changes below
// the fold and the click appears to do nothing.
describe('TreasurerDashboard — pledge band filter', () => {
  const originalScroll = Element.prototype.scrollIntoView;
  afterEach(() => { Element.prototype.scrollIntoView = originalScroll; });

  const goToPledgesTab = async () => {
    render(<TreasurerDashboard />);
    fireEvent.click(await screen.findByText('treasurerDashboard.tabs.pledges'));
    await screen.findByTestId('pledge-table');
  };

  it('hands the chosen filter to both the band and the table, and scrolls the table into view', async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    await goToPledgesTab();

    fireEvent.click(screen.getByTestId('band-pick-fulfilled'));

    expect(screen.getByTestId('band-active-filter')).toHaveTextContent('fulfilled');
    expect(screen.getByTestId('pledge-table')).toHaveTextContent('fulfilled');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(scrollIntoView.mock.instances[0]).toContainElement(screen.getByTestId('pledge-table'));
  });

  it('does not throw where scrollIntoView is unavailable', async () => {
    (Element.prototype as any).scrollIntoView = undefined;
    await goToPledgesTab();
    fireEvent.click(screen.getByTestId('band-pick-fulfilled'));
    expect(screen.getByTestId('pledge-table')).toHaveTextContent('fulfilled');
  });
});
