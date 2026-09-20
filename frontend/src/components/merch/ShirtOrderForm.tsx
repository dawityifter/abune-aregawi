import React, { useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { MerchProduct, MerchCheckoutRequest, formatMoney } from '../../config/merch';
import SizeQuantityPicker from './SizeQuantityPicker';

interface Props {
  product: MerchProduct;
  taxApplies: boolean;
  submitting: boolean;
  error?: string | null;
  onSubmit: (payload: MerchCheckoutRequest) => Promise<void> | void;
}

/**
 * The order form itself. It collects and validates; it does not talk to the
 * API and does not know what a Checkout Session is — MerchPage owns the request
 * and the redirect. That split is what makes this testable without a network.
 */
const ShirtOrderForm: React.FC<Props> = ({ product, taxApplies, submitting, error, onSubmit }) => {
  const { t } = useI18n();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Each chosen line carries its own unit price, because an L costs more than
  // an S. Multiplying one product-wide price across every size — which this did
  // when all shirts cost the same — undercharges every mixed order.
  const chosen = useMemo(
    () => product.sizes
      .map(({ size, unit_amount: unitAmount }) => ({
        size,
        quantity: quantities[size] || 0,
        unitAmount
      }))
      .filter((item) => item.quantity > 0),
    [product.sizes, quantities]
  );

  const subtotalCents = chosen.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0);

  const handleQuantityChange = (size: string, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [size]: quantity }));
    setLocalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (chosen.length === 0) {
      setLocalError(t('merch.errors.noItems'));
      return;
    }

    // Checked here as well as by the `required` attributes. Native validation
    // is the browser's decision to make — it is skipped entirely when a form is
    // submitted programmatically — and the server rejects a nameless order
    // anyway, so the purchaser is better told here than after a round trip.
    if (!name.trim() || !email.trim()) {
      setLocalError(t('merch.errors.contactRequired'));
      return;
    }

    setLocalError(null);
    await onSubmit({
      event_key: product.event_key,
      purchaser_name: name.trim(),
      purchaser_email: email.trim(),
      // Omitted rather than sent empty: the server validates it only when present.
      ...(phone.trim() ? { purchaser_phone: phone.trim() } : {}),
      // Size and quantity only. `chosen` also carries the display price, and
      // that must not travel: the server prices from its own catalog, and
      // sending a price would imply it were negotiable.
      items: chosen.map(({ size, quantity }) => ({ size, quantity }))
    });
  };

  const shownError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6" noValidate={false}>
      <SizeQuantityPicker
        product={product}
        quantities={quantities}
        onChange={handleQuantityChange}
        disabled={submitting}
      />

      {/* Pickup is the whole fulfillment model, so it is stated on the form
          rather than buried in a confirmation email. */}
      <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
        <h3 className="text-sm font-semibold text-amber-900">{t('merch.pickup.title')}</h3>
        <p className="mt-1 text-sm text-amber-800">{t('merch.pickup.body')}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="merch-name" className="block text-sm font-medium text-gray-900">
            {t('merch.form.nameLabel')}
          </label>
          <input
            id="merch-name"
            type="text"
            required
            value={name}
            disabled={submitting}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </div>

        <div>
          <label htmlFor="merch-email" className="block text-sm font-medium text-gray-900">
            {t('merch.form.emailLabel')}
          </label>
          <input
            id="merch-email"
            type="email"
            required
            value={email}
            disabled={submitting}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </div>

        <div>
          <label htmlFor="merch-phone" className="block text-sm font-medium text-gray-900">
            {t('merch.form.phoneLabel')}{' '}
            <span className="text-gray-500 font-normal">({t('merch.form.phoneOptional')})</span>
          </label>
          <input
            id="merch-phone"
            type="tel"
            value={phone}
            disabled={submitting}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">{t('merch.form.summaryTitle')}</h3>
        {chosen.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">{t('merch.form.empty')}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {chosen.map((item) => (
              <li key={item.size} className="flex justify-between">
                <span>{product.product_name} — {item.size} × {item.quantity}</span>
                <span>{formatMoney(item.quantity * item.unitAmount, product.currency)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex justify-between text-base font-semibold text-gray-900">
          <span>{t('merch.form.subtotal')}</span>
          <span data-testid="merch-subtotal">{formatMoney(subtotalCents, product.currency)}</span>
        </div>

        {/* No tax figure here: the server owns the rate and the mode, and a
            number duplicated in the UI is a number that drifts. */}
        {taxApplies && (
          <p className="mt-1 text-sm text-gray-600">{t('merch.form.taxAtCheckout')}</p>
        )}
      </div>

      {shownError && (
        <div role="alert" className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-800">{shownError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-md bg-primary-600 px-4 py-3 text-white font-medium hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? t('merch.form.submitting') : t('merch.form.submit')}
      </button>
    </form>
  );
};

export default ShirtOrderForm;
