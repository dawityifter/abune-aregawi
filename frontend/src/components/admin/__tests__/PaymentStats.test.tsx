import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaymentStats from '../PaymentStats';

// t returns the key so we can assert on stable substrings (e.g. reconcileRequired)
jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, data: { totalOutstandingBalance: 0, lendingMembersCount: 0 } }),
  }) as any;
});

const baseStats = {
  totalMembers: 10,
  contributingMembers: 8,
  duesTrackedMembers: 8,
  notDuesTrackedMembers: 2,
  upToDateMembers: 6,
  behindMembers: 2,
  totalAmountDue: 10000,
  totalMembershipCollected: 6000,
  otherPayments: 300,
  totalCollected: 900,
  totalExpenses: 500,
  netIncome: 400,
  collectionRate: 60,
  outstandingAmount: 4000,
  currentBankBalance: 1000,
};

const renderWith = (reconciliation: any, onNavigateToBank = jest.fn()) => {
  render(
    <PaymentStats
      stats={{ ...baseStats, reconciliation } as any}
      selectedYear={2026}
      availableYears={[2026]}
      onYearChange={jest.fn()}
      onNavigateToBank={onNavigateToBank}
    />
  );
  return onNavigateToBank;
};

describe('PaymentStats reconciliation warning', () => {
  it('shows the receipts warning and links to the bank tab when receipts are unreconciled', () => {
    const onNav = renderWith({
      thresholdDollars: 50,
      hasBankData: true,
      bankDeposits: 3700,
      bankDebits: 500,
      receiptsReconciled: false,
      receiptsDifference: -2800,
      expensesReconciled: true,
      expensesDifference: 0,
    });

    const warn = screen.getByLabelText(/reconcileRequired/);
    expect(warn).toBeInTheDocument();
    fireEvent.click(warn);
    expect(onNav).toHaveBeenCalledTimes(1);
  });

  it('shows no warning when both sides are reconciled', () => {
    renderWith({
      thresholdDollars: 50,
      hasBankData: true,
      bankDeposits: 910,
      bankDebits: 480,
      receiptsReconciled: true,
      receiptsDifference: -10,
      expensesReconciled: true,
      expensesDifference: 20,
    });

    expect(screen.queryByLabelText(/reconcileRequired/)).not.toBeInTheDocument();
  });

  it('shows no warning when there is no bank data', () => {
    renderWith({
      thresholdDollars: 50,
      hasBankData: false,
      bankDeposits: 0,
      bankDebits: 0,
      receiptsReconciled: true,
      receiptsDifference: 900,
      expensesReconciled: true,
      expensesDifference: 500,
    });

    expect(screen.queryByLabelText(/reconcileRequired/)).not.toBeInTheDocument();
  });
});

describe('PaymentStats Dues & Member Status pairing', () => {
  // outstandingAmount is only ever computed over dues-tracked members (there's
  // no "amount due" for a member with no yearly_pledge), so the collected
  // figure paired with it must be the same tracked-only number — otherwise the
  // panel shows two numbers from different populations that don't reconcile.

  it('pairs the tracked-only collected figure with outstandingAmount, not the all-members total', () => {
    render(
      <PaymentStats
        stats={{
          ...baseStats,
          totalMembershipCollected: 6000,   // all members, incl. non-dues-tracked
          trackedMembershipCollected: 4500, // dues-tracked members only
          outstandingAmount: 1500,          // computed from the tracked-only figure
        } as any}
        selectedYear={2026}
        availableYears={[2026]}
        onYearChange={jest.fn()}
      />
    );

    // The tracked-only figure now appears in both the top (Annual Dues
    // Progress) and bottom (Dues & Member Status) panels — proving they
    // agree with each other, which is the actual bug this fixes.
    expect(screen.getAllByText('$4,500.00')).toHaveLength(2);
    // The all-members figure, which belongs to Total Receipts / net income
    // elsewhere, no longer leaks into either dues panel.
    expect(screen.queryByText('$6,000.00')).not.toBeInTheDocument();
  });

  it('falls back to the all-members figure when trackedMembershipCollected is absent (older API response)', () => {
    render(
      <PaymentStats
        stats={{ ...baseStats, totalMembershipCollected: 6000, outstandingAmount: 4000 } as any}
        selectedYear={2026}
        availableYears={[2026]}
        onYearChange={jest.fn()}
      />
    );

    // Both panels fall back to the same value together, not just one of them.
    expect(screen.getAllByText('$6,000.00')).toHaveLength(2);
  });

  it('explains the basis of each outstanding figure via tooltip, since they use different populations', () => {
    render(
      <PaymentStats
        stats={{ ...baseStats, trackedMembershipCollected: 4500, outstandingAmount: 1500 } as any}
        selectedYear={2026}
        availableYears={[2026]}
        onYearChange={jest.fn()}
      />
    );

    // t() is mocked to return the key, so these assert the right i18n key is
    // wired to the right element, not the (untranslated-in-tests) copy.
    expect(screen.getByTitle('treasurerDashboard.stats.annualDuesProgressHelp')).toBeInTheDocument();
    expect(screen.getByTitle('treasurerDashboard.stats.annualOutstandingHelp')).toBeInTheDocument();
    expect(screen.getByTitle('treasurerDashboard.health.membershipDuesHelp')).toBeInTheDocument();
    expect(screen.getByTitle('treasurerDashboard.health.duesOutstandingHelp')).toBeInTheDocument();
  });
});
