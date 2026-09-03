import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddExpenseModal from '../AddExpenseModal';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

const CATEGORIES = [{ id: 'c1', gl_code: 'EXP005', name: 'Utilities', description: '' }];

/** `available` controls what the availability endpoint answers. */
function mockApi({ available = true }: { available?: boolean } = {}) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('check-number-availability')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { check_number: '1593', available, reason: available ? null : 'DUPLICATE' },
        }),
      });
    }
    if (u.includes('/categories')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: CATEGORIES }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
  }) as any;
}

const checkField = async () => screen.findByTestId('check-number-input');

function availabilityCalls(): string[] {
  return (global.fetch as jest.Mock).mock.calls
    .map((c) => String(c[0]))
    .filter((u) => u.includes('check-number-availability'));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Add expense — check number validated on blur', () => {
  it('flags a duplicate as soon as the user leaves the field', async () => {
    mockApi({ available: false });
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);

    const input = await checkField();
    fireEvent.change(input, { target: { value: '1593' } });
    fireEvent.blur(input);

    expect(await screen.findByText('treasurerDashboard.expenses.addModal.checkNumberDuplicate')).toBeInTheDocument();
  });

  it('says nothing when the number is free', async () => {
    mockApi({ available: true });
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);

    const input = await checkField();
    fireEvent.change(input, { target: { value: '1593' } });
    fireEvent.blur(input);

    await waitFor(() => expect(availabilityCalls().length).toBe(1));
    expect(screen.queryByText('treasurerDashboard.expenses.addModal.checkNumberDuplicate')).not.toBeInTheDocument();
  });

  it('flags an empty check number on blur without calling the server', async () => {
    mockApi();
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);

    const input = await checkField();
    fireEvent.blur(input);

    expect(
      await screen.findByText('treasurerDashboard.expenses.addModal.checkNumberRequired')
    ).toBeInTheDocument();
    expect(availabilityCalls()).toHaveLength(0);
  });

  it('clears the duplicate warning once the user edits the number again', async () => {
    mockApi({ available: false });
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);

    const input = await checkField();
    fireEvent.change(input, { target: { value: '1593' } });
    fireEvent.blur(input);
    await screen.findByText('treasurerDashboard.expenses.addModal.checkNumberDuplicate');

    fireEvent.change(input, { target: { value: '1594' } });

    await waitFor(() => expect(screen.queryByText('treasurerDashboard.expenses.addModal.checkNumberDuplicate')).not.toBeInTheDocument());
  });

  it('asks about the number the user actually typed', async () => {
    mockApi();
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);

    const input = await checkField();
    fireEvent.change(input, { target: { value: '1593' } });
    fireEvent.blur(input);

    await waitFor(() => expect(availabilityCalls()[0]).toContain('check_number=1593'));
  });
});

describe('Add expense — field order', () => {
  it('asks for payment method and check number before the category', async () => {
    mockApi();
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);

    await checkField();
    const form = document.querySelector('form') as HTMLElement;
    const text = form.textContent || '';

    const methodAt = text.indexOf('treasurerDashboard.expenses.addModal.paymentMethod');
    const checkAt = text.indexOf('treasurerDashboard.expenses.addModal.checkNumber');
    const categoryAt = text.indexOf('treasurerDashboard.expenses.addModal.category');

    expect(methodAt).toBeGreaterThanOrEqual(0);
    expect(methodAt).toBeLessThan(checkAt);
    expect(checkAt).toBeLessThan(categoryAt);
  });
});
