import { loadStripe } from '@stripe/stripe-js';

// Load Stripe with your publishable key (guard missing key to avoid runtime errors)
const pk = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
export const stripePromise = pk
  ? loadStripe(pk)
  : (console.warn('[Stripe] Missing REACT_APP_STRIPE_PUBLISHABLE_KEY; Stripe disabled'), Promise.resolve(null));

// API functions for Stripe integration
export const createPaymentIntent = async (donationData: {
  amount: number;
  currency?: string;
  donation_type: 'one-time' | 'recurring';
  frequency?: string;
  payment_method: 'card' | 'ach';
  donor_first_name: string;
  donor_last_name: string;
  donor_email: string;
  donor_phone?: string;
  donor_address?: string;
  donor_zip_code?: string;
  metadata?: any;
}) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/donations/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(donationData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create payment intent');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

export const confirmPayment = async (paymentIntentId: string) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/donations/confirm-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment_intent_id: paymentIntentId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to confirm payment');
    }

    return await response.json();
  } catch (error) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

export const getDonation = async (donationId: string) => {
  try {
    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/donations/${donationId}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get donation');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting donation:', error);
    throw error;
  }
}; 