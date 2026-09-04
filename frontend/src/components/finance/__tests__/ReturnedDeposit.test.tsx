import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionList from '../BankTransactionList';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

const RETURN_ROW = {
  id: 'bt-1',
  date: '2026-09-02',
  amount: -200,
  description: 'DEPOSITED ITEM RETURNED CHK SER# 1397 CHARGEBACK RTN REASON: UnableTo Locate',
  type: 'DEPOSIT_RETURN',
  status: 'PENDING' as const,
  returned_item: {
    state: 'RETURNED' as const,
    check_number: '1397',
    bank_amount: 200,
    reverses_ledger_entry_id: 1564,
    receipt_number: '6102',
    original_amount: 200,
    reason: null,
  },
};

function mockApi(row: any) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('/api/bank/transactions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { transactions: [row], pagination: { totalPages: 1, totalItems: 1 } },
        }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) });
  }) as any;
}

beforeEach(() => jest.clearAllMocks());

describe('Bank list — returned deposited items', () => {
  it('labels the row as a returned item, not a plain pending debit', async () => {
    mockApi(RETURN_ROW);
    render(<BankTransactionList refreshTrigger={0} />);

    expect(await screen.findByText('RETURNED ITEM')).toBeInTheDocument();
  });

  it('names the receipt the return reverses so the treasurer can act', async () => {
    mockApi(RETURN_ROW);
    render(<BankTransactionList refreshTrigger={0} />);

    expect(await screen.findByText(/receipt #6102/i)).toBeInTheDocument();
  });

  it('says the original could not be found when the serial matched nothing', async () => {
    mockApi({
      ...RETURN_ROW,
      returned_item: { ...RETURN_ROW.returned_item, reverses_ledger_entry_id: null, receipt_number: null, reason: 'ORIGINAL_NOT_FOUND' },
    });
    render(<BankTransactionList refreshTrigger={0} />);

    expect(await screen.findByText(/no recorded payment/i)).toBeInTheDocument();
  });
});
