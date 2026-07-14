import React, { useState, useEffect, useCallback } from 'react';
import { useStripe } from '@stripe/react-stripe-js';
import { createPaymentIntent } from '../config/stripe';
import { useLanguage } from '../contexts/LanguageContext';

interface ACHPaymentProps {
  donationData: {
    amount: number;
    donation_type: 'one-time' | 'recurring';
    frequency?: string;
    payment_method: 'card' | 'ach';
    donor_first_name: string;
    donor_last_name: string;
    donor_email: string;
    donor_phone?: string;
    donor_address?: string;
    donor_zip_code?: string;
  };
  onSuccess: (donation: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  inline?: boolean;
  onPaymentReady?: (processPayment: () => Promise<void>) => void;
  // Optional payment purpose and refresh callback
  purpose?: 'membership_due' | 'tithe' | 'donation' | 'event' | 'other';
  onRefreshHistory?: () => void;
}

const ACHPayment: React.FC<ACHPaymentProps> = ({ 
  donationData, 
  onSuccess, 
  onError, 
  onCancel,
  inline = false,
  onPaymentReady,
  purpose,
  onRefreshHistory
}) => {
  const stripe = useStripe();
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bankInfo, setBankInfo] = useState({
    accountNumber: '',
    routingNumber: '',
    accountType: 'checking',
    accountHolderName: `${donationData.donor_first_name} ${donationData.donor_last_name}`
  });

  // Expose payment processing function to parent component
  const processPayment = useCallback(async () => {
    if (!stripe) {
      const msg = t('achPayment.errors.stripeNotLoaded');
      setError(msg);
      onError(msg);
      return;
    }
    // Validate bank information
    if (!bankInfo.accountNumber || !bankInfo.routingNumber || !bankInfo.accountHolderName) {
      const errorMsg = t('achPayment.errors.fillRequired');
      setError(errorMsg);
      onError(errorMsg);
      return;
    }

    if (bankInfo.routingNumber.length !== 9) {
      const errorMsg = t('achPayment.errors.routingLength');
      setError(errorMsg);
      onError(errorMsg);
      return;
    }

    if (bankInfo.accountNumber.length < 4) {
      const errorMsg = t('achPayment.errors.accountLength');
      setError(errorMsg);
      onError(errorMsg);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create payment intent on the backend with ACH payment method
      // Only pass email if it exists - backend will handle default
      const paymentData: any = {
        ...donationData,
        // Send full name from "Account Holder Name" field - backend will parse it
        donor_full_name: bankInfo.accountHolderName || undefined,
        metadata: {
          ...(donationData as any).metadata,
          purpose: purpose || 'donation',
          payment_method: donationData.payment_method
        },
        bank_account: {
          account_number: bankInfo.accountNumber,
          routing_number: bankInfo.routingNumber,
          account_type: bankInfo.accountType,
          account_holder_name: bankInfo.accountHolderName
        }
      };
      
      // Only include donor_email if it exists
      if (donationData.donor_email) {
        paymentData.donor_email = donationData.donor_email;
      }

      const { client_secret, payment_intent_id, donation_id } = await createPaymentIntent(paymentData);

      // Confirm ACH payment by attaching bank account details
      const { error: stripeError, paymentIntent } = await stripe.confirmUsBankAccountPayment(client_secret, {
        payment_method: {
          us_bank_account: {
            account_number: bankInfo.accountNumber,
            routing_number: bankInfo.routingNumber,
            account_holder_type: bankInfo.accountType === 'company' ? 'company' : 'individual',
          },
          billing_details: {
            name: bankInfo.accountHolderName,
            // Only pass email to Stripe if it exists
            ...(donationData.donor_email && { email: donationData.donor_email }),
            phone: donationData.donor_phone,
          }
        }
      } as any);

      if (stripeError) {
        const msg = stripeError.message || t('achPayment.errors.achFailed');
        setError(msg);
        onError(msg);
        return;
      }

      // paymentIntent.status will likely be 'processing' or 'requires_payment_method' in edge cases
      onSuccess({
        amount: donationData.amount,
        payment_method: 'ach',
        status: paymentIntent?.status || 'processing',
        payment_intent_id,
        donation_id
      });
      if (onRefreshHistory) onRefreshHistory();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('achPayment.errors.unexpected');
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [bankInfo, donationData, onSuccess, onError, purpose, onRefreshHistory, stripe, t]);

  // Expose the payment processing function to parent component
  useEffect(() => {
    if (onPaymentReady) {
      onPaymentReady(processPayment);
    }
  }, [processPayment, onPaymentReady]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await processPayment();
  };

  const handleInputChange = (field: string, value: string) => {
    setBankInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (inline) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('achPayment.bankInfo')}</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('achPayment.accountHolderName')}
              </label>
              <input
                type="text"
                value={bankInfo.accountHolderName}
                onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('achPayment.routingNumber')}
              </label>
              <input
                type="text"
                value={bankInfo.routingNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                  handleInputChange('routingNumber', value);
                }}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123456789"
                maxLength={9}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('achPayment.routingHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('achPayment.accountNumber')}
              </label>
              <input
                type="text"
                value={bankInfo.accountNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  handleInputChange('accountNumber', value);
                }}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1234567890"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('achPayment.accountNumberHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('achPayment.accountType')}
              </label>
              <select
                value={bankInfo.accountType}
                onChange={(e) => handleInputChange('accountType', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="checking">{t('achPayment.checking')}</option>
                <option value="savings">{t('achPayment.savings')}</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <p className="text-sm text-blue-700">
              <strong>{t('achPayment.amountLabel')}</strong> ${donationData.amount.toFixed(2)}
            </p>
            <p className="text-sm text-blue-700">
              <strong>{t('achPayment.typeLabel')}</strong> {donationData.donation_type === 'recurring' ? t('achPayment.recurring') : t('achPayment.oneTime')}
              {donationData.donation_type === 'recurring' && donationData.frequency && (
                <span> ({donationData.frequency})</span>
              )}
            </p>
            <p className="text-sm text-blue-700">
              <strong>{t('achPayment.methodLabel')}</strong> {t('achPayment.methodValue')}
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <p className="text-sm text-yellow-700">
              <strong>{t('achPayment.importantLabel')}</strong> {t('achPayment.importantText')}
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
            <p className="text-sm text-green-700">
              <strong>{t('achPayment.securityLabel')}</strong> {t('achPayment.securityText')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('achPayment.bankInfo')}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('achPayment.accountHolderName')}
            </label>
            <input
              type="text"
              value={bankInfo.accountHolderName}
              onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('achPayment.routingNumber')}
            </label>
            <input
              type="text"
              value={bankInfo.routingNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                handleInputChange('routingNumber', value);
              }}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="123456789"
              maxLength={9}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('achPayment.routingHint')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('achPayment.accountNumber')}
            </label>
            <input
              type="text"
              value={bankInfo.accountNumber}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                handleInputChange('accountNumber', value);
              }}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1234567890"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('achPayment.accountNumberHint')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('achPayment.accountType')}
            </label>
            <select
              value={bankInfo.accountType}
              onChange={(e) => handleInputChange('accountType', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="checking">{t('achPayment.checking')}</option>
              <option value="savings">{t('achPayment.savings')}</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <p className="text-sm text-blue-700">
            <strong>{t('achPayment.amountLabel')}</strong> ${donationData.amount.toFixed(2)}
          </p>
          <p className="text-sm text-blue-700">
            <strong>{t('achPayment.typeLabel')}</strong> {donationData.donation_type === 'recurring' ? t('achPayment.recurring') : t('achPayment.oneTime')}
            {donationData.donation_type === 'recurring' && donationData.frequency && (
              <span> ({donationData.frequency})</span>
            )}
          </p>
          <p className="text-sm text-blue-700">
            <strong>{t('achPayment.methodLabel')}</strong> {t('achPayment.methodValue')}
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <p className="text-sm text-yellow-700">
            <strong>{t('achPayment.importantLabel')}</strong> {t('achPayment.importantText')}
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
          <p className="text-sm text-green-700">
            <strong>{t('achPayment.securityLabel')}</strong> {t('achPayment.securityText')}
          </p>
        </div>
      </div>

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-lg transition duration-200"
        >
          {t('achPayment.cancel')}
        </button>
        <button
          type="submit"
          disabled={isProcessing}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
        >
          {isProcessing ? t('achPayment.processing') : t('achPayment.pay', { amount: donationData.amount.toFixed(2) })}
        </button>
      </div>
    </form>
  );
};

export default ACHPayment; 
