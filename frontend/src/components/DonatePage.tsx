import React, { useState, useEffect, useMemo } from 'react';
import ZelleQR from '../assets/AbuneAregawiZelle.png';
import StripePayment from './StripePayment';
import ACHPayment from './ACHPayment';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '../config/stripe';

const DonatePage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [donationType, setDonationType] = useState<'one-time' | 'recurring'>('one-time');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'ach'>('card');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [frequency, setFrequency] = useState('monthly');
  const [donorInfo, setDonorInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    zipCode: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [processCardPayment, setProcessCardPayment] = useState<(() => Promise<void>) | null>(null);
  const [processACHPayment, setProcessACHPayment] = useState<(() => Promise<void>) | null>(null);

  // Prefill donor information with logged-in user data
  useEffect(() => {
    if (user && !user._temp) {
      setDonorInfo({
        firstName: user.first_name || user.firstName || '',
        lastName: user.last_name || user.lastName || '',
        email: user.email || '',
        phone: user.phone_number || user.phoneNumber || '',
        address: user.street_line1 || user.streetLine1 || '',
        zipCode: user.postal_code || user.postalCode || ''
      });
    }
  }, [user]);

  // Reset donor information to user's profile data
  const resetToProfileData = () => {
    if (user && !user._temp) {
      setDonorInfo({
        firstName: user.first_name || user.firstName || '',
        lastName: user.last_name || user.lastName || '',
        email: user.email || '',
        phone: user.phone_number || user.phoneNumber || '',
        address: user.street_line1 || user.streetLine1 || '',
        zipCode: user.postal_code || user.postalCode || ''
      });
    }
  };

  // Amount validation helpers
  const amountPattern = useMemo(() => /^[0-9]*([.][0-9]{0,2})?$/, []);

  const handleAmountChange = (value: string) => {
    // Allow empty string (so user can clear), otherwise must match pattern
    if (value === '' || amountPattern.test(value)) {
      setAmount(value);
      setAmountError(null);
    } else {
      // Do not update amount, but show a gentle inline error
      setAmountError(t('donatePage.errors.amountDecimals'));
    }
  };

  const normalizeAmountOnBlur = () => {
    if (!amount) return;
    // Normalize to at most two decimals and remove extraneous leading zeros
    const num = Number(amount);
    if (Number.isFinite(num)) {
      const normalized = num.toFixed(2);
      setAmount(normalized);
      setAmountError(null);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!amount || !amountPattern.test(amount)) {
      setAmountError(t('donatePage.errors.amountExample'));
      alert(t('donatePage.errors.amountDecimalsAlert'));
      return;
    }
    const amtValue = parseFloat(amount);
    if (!Number.isFinite(amtValue) || amtValue < 1) {
      setAmountError(t('donatePage.errors.amountMin'));
      alert(t('donatePage.errors.amountMinAlert'));
      return;
    }

    if (!donorInfo.firstName || !donorInfo.lastName) {
      alert(t('donatePage.errors.nameRequired'));
      return;
    }

    // Set processing state
    setIsProcessing(true);
    setPaymentError(null);
    setPaymentSuccess(false);

    try {
      // Handle payment based on selected payment method
      if (paymentMethod === 'card') {
        if (processCardPayment) {
          await processCardPayment();
        } else {
          throw new Error(t('donatePage.errors.cardNotReady'));
        }
      } else if (paymentMethod === 'ach') {
        if (processACHPayment) {
          await processACHPayment();
        } else {
          throw new Error(t('donatePage.errors.achNotReady'));
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('donatePage.errors.unexpected');
      handlePaymentError(errorMessage);
    }
  };

  const handlePaymentSuccess = (donation: any) => {
    setPaymentSuccess(true);
    setIsProcessing(false);
    
    // Reset form
    setAmount('');
    setDonorInfo({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      zipCode: ''
    });
    
    alert(t('donatePage.thankYou', { amount: donation.amount }));
  };

  const handlePaymentError = (error: string) => {
    setPaymentError(error);
    setIsProcessing(false);
  };

  const handlePaymentCancel = () => {
    setIsProcessing(false);
    setPaymentError(null);
  };

  const donationData = useMemo(() => {
    const parsed = parseFloat(amount);
    const safeAmount = Number.isFinite(parsed) ? parsed : 0;
    return {
      amount: safeAmount,
      donation_type: donationType,
      frequency: donationType === 'recurring' ? frequency : undefined,
      payment_method: paymentMethod,
      donor_first_name: donorInfo.firstName,
      donor_last_name: donorInfo.lastName,
      donor_email: donorInfo.email || 'abunearegawitx@gmail.com',
      donor_phone: donorInfo.phone || undefined,
      donor_address: donorInfo.address || undefined,
      donor_zip_code: donorInfo.zipCode || undefined,
    };
  }, [amount, donationType, frequency, paymentMethod, donorInfo]);

  // Shared tiled background style (same as bylaws page)
  const bgStyle: React.CSSProperties = {
    backgroundImage: `url(${process.env.PUBLIC_URL}/bylaws/TigrayOrthodox-background.png)`,
    backgroundRepeat: 'repeat',
    backgroundPosition: 'top left',
    backgroundSize: 'auto',
  };

  return (
    <Elements stripe={stripePromise}>
      <div className="min-h-screen pt-16 py-12 px-4 sm:px-6 lg:px-8" style={bgStyle}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('donatePage.title')}</h1>
          <p className="text-lg text-gray-600">
            {t('donatePage.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Online Donation Form */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">{t('donatePage.onlineDonation')}</h2>
            
            <form onSubmit={handleFormSubmit} className="space-y-6">
                {/* Donation Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('donatePage.howOften')}
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="one-time"
                        checked={donationType === 'one-time'}
                        onChange={(e) => setDonationType(e.target.value as 'one-time' | 'recurring')}
                        className="mr-2"
                      />
                      {t('donatePage.oneTime')}
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="recurring"
                        checked={donationType === 'recurring'}
                        onChange={(e) => setDonationType(e.target.value as 'one-time' | 'recurring')}
                        className="mr-2"
                      />
                      {t('donatePage.recurring')}
                    </label>
                  </div>
                </div>

                {/* Frequency (for recurring) */}
                {donationType === 'recurring' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('donatePage.frequency')}
                    </label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="weekly">{t('donatePage.freq.weekly')}</option>
                      <option value="monthly">{t('donatePage.freq.monthly')}</option>
                      <option value="quarterly">{t('donatePage.freq.quarterly')}</option>
                      <option value="yearly">{t('donatePage.freq.yearly')}</option>
                    </select>
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('donatePage.donationAmount')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      onBlur={normalizeAmountOnBlur}
                      placeholder="0.00"
                      required
                      className="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2"
                    />
                    {amountError && (
                      <p className="mt-1 text-xs text-red-600">{amountError}</p>
                    )}
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('donatePage.paymentMethod')}
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="card"
                        checked={paymentMethod === 'card'}
                        onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'ach')}
                        className="mr-2"
                      />
                      {t('donatePage.cardOption')}
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="ach"
                        checked={paymentMethod === 'ach'}
                        onChange={(e) => setPaymentMethod(e.target.value as 'card' | 'ach')}
                        className="mr-2"
                      />
                      {t('donatePage.achOption')}
                    </label>
                  </div>
                </div>

                {/* Payment Form Fields - Show inline based on payment method */}
                {paymentMethod === 'card' && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{t('donatePage.cardInformation')}</h3>
                    <div className="border border-gray-300 rounded-md p-3 bg-white">
                      <StripePayment
                        donationData={donationData}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        onCancel={handlePaymentCancel}
                        inline={true}
                        onPaymentReady={(fn) => setProcessCardPayment(() => fn)}
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === 'ach' && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{t('donatePage.bankInformation')}</h3>
                    <ACHPayment
                      donationData={donationData}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      onCancel={handlePaymentCancel}
                      inline={true}
                      onPaymentReady={(fn) => setProcessACHPayment(() => fn)}
                    />
                  </div>
                )}

                {/* Donor Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-800">{t('donatePage.donorInformation')}</h3>

                  {user && !user._temp && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-blue-700">
                          <strong>{t('donatePage.prefillNoteLabel')}</strong> {t('donatePage.prefillNoteBody')}
                        </p>
                        <button
                          type="button"
                          onClick={resetToProfileData}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                        >
                          {t('donatePage.resetToProfile')}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('donatePage.firstName')}
                      </label>
                      <input
                        type="text"
                        value={donorInfo.firstName}
                        onChange={(e) => setDonorInfo({...donorInfo, firstName: e.target.value})}
                        required
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('donatePage.lastName')}
                      </label>
                      <input
                        type="text"
                        value={donorInfo.lastName}
                        onChange={(e) => setDonorInfo({...donorInfo, lastName: e.target.value})}
                        required
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('donatePage.email')}
                    </label>
                    <input
                      type="email"
                      value={donorInfo.email}
                      onChange={(e) => setDonorInfo({...donorInfo, email: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('donatePage.phoneNumber')}
                    </label>
                    <input
                      type="tel"
                      value={donorInfo.phone}
                      onChange={(e) => setDonorInfo({...donorInfo, phone: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('donatePage.billingAddress')}
                    </label>
                    <input
                      type="text"
                      value={donorInfo.address}
                      onChange={(e) => setDonorInfo({...donorInfo, address: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('donatePage.zipCode')}
                    </label>
                    <input
                      type="text"
                      value={donorInfo.zipCode}
                      onChange={(e) => setDonorInfo({...donorInfo, zipCode: e.target.value})}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                {/* Authorization */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-sm text-gray-700">
                    {t('donatePage.auth.template', {
                      action: paymentMethod === 'card' ? t('donatePage.auth.chargeCard') : t('donatePage.auth.debitAccount'),
                      recurring: donationType === 'recurring'
                        ? t('donatePage.auth.recurringClause', { frequency: t(`donatePage.freq.${frequency}`) })
                        : '',
                      method: paymentMethod === 'card' ? t('donatePage.auth.methodCard') : t('donatePage.auth.methodAch'),
                    })}
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-200"
                >
                  {isProcessing ? t('donatePage.processing') : t('donatePage.continueToPayment', { amount: amount || '0.00' })}
                </button>
              </form>

            {paymentError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{paymentError}</p>
              </div>
            )}

            {paymentSuccess && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-sm text-green-600">{t('donatePage.paymentSuccessMsg')}</p>
              </div>
            )}
          </div>

          {/* Alternative Payment Methods */}
          <div className="space-y-6">
            {/* Zelle */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">{t('donatePage.zelle.title')}</h3>
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <div className="text-center space-y-4">
                  {/* QR Code */}
                  <div className="flex flex-col items-center">
                    <img
                      src={ZelleQR}
                      alt={t('donatePage.zelle.qrAlt')}
                      className="w-56 h-56 object-contain rounded-md border border-blue-200 bg-white"
                      loading="lazy"
                    />
                    <noscript>
                      <p className="text-xs text-blue-800">
                        {t('donatePage.zelle.imageFallbackPre')}<a className="underline" href={ZelleQR} target="_blank" rel="noreferrer">{t('donatePage.zelle.imageFallbackLink')}</a>.
                      </p>
                    </noscript>
                    <p className="mt-2 text-xs text-blue-800">
                      {t('donatePage.zelle.scanHint')}
                    </p>
                  </div>
                  <div>
                    <span className="text-lg font-bold text-blue-700 block mb-2">{t('donatePage.zelle.emailLabel')}</span>
                    <div 
                      className="bg-white border border-blue-300 rounded-lg p-3 inline-block cursor-pointer hover:bg-blue-50 transition-colors"
                      onClick={(e) => {
                        navigator.clipboard.writeText('abunearegawitx@gmail.com');
                        // Visual feedback
                        const element = e.currentTarget as HTMLElement;
                        if (element) {
                          element.style.backgroundColor = '#dbeafe';
                          setTimeout(() => {
                            element.style.backgroundColor = '';
                          }, 200);
                        }
                      }}
                      title={t('donatePage.zelle.copyTitle')}
                    >
                      <span className="text-lg text-blue-900 font-mono select-all">abunearegawitx@gmail.com</span>
                    </div>
                  </div>
                  
                  <div className="text-left space-y-3">
                    <h4 className="font-semibold text-gray-800">{t('donatePage.zelle.howTitle')}</h4>
                    <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
                      <li>{t('donatePage.zelle.step1')}</li>
                      <li>{t('donatePage.zelle.step2')}</li>
                      <li>{t('donatePage.zelle.step3')} <span className="font-mono text-blue-600">abunearegawitx@gmail.com</span></li>
                      <li>{t('donatePage.zelle.step4')}</li>
                      <li>
                        {t('donatePage.zelle.step5Pre')}<span className="font-medium">{t('donatePage.zelle.step5Memo')}</span>
                        <span className="block text-xs text-blue-800 mt-1">{t('donatePage.zelle.step5Hint')}</span>
                      </li>
                      <li>{t('donatePage.zelle.step6')}</li>
                    </ol>
                  </div>
                  
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-800 font-medium mb-1">{t('donatePage.zelle.quickCopyLabel')}</p>
                    <p className="text-xs text-green-700">
                      {t('donatePage.zelle.quickCopyBody')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Check */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">{t('donatePage.check.title')}</h3>
              <div className="bg-green-50 border border-green-200 rounded p-4 flex flex-col items-center">
                <span className="text-lg font-bold text-green-700">{t('donatePage.check.payableTo')}</span>
                <span className="text-lg text-green-900">{t('donatePage.check.payee')}</span>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">{t('donatePage.questions.title')}</h3>
              <p className="text-gray-600 mb-4">
                {t('donatePage.questions.body')}
              </p>
              <a 
                href="mailto:abunearegawitx@gmail.com" 
                className="text-blue-600 underline hover:text-blue-800"
              >
                abunearegawitx@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>
      </div>
    </Elements>
  );
};

export default DonatePage;

export {}; 