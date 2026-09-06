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

/** A voided check as it comes back from the API: $0.00, memo says why. */
const VOID_EXPENSE = {
  id: 'exp-9',
  category: 'EXP005',
  category_name: 'Utilities',
  category_description: 'Utility bills',
  amount: 0,
  entry_date: '2026-08-01',
  payment_method: 'check',
  receipt_number: '',
  check_number: '1593',
  invoice_number: '',
  memo: 'Void - misprinted',
  payee_name: 'Dallas Utilities',
  created_at: '2026-08-01T12:00:00Z',
};

const CATEGORIES = [{ id: 'c1', gl_code: 'EXP005', name: 'Utilities' }];

function mockApi({ expenses = [VOID_EXPENSE], putResponse = null as any } = {}) {
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    if (opts?.method === 'PUT') {
      return Promise.resolve(putResponse);
    }
    if (String(url).includes('/api/expenses/categories')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: CATEGORIES }) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        data: expenses,
        pagination: { totalPages: 1, totalItems: expenses.length },
      }),
    });
  }) as any;
}

const openDrawer = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Details' }));
};

const startEditing = () => fireEvent.click(screen.getByText('treasurerDashboard.expenses.edit.edit'));
const saveEdit = () => fireEvent.click(screen.getByText('treasurerDashboard.expenses.edit.save'));
const putCall = () => (global.fetch as jest.Mock).mock.calls.find(([, o]) => o?.method === 'PUT');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ExpenseList — voided checks', () => {
  it('lists a voided check with its number and a $0.00 amount', async () => {
    mockApi();
    render(<ExpenseList />);

    expect(await screen.findByText('1593')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('saves a memo-only correction without objecting to the $0.00 amount', async () => {
    mockApi({
      putResponse: {
        ok: true,
        json: () => Promise.resolve({ data: { ...VOID_EXPENSE, memo: 'Void - misprinted, reissued as 1594' } }),
      },
    });
    render(<ExpenseList canEdit />);
    await openDrawer();
    startEditing();

    fireEvent.change(screen.getByDisplayValue('Void - misprinted'), {
      target: { value: 'Void - misprinted, reissued as 1594' },
    });
    saveEdit();

    await waitFor(() => expect(putCall()).toBeDefined());
    expect(JSON.parse(putCall()[1].body)).toMatchObject({
      amount: 0,
      memo: 'Void - misprinted, reissued as 1594',
    });
  });

  it('blocks zeroing the amount once the void wording leaves the memo', async () => {
    mockApi();
    render(<ExpenseList canEdit />);
    await openDrawer();
    startEditing();

    fireEvent.change(screen.getByDisplayValue('Void - misprinted'), {
      target: { value: 'Utilities payment' },
    });
    saveEdit();

    expect(await screen.findByText('treasurerDashboard.expenses.edit.amountInvalid')).toBeInTheDocument();
    expect(putCall()).toBeUndefined();
  });

  it('still blocks zeroing the amount of an ordinary expense', async () => {
    mockApi({ expenses: [{ ...VOID_EXPENSE, amount: 450, memo: 'August water bill' }] });
    render(<ExpenseList canEdit />);
    await openDrawer();
    startEditing();

    fireEvent.change(screen.getByDisplayValue('450'), { target: { value: '0' } });
    saveEdit();

    expect(await screen.findByText('treasurerDashboard.expenses.edit.amountInvalid')).toBeInTheDocument();
    expect(putCall()).toBeUndefined();
  });
});
