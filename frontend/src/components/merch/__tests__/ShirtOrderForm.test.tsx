import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import ShirtOrderForm from '../ShirtOrderForm';
import { MerchCatalog } from '../../../config/merch';

// Mirrors the backend catalog SHAPE, not its prices. Kept local so a price
// change on the server cannot quietly rewrite what these tests claim — and the
// sizes here deliberately cost DIFFERENT amounts even though the real shirts
// are all $30, because a fixture where every size cost the same would let a
// subtotal bug through unnoticed.
const YOUTH = 'Youth Test T-Shirt';
const ADULT = 'Adult Test T-Shirt';

const catalog: MerchCatalog = {
  event_key: 'october_5k_fundraiser',
  description: 'Test shirt',
  currency: 'usd',
  products: [
    {
      product_key: 'youth_test',
      product_name: YOUTH,
      sizes: [
        { size: 'S', unit_amount: 2500 },
        { size: 'M', unit_amount: 2700 }
      ],
      max_quantity_per_size: 20
    },
    {
      product_key: 'adult_test',
      product_name: ADULT,
      sizes: [
        { size: 'S', unit_amount: 3000 },
        { size: 'L', unit_amount: 3500 }
      ],
      max_quantity_per_size: 20
    }
  ],
  tax_applies: true
};

const youth = catalog.products[0];
const adult = catalog.products[1];

const renderForm = (props: Partial<React.ComponentProps<typeof ShirtOrderForm>> = {}) => {
  const onSubmit: jest.Mock = (props.onSubmit as jest.Mock) || jest.fn().mockResolvedValue(undefined);
  const utils = render(
    <I18nProvider>
      <LanguageProvider>
        <ShirtOrderForm
          catalog={catalog}
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

// Product AND size: the two shirts share size letters, so a matcher on the
// letter alone would find two boxes and throw.
const qtyInput = (productName: string, size: string) =>
  screen.getByLabelText(new RegExp(`quantity for ${productName} size ${size}`, 'i'));
// Scoped, because a single-size order shows the same figure on its line and in
// the total, and an unscoped match would pass without the total existing.
const subtotal = () => screen.getByTestId('merch-subtotal');
// Name and phone: those are the two the form now insists on. Email is filled
// only by the cases that are about email.
const fillPurchaser = () => {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test Purchaser' } });
  fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '+12145550000' } });
};

describe('ShirtOrderForm — sizes and quantities', () => {
  it('offers a quantity control for every size of every product', () => {
    renderForm();

    youth.sizes.forEach(({ size }) => expect(qtyInput(YOUTH, size)).toBeInTheDocument());
    adult.sizes.forEach(({ size }) => expect(qtyInput(ADULT, size)).toBeInTheDocument());
  });

  // The two shirts share size letters. One counter behind both would make a
  // youth small and an adult small the same box.
  it('counts a youth small separately from an adult small', async () => {
    renderForm();

    fireEvent.change(qtyInput(YOUTH, 'S'), { target: { value: '2' } });

    expect(qtyInput(ADULT, 'S')).toHaveValue(0);
    await waitFor(() => expect(subtotal()).toHaveTextContent('$50.00'));
  });

  it('names each garment above its own size run', () => {
    renderForm();

    expect(screen.getByText(new RegExp(YOUTH))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(ADULT))).toBeInTheDocument();
  });

  it('starts with nothing selected and no subtotal to pay', () => {
    renderForm();

    youth.sizes.forEach(({ size }) => expect(qtyInput(YOUTH, size)).toHaveValue(0));
    adult.sizes.forEach(({ size }) => expect(qtyInput(ADULT, size)).toHaveValue(0));
    expect(subtotal()).toHaveTextContent('$0.00');
  });

  it('shows a subtotal that follows the chosen quantities', async () => {
    renderForm();

    fireEvent.change(qtyInput(YOUTH, 'S'), { target: { value: '2' } });
    await waitFor(() => expect(subtotal()).toHaveTextContent('$50.00'));

    fireEvent.change(qtyInput(ADULT, 'L'), { target: { value: '1' } });
    await waitFor(() => expect(subtotal()).toHaveTextContent('$85.00'));
  });

  /**
   * The load-bearing test for per-line pricing: every size in the fixture costs
   * a different amount, so a subtotal built from any single unit price is wrong
   * here. A youth S ($25) plus an adult L ($35) is $60, and no other pairing of
   * one price across two lines lands there.
   */
  it('prices each line at its own rate when products and sizes are mixed', async () => {
    renderForm();

    fireEvent.change(qtyInput(YOUTH, 'S'), { target: { value: '1' } });
    fireEvent.change(qtyInput(ADULT, 'L'), { target: { value: '1' } });

    await waitFor(() => expect(subtotal()).toHaveTextContent('$60.00'));
  });

  it('shows each size price beside its quantity box', () => {
    renderForm();

    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('$35.00')).toBeInTheDocument();
  });

  // The server refuses these too, but a purchaser should not have to reach
  // Stripe to find out.
  it('will not let a quantity exceed the per-size maximum', () => {
    renderForm();

    fireEvent.change(qtyInput(ADULT, 'S'), { target: { value: '999' } });

    expect(qtyInput(ADULT, 'S')).toHaveValue(adult.max_quantity_per_size);
  });

  it('treats a cleared quantity box as none of that size', async () => {
    renderForm();

    fireEvent.change(qtyInput(ADULT, 'S'), { target: { value: '2' } });
    fireEvent.change(qtyInput(ADULT, 'S'), { target: { value: '' } });

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

  it('sends only the lines that were actually chosen, each naming its product', async () => {
    const { onSubmit } = renderForm();
    fillPurchaser();
    fireEvent.change(qtyInput(YOUTH, 'S'), { target: { value: '2' } });
    fireEvent.change(qtyInput(ADULT, 'L'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.items).toEqual([
      { product_key: 'youth_test', size: 'S', quantity: 2 },
      { product_key: 'adult_test', size: 'L', quantity: 1 }
    ]);
  });

  // Same letter, two garments: the payload has to keep them apart or the
  // parish hands an adult shirt to a child.
  it('sends the same size on both products as two distinct lines', async () => {
    const { onSubmit } = renderForm();
    fillPurchaser();
    fireEvent.change(qtyInput(YOUTH, 'S'), { target: { value: '1' } });
    fireEvent.change(qtyInput(ADULT, 'S'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].items).toEqual([
      { product_key: 'youth_test', size: 'S', quantity: 1 },
      { product_key: 'adult_test', size: 'S', quantity: 1 }
    ]);
  });

  it('sends the purchaser contact details', async () => {
    const { onSubmit } = renderForm();
    fillPurchaser();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'buyer@example.org' } });
    fireEvent.change(qtyInput(ADULT, 'S'), { target: { value: '1' } });

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
    fireEvent.change(qtyInput(ADULT, 'S'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].items[0]).not.toHaveProperty('unit_amount');
  });

  it('requires a name and a phone number before checkout', async () => {
    const { onSubmit } = renderForm();
    fireEvent.change(qtyInput(ADULT, 'S'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  });

  // Pickup is arranged by phone, so it is the detail the parish cannot do
  // without — an email address alone is not enough to check out.
  it('will not check out on an email alone', async () => {
    const { onSubmit } = renderForm();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test Purchaser' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'buyer@example.org' } });
    fireEvent.change(qtyInput(ADULT, 'S'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    // Scoped to the alert: "phone" also appears as a field label, so an
    // unscoped match would pass without any error being shown at all.
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/phone/i));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('checks out with no email at all', async () => {
    const { onSubmit } = renderForm();
    fillPurchaser();
    fireEvent.change(qtyInput(ADULT, 'S'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.purchaser_phone).toBe('+12145550000');
    // Left off rather than sent empty: the server validates it only when present.
    expect(payload).not.toHaveProperty('purchaser_email');
  });

  // The field the form insists on comes first, so the tab order matches what a
  // purchaser actually has to fill in.
  it('puts the phone box before the email box', () => {
    const { container } = renderForm();

    const ids = Array.from(container.querySelectorAll('input'))
      .map((el) => el.id)
      .filter((id) => id === 'merch-phone' || id === 'merch-email');

    expect(ids).toEqual(['merch-phone', 'merch-email']);
  });

  it('marks the email optional and the phone not', () => {
    renderForm();

    expect(screen.getByLabelText(/email/i)).not.toBeRequired();
    expect(screen.getByLabelText(/phone/i)).toBeRequired();
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
    renderForm();

    expect(screen.getByText(/tax .*(calculated|checkout)/i)).toBeInTheDocument();
  });
});
