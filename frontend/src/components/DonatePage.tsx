import React, { useState, useEffect, useMemo } from 'react';
import ZelleQR from '../assets/AbuneAregawiZelle.png';
import StripePayment from './StripePayment';
import ACHPayment from './ACHPayment';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '../config/stripe';
import { usePledgeBalance } from '../hooks/usePledgeBalance';

/**
 * Suggested gifts. Stored already normalised to two decimals so tapping a
 * preset and typing the same figure by hand produce identical state — the
 * amount field normalises on blur, and a mismatch would un-highlight the
 * preset the member just chose.
 */
const PRESET_AMOUNTS = ['25.00', '50.00', '100.00', '250.00'];

const DonatePage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { balance: pledgeBalance } = usePledgeBalance();
  const [applyToPledge, setApplyToPledge] = useState(false);

  // Only worth offering while money is actually owed on a pledge. An errored
  // lookup leaves balance null, so the option simply does not appear — a
  // payment page must never break because of this.
  const canApplyToPledge = Boolean(user && pledgeBalance && pledgeBalance.remaining_amount > 0);
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

  const handlePresetClick = (preset: string) => {
    setAmount(preset);
    setAmountError(null);
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


  return (
    <Elements stripe={stripePromise}>
      <div className="min-h-screen pt-top-nav py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-accent-700 mb-3">{t('donatePage.title')}</h1>
          <p className="text-lg text-accent-500">
            {t('donatePage.subtitle')}
          </p>
        </div>

        <div className="space-y-8">
          {/* Online Donation Form */}
          <div className="card">
            <h2 className="font-serif text-2xl font-semibold text-accent-700 mb-6">{t('donatePage.onlineDonation')}</h2>
            
            <form onSubmit={handleFormSubmit} className="space-y-6">
                {/* Amount first: it is the decision the member came to make.
                    The form used to open on an empty $0.00 field, below two
                    other questions, with no suggested amounts at all. */}
                <div>
                  <label htmlFor="donation-amount" className="block text-sm font-semibold text-accent-700 mb-2">
                    {t('donatePage.donationAmount')}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_AMOUNTS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePresetClick(preset)}
                        aria-pressed={amount === preset}
                        className={`min-h-[48px] rounded-md border-2 font-semibold tabular-nums transition-colors ${
                          amount === preset
                            ? 'border-primary-700 bg-primary-50 text-primary-700'
                            : 'border-accent-200 bg-accent-50 text-accent-700 hover:border-accent-300'
                        }`}
                      >
                        ${Number(preset).toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <div className="relative mt-3">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-500" aria-hidden="true">$</span>
                    <input
                      id="donation-amount"
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      onBlur={normalizeAmountOnBlur}
                      placeholder={t('donatePage.otherAmount')}
                      required
                      aria-describedby={amountError ? 'donation-amount-error' : undefined}
                      className="w-full min-h-[48px] border border-accent-200 rounded-md pl-8 pr-3 py-2 text-lg tabular-nums"
                    />
                  </div>
                  {amountError && (
                    <p id="donation-amount-error" className="mt-1 text-sm text-primary-700">{amountError}</p>
                  )}
                </div>

                {/* Donation Type */}
                <div>
                  <span className="block text-sm font-semibold text-accent-700 mb-2">
                    {t('donatePage.howOften')}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['one-time', 'recurring'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setDonationType(option)}
                        aria-pressed={donationType === option}
                        className={`min-h-[48px] rounded-md border-2 font-semibold transition-colors ${
                          donationType === option
                            ? 'border-primary-700 bg-primary-50 text-primary-700'
                            : 'border-accent-200 bg-accent-50 text-accent-700 hover:border-accent-300'
                        }`}
                      >
                        {option === 'one-time' ? t('donatePage.oneTime') : t('donatePage.recurring')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frequency (for recurring) */}
                {donationType === 'recurring' && (
                  <div>
                    <label htmlFor="donation-frequency" className="block text-sm font-semibold text-accent-700 mb-2">
                      {t('donatePage.frequency')}
                    </label>
                    <select
                      id="donation-frequency"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="w-full min-h-[48px] border border-accent-200 rounded-md px-3 py-2"
                    >
                      <option value="weekly">{t('donatePage.freq.weekly')}</option>
                      <option value="monthly">{t('donatePage.freq.monthly')}</option>
                      <option value="quarterly">{t('donatePage.freq.quarterly')}</option>
                      <option value="yearly">{t('donatePage.freq.yearly')}</option>
                    </select>
                  </div>
                )}

                {canApplyToPledge && pledgeBalance && (
                  <div className="mb-6 rounded-lg border border-primary-200 bg-primary-50 p-4">
                    <label htmlFor="applyToPledge" className="flex items-start gap-3 cursor-pointer">
                      <input
                        id="applyToPledge"
                        type="checkbox"
                        checked={applyToPledge}
                        onChange={(e) => setApplyToPledge(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block font-medium text-accent-700">
                          {t('donatePage.applyToPledge')}
                        </span>
                        <span className="block text-sm text-accent-700">
                          {t('donatePage.pledgeRemaining', {
                            amount: `$${pledgeBalance.remaining_amount.toLocaleString()}`,
                            campaign: pledgeBalance.campaign_name
                          })}
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-semibold text-accent-700 mb-2">
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
                  <div className="bg-accent-100 p-4 rounded-md">
                    <div className="border border-accent-200 rounded-md p-3 bg-accent-50">
                      <StripePayment
                        donationData={donationData}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        onCancel={handlePaymentCancel}
                        inline={true}
                        onPaymentReady={(fn) => setProcessCardPayment(() => fn)}
                        purpose={applyToPledge ? 'pledge_drive' : 'donation'}
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === 'ach' && (
                  <div className="bg-accent-100 p-4 rounded-md">
                    <h3 className="font-serif text-lg font-semibold text-accent-700 mb-4">{t('donatePage.bankInformation')}</h3>
                    <ACHPayment
                      donationData={donationData}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      onCancel={handlePaymentCancel}
                      inline={true}
                      onPaymentReady={(fn) => setProcessACHPayment(() => fn)}
                      purpose={applyToPledge ? 'pledge_drive' : 'donation'}
                    />
                  </div>
                )}

                {/* Donor Information */}
                <div className="space-y-4">
                  <h3 className="font-serif text-lg font-semibold text-accent-700">{t('donatePage.donorInformation')}</h3>

                  {user && !user._temp && (
                    <div className="bg-tsaeda-50 border border-tsaeda-200 rounded-md p-3 mb-4">
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-tsaeda-700">
                          <strong>{t('donatePage.prefillNoteLabel')}</strong> {t('donatePage.prefillNoteBody')}
                        </p>
                        <button
                          type="button"
                          onClick={resetToProfileData}
                          className="text-xs bg-tsaeda-600 hover:bg-tsaeda-700 text-white px-3 py-1.5 rounded-md transition-colors"
                        >
                          {t('donatePage.resetToProfile')}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-accent-700 mb-2">
                        {t('donatePage.firstName')}
                      </label>
                      <input
                        type="text"
                        value={donorInfo.firstName}
                        onChange={(e) => setDonorInfo({...donorInfo, firstName: e.target.value})}
                        required
                        className="w-full min-h-[48px] border border-accent-200 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-accent-700 mb-2">
                        {t('donatePage.lastName')}
                      </label>
                      <input
                        type="text"
                        value={donorInfo.lastName}
                        onChange={(e) => setDonorInfo({...donorInfo, lastName: e.target.value})}
                        required
                        className="w-full min-h-[48px] border border-accent-200 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-accent-700 mb-2">
                      {t('donatePage.email')}
                    </label>
                    <input
                      type="email"
                      value={donorInfo.email}
                      onChange={(e) => setDonorInfo({...donorInfo, email: e.target.value})}
                      className="w-full min-h-[48px] border border-accent-200 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-accent-700 mb-2">
                      {t('donatePage.phoneNumber')}
                    </label>
                    <input
                      type="tel"
                      value={donorInfo.phone}
                      onChange={(e) => setDonorInfo({...donorInfo, phone: e.target.value})}
                      className="w-full min-h-[48px] border border-accent-200 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-accent-700 mb-2">
                      {t('donatePage.billingAddress')}
                    </label>
                    <input
                      type="text"
                      value={donorInfo.address}
                      onChange={(e) => setDonorInfo({...donorInfo, address: e.target.value})}
                      className="w-full min-h-[48px] border border-accent-200 rounded-md px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-accent-700 mb-2">
                      {t('donatePage.zipCode')}
                    </label>
                    <input
                      type="text"
                      value={donorInfo.zipCode}
                      onChange={(e) => setDonorInfo({...donorInfo, zipCode: e.target.value})}
                      className="w-full min-h-[48px] border border-accent-200 rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                {/* Authorization */}
                <div className="bg-accent-100 p-4 rounded-md">
                  <p className="text-sm text-accent-500">
                    {t('donatePage.auth.template', {
                      action: paymentMethod === 'card' ? t('donatePage.auth.chargeCard') : t('donatePage.auth.debitAccount'),
                      recurring: donationType === 'recurring'
                        ? t('donatePage.auth.recurringClause', { frequency: t(`donatePage.freq.${frequency}`) })
                        : '',
                      method: paymentMethod === 'card' ? t('donatePage.auth.methodCard') : t('donatePage.auth.methodAch'),
                    })}
                  </p>
                </div>

                {/* The button used to read "Continue to Payment - $0.00" in
                    Stripe's default blue — a colour used nowhere else on the
                    site, naming an amount of nothing. It now says what will
                    happen, in the parish's own red. */}
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="btn btn-primary btn-block text-lg disabled:bg-accent-400"
                >
                  {isProcessing
                    ? t('donatePage.processing')
                    : amount
                      ? t('donatePage.giveAmount', { amount: Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) })
                      : t('donatePage.giveNoAmount')}
                </button>
              </form>

            {paymentError && (
              <div className="mt-4 bg-primary-50 border border-primary-200 rounded-md p-3">
                <p className="text-sm text-primary-700">{paymentError}</p>
              </div>
            )}

            {paymentSuccess && (
              <div className="mt-4 bg-tsaeda-50 border border-tsaeda-200 rounded-md p-3">
                <p className="text-sm text-tsaeda-700">{t('donatePage.paymentSuccessMsg')}</p>
              </div>
            )}
          </div>

          {/* Alternative Payment Methods.
              Behind a disclosure rather than beside the form: Zelle and cheque
              are still one tap away, but they no longer compete with the card
              path for a member who just wants to give and be done. */}
          <details className="rounded-md border border-accent-200 bg-accent-50 p-6">
            <summary className="cursor-pointer list-none font-semibold text-tsaeda-600 marker:hidden">
              {t('donatePage.otherWaysToGive')}
            </summary>
            <div className="mt-6 space-y-6">
            {/* Zelle */}
            <div className="card">
              <h3 className="font-serif text-xl font-semibold text-accent-700 mb-4">{t('donatePage.zelle.title')}</h3>
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
            <div className="card">
              <h3 className="font-serif text-xl font-semibold text-accent-700 mb-4">{t('donatePage.check.title')}</h3>
              <div className="bg-accent-100 border border-accent-200 rounded-md p-4 flex flex-col items-center">
                <span className="text-lg font-bold text-accent-700">{t('donatePage.check.payableTo')}</span>
                <span className="text-lg text-accent-700">{t('donatePage.check.payee')}</span>
              </div>
            </div>

            {/* Contact Info */}
            <div className="card">
              <h3 className="font-serif text-xl font-semibold text-accent-700 mb-4">{t('donatePage.questions.title')}</h3>
              <p className="text-accent-500 mb-4">
                {t('donatePage.questions.body')}
              </p>
              <a 
                href="mailto:abunearegawitx@gmail.com" 
                className="text-tsaeda-600 underline hover:text-tsaeda-700"
              >
                abunearegawitx@gmail.com
              </a>
            </div>
            </div>
          </details>
        </div>
      </div>
      </div>
    </Elements>
  );
};

export default DonatePage;

export {}; 