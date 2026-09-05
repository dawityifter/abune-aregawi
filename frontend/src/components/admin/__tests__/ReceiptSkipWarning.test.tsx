import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddPaymentModal from '../AddPaymentModal';

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, language: 'en' }),
}));

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

function mockApi(lastReceipt: number | null) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('last-receipt-number')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            last_receipt_number: lastReceipt,
            next_expected: lastReceipt === null ? 5680 : lastReceipt + 1,
          },
        }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
  }) as any;
}

function open() {
  render(<AddPaymentModal onClose={jest.fn()} onPaymentAdded={jest.fn()} paymentView="new" />);
}

const receiptField = async () => screen.findByLabelText(/receipt number/i);
const warning = () => screen.queryByTestId('receipt-skip-warning');
const confirmBox = () => screen.queryByTestId('receipt-skip-confirm');

async function typeReceipt(value: string) {
  const field = await receiptField();
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
  return field;
}

beforeEach(() => jest.clearAllMocks());

describe('Add Payment — skipped receipt warning', () => {
  it('warns when the entered receipt jumps past the next expected one', async () => {
    mockApi(6012);
    open();

    await typeReceipt('6014');

    await waitFor(() => expect(warning()).toBeInTheDocument());
    expect(warning()).toHaveTextContent('6012');
    expect(warning()).toHaveTextContent('6013');
  });

  it('stays quiet for the very next receipt in sequence', async () => {
    mockApi(6012);
    open();

    await typeReceipt('6013');

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(warning()).not.toBeInTheDocument();
  });

  it('stays quiet for a receipt at or below the last recorded one', async () => {
    mockApi(6012);
    open();

    await typeReceipt('6011');

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(warning()).not.toBeInTheDocument();
  });

  it('names every number skipped when several are jumped', async () => {
    mockApi(6012);
    open();

    await typeReceipt('6016');

    await waitFor(() => expect(warning()).toBeInTheDocument());
    expect(warning()).toHaveTextContent('6013');
    expect(warning()).toHaveTextContent('6015');
  });

  it('lets the treasurer continue once they confirm', async () => {
    mockApi(6012);
    open();
    await typeReceipt('6014');
    await waitFor(() => expect(warning()).toBeInTheDocument());

    fireEvent.click(confirmBox() as HTMLElement);

    await waitFor(() => expect((confirmBox() as HTMLInputElement).checked).toBe(true));
  });

  it('makes them confirm again if they change the number to another skip', async () => {
    mockApi(6012);
    open();
    await typeReceipt('6014');
    await waitFor(() => expect(warning()).toBeInTheDocument());
    fireEvent.click(confirmBox() as HTMLElement);
    await waitFor(() => expect((confirmBox() as HTMLInputElement).checked).toBe(true));

    await typeReceipt('6020');

    await waitFor(() => expect((confirmBox() as HTMLInputElement).checked).toBe(false));
  });

  it('says nothing when the receipt book has no entries yet', async () => {
    mockApi(null);
    open();

    await typeReceipt('5680');

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(warning()).not.toBeInTheDocument();
  });

  it('does not warn on the 000 no-receipt marker', async () => {
    mockApi(6012);
    open();

    await typeReceipt('000');

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(warning()).not.toBeInTheDocument();
  });
});

describe('Add Payment — the skip must be confirmed before saving', () => {
  const saveButton = () => screen.getByRole('button', { name: /record payment|save|add payment/i });

  it('disables saving while an unconfirmed skip is showing', async () => {
    mockApi(6012);
    open();
    await typeReceipt('6014');
    await waitFor(() => expect(warning()).toBeInTheDocument());

    expect(saveButton()).toBeDisabled();
  });

  it('re-enables saving once the treasurer confirms', async () => {
    mockApi(6012);
    open();
    await typeReceipt('6014');
    await waitFor(() => expect(warning()).toBeInTheDocument());

    fireEvent.click(confirmBox() as HTMLElement);

    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('leaves saving alone when no receipt was skipped', async () => {
    mockApi(6012);
    open();
    await typeReceipt('6013');

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(saveButton()).toBeEnabled();
  });
});
