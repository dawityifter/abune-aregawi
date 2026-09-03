import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExpenseList from '../ExpenseList';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

const EXPENSE = {
  id: 'exp-1',
  category: 'EXP005',
  category_name: 'Utilities',
  category_description: 'Utility bills',
  amount: 450,
  entry_date: '2026-08-01',
  payment_method: 'ach',
  receipt_number: '5691',
  check_number: '',
  invoice_number: '',
  memo: 'Power bill',
  payee_name: 'Dallas Utilities',
  is_reconciled: true,
  created_at: '2026-08-01T12:00:00Z',
};

const CATEGORIES = [{ id: 'c1', gl_code: 'EXP005', name: 'Utilities' }];

function mockApi(methods: string[] = ['ach', 'cash', 'check', 'debit_card']) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/api/expenses/categories')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: CATEGORIES }) });
    }
    if (u.includes('/api/expenses/payment-methods')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: methods }) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        data: [EXPENSE],
        pagination: { totalPages: 1, totalItems: 1 },
      }),
    });
  }) as any;
}

function listUrls(): string[] {
  return (global.fetch as jest.Mock).mock.calls
    .map((c) => String(c[0]))
    .filter((u) => u.includes('/api/expenses?'));
}

const methodSelect = async () => screen.findByLabelText('treasurerDashboard.expenses.filters.paymentMethod');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ExpenseList — method filter', () => {
  it('offers the methods the data actually contains', async () => {
    mockApi();
    render(<ExpenseList />);

    const select = await methodSelect();
    await waitFor(() => {
      expect(within(select).getByText('treasurerDashboard.transactionList.methods.ach')).toBeInTheDocument();
    });
    expect(within(select).getByText('treasurerDashboard.transactionList.methods.debit_card')).toBeInTheDocument();
  });

  it('does not offer a method that no expense uses', async () => {
    mockApi(['cash', 'check']);
    render(<ExpenseList />);

    const select = await methodSelect();
    await waitFor(() => {
      expect(within(select).getByText('treasurerDashboard.transactionList.methods.cash')).toBeInTheDocument();
    });
    expect(within(select).queryByText('treasurerDashboard.transactionList.methods.zelle')).not.toBeInTheDocument();
  });

  it('asks the server to narrow the list when a method is picked', async () => {
    mockApi();
    render(<ExpenseList />);
    await screen.findByText('Dallas Utilities');

    fireEvent.change(await methodSelect(), { target: { value: 'ach' } });

    await waitFor(() => {
      expect(listUrls().some((u) => u.includes('payment_method=ach'))).toBe(true);
    });
  });

  it('returns to the first page when the method changes', async () => {
    mockApi();
    render(<ExpenseList />);
    await screen.findByText('Dallas Utilities');

    fireEvent.change(await methodSelect(), { target: { value: 'ach' } });

    await waitFor(() => {
      const filtered = listUrls().filter((u) => u.includes('payment_method=ach'));
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((u) => u.includes('page=1'))).toBe(true);
    });
  });

  it('clears the method along with the other filters', async () => {
    mockApi();
    render(<ExpenseList />);
    await screen.findByText('Dallas Utilities');

    const select = (await methodSelect()) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'ach' } });
    await waitFor(() => expect(select.value).toBe('ach'));

    fireEvent.click(await screen.findByText('treasurerDashboard.expenses.filters.clear'));

    await waitFor(() => expect(select.value).toBe(''));
  });

  it('sends no method param when the filter is left on all methods', async () => {
    mockApi();
    render(<ExpenseList />);
    await screen.findByText('Dallas Utilities');

    await waitFor(() => expect(listUrls().length).toBeGreaterThan(0));
    expect(listUrls().every((u) => !u.includes('payment_method='))).toBe(true);
  });
});
