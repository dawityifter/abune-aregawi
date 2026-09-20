import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Where Stripe Checkout returns a purchaser after a successful payment.
 *
 * Deliberately says nothing about the order beyond thanking them: the session
 * id in the URL is not proof of payment (a purchaser can sit on this URL, and
 * the webhook may not have landed yet). The webhook is what marks an order
 * paid, and the receipt comes from Stripe.
 */
const MerchThankYouPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
          <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('merch.thankYou.title')}</h1>
        <p className="text-gray-600">{t('merch.thankYou.body')}</p>
        <p className="mt-3 text-gray-600">{t('merch.thankYou.pickupReminder')}</p>

        <Link
          to="/"
          className="mt-6 inline-block rounded-md bg-primary-600 px-4 py-2 text-white font-medium hover:bg-primary-700"
        >
          {t('merch.thankYou.home')}
        </Link>
      </div>
    </div>
  );
};

export default MerchThankYouPage;
