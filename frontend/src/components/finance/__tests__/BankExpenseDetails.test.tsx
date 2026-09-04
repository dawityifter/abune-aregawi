import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionDetail from '../BankTransactionDetail';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

const EXPENSE = {
  id: 1564,
  category: 'EXP100',
  category_name: 'Utilities',
  amount: 120,
  entry_date: '2025-02-09',
  payment_method: 'check',
  check_number: '1701',
  receipt_number: '7001',
  payee_name: 'Dallas Utilities',
  memo: 'February power bill',
  source_system: 'manual',
};

function txn(overrides: any = {}) {
  return {
    id: 'bt-1',
    date: '2025-02-10',
    amount: -120,
    description: 'CHECK #1701',
    type: 'CHECK_PAID',
    status: 'MATCHED',
    check_number: '1701',
    reconciled_source: 'AUTO_CHECK_MATCH',
    reconciled_at: '2025-02-12T00:00:00Z',
    reconciled_expense: EXPENSE,
    ...overrides,
  };
}

function show(t: any) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, json: () => Promise.resolve({ success: true, data: [] }),
  }) as any;
  render(<BankTransactionDetail txn={t} onClose={jest.fn()} onSuccess={jest.fn()} />);
}

describe('Bank Transaction Details — linked expense', () => {
  it('shows the expense category with its name', async () => {
    show(txn());
    // Rendered as one string so the treasurer does not have to decode the GL code.
    expect(await screen.findByText('EXP100 · Utilities')).toBeInTheDocument();
  });

  it('shows the recorded expense amount', async () => {
    show(txn());
    expect(await screen.findByText('$120.00')).toBeInTheDocument();
  });

  it('shows the check and receipt numbers from the expense record', async () => {
    show(txn());
    expect(await screen.findByText(/7001/)).toBeInTheDocument();
  });

  it('shows the payee and memo', async () => {
    show(txn());
    expect(await screen.findByText('Dallas Utilities')).toBeInTheDocument();
    expect(screen.getByText('February power bill')).toBeInTheDocument();
  });

  it('says the expense was entered by hand and matched automatically', async () => {
    show(txn());
    expect(await screen.findByText(/entered by hand/i)).toBeInTheDocument();
  });

  it('says when the bank reconciliation created the expense itself', async () => {
    show(txn({ reconciled_expense: { ...EXPENSE, source_system: 'bank_reconciliation' } }));
    expect(await screen.findByText(/created by bank reconciliation/i)).toBeInTheDocument();
  });

  it('renders nothing extra when no expense is linked', async () => {
    show(txn({ reconciled_expense: undefined, reconciled_payee_name: undefined, reconciled_memo: undefined }));
    expect(screen.queryByText('Dallas Utilities')).not.toBeInTheDocument();
  });
});
