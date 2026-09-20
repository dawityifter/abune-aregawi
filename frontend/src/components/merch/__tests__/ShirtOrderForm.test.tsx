import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import ShirtOrderForm from '../ShirtOrderForm';
import { MerchProduct } from '../../../config/merch';

// Mirrors the backend catalog shape. Kept local so a price change on the server
// cannot quietly rewrite what these tests claim.
const product: MerchProduct = {
  event_key: 'october_5k_fundraiser',
  product_name: '5K Fundraiser T-Shirt',
  description: 'Test shirt',
  currency: 'usd',
  // Two sizes at DIFFERENT prices, mirroring the real catalog. A fixture where
  // every size cost the same would let a subtotal bug through unnoticed.
  sizes: [
    { size: 'S', unit_amount: 2500 },
    { size: 'L', unit_amount: 3000 }
  ],
  max_quantity_per_size: 20
};

const renderForm = (props: Partial<React.ComponentProps<typeof ShirtOrderForm>> = {}) => {
  const onSubmit: jest.Mock = (props.onSubmit as jest.Mock) || jest.fn().mockResolvedValue(undefined);
  const utils = render(
    <I18nProvider>
      <LanguageProvider>
        <ShirtOrderForm
          product={product}
          taxApplies
          submitting={false}
          error={null}
          {...props}
          onSubmit={onSubmit}
        />
      </LanguageProvider>
    </I18nProvider>
  );
  return { ...utils, onSubmit };
};

const qtyInput = (size: string) => screen.getByLabelText(new RegExp(`quantity for size ${size}`, 'i'));
// Scoped, because a single-size order shows the same figure on its line and in
// the total, and an unscoped match would pass without the total existing.
const subtotal = () => screen.getByTestId('merch-subtotal');
const fillPurchaser = () => {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test Purchaser' } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'buyer@example.org' } });
};

describe('ShirtOrderForm — sizes and quantities', () => {
  it('offers a quantity control for every catalog size', () => {
    renderForm();

    product.sizes.forEach(({ size }) => expect(qtyInput(size)).toBeInTheDocument());
  });

  it('starts with nothing selected and no subtotal to pay', () => {
    renderForm();

    product.sizes.forEach(({ size }) => expect(qtyInput(size)).toHaveValue(0));
    expect(subtotal()).toHaveTextContent('$0.00');
  });

  it('shows a subtotal that follows the chosen quantities', async () => {
    renderForm();

    fireEvent.change(qtyInput('S'), { target: { value: '2' } });
    await waitFor(() => expect(subtotal()).toHaveTextContent('$50.00'));

    fireEvent.change(qtyInput('L'), { target: { value: '1' } });
    await waitFor(() => expect(subtotal()).toHaveTextContent('$80.00'));
  });

  /**
   * The load-bearing test for per-size pricing: S is $25 and L is $30, so a
   * subtotal built from any single unit price is wrong here. 1 S + 1 L = $55,
   * not $50 and not $60.
   */
  it('prices each size at its own rate when sizes are mixed', async () => {
    renderForm();

    fireEvent.change(qtyInput('S'), { target: { value: '1' } });
    fireEvent.change(qtyInput('L'), { target: { value: '1' } });

    await waitFor(() => expect(subtotal()).toHaveTextContent('$55.00'));
  });

  it('shows each size price beside its quantity box', () => {
    renderForm();

    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
  });

  // The server refuses these too, but a purchaser should not have to reach
  // Stripe to find out.
  it('will not let a quantity exceed the per-size maximum', () => {
    renderForm();

    fireEvent.change(qtyInput('S'), { target: { value: '999' } });

    expect(qtyInput('S')).toHaveValue(product.max_quantity_per_size);
  });

  it('treats a cleared quantity box as none of that size', async () => {
    renderForm();

    fireEvent.change(qtyInput('S'), { target: { value: '2' } });
    fireEvent.change(qtyInput('S'), { target: { value: '' } });

    await waitFor(() => expect(subtotal()).toHaveTextContent('$0.00'));
  });
});

describe('ShirtOrderForm — checkout', () => {
  it('refuses to submit with no sizes chosen', async () => {
    const { onSubmit } = renderForm();
    fillPurchaser();

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(screen.getByText(/at least one size/i)).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends only the sizes that were actually chosen', async () => {
    const { onSubmit } = renderForm();
    fillPurchaser();
    fireEvent.change(qtyInput('S'), { target: { value: '2' } });
    fireEvent.change(qtyInput('L'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.items).toEqual([
      { size: 'S', quantity: 2 },
      { size: 'L', quantity: 1 }
    ]);
  });

  it('sends the purchaser contact details', async () => {
    const { onSubmit } = renderForm();
    fillPurchaser();
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '+12145550000' } });
    fireEvent.change(qtyInput('S'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      purchaser_name: 'Test Purchaser',
      purchaser_email: 'buyer@example.org',
      purchaser_phone: '+12145550000',
      event_key: 'october_5k_fundraiser'
    });
  });

  // The price is the server's decision. Sending one invites a caller to think
  // it matters.
  it('does not send a price', async () => {
    const { onSubmit } = renderForm();
    fillPurchaser();
    fireEvent.change(qtyInput('S'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].items[0]).not.toHaveProperty('unit_amount');
  });

  it('requires a name and an email before checkout', async () => {
    const { onSubmit } = renderForm();
    fireEvent.change(qtyInput('S'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  });

  it('disables the button while checkout is starting', () => {
    renderForm({ submitting: true });

    expect(screen.getByRole('button', { name: /starting checkout/i })).toBeDisabled();
  });

  it('shows an error handed down from the page', () => {
    renderForm({ error: 'We could not start checkout. Please try again.' });

    expect(screen.getByText(/could not start checkout/i)).toBeInTheDocument();
  });

  // Pickup at the church or the event only.
  it('tells the purchaser the shirts are collected, not shipped', () => {
    renderForm();

    expect(screen.getByText(/pickup only/i)).toBeInTheDocument();
    expect(screen.getByText(/do not ship/i)).toBeInTheDocument();
  });

  it('says tax is worked out at checkout when tax applies', () => {
    renderForm({ taxApplies: true });

    expect(screen.getByText(/tax .*(calculated|checkout)/i)).toBeInTheDocument();
  });
});
