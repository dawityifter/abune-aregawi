import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MerchPage from '../MerchPage';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { MerchCatalog, MerchCheckoutError } from '../../config/merch';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

const CATALOG: MerchCatalog = {
  event_key: 'october_5k_fundraiser',
  description: 'Test shirt',
  currency: 'usd',
  tax_applies: true,
  products: [{
    product_key: 'adult_test',
    product_name: 'Adult Test T-Shirt',
    product_name_ti: 'ናይ ዓበይቲ ፈተነ ማልያ',
    sizes: [{ size: 'S', unit_amount: 3000, available: 50 }],
    max_quantity_per_size: 20
  }]
};

const mockCreate = jest.fn();
jest.mock('../../config/merch', () => ({
  ...jest.requireActual('../../config/merch'),
  fetchMerchCatalog: () => Promise.resolve(CATALOG),
  createMerchCheckoutSession: (...args: unknown[]) => mockCreate(...args),
}));

const failWith = (status: number, extra: Partial<MerchCheckoutError> = {}) => {
  const err: MerchCheckoutError = Object.assign(new Error('Server says something in English'), { status, ...extra });
  mockCreate.mockRejectedValueOnce(err);
};

const renderPage = async (lang: 'en' | 'ti') => {
  localStorage.setItem('app.lang', lang);
  render(
    <I18nProvider>
      <LanguageProvider>
        <MerchPage />
      </LanguageProvider>
    </I18nProvider>
  );
  await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0));
};

const orderOneShirt = () => {
  fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText(/full name|ምሉእ ስም/i), { target: { value: 'Test Purchaser' } });
  fireEvent.change(screen.getByLabelText(/phone|ስልኪ/i), { target: { value: '2145550000' } });
  fireEvent.click(screen.getByRole('button', { name: /continue|ክፍሊት/i }));
};

afterEach(() => {
  localStorage.setItem('app.lang', 'en');
  mockCreate.mockReset();
});

describe('MerchPage checkout errors', () => {
  it('says how many are left, in Tigrigna, when stock runs short', async () => {
    failWith(409, { product_key: 'adult_test', size: 'S', available: 2 });
    await renderPage('ti');

    orderOneShirt();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ካብ ናይ ዓበይቲ ፈተነ ማልያ መጠን S 2 ጥራይ ተሪፉ'));
    expect(screen.getByRole('alert')).not.toHaveTextContent(/English/);
  });

  it('says a size sold out, in English, when none are left', async () => {
    failWith(409, { product_key: 'adult_test', size: 'S', available: 0 });
    await renderPage('en');

    orderOneShirt();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Adult Test T-Shirt size S just sold out'));
  });

  it('shows the server\'s own field message to an English reader', async () => {
    failWith(400);
    await renderPage('en');

    orderOneShirt();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server says something in English'));
  });

  it('does not show the server\'s English to a Tigrigna reader', async () => {
    failWith(400);
    await renderPage('ti');

    orderOneShirt();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('በጃኹም ዝርዝራትኩም'));
    expect(screen.getByRole('alert')).not.toHaveTextContent(/English/);
  });

  it('explains a rate limit in Tigrigna', async () => {
    failWith(429);
    await renderPage('ti');

    orderOneShirt();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ብዙሕ ፈተነታት'));
  });
});
