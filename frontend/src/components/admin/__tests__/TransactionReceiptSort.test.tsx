import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionList from '../TransactionList';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, language: 'en' }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') }, currentUser: { role: 'treasurer' } }),
}));

const TXN = {
  id: 1, payment_date: '2026-08-23', amount: 61, payment_type: 'donation',
  payment_method: 'cash', status: 'succeeded', receipt_number: '6086',
  member: { first_name: 'A', last_name: 'B' },
};

function mockApi() {
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { transactions: [TXN], pagination: { totalPages: 1, totalItems: 1, currentPage: 1 } },
      }),
    })
  ) as any;
}

const listUrls = () =>
  (global.fetch as jest.Mock).mock.calls.map(c => String(c[0])).filter(u => u.includes('/transactions'));

const receiptHeader = async () =>
  screen.findByRole('button', { name: /transactionList\.table\.receipt/i });

beforeEach(() => jest.clearAllMocks());

describe('Member payments — sort by receipt', () => {
  it('sends no sort parameters until a header is clicked', async () => {
    mockApi();
    render(<TransactionList onTransactionAdded={jest.fn()} />);

    await waitFor(() => expect(listUrls().length).toBeGreaterThan(0));
    expect(listUrls().every(u => !u.includes('sort_by='))).toBe(true);
  });

  it('asks the server to sort by receipt when the header is clicked', async () => {
    mockApi();
    render(<TransactionList onTransactionAdded={jest.fn()} />);

    fireEvent.click(await receiptHeader());

    await waitFor(() =>
      expect(listUrls().some(u => u.includes('sort_by=receipt_number'))).toBe(true)
    );
  });

  it('sorts descending first, then flips on a second click', async () => {
    mockApi();
    render(<TransactionList onTransactionAdded={jest.fn()} />);

    const header = await receiptHeader();
    fireEvent.click(header);
    await waitFor(() => expect(listUrls().some(u => u.includes('sort_dir=desc'))).toBe(true));

    fireEvent.click(header);
    await waitFor(() => expect(listUrls().some(u => u.includes('sort_dir=asc'))).toBe(true));
  });

  it('exposes the sort direction to assistive technology', async () => {
    mockApi();
    render(<TransactionList onTransactionAdded={jest.fn()} />);

    fireEvent.click(await receiptHeader());

    await waitFor(() => {
      const th = screen.getByRole('columnheader', { name: /receipt/i });
      expect(th).toHaveAttribute('aria-sort', 'descending');
    });
  });

  it('returns to the first page when the sort changes', async () => {
    mockApi();
    render(<TransactionList onTransactionAdded={jest.fn()} />);

    fireEvent.click(await receiptHeader());

    await waitFor(() => {
      const sorted = listUrls().filter(u => u.includes('sort_by=receipt_number'));
      expect(sorted.length).toBeGreaterThan(0);
      expect(sorted.every(u => u.includes('page=1'))).toBe(true);
    });
  });
});
