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

function mockApi() {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('check-number-availability')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { check_number: '1593', available: true, reason: null },
        }),
      });
    }
    if (u.includes('/categories')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: CATEGORIES }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
  }) as any;
}

const saveButton = () => screen.getByRole('button', { name: /addModal\.save/ });
const amountField = () => screen.getByLabelText(/addModal\.amount/);
const memoField = () => screen.getByLabelText(/addModal\.memo/);

/** Fills every required field except the amount, which each test sets itself. */
async function fillFormExceptAmount() {
  fireEvent.change(await screen.findByTestId('check-number-input'), { target: { value: '1593' } });
  fireEvent.change(screen.getByLabelText(/addModal\.category/), { target: { value: 'EXP005' } });
  fireEvent.change(screen.getByLabelText(/addModal\.date/), { target: { value: '2026-08-01' } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi();
});

describe('Add expense — voided check', () => {
  it('enables save for a $0.00 amount once the memo says void', async () => {
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillFormExceptAmount();
    fireEvent.change(amountField(), { target: { value: '0.00' } });

    expect(saveButton()).toBeDisabled();

    fireEvent.change(memoField(), { target: { value: 'Void' } });

    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('accepts a void memo that carries the rest of the explanation', async () => {
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillFormExceptAmount();
    fireEvent.change(amountField(), { target: { value: '0' } });
    fireEvent.change(memoField(), {
      target: { value: 'Void - misprinted, reissued as 1594' },
    });

    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('keeps save disabled at $0.00 when the memo does not mark it void', async () => {
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillFormExceptAmount();
    fireEvent.change(amountField(), { target: { value: '0.00' } });
    fireEvent.change(memoField(), { target: { value: 'August electric bill' } });

    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it('disables save again if the void wording is removed from the memo', async () => {
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillFormExceptAmount();
    fireEvent.change(amountField(), { target: { value: '0.00' } });
    fireEvent.change(memoField(), { target: { value: 'Void' } });
    await waitFor(() => expect(saveButton()).toBeEnabled());

    fireEvent.change(memoField(), { target: { value: 'Never mind' } });

    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it('clears a stale amount error once the memo is marked void', async () => {
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillFormExceptAmount();
    fireEvent.change(amountField(), { target: { value: '0.00' } });
    // Submit directly, as pressing Enter in a field does, to raise the error.
    fireEvent.submit(saveButton().closest('form') as HTMLFormElement);
    await screen.findByText(/addModal\.amountPositiveOrVoid/);

    fireEvent.change(memoField(), { target: { value: 'Void' } });

    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('posts the voided check with a zero amount and its check number', async () => {
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillFormExceptAmount();
    fireEvent.change(amountField(), { target: { value: '0.00' } });
    fireEvent.change(memoField(), { target: { value: 'Void - torn' } });
    await waitFor(() => expect(saveButton()).toBeEnabled());

    fireEvent.click(saveButton());

    await waitFor(() => {
      const post = (global.fetch as jest.Mock).mock.calls
        .find(([, init]) => init && init.method === 'POST');
      expect(post).toBeDefined();
      expect(JSON.parse(post[1].body)).toMatchObject({
        amount: 0,
        check_number: '1593',
        memo: 'Void - torn',
      });
    });
  });
});
