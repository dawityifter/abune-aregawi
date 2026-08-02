import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddExpenseModal from '../AddExpenseModal';
import { invalidateCached, CACHE_KEYS } from '../../../utils/referenceDataCache';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

// Stable identity: a fresh object per call would re-create the fetch callbacks
// and re-fire the effect, which would make the request counts below meaningless.
const FIREBASE_USER = { getIdToken: () => Promise.resolve('mock-token') };
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: FIREBASE_USER }),
}));

const CATEGORIES = [{ id: 'c1', gl_code: 'EXP005', name: 'Utilities', description: '', is_active: true, is_fixed: false }];
const VENDORS = [{ id: 'v1', name: 'Dallas Utilities', vendor_type: 'utility', is_active: true }];

function mockApi(postResponse: any = { ok: true, json: () => Promise.resolve({ data: {} }) }) {
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    if (opts?.method === 'POST') return Promise.resolve(postResponse);
    if (String(url).includes('/api/vendors')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: VENDORS }) });
    }
    if (String(url).includes('/api/employees')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: CATEGORIES }) });
  }) as any;
}

const countGets = (fragment: string) =>
  (global.fetch as jest.Mock).mock.calls.filter(
    ([url, opts]) => String(url).includes(fragment) && opts?.method !== 'POST'
  ).length;

beforeEach(() => {
  jest.clearAllMocks();
  invalidateCached(); // each test starts from a cold cache
});

describe('AddExpenseModal — reference data cache', () => {
  it('serves dropdowns from cache on reopen without refetching', async () => {
    mockApi();
    const { unmount } = render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await waitFor(() => expect(countGets('/api/expenses/categories')).toBe(1));
    unmount();

    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await screen.findByText('treasurerDashboard.expenses.addModal.title');

    expect(countGets('/api/expenses/categories')).toBe(1);
    expect(countGets('/api/vendors')).toBe(1);
  });

  it('refetches vendors after the vendor cache is invalidated', async () => {
    mockApi();
    const { unmount } = render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await waitFor(() => expect(countGets('/api/vendors')).toBe(1));
    unmount();

    invalidateCached(CACHE_KEYS.vendors);

    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await waitFor(() => expect(countGets('/api/vendors')).toBe(2));
    // Categories were untouched, so they stay cached
    expect(countGets('/api/expenses/categories')).toBe(1);
  });
});

describe('AddExpenseModal — required check number', () => {
  const fillRequiredFields = async () => {
    // The category select only renders once the categories request resolves
    const categorySelect = await screen.findByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: 'EXP005' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '450' } });
  };

  it('blocks submit when the method is check and no check number is entered', async () => {
    mockApi();
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillRequiredFields();

    fireEvent.click(screen.getByText('treasurerDashboard.expenses.addModal.save'));

    expect(
      await screen.findByText('treasurerDashboard.expenses.addModal.checkNumberRequired')
    ).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.some(([, o]) => o?.method === 'POST')).toBe(false);
  });

  it('sends the trimmed check number on a valid submit', async () => {
    const onSuccess = jest.fn();
    mockApi();
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={onSuccess} />);
    await fillRequiredFields();

    fireEvent.change(screen.getByPlaceholderText('CHK-1234'), { target: { value: ' 1042 ' } });
    fireEvent.click(screen.getByText('treasurerDashboard.expenses.addModal.save'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const postCall = (global.fetch as jest.Mock).mock.calls.find(([, o]) => o?.method === 'POST');
    expect(JSON.parse(postCall[1].body)).toMatchObject({ check_number: '1042' });
  });
});
