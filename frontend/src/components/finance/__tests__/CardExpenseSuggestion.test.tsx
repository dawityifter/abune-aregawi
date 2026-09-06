import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionDetail from '../BankTransactionDetail';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

const CATEGORIES = [
  { gl_code: 'EXP006', name: 'Cable', is_active: true },
  { gl_code: 'EXP102', name: 'Building Repairs', is_active: true },
];

/**
 * A repeat card purchase arrives with the classification its payee was last
 * given. It is a starting point, not a decision: the treasurer still submits,
 * and can change the category first — a hardware store is Building Repairs one
 * week and Supplies the next.
 */
function pendingCard(overrides: any = {}) {
  return {
    id: 'bt-9',
    date: '2025-09-28',
    amount: -194.99,
    description: 'Spectrum 855-707-7328 MO                     09/28',
    type: 'DEBIT_CARD',
    status: 'PENDING',
    check_number: null,
    payer_name: null,
    suggested_expense: {
      gl_code: 'EXP006',
      category_name: 'Cable',
      payee_name: 'Spectrum',
      reason: 'Previously classified for this payee',
    },
    ...overrides,
  };
}

function show(t: any) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, data: CATEGORIES }),
  }) as any;
  render(<BankTransactionDetail txn={t} onClose={jest.fn()} onSuccess={jest.fn()} />);
}

describe('Card expense suggestion on a pending debit', () => {
  const suggestionBox = async () => {
    const heading = await screen.findByText(/Suggested from a previous charge/);
    return heading.closest('div') as HTMLElement;
  };

  it('names the suggested category and payee', async () => {
    show(pendingCard());
    // Scoped to the suggestion box: the raw bank description names the
    // merchant too, and matching that would prove nothing.
    const box = await suggestionBox();
    expect(within(box).getByText(/EXP006 · Cable/)).toBeInTheDocument();
    expect(within(box).getByText(/Spectrum/)).toBeInTheDocument();
  });

  it('says where the suggestion came from', async () => {
    show(pendingCard());
    expect(await screen.findByText(/Previously classified for this payee/)).toBeInTheDocument();
  });

  it('pre-fills the category so one click records it', async () => {
    show(pendingCard());
    const select = await screen.findByLabelText('Expense Category');
    await waitFor(() => expect(select).toHaveValue('EXP006'));
  });

  it('pre-fills the payee', async () => {
    show(pendingCard());
    const payee = await screen.findByLabelText(/Payee/);
    await waitFor(() => expect(payee).toHaveValue('Spectrum'));
  });

  it('leaves the category editable rather than locking it in', async () => {
    show(pendingCard());
    const select = await screen.findByLabelText('Expense Category');
    expect(select).not.toBeDisabled();
    // The other categories are still offered, so a hardware store run can be
    // re-filed without leaving the screen.
    expect(screen.getByRole('option', { name: 'Building Repairs' })).toBeInTheDocument();
  });

  it('shows no suggestion block when nothing was learned', async () => {
    show(pendingCard({ suggested_expense: undefined }));
    await screen.findByLabelText('Expense Category');
    expect(screen.queryByText(/Previously classified/)).not.toBeInTheDocument();
  });

  it('does not pre-fill the category when nothing was learned', async () => {
    show(pendingCard({ suggested_expense: undefined }));
    const select = await screen.findByLabelText('Expense Category');
    expect(select).toHaveValue('');
  });
});
