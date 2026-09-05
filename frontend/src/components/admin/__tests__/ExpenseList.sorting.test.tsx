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

const EXPENSES = [
  {
    id: 'exp-1',
    category: 'EXP005',
    category_name: 'Utilities',
    category_description: 'Utility bills',
    amount: 450,
    entry_date: '2026-08-01',
    payment_method: 'check',
    receipt_number: '5691',
    check_number: '1593',
    invoice_number: '',
    memo: 'August water bill',
    payee_name: 'Dallas Utilities',
    is_reconciled: true,
    created_at: '2026-08-01T12:00:00Z',
  },
  {
    id: 'exp-2',
    category: 'EXP006',
    category_name: 'Supplies',
    category_description: 'Office supplies',
    amount: 20,
    entry_date: '2026-07-01',
    payment_method: 'check',
    receipt_number: '5692',
    check_number: '1594',
    invoice_number: '',
    memo: 'Paper',
    payee_name: 'Office Depot',
    is_reconciled: false,
    created_at: '2026-07-01T12:00:00Z',
  },
];

const CATEGORIES = [{ id: 'c1', gl_code: 'EXP005', name: 'Utilities' }];

function mockApi() {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('/api/expenses/categories')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: CATEGORIES }) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        data: EXPENSES,
        pagination: { totalPages: 1, totalItems: EXPENSES.length },
      }),
    });
  }) as any;
}

/** URLs the component requested for the expense list itself. */
function listUrls(): string[] {
  return (global.fetch as jest.Mock).mock.calls
    .map((c) => String(c[0]))
    .filter((u) => u.includes('/api/expenses?'));
}

const clickHeader = async (key: string) => {
  fireEvent.click(await screen.findByRole('button', { name: key }));
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ExpenseList — sorting', () => {
  it('asks the server for the whole dataset sorted, not just the page', async () => {
    mockApi();
    render(<ExpenseList />);
    await screen.findByText('Dallas Utilities');

    await clickHeader('treasurerDashboard.expenses.table.amount');

    await waitFor(() => {
      expect(listUrls().some((u) => u.includes('sort_by=amount'))).toBe(true);
    });
  });

  it('sorts descending first, then toggles to ascending on a second click', async () => {
    mockApi();
    render(<ExpenseList />);
    await screen.findByText('Dallas Utilities');

    await clickHeader('treasurerDashboard.expenses.table.amount');
    await waitFor(() => {
      expect(listUrls().some((u) => u.includes('sort_by=amount&sort_dir=desc'))).toBe(true);
    });

    await clickHeader('treasurerDashboard.expenses.table.amount');
    await waitFor(() => {
      expect(listUrls().some((u) => u.includes('sort_by=amount&sort_dir=asc'))).toBe(true);
    });
  });

  it('can sort by check number', async () => {
    mockApi();
    render(<ExpenseList />);
    await screen.findByText('Dallas Utilities');

    await clickHeader('treasurerDashboard.expenses.table.checkNumber');

    await waitFor(() => {
      expect(listUrls().some((u) => u.includes('sort_by=check_number'))).toBe(true);
    });
  });

  it.each([
    ['treasurerDashboard.expenses.table.date', 'entry_date'],
    ['treasurerDashboard.expenses.table.category', 'category'],
    ['treasurerDashboard.expenses.table.payee', 'payee'],
    ['treasurerDashboard.expenses.table.method', 'payment_method'],
  ])('can sort by %s', async (label, param) => {
    mockApi();
    render(<ExpenseList />);
    await screen.findByText('Dallas Utilities');

    await clickHeader(label);

    await waitFor(() => {
      expect(listUrls().some((u) => u.includes(`sort_by=${param}`))).toBe(true);
    });
  });

  it('marks the sorted column for screen readers', async () => {
    mockApi();
    render(<ExpenseList />);
    await screen.findByText('Dallas Utilities');

    await clickHeader('treasurerDashboard.expenses.table.amount');

    await waitFor(() => {
      const header = screen
        .getByRole('button', { name: 'treasurerDashboard.expenses.table.amount' })
        .closest('th');
      expect(header).toHaveAttribute('aria-sort', 'descending');
    });
  });

  it('returns to the first page when the sort changes', async () => {
    mockApi();
    render(<ExpenseList />);
    await screen.findByText('Dallas Utilities');

    await clickHeader('treasurerDashboard.expenses.table.amount');

    await waitFor(() => {
      const sorted = listUrls().filter((u) => u.includes('sort_by=amount'));
      expect(sorted.length).toBeGreaterThan(0);
      expect(sorted.every((u) => u.includes('page=1'))).toBe(true);
    });
  });
});

describe('ExpenseList — check number and reconciliation columns', () => {
  it('shows check numbers in their own column', async () => {
    mockApi();
    render(<ExpenseList />);

    expect(await screen.findByText('1593')).toBeInTheDocument();
    expect(await screen.findByText('1594')).toBeInTheDocument();
  });

  it('shows whether each expense has cleared the bank', async () => {
    mockApi();
    render(<ExpenseList />);

    expect(await screen.findByText('treasurerDashboard.expenses.table.reconciled')).toBeInTheDocument();
    expect(await screen.findByText('treasurerDashboard.expenses.table.notReconciled')).toBeInTheDocument();
  });
});
