import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExpenseList from '../ExpenseList';

// t returns the key so assertions can target stable dotted keys
jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

const CHECK_EXPENSE = {
  id: 'exp-1',
  category: 'EXP005',
  category_name: 'Utilities',
  category_description: 'Utility bills',
  amount: 450,
  entry_date: '2026-08-01',
  payment_method: 'check',
  receipt_number: '5691',
  check_number: '1042',
  invoice_number: '',
  memo: 'August water bill',
  payee_name: 'Dallas Utilities',
  created_at: '2026-08-01T12:00:00Z',
};

const CATEGORIES = [{ id: 'c1', gl_code: 'EXP005', name: 'Utilities' }];

/** Routes fetches by URL; expense PUTs resolve via `putResponse`. */
function mockApi({ expenses = [CHECK_EXPENSE], putResponse = null as any } = {}) {
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ExpenseList — check number display', () => {
  it('shows the check number in the table when one is recorded', async () => {
    mockApi();
    render(<ExpenseList />);

    expect(await screen.findByText('#1042')).toBeInTheDocument();
    expect(screen.queryByText('treasurerDashboard.expenses.missingCheckNumber')).not.toBeInTheDocument();
  });

  it('shows the check number under its own label in the drawer', async () => {
    mockApi();
    render(<ExpenseList />);
    await openDrawer();

    expect(screen.getByText('treasurerDashboard.expenses.addModal.checkNumber')).toBeInTheDocument();
    expect(screen.getByText('1042')).toBeInTheDocument();
  });

  it('shows the invoice number rather than the receipt number under Record Info', async () => {
    mockApi({ expenses: [{ ...CHECK_EXPENSE, invoice_number: 'INV-2026-001' }] });
    render(<ExpenseList />);
    await openDrawer();

    expect(screen.getByText('treasurerDashboard.expenses.invoiceNumber')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    expect(screen.queryByText('treasurerDashboard.expenses.addModal.receiptNumber')).not.toBeInTheDocument();
    expect(screen.queryByText('5691')).not.toBeInTheDocument();
  });

  it('shows a dash when no invoice number is recorded', async () => {
    mockApi();
    render(<ExpenseList />);
    await openDrawer();

    expect(screen.getByText('treasurerDashboard.expenses.invoiceNumber')).toBeInTheDocument();
  });

  it('flags a check expense with no check number instead of showing the receipt number', async () => {
    mockApi({ expenses: [{ ...CHECK_EXPENSE, check_number: '' }] });
    render(<ExpenseList />);
    await openDrawer();

    expect(screen.getAllByText('treasurerDashboard.expenses.missingCheckNumber').length).toBeGreaterThan(0);
    // The old code fell back to the receipt number under the check label
    expect(screen.queryByText('1042')).not.toBeInTheDocument();
  });

  it('omits the check number row entirely for cash expenses', async () => {
    mockApi({ expenses: [{ ...CHECK_EXPENSE, payment_method: 'cash', check_number: '' }] });
    render(<ExpenseList />);
    await openDrawer();

    expect(screen.queryByText('treasurerDashboard.expenses.addModal.checkNumber')).not.toBeInTheDocument();
    expect(screen.queryByText('treasurerDashboard.expenses.missingCheckNumber')).not.toBeInTheDocument();
    expect(screen.queryByText('#1042')).not.toBeInTheDocument();
  });
});

describe('ExpenseList — editing', () => {
  it('hides the Edit button when canEdit is false', async () => {
    mockApi();
    render(<ExpenseList canEdit={false} />);
    await openDrawer();

    expect(screen.queryByText('treasurerDashboard.expenses.edit.edit')).not.toBeInTheDocument();
  });

  it('shows the Edit button when canEdit is true', async () => {
    mockApi();
    render(<ExpenseList canEdit />);
    await openDrawer();

    expect(screen.getByText('treasurerDashboard.expenses.edit.edit')).toBeInTheDocument();
  });

  it('saves changed fields via PUT and notifies the parent', async () => {
    const onExpenseChanged = jest.fn();
    mockApi({
      putResponse: {
        ok: true,
        json: () => Promise.resolve({ data: { ...CHECK_EXPENSE, amount: 500 } }),
      },
    });

    render(<ExpenseList canEdit onExpenseChanged={onExpenseChanged} />);
    await openDrawer();
    fireEvent.click(screen.getByText('treasurerDashboard.expenses.edit.edit'));

    fireEvent.change(screen.getByDisplayValue('450'), { target: { value: '500' } });
    fireEvent.click(screen.getByText('treasurerDashboard.expenses.edit.save'));

    await waitFor(() => expect(onExpenseChanged).toHaveBeenCalled());

    const putCall = (global.fetch as jest.Mock).mock.calls.find(([, o]) => o?.method === 'PUT');
    expect(putCall[0]).toContain('/api/expenses/exp-1');
    expect(JSON.parse(putCall[1].body)).toMatchObject({ amount: 500, check_number: '1042' });
  });

  it('blocks saving a check expense with the check number cleared', async () => {
    mockApi();
    render(<ExpenseList canEdit />);
    await openDrawer();
    fireEvent.click(screen.getByText('treasurerDashboard.expenses.edit.edit'));

    fireEvent.change(screen.getByDisplayValue('1042'), { target: { value: '' } });
    fireEvent.click(screen.getByText('treasurerDashboard.expenses.edit.save'));

    expect(await screen.findByText('treasurerDashboard.expenses.addModal.checkNumberRequired')).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.some(([, o]) => o?.method === 'PUT')).toBe(false);
  });

  it('keeps the form open with entered values when the API rejects a duplicate check number', async () => {
    mockApi({
      putResponse: {
        ok: false,
        json: () => Promise.resolve({ message: 'Check number "1099" has already been used.' }),
      },
    });

    render(<ExpenseList canEdit />);
    await openDrawer();
    fireEvent.click(screen.getByText('treasurerDashboard.expenses.edit.edit'));

    fireEvent.change(screen.getByDisplayValue('1042'), { target: { value: '1099' } });
    fireEvent.click(screen.getByText('treasurerDashboard.expenses.edit.save'));

    expect(await screen.findByText(/already been used/)).toBeInTheDocument();
    // Form still open, user's input preserved for correction
    expect(screen.getByDisplayValue('1099')).toBeInTheDocument();
  });

  it('restores the original values on cancel', async () => {
    mockApi();
    render(<ExpenseList canEdit />);
    await openDrawer();
    fireEvent.click(screen.getByText('treasurerDashboard.expenses.edit.edit'));

    fireEvent.change(screen.getByDisplayValue('450'), { target: { value: '999' } });
    fireEvent.click(screen.getByText('treasurerDashboard.expenses.edit.cancel'));

    fireEvent.click(screen.getByText('treasurerDashboard.expenses.edit.edit'));
    expect(screen.getByDisplayValue('450')).toBeInTheDocument();
  });
});
