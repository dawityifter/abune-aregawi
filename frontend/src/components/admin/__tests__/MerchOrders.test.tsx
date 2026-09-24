import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MerchOrders from '../MerchOrders';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';

// Stable identity, or the load callback is re-created and re-fires every render.
const FIREBASE_USER = { getIdToken: () => Promise.resolve('mock-token') };
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: FIREBASE_USER }),
}));

const ORDER = {
  id: 1,
  purchaser_name: 'Test Purchaser',
  purchaser_email: 'buyer@example.org',
  purchaser_phone: '+12145550000',
  status: 'paid',
  fulfillment_status: 'unfulfilled',
  subtotal: '30.00',
  tax: '2.48',
  total: '32.48',
  event_key: 'october_5k_fundraiser',
  created_at: '2026-09-20T12:00:00Z',
  items: [{ id: 1, product_name: 'Adult Test T-Shirt', size: 'S', quantity: 1, unit_amount: '30.00', total_amount: '30.00' }]
};

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const body = url.includes('/size-summary')
      ? { sizes: [{ product_name: 'Adult Test T-Shirt', size: 'S', quantity: 1 }], total_shirts: 1 }
      : url.includes('/inventory')
        ? { items: [] }
        : { orders: [ORDER] };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  });
});

afterEach(() => localStorage.setItem('app.lang', 'en'));

const renderOrders = (lang: 'en' | 'ti') => {
  localStorage.setItem('app.lang', lang);
  return render(
    <I18nProvider>
      <LanguageProvider>
        <MerchOrders />
      </LanguageProvider>
    </I18nProvider>
  );
};

describe('MerchOrders', () => {
  it('headlines the online sales summary', async () => {
    renderOrders('en');

    await screen.findByText('Test Purchaser');
    expect(screen.getByText('Shirts sold online via Stripe')).toBeInTheDocument();
    expect(screen.getByText('Mark fulfilled')).toBeInTheDocument();
  });

  // A green parity test cannot see English left in the markup, so render the
  // page in Tigrigna and look for it.
  it('shows no English labels in Tigrigna', async () => {
    renderOrders('ti');

    await screen.findByText('Test Purchaser');
    for (const phrase of [
      'Merchandise Orders', 'Shirts sold online', /^Purchaser$/, 'Fulfillment',
      'Mark fulfilled', 'All payment statuses', 'incl\\.', /^Paid$/
    ]) {
      const pattern = phrase instanceof RegExp ? phrase : new RegExp(phrase, 'i');
      expect(screen.queryAllByText(pattern)).toHaveLength(0);
    }
    expect(screen.getByText('ትእዛዛት ሸቐጥ')).toBeInTheDocument();
    // The status chip, not just the filter option of the same name.
    expect(screen.getAllByText('ተኸፊሉ').length).toBeGreaterThanOrEqual(2);
  });
});
