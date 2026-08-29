import React, { useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '../../config/stripe';
import StripePayment from '../StripePayment';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n/I18nProvider';

export interface PledgeCheckoutFormProps {
  anonymous: boolean;
  campaignId: number;
  onSuccess: (pledgeId?: number) => void;
}

// Flows 2 and 3 (spec §5.3/§5.4). They are one component because they differ
// in exactly two ways: whether a member is signed in, and whether a baptism
// name is collected.
//
// Paying now always means paying in full — there is a single amount field,
// and it is both the pledge and the payment. Anyone who wants to split
// chooses "pledge for later" and pays in installments afterwards.
const PledgeCheckoutForm: React.FC<PledgeCheckoutFormProps> = ({
  anonymous, campaignId, onSuccess
}) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [baptismName, setBaptismName] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [readyToPay, setReadyToPay] = useState(false);

  const handleContinue = () => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value < 1) {
      setError(t('pledgeForm.errors.amountMin'));
      return;
    }
    // Anonymous to the parish, never anonymous to the treasurer. Without an
    // internal identifier the church cannot reconcile the gift at all, so
    // this is a hard requirement rather than a nicety. The server enforces
    // it too (donationController rejects with 400 before any Stripe call).
    if (anonymous && !baptismName.trim()) {
      setError(t('pledge.anonymous.errors.baptismNameRequired'));
      return;
    }
    setError(null);
    setReadyToPay(true);
  };

  // The optional "phone or email" contact field can hold either shape.
  // express-validator enforces .isEmail() on donor_email and .isMobilePhone()
  // on donor_phone when either is present, so a phone number handed to
  // donor_email (or vice versa) would 400 before Stripe is ever called.
  const trimmedContact = contact.trim();
  const contactLooksLikeEmail = trimmedContact.includes('@');

  // StripePayment (also used by DonatePage) takes a donationData bundle plus
  // purpose/onCancel, not the flat amount/metadata shape one might expect —
  // metadata rides inside donationData.metadata.
  const donationData: any = {
    amount: parseFloat(amount) || 0,
    donation_type: 'one-time',
    payment_method: 'card',
    donor_first_name: anonymous ? 'Anonymous' : (user?.first_name || user?.firstName || ''),
    donor_last_name: anonymous ? 'Giver' : (user?.last_name || user?.lastName || ''),
    donor_email: anonymous
      ? (contactLooksLikeEmail ? trimmedContact : '')
      : (user?.email || ''),
    donor_phone: anonymous && trimmedContact && !contactLooksLikeEmail ? trimmedContact : undefined,
    metadata: {
      pledgeIntent: 'immediate',
      campaignId: String(campaignId),
      isAnonymous: anonymous ? 'true' : 'false',
      baptismName: anonymous ? baptismName.trim() : '',
      memberId: anonymous ? '' : String(user?.id || '')
    }
  };

  const handleCancel = () => setReadyToPay(false);

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <p className="text-sm text-gray-600">{t('pledge.checkout.payInFullNote')}</p>

      <div>
        <label htmlFor="checkout-amount" className="block text-sm font-medium text-gray-700">
          {t('pledgeForm.amountLabel')}
        </label>
        <input
          id="checkout-amount" type="number" min="1" step="0.01" value={amount}
          onChange={(e) => setAmount(e.target.value)} disabled={readyToPay}
          aria-describedby={error ? 'checkout-error' : undefined}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      {anonymous && (
        <>
          <div>
            <label htmlFor="checkout-baptism-name" className="block text-sm font-medium text-gray-700">
              {t('pledge.anonymous.baptismNameLabel')}
            </label>
            <input
              id="checkout-baptism-name" type="text" value={baptismName}
              onChange={(e) => setBaptismName(e.target.value)} disabled={readyToPay}
              aria-describedby={error ? 'checkout-error' : undefined}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
            <p className="mt-1 text-xs text-gray-500">{t('pledge.anonymous.baptismNameHelp')}</p>
          </div>

          <div>
            <label htmlFor="checkout-contact" className="block text-sm font-medium text-gray-700">
              {t('pledge.anonymous.contactLabel')}
            </label>
            <input
              id="checkout-contact" type="text" value={contact}
              onChange={(e) => setContact(e.target.value)} disabled={readyToPay}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
        </>
      )}

      {error && (
        <p id="checkout-error" role="alert" className="text-sm text-red-600">{error}</p>
      )}

      {!readyToPay ? (
        <button
          type="button" onClick={handleContinue}
          className="w-full rounded-md bg-primary-600 px-4 py-2 text-white font-medium"
        >
          {t('pledge.checkout.continue')}
        </button>
      ) : (
        <Elements stripe={stripePromise}>
          <StripePayment
            donationData={donationData}
            purpose="pledge_drive"
            onSuccess={() => onSuccess()}
            onError={(message: string) => setError(message)}
            onCancel={handleCancel}
          />
        </Elements>
      )}
    </div>
  );
};

export default PledgeCheckoutForm;
