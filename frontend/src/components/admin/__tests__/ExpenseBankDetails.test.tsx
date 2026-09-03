import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExpenseList from '../ExpenseList';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

const BANK = {
  id: 'bt-9',
  date: '2026-08-31',
  description: 'CHECK #1601 PAID',
  amount: -125,
  type: 'CHECK_PAID',
  check_number: '1601',
  status: 'MATCHED',
  reconciled_source: 'AUTO_CHECK_MATCH',
  reconciled_at: '2026-09-01T10:00:00Z',
  amount_matches: true,
};

function expense(overrides: any = {}) {
  return {
    id: 'exp-1', category: 'EXP100', category_name: 'Utilities', category_description: '',
    amount: 125, entry_date: '2026-08-30', payment_method: 'check', receipt_number: '',
    check_number: '1601', memo: 'Power bill', payee_name: 'Dallas Utilities',
    is_reconciled: true, created_at: '2026-08-30T00:00:00Z', ...overrides,
  };
}

function mockApi(row: any, bank: any) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/categories')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    }
    if (u.includes('/payment-methods')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: ['check'] }) });
    }
    if (/\/api\/expenses\/[^?]+$/.test(u)) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { ...row, bank_transaction: bank } }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: [row], pagination: { totalPages: 1, totalItems: 1 } }),
    });
  }) as any;
}

const detailFetches = () =>
  (global.fetch as jest.Mock).mock.calls
    .map((c) => String(c[0]))
    .filter((u) => /\/api\/expenses\/exp-1$/.test(u));

async function openDetails() {
  render(<ExpenseList />);
  fireEvent.click(await screen.findByText('Details'));
}

beforeEach(() => jest.clearAllMocks());

describe('Expense details — bank reconciliation', () => {
  it('shows the statement line the expense was matched to', async () => {
    mockApi(expense(), BANK);
    await openDetails();

    expect(await screen.findByText('CHECK #1601 PAID')).toBeInTheDocument();
  });

  it('says the match was made automatically on the check number', async () => {
    mockApi(expense(), BANK);
    await openDetails();

    expect(await screen.findByText(/matched automatically/i)).toBeInTheDocument();
  });

  it('says so when a treasurer reconciled it by hand', async () => {
    mockApi(expense(), { ...BANK, reconciled_source: 'MANUAL' });
    await openDetails();

    expect(await screen.findByText(/reconciled by hand/i)).toBeInTheDocument();
  });

  it('flags a bank amount that disagrees with the expense', async () => {
    mockApi(expense({ amount: 205 }), { ...BANK, amount_matches: false });
    await openDetails();

    expect(await screen.findByText(/does not match/i)).toBeInTheDocument();
  });

  it('says an unreconciled expense has not cleared, without fetching', async () => {
    mockApi(expense({ is_reconciled: false }), null);
    await openDetails();

    expect(await screen.findByText(/not reconciled against the bank/i)).toBeInTheDocument();
    expect(detailFetches()).toHaveLength(0);
  });

  it('fetches the detail only once per opened expense', async () => {
    mockApi(expense(), BANK);
    await openDetails();

    await screen.findByText('CHECK #1601 PAID');
    await waitFor(() => expect(detailFetches()).toHaveLength(1));
  });
});
