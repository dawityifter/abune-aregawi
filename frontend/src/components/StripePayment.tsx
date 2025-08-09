import React, { useState, useEffect, useRef } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise, createPaymentIntent, confirmPayment } from '../config/stripe';

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
}

const PaymentForm: React.FC<StripePaymentProps> = ({ 
  donationData, 
  onSuccess, 
  onError, 
  onCancel,
  inline = false
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardElementRef = useRef<HTMLDivElement>(null);
  const cardElementFullRef = useRef<HTMLDivElement>(null);

  // Handle accessibility issues with Stripe CardElement
  useEffect(() => {
    // Remove any conflicting aria-hidden attributes from Stripe elements
    const removeAriaHidden = () => {
      const refs = [cardElementRef.current, cardElementFullRef.current];
      refs.forEach((ref) => {
        if (ref) {
          const stripeElements = ref.querySelectorAll('[data-elements-stable-field-name]');
          stripeElements.forEach((element) => {
            if (element.hasAttribute('aria-hidden')) {
              element.removeAttribute('aria-hidden');
            }
            // Ensure proper focus management
            if (element instanceof HTMLElement) {
              element.setAttribute('tabindex', '0');
            }
          });
        }
      });
    };

    // Run after a short delay to ensure Stripe elements are rendered
    const timeoutId = setTimeout(removeAriaHidden, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe has not loaded yet. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create payment intent on the backend
      const { client_secret, payment_intent_id } = await createPaymentIntent(donationData);

      // Confirm the payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            name: `${donationData.donor_first_name} ${donationData.donor_last_name}`,
            email: donationData.donor_email,
            phone: donationData.donor_phone,
            address: {
              line1: donationData.donor_address,
              postal_code: donationData.donor_zip_code,
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
        onSuccess(result.donation);
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
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm {...props} />
    </Elements>
  );
};

export default StripePayment; 