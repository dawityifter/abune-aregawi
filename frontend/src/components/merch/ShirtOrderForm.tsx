import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { MerchCatalog, MerchCheckoutRequest, formatMoney } from '../../config/merch';
import SizeQuantityPicker from './SizeQuantityPicker';
import {
  formatPhoneNumber, formatE164ToDisplay, isValidPhoneNumber, normalizePhoneNumber
} from '../../utils/formatPhoneNumber';

/**
 * What is typed, shown as (XXX) XXX-XXXX and capped at ten digits. A leading
 * country code is dropped first — no US area code starts with 1 — so a number
 * pasted as "+1 214 555 0000" keeps its last digit instead of losing it to the
 * cap.
 */
const formatTypedPhone = (raw: string) => {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits ? formatPhoneNumber(digits) : '';
};

export interface PurchaserPrefill {
  name?: string;
  phone?: string;
  email?: string;
}

interface Props {
  catalog: MerchCatalog;
  submitting: boolean;
  error?: string | null;
  onSubmit: (payload: MerchCheckoutRequest) => Promise<void> | void;
  /** A signed-in member's contact details, if we have them. */
  prefill?: PurchaserPrefill;
}

/**
 * Quantities are keyed by product AND size. Keying on size alone would make a
 * youth S and an adult S the same box — two different garments sharing one
 * counter, and whichever the purchaser touched last would win.
 */
const cellKey = (productKey: string, size: string) => `${productKey}|${size}`;

/**
 * The order form itself. It collects and validates; it does not talk to the
 * API and does not know what a Checkout Session is — MerchPage owns the request
 * and the redirect. That split is what makes this testable without a network.
 */
const ShirtOrderForm: React.FC<Props> = ({ catalog, submitting, error, onSubmit, prefill }) => {
  const { t } = useI18n();
  const { products, currency, tax_applies: taxApplies } = catalog;
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // The member record can land after the form is on screen (auth resolves
  // asynchronously), so this runs on every change to it — but only ever fills
  // a box that is still empty. Whatever the purchaser typed wins; a member
  // buying for someone else must not have their edits snapped back.
  const prefillName = prefill?.name?.trim() || '';
  const prefillPhone = prefill?.phone?.trim() || '';
  const prefillEmail = prefill?.email?.trim() || '';
  useEffect(() => {
    if (prefillName) setName((current) => current || prefillName);
    if (prefillPhone) setPhone((current) => current || formatE164ToDisplay(prefillPhone));
    if (prefillEmail) setEmail((current) => current || prefillEmail);
  }, [prefillName, prefillPhone, prefillEmail]);

  // Each chosen line carries its own unit price, taken from its own size entry
  // rather than from any product-wide figure. Every shirt costs $30 today,
  // which is exactly when a single shared price looks harmless to introduce.
  const chosen = useMemo(
    () => products.flatMap((product) =>
      product.sizes
        .map(({ size, unit_amount: unitAmount }) => ({
          productKey: product.product_key,
          productName: product.product_name,
          size,
          quantity: quantities[cellKey(product.product_key, size)] || 0,
          unitAmount
        }))
        .filter((item) => item.quantity > 0)),
    [products, quantities]
  );

  const subtotalCents = chosen.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0);

  const handleQuantityChange = (productKey: string, size: string, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [cellKey(productKey, size)]: quantity }));
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
    if (!name.trim() || !phone.trim()) {
      setLocalError(t('merch.errors.contactRequired'));
      return;
    }

    if (!isValidPhoneNumber(phone)) {
      setLocalError(t('merch.errors.phoneInvalid'));
      return;
    }

    setLocalError(null);
    await onSubmit({
      event_key: catalog.event_key,
      purchaser_name: name.trim(),
      // E.164 for the server, whatever the box shows.
      purchaser_phone: normalizePhoneNumber(phone),
      // Omitted rather than sent empty: the server validates it only when present.
      ...(email.trim() ? { purchaser_email: email.trim() } : {}),
      // Product, size and quantity only. `chosen` also carries the display
      // price, and that must not travel: the server prices from its own
      // catalog, and sending a price would imply it were negotiable.
      items: chosen.map(({ productKey, size, quantity }) => ({
        product_key: productKey,
        size,
        quantity
      }))
    });
  };

  const shownError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6" noValidate={false}>
      <div className="space-y-6">
        {products.map((product) => (
          <SizeQuantityPicker
            key={product.product_key}
            product={product}
            currency={currency}
            quantities={quantities}
            onChange={handleQuantityChange}
            disabled={submitting}
          />
        ))}
      </div>

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
          <label htmlFor="merch-phone" className="block text-sm font-medium text-gray-900">
            {t('merch.form.phoneLabel')}
          </label>
          <input
            id="merch-phone"
            type="tel"
            required
            value={phone}
            disabled={submitting}
            onChange={(e) => setPhone(formatTypedPhone(e.target.value))}
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(214) 555-0123"
            className="mt-1 w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </div>

        <div>
          <label htmlFor="merch-email" className="block text-sm font-medium text-gray-900">
            {t('merch.form.emailLabel')}{' '}
            <span className="text-gray-500 font-normal">({t('merch.form.emailOptional')})</span>
          </label>
          <input
            id="merch-email"
            type="email"
            value={email}
            disabled={submitting}
            onChange={(e) => setEmail(e.target.value)}
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
              <li key={cellKey(item.productKey, item.size)} className="flex justify-between">
                <span>{item.productName} — {item.size} × {item.quantity}</span>
                <span>{formatMoney(item.quantity * item.unitAmount, currency)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex justify-between text-base font-semibold text-gray-900">
          <span>{t('merch.form.subtotal')}</span>
          <span data-testid="merch-subtotal">{formatMoney(subtotalCents, currency)}</span>
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
