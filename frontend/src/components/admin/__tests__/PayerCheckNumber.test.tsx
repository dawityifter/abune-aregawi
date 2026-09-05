import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddPaymentModal from '../AddPaymentModal';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

function mockApi() {
  global.fetch = jest.fn().mockImplementation(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: {} }) })
  ) as any;
}

const field = () => screen.queryByTestId('payer-check-number');

beforeEach(() => jest.clearAllMocks());

function open(paymentView: 'old' | 'new' = 'new') {
  mockApi();
  render(
    <AddPaymentModal
      onClose={jest.fn()}
      onPaymentAdded={jest.fn()}
      paymentView={paymentView}
    />
  );
}

describe('AddPaymentModal — payer check serial', () => {
  it('asks for the check serial once the method is check', async () => {
    open();
    const method = await screen.findByLabelText(/payment method/i);
    fireEvent.change(method, { target: { value: 'check' } });

    await waitFor(() => expect(field()).toBeInTheDocument());
  });

  it('does not ask for it on a cash payment', async () => {
    open();
    const method = await screen.findByLabelText(/payment method/i);
    fireEvent.change(method, { target: { value: 'cash' } });

    await waitFor(() => expect(field()).not.toBeInTheDocument());
  });

  it('is not offered in the legacy payment view, which cannot store it', async () => {
    // The legacy submit path posts to a different endpoint that ignores
    // check_number; showing the field there would silently discard it.
    open('old');
    const method = await screen.findByLabelText(/payment method/i);
    fireEvent.change(method, { target: { value: 'Check' } });

    await waitFor(() => expect(field()).not.toBeInTheDocument());
  });

  it('accepts digits only, since a check serial is numeric', async () => {
    open();
    const method = await screen.findByLabelText(/payment method/i);
    fireEvent.change(method, { target: { value: 'check' } });

    const input = (await screen.findByTestId('payer-check-number')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'CHK-1397' } });

    expect(input.value).toBe('1397');
  });
});
