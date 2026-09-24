import React, { useEffect, useMemo, useState } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../contexts/AuthContext';
import ShirtOrderForm, { PurchaserPrefill } from '../components/merch/ShirtOrderForm';
import {
  MerchCatalog,
  MerchCheckoutRequest,
  MerchCheckoutError,
  productDisplayName,
  fetchMerchCatalog,
  createMerchCheckoutSession
} from '../config/merch';

/**
 * Public t-shirt ordering for the October 5K fundraiser.
 *
 * This is a SALE, not a gift: it never touches the donation or pledge flows,
 * and the copy deliberately avoids the language of giving. Payment is hosted
 * Stripe Checkout, so no card details are ever entered on this page and
 * Stripe.js is never loaded.
 */
const MerchPage: React.FC = () => {
  const { t, lang } = useI18n();
  const [catalog, setCatalog] = useState<MerchCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Public page, so a visitor who is not signed in simply gets empty boxes.
  // `_temp` is the placeholder AuthContext holds before the member record is
  // loaded — same guard, same field names as DonatePage.
  const prefill = useMemo<PurchaserPrefill | undefined>(() => {
    if (!user || user._temp) return undefined;
    const first = user.first_name || user.firstName || '';
    const last = user.last_name || user.lastName || '';
    return {
      name: `${first} ${last}`.trim(),
      phone: user.phone_number || user.phoneNumber || '',
      email: user.email || ''
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    fetchMerchCatalog()
      .then((data) => { if (active) setCatalog(data); })
      .catch((err) => {
        console.error('Failed to load merchandise catalog:', err);
        if (active) setError(t('merch.errors.network'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);

  /**
   * A failed checkout, in the purchaser's language. The server's own message is
   * English, so it is only shown as-is for an English reader's 400 — where it
   * names the field to fix. Everything else is mapped from the status code.
   */
  const describeCheckoutError = (err: unknown): string => {
    const e = err as MerchCheckoutError;
    if (e?.status === 409) {
      const product = catalog?.products.find((p) => p.product_key === e.product_key);
      const name = product ? productDisplayName(product, lang) : '';
      const key = e.available ? 'merch.errors.outOfStock' : 'merch.errors.soldOutSize';
      return t(key)
        .replace('{product}', name)
        .replace('{size}', e.size || '')
        .replace('{count}', String(e.available ?? 0));
    }
    if (e?.status === 429) return t('merch.errors.rateLimited');
    if (e?.status === 503) return t('merch.errors.unavailable');
    if (e?.status === 400) return lang === 'en' && e.message ? e.message : t('merch.errors.checkDetails');
    return t('merch.errors.generic');
  };

  const handleCheckout = async (payload: MerchCheckoutRequest) => {
    setSubmitting(true);
    setError(null);
    try {
      const { url } = await createMerchCheckoutSession(payload);
      // Hosted Checkout lives on Stripe's domain, so this is a full navigation
      // rather than a route change.
      window.location.assign(url);
    } catch (err) {
      console.error('Merchandise checkout failed:', err);
      setError(describeCheckoutError(err));
      // The usual failure is a size selling out while the form was open. Fresh
      // counts let the pickers show that, instead of the purchaser guessing.
      fetchMerchCatalog().then(setCatalog).catch(() => {});
      // Only cleared on failure: on success the browser is already leaving, and
      // re-enabling the button would invite a second click and a second order.
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{t('merch.hero.title')}</h1>
          <p className="text-gray-600">{error || t('merch.errors.network')}</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="text-sm uppercase tracking-wide opacity-75 mb-2">
              {t('merch.hero.tagline')}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('merch.hero.title')}</h1>
            <p className="text-xl md:text-2xl opacity-90">{t('merch.hero.subtitle')}</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-12">
          {/* The shirt itself, front and back in one artwork. Worth its weight
              on the page: nobody buys a shirt they have not seen. */}
          <figure className="mb-8 overflow-hidden rounded-lg bg-white shadow">
            <img
              src="/images/promo/5k-tshirt.jpeg"
              alt={t('merch.product.imageAlt')}
              width={1280}
              height={1114}
              className="w-full h-auto"
            />
            <figcaption className="px-4 py-3 text-sm text-gray-600">
              {t('merch.product.imageCaption')}
            </figcaption>
          </figure>

          <ShirtOrderForm
            catalog={catalog}
            submitting={submitting}
            error={error}
            onSubmit={handleCheckout}
            prefill={prefill}
          />

          <p className="mt-4 text-center text-sm text-gray-500">
            {t('merch.product.soldOutNote')}
          </p>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default MerchPage;
