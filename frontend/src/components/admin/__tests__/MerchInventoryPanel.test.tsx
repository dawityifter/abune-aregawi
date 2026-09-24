import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MerchInventoryPanel from '../MerchInventoryPanel';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';

const renderPanel = () => render(
  <I18nProvider>
    <LanguageProvider>
      <MerchInventoryPanel />
    </LanguageProvider>
  </I18nProvider>
);

// Stable identity, or the load callback is re-created and re-fires every render.
const FIREBASE_USER = { getIdToken: () => Promise.resolve('mock-token') };
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: FIREBASE_USER }),
}));

const YOUTH = 'Youth Test T-Shirt';
const ADULT = 'Adult Test T-Shirt';

const INVENTORY = [
  { product_key: 'youth_test', product_name: YOUTH, size: 'S', quantity: 50, held: 0 },
  { product_key: 'youth_test', product_name: YOUTH, size: 'M', quantity: 100, held: 2 },
  { product_key: 'adult_test', product_name: ADULT, size: 'S', quantity: 4, held: 0 },
  { product_key: 'adult_test', product_name: ADULT, size: 'L', quantity: 0, held: 0 }
];

type PutReply = { status: number; body: any };
let putReply: PutReply;

beforeEach(() => {
  localStorage.setItem('app.lang', 'en');
  putReply = { status: 200, body: {} };
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    if (opts?.method === 'PUT') {
      return Promise.resolve({
        ok: putReply.status < 400,
        status: putReply.status,
        json: () => Promise.resolve(putReply.body)
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, items: INVENTORY })
    });
  });
});

const putCalls = () => (global.fetch as jest.Mock).mock.calls.filter(([, opts]) => opts?.method === 'PUT');
const stock = (key: string) => screen.getByTestId(`stock-${key}`);

describe('MerchInventoryPanel', () => {
  it('shows what is left of every size, grouped by shirt', async () => {
    renderPanel();

    await waitFor(() => expect(stock('youth_test|M')).toHaveTextContent('100'));
    expect(screen.getByText(YOUTH)).toBeInTheDocument();
    expect(screen.getByText(ADULT)).toBeInTheDocument();
    expect(stock('adult_test|S')).toHaveTextContent('4');
  });

  it('flags a size at zero as off sale', async () => {
    renderPanel();

    await screen.findByText(/sold out — off sale/i);
  });

  it('subtracts a cash sale from the count it was looking at', async () => {
    putReply = { status: 200, body: { success: true, item: { quantity: 94 } } };
    renderPanel();
    await waitFor(() => expect(stock('youth_test|M')).toHaveTextContent('100'));

    fireEvent.change(screen.getByLabelText(`Shirts sold for cash, ${YOUTH} size M`), { target: { value: '6' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Subtract' })[1]);

    await waitFor(() => expect(stock('youth_test|M')).toHaveTextContent('94'));
    const [url, opts] = putCalls()[0];
    expect(url).toMatch(/\/api\/merch\/inventory\/youth_test\/M$/);
    expect(JSON.parse(opts.body)).toEqual({ quantity: 94, expected_quantity: 100 });
    expect(screen.getByRole('status')).toHaveTextContent(/recorded 6/i);
  });

  it('will not subtract more than the count holds', async () => {
    renderPanel();
    await waitFor(() => expect(stock('adult_test|S')).toHaveTextContent('4'));

    fireEvent.change(screen.getByLabelText(`Shirts sold for cash, ${ADULT} size S`), { target: { value: '5' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Subtract' })[2]);

    expect(screen.getByRole('alert')).toHaveTextContent(/only 4/i);
    expect(putCalls()).toHaveLength(0);
  });

  it('sets a count outright after a recount', async () => {
    putReply = { status: 200, body: { success: true, item: { quantity: 12 } } };
    renderPanel();
    await waitFor(() => expect(stock('adult_test|L')).toHaveTextContent('0'));

    fireEvent.change(screen.getByLabelText(`New count, ${ADULT} size L`), { target: { value: '12' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[3]);

    await waitFor(() => expect(stock('adult_test|L')).toHaveTextContent('12'));
    expect(JSON.parse(putCalls()[0][1].body)).toEqual({ quantity: 12, expected_quantity: 0 });
  });

  // An online order moved the count while the admin was typing. Their figure
  // must not be written over it; they are shown the real number instead.
  it('shows the new count and explains when an online order got there first', async () => {
    putReply = {
      status: 409,
      body: { success: false, current: 98, message: 'The count changed to 98 while you were editing.' }
    };
    renderPanel();
    await waitFor(() => expect(stock('youth_test|M')).toHaveTextContent('100'));

    fireEvent.change(screen.getByLabelText(`Shirts sold for cash, ${YOUTH} size M`), { target: { value: '6' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Subtract' })[1]);

    await waitFor(() => expect(stock('youth_test|M')).toHaveTextContent('98'));
    expect(screen.getByRole('alert')).toHaveTextContent(/changed to 98/i);
    // Left in place so the admin can save again against the new count.
    expect(screen.getByLabelText(`Shirts sold for cash, ${YOUTH} size M`)).toHaveValue(6);
  });
});

// A green parity test cannot see English left in the markup, so render the
// panel in Tigrigna and look for it.
describe('MerchInventoryPanel in Tigrigna', () => {
  beforeEach(() => localStorage.setItem('app.lang', 'ti'));
  afterEach(() => localStorage.setItem('app.lang', 'en'));

  it('shows no English labels', async () => {
    renderPanel();
    await waitFor(() => expect(stock('youth_test|M')).toHaveTextContent('100'));

    for (const phrase of [
      'Inventory', 'Shirts left to sell', 'Awaiting payment', 'Left to sell',
      'Sold for cash', 'Set count', 'Subtract', 'Save', 'Sold out'
    ]) {
      expect(screen.queryAllByText(new RegExp(phrase, 'i'))).toHaveLength(0);
    }
    expect(screen.getByText('ዕቑር ማልያ')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'ኣጉድል' }).length).toBeGreaterThan(0);
  });

  it('explains a conflicting edit in Tigrigna', async () => {
    putReply = { status: 409, body: { success: false, current: 98, message: 'The count changed to 98.' } };
    renderPanel();
    await waitFor(() => expect(stock('youth_test|M')).toHaveTextContent('100'));

    fireEvent.change(screen.getAllByRole('spinbutton')[2], { target: { value: '6' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'ኣጉድል' })[1]);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('98'));
    expect(screen.getByRole('alert')).not.toHaveTextContent(/changed/i);
  });
});
