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

const saveButton = () => screen.getByRole('button', { name: /addModal\.save/ });
const checkField = async () => screen.findByTestId('check-number-input');

/** Fills everything the gate requires, leaving the form ready to submit. */
async function fillValidForm() {
  fireEvent.change(await checkField(), { target: { value: '1593' } });
  fireEvent.change(screen.getByLabelText(/addModal\.category/), { target: { value: 'EXP005' } });
  fireEvent.change(screen.getByLabelText(/addModal\.amount/), { target: { value: '125.00' } });
  fireEvent.change(screen.getByLabelText(/addModal\.date/), { target: { value: '2026-08-01' } });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Add expense — save button gating', () => {
  it('starts disabled on an empty form', async () => {
    mockApi();
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    // Wait for categories, so this asserts the gate rather than the loading state.
    await screen.findByLabelText(/addModal\.category/);

    expect(saveButton()).toBeDisabled();
  });

  it('enables once check number, category, amount and date are all filled', async () => {
    mockApi();
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillValidForm();

    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('disables again when the check number turns out to be a duplicate', async () => {
    mockApi({ available: false });
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillValidForm();
    await waitFor(() => expect(saveButton()).toBeEnabled());

    fireEvent.blur(await checkField());

    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it('stays disabled without a category', async () => {
    mockApi();
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillValidForm();
    await waitFor(() => expect(saveButton()).toBeEnabled());

    fireEvent.change(screen.getByLabelText(/addModal\.category/), { target: { value: '' } });

    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it('stays disabled when the amount is not a positive number', async () => {
    mockApi();
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillValidForm();
    await waitFor(() => expect(saveButton()).toBeEnabled());

    fireEvent.change(screen.getByLabelText(/addModal\.amount/), { target: { value: '0' } });

    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it('stays disabled without a date', async () => {
    mockApi();
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await fillValidForm();
    await waitFor(() => expect(saveButton()).toBeEnabled());

    fireEvent.change(screen.getByLabelText(/addModal\.date/), { target: { value: '' } });

    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it('does not require a check number for a cash expense', async () => {
    mockApi();
    render(<AddExpenseModal isOpen onClose={jest.fn()} onSuccess={jest.fn()} />);
    await checkField();

    fireEvent.click(screen.getByDisplayValue('cash'));
    fireEvent.change(screen.getByLabelText(/addModal\.category/), { target: { value: 'EXP005' } });
    fireEvent.change(screen.getByLabelText(/addModal\.amount/), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText(/addModal\.date/), { target: { value: '2026-08-01' } });

    await waitFor(() => expect(saveButton()).toBeEnabled());
  });
});
