import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionList from '../TransactionList';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key })
}));

// Stable identity: a fresh object per call re-fires the fetch effect
const AUTH_VALUE = { firebaseUser: { getIdToken: async () => 'test-token' } };
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => AUTH_VALUE
}));

const BASE_TX = {
  id: 1,
  payment_date: '2026-08-01',
  amount: 100,
  payment_type: 'donation',
  payment_method: 'credit_card',
  status: 'succeeded',
  member_id: null,
  member: null
};

const DONOR_BLOCK = '[Anonymous Donor]\nName: newaye kidusan';

function mockApi(transactions: any[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { transactions, pagination: { total_pages: 1 } } })
  }) as any;
}

const renderList = () => render(<TransactionList onTransactionAdded={jest.fn()} />);

beforeEach(() => jest.clearAllMocks());

describe('non-member donor name display', () => {
  it('prefers the donor_name column when present', async () => {
    mockApi([{ ...BASE_TX, donor_name: 'newaye kidusan', note: DONOR_BLOCK }]);
    renderList();

    expect(await screen.findByText('newaye kidusan')).toBeInTheDocument();
    expect(screen.queryByText('Anonymous Donor')).not.toBeInTheDocument();
  });

  it('falls back to the note block on older rows with no column value', async () => {
    mockApi([{ ...BASE_TX, note: DONOR_BLOCK }]);
    renderList();

    expect(await screen.findByText('newaye kidusan')).toBeInTheDocument();
  });

  it('uses the column even when the note block disagrees', async () => {
    // The note is editable in the drawer, so it can drift from the column
    mockApi([{ ...BASE_TX, donor_name: 'Correct Name', note: '[Anonymous Donor]\nName: Stale Name' }]);
    renderList();

    expect(await screen.findByText('Correct Name')).toBeInTheDocument();
    expect(screen.queryByText('Stale Name')).not.toBeInTheDocument();
  });

  it('falls back to Anonymous Donor when neither source has a name', async () => {
    mockApi([{ ...BASE_TX, note: 'Just a plain note' }]);
    renderList();

    expect(await screen.findByText('Anonymous Donor')).toBeInTheDocument();
  });

  it('does not show a donor name for a member-attributed transaction', async () => {
    mockApi([{
      ...BASE_TX,
      member_id: 42,
      member: { id: 42, first_name: 'Real', last_name: 'Member' },
      donor_name: null
    }]);
    renderList();

    await waitFor(() => expect(screen.getByText(/Real Member/)).toBeInTheDocument());
    expect(screen.queryByText('Anonymous Donor')).not.toBeInTheDocument();
  });
});
