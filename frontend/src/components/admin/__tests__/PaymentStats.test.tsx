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
