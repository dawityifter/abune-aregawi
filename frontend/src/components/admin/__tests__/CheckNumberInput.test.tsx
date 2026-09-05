import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddExpenseModal from '../AddExpenseModal';
import ExpenseList from '../ExpenseList';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

const CATEGORIES = [{ id: 'c1', gl_code: 'EXP005', name: 'Utilities' }];

const CHECK_EXPENSE = {
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
  is_reconciled: false,
  created_at: '2026-08-01T12:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('/categories')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: CATEGORIES }) });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        data: [CHECK_EXPENSE],
        pagination: { totalPages: 1, totalItems: 1 },
      }),
    });
  }) as any;
});

async function checkFieldInModal() {
  render(<AddExpenseModal isOpen={true} onClose={() => {}} onSuccess={() => {}} />);
  const method = await screen.findByLabelText(/check/i, { selector: 'input[type="radio"]' }).catch(() => null);
  if (method) fireEvent.click(method);
  return screen.findByTestId('check-number-input');
}

describe('Check number input — add expense', () => {
  it('refuses letters typed into the check number field', async () => {
    const input = (await checkFieldInModal()) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'CHK-1593' } });

    expect(input.value).toBe('1593');
  });

  it('keeps digits as typed', async () => {
    const input = (await checkFieldInModal()) as HTMLInputElement;

    fireEvent.change(input, { target: { value: '1593' } });

    expect(input.value).toBe('1593');
  });

  it('asks the keyboard for digits on mobile', async () => {
    const input = (await checkFieldInModal()) as HTMLInputElement;

    expect(input).toHaveAttribute('inputMode', 'numeric');
  });
});

describe('Check number input — edit expense', () => {
  it('refuses letters typed into the drawer check number field', async () => {
    render(<ExpenseList canEdit={true} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Details' }));
    fireEvent.click(await screen.findByRole('button', { name: 'treasurerDashboard.expenses.edit.edit' }));

    const input = (await screen.findByTestId('edit-check-number-input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '15a93b' } });

    await waitFor(() => expect(input.value).toBe('1593'));
  });
});
