import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionList from '../TransactionList';

// A dues payment's earmark (for_year) decides which year it is credited to.
// It used to be write-once: set on entry, shown nowhere, editable nowhere, so
// a wrong year could only be corrected by deleting and re-keying the payment.
// All fixtures are synthetic.

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key })
}));

const AUTH_VALUE = { firebaseUser: { getIdToken: async () => 'test-token' } };
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => AUTH_VALUE
}));

const THIS_YEAR = new Date().getFullYear();

const DUES_TX = {
  id: 1,
  payment_date: `${THIS_YEAR}-09-08`,
  amount: 1000,
  payment_type: 'membership_due',
  payment_method: 'cash',
  status: 'succeeded',
  receipt_number: '901',
  member_id: 5,
  member: {
    id: 5,
    first_name: 'Testmember',
    last_name: 'Example',
    email: '',
    phone_number: ''
  },
  for_year: THIS_YEAR - 1
};

const listResponse = (transactions: any[]) => ({
  ok: true,
  json: async () => ({ data: { transactions, pagination: { total_pages: 1 } } })
});

function mockApi(transactions: any[]) {
  global.fetch = jest.fn().mockImplementation((_url: string, opts?: any) => {
    if (opts?.method === 'PUT') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { transaction: { ...transactions[0], for_year: null } } })
      });
    }
    return Promise.resolve(listResponse(transactions));
  }) as any;
}

const renderList = () => render(<TransactionList onTransactionAdded={jest.fn()} />);

const openDrawerAndEdit = async () => {
  renderList();
  fireEvent.click(await screen.findByText('Details'));
  fireEvent.click(await screen.findByText('treasurerDashboard.transactionList.edit.edit'));
};

const lastPutBody = () => {
  const calls = (global.fetch as jest.Mock).mock.calls.filter(c => c[1]?.method === 'PUT');
  return JSON.parse(calls[calls.length - 1][1].body);
};

beforeEach(() => jest.clearAllMocks());

describe('editing a dues earmark', () => {
  it('shows the earmarked year on the record without entering edit mode', async () => {
    mockApi([DUES_TX]);
    renderList();

    fireEvent.click(await screen.findByText('Details'));

    expect(await screen.findByText('treasurerDashboard.transactionList.edit.forYear')).toBeInTheDocument();
    expect(screen.getByText(String(THIS_YEAR - 1))).toBeInTheDocument();
  });

  it('opens the editor with the stored year already selected', async () => {
    mockApi([DUES_TX]);
    await openDrawerAndEdit();

    const select = await screen.findByDisplayValue(String(THIS_YEAR - 1));
    expect(select).toBeInTheDocument();
  });

  it('saves a corrected year', async () => {
    mockApi([DUES_TX]);
    await openDrawerAndEdit();

    const select = await screen.findByDisplayValue(String(THIS_YEAR - 1));
    fireEvent.change(select, { target: { value: String(THIS_YEAR) } });
    fireEvent.click(screen.getByText('treasurerDashboard.transactionList.edit.save'));

    await waitFor(() => expect(lastPutBody().for_year).toBe(THIS_YEAR));
  });

  it('clears the earmark back to the payment date year', async () => {
    mockApi([DUES_TX]);
    await openDrawerAndEdit();

    const select = await screen.findByDisplayValue(String(THIS_YEAR - 1));
    fireEvent.change(select, { target: { value: '' } });
    fireEvent.click(screen.getByText('treasurerDashboard.transactionList.edit.save'));

    await waitFor(() => expect(lastPutBody().for_year).toBeNull());
  });

  it('offers a year the record already holds even when it is outside the normal range', async () => {
    // The Square review screen writes its own year. Opening such a row must not
    // silently reset it to default on save.
    mockApi([{ ...DUES_TX, for_year: 2019 }]);
    await openDrawerAndEdit();

    expect(await screen.findByDisplayValue('2019')).toBeInTheDocument();
  });

  it('hides the earmark entirely for a payment that is not membership dues', async () => {
    mockApi([{ ...DUES_TX, payment_type: 'donation', for_year: null }]);
    renderList();

    fireEvent.click(await screen.findByText('Details'));

    await waitFor(() => expect(screen.getByText('treasurerDashboard.transactionList.edit.edit')).toBeInTheDocument());
    expect(screen.queryByText('treasurerDashboard.transactionList.edit.forYear')).not.toBeInTheDocument();
  });

  it('sends a null earmark when a due is reclassified away from dues', async () => {
    mockApi([DUES_TX]);
    await openDrawerAndEdit();

    // Located by value rather than display text: the type options are rendered
    // with human labels, so findByDisplayValue would need the label instead.
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const typeSelect = selects.find(s => s.value === 'membership_due')!;
    fireEvent.change(typeSelect, { target: { value: 'donation' } });
    fireEvent.click(screen.getByText('treasurerDashboard.transactionList.edit.save'));

    await waitFor(() => expect(lastPutBody().for_year).toBeNull());
  });
});
