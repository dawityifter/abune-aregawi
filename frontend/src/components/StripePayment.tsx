import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createPaymentIntent, confirmPayment } from '../config/stripe';

interface StripePaymentProps {
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
  // Optional payment purpose coming from Add Payment Screen dropdown
  purpose?: 'membership_due' | 'tithe' | 'donation' | 'event' | 'other';
  // Optional callback to refresh dues/payment history after success
  onRefreshHistory?: () => void;
}

const PaymentForm: React.FC<StripePaymentProps> = ({ 
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
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardElementRef = useRef<HTMLDivElement>(null);
  const cardElementFullRef = useRef<HTMLDivElement>(null);
  // Visible billing inputs for treasurer inline flow
  const [nameOnCard, setNameOnCard] = useState<string>(() => {
    const name = `${donationData.donor_first_name || ''} ${donationData.donor_last_name || ''}`.trim();
    return name;
  });
  const [billingAddress1, setBillingAddress1] = useState<string>(donationData.donor_address || '');
  const [billingPostal, setBillingPostal] = useState<string>(donationData.donor_zip_code || '');

  // Prefill inputs when donationData changes, without overriding user-entered values
  useEffect(() => {
    const suggestedName = `${donationData.donor_first_name || ''} ${donationData.donor_last_name || ''}`.trim();
    if (!nameOnCard && suggestedName) {
      setNameOnCard(suggestedName);
    }
    if (!billingAddress1 && donationData.donor_address) {
      setBillingAddress1(donationData.donor_address);
    }
    if (!billingPostal && donationData.donor_zip_code) {
      setBillingPostal(donationData.donor_zip_code);
    }
  }, [donationData.donor_first_name, donationData.donor_last_name, donationData.donor_address, donationData.donor_zip_code]);

  // Expose payment processing function to parent component
  const processPayment = useCallback(async () => {
    if (!stripe || !elements) {
      const errorMsg = 'Stripe has not loaded yet. Please try again.';
      setError(errorMsg);
      onError(errorMsg);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create payment intent on the backend (attach purpose in metadata)
      const payload = {
        ...donationData,
        metadata: {
          ...(donationData as any).metadata,
          purpose: purpose || 'donation',
          payment_method: donationData.payment_method
        }
      } as typeof donationData & { metadata?: any };

      const { client_secret, payment_intent_id, donation_id } = await createPaymentIntent(payload as any);

      // Confirm the payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            name: nameOnCard || `${donationData.donor_first_name} ${donationData.donor_last_name}`.trim(),
            email: donationData.donor_email,
            phone: donationData.donor_phone,
            address: {
              line1: billingAddress1 || donationData.donor_address,
              postal_code: billingPostal || donationData.donor_zip_code,
            },
          },
        },
      });

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
        onError(stripeError.message || 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        // Confirm payment on backend
        const result = await confirmPayment(payment_intent_id);
        onSuccess({ ...result.donation, payment_intent_id, donation_id });
        // Trigger refresh of dues/payment history after a short delay to allow webhook to persist
        setTimeout(() => {
          try {
            window.dispatchEvent(new CustomEvent('payments:refresh'));
          } catch {}
          if (onRefreshHistory) onRefreshHistory();
        }, 1200);
      } else {
        setError('Payment was not successful. Please try again.');
        onError('Payment was not successful. Please try again.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [stripe, elements, donationData, onSuccess, onError, purpose, onRefreshHistory]);

  // Expose the payment processing function to parent component
  useEffect(() => {
    if (onPaymentReady) {
      onPaymentReady(processPayment);
    }
  }, [onPaymentReady, processPayment]);

  // Removed custom aria-hidden manipulations to avoid conflicts with Stripe Elements internals

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await processPayment();
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
    // We provide our own postal input below
    hidePostalCode: true,
    classes: {
      focus: 'focused',
      invalid: 'invalid',
    },
  };

  if (inline) {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="card-element">
          Card Information
        </label>
        <div 
          ref={cardElementRef}
          className="border border-gray-300 rounded-md p-3 bg-white"
          role="group"
          aria-labelledby="card-element-label"
        >
          <div id="card-element-label" className="sr-only">Credit or debit card information</div>
          <CardElement 
            id="card-element"
            options={cardElementOptions}
            className="stripe-card-element"
          />
        </div>
        {/* Billing details visible inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name-on-card">Name on card</label>
            <input
              id="name-on-card"
              type="text"
              value={nameOnCard}
              onChange={(e) => setNameOnCard(e.target.value)}
              placeholder="Full name as shown on card"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="billing-address1">Billing address</label>
            <input
              id="billing-address1"
              type="text"
              value={billingAddress1}
              onChange={(e) => setBillingAddress1(e.target.value)}
              placeholder="Street address"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="billing-postal">ZIP / Postal code</label>
            <input
              id="billing-postal"
              type="text"
              value={billingPostal}
              onChange={(e) => setBillingPostal(e.target.value)}
              placeholder="ZIP"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-3" role="alert">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Information</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="card-element-full">
            Card Information
          </label>
          <div 
            ref={cardElementFullRef}
            className="border border-gray-300 rounded-md p-3 bg-white"
            role="group"
            aria-labelledby="card-element-full-label"
          >
            <div id="card-element-full-label" className="sr-only">Credit or debit card information</div>
            <CardElement 
              id="card-element-full"
              options={cardElementOptions}
              className="stripe-card-element"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <p className="text-sm text-blue-700">
            <strong>Amount:</strong> ${donationData.amount.toFixed(2)}
          </p>
          <p className="text-sm text-blue-700">
            <strong>Type:</strong> {donationData.donation_type === 'recurring' ? 'Recurring' : 'One-time'}
            {donationData.donation_type === 'recurring' && donationData.frequency && (
              <span> ({donationData.frequency})</span>
            )}
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
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
        >
          {isProcessing ? 'Processing...' : `Pay $${donationData.amount.toFixed(2)}`}
        </button>
      </div>
    </form>
  );
};

const StripePayment: React.FC<StripePaymentProps> = (props) => {
  // Parent is responsible for wrapping with <Elements stripe={stripePromise}>
  return <PaymentForm {...props} />;
};

export default StripePayment; 