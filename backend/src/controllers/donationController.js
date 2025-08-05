const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Donation } = require('../models');
const { validationResult } = require('express-validator');

// Create payment intent for donation
const createPaymentIntent = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      amount,
      currency = 'usd',
      donation_type,
      frequency,
      payment_method,
      donor_first_name,
      donor_last_name,
      donor_email,
      donor_phone,
      donor_address,
      donor_zip_code,
      metadata = {}
    } = req.body;

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least $1.00'
      });
    }

    // Convert amount to cents for Stripe
    const amountInCents = Math.round(parseFloat(amount) * 100);

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency,
      payment_method_types: payment_method === 'ach' ? ['us_bank_account'] : ['card'],
      metadata: {
        donation_type,
        frequency: frequency || '',
        payment_method,
        donor_first_name,
        donor_last_name,
        donor_email,
        donor_phone: donor_phone || '',
        donor_address: donor_address || '',
        donor_zip_code: donor_zip_code || '',
        ...metadata
      }
    });

    // Create donation record in database
    const donation = await Donation.create({
      stripe_payment_intent_id: paymentIntent.id,
      amount: amount,
      currency,
      donation_type,
      frequency,
      payment_method,
      status: 'pending',
      donor_first_name,
      donor_last_name,
      donor_email,
      donor_phone,
      donor_address,
      donor_zip_code,
      metadata
    });

    res.status(200).json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      donation_id: donation.id
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
};

// Confirm payment and update donation status
const confirmPayment = async (req, res) => {
  try {
    const { payment_intent_id } = req.body;

    if (!payment_intent_id) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required'
      });
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    // Find and update donation record
    const donation = await Donation.findOne({
      where: { stripe_payment_intent_id: payment_intent_id }
    });

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    // Update donation status based on Stripe payment intent status
    let status = 'pending';
    if (paymentIntent.status === 'succeeded') {
      status = 'succeeded';
    } else if (paymentIntent.status === 'canceled') {
      status = 'canceled';
    } else if (paymentIntent.status === 'requires_payment_method') {
      status = 'failed';
    }

    await donation.update({
      status,
      stripe_customer_id: paymentIntent.customer || null
    });

    res.status(200).json({
      success: true,
      status,
      donation: {
        id: donation.id,
        amount: donation.amount,
        status: donation.status,
        donor_email: donation.donor_email,
        created_at: donation.created_at
      }
    });

  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment',
      error: error.message
    });
  }
};

// Get donation by ID
const getDonation = async (req, res) => {
  try {
    const { id } = req.params;

    const donation = await Donation.findByPk(id);

    if (!donation) {
      return res.status(404).json({
        success: false,
        message: 'Donation not found'
      });
    }

    res.status(200).json({
      success: true,
      donation: {
        id: donation.id,
        amount: donation.amount,
        status: donation.status,
        donation_type: donation.donation_type,
        frequency: donation.frequency,
        payment_method: donation.payment_method,
        donor_first_name: donation.donor_first_name,
        donor_last_name: donation.donor_last_name,
        donor_email: donation.donor_email,
        created_at: donation.created_at
      }
    });

  } catch (error) {
    console.error('Error getting donation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get donation',
      error: error.message
    });
  }
};

// Get all donations (with pagination)
const getAllDonations = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const { count, rows: donations } = await Donation.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      donations: donations.map(donation => ({
        id: donation.id,
        amount: donation.amount,
        status: donation.status,
        donation_type: donation.donation_type,
        frequency: donation.frequency,
        payment_method: donation.payment_method,
        donor_first_name: donation.donor_first_name,
        donor_last_name: donation.donor_last_name,
        donor_email: donation.donor_email,
        created_at: donation.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error getting donations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get donations',
      error: error.message
    });
  }
};

// Webhook handler for Stripe events
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

// Helper function to handle successful payments
const handlePaymentSucceeded = async (paymentIntent) => {
  const donation = await Donation.findOne({
    where: { stripe_payment_intent_id: paymentIntent.id }
  });

  if (donation) {
    await donation.update({
      status: 'succeeded',
      stripe_customer_id: paymentIntent.customer || null
    });
  }
};

// Helper function to handle failed payments
const handlePaymentFailed = async (paymentIntent) => {
  const donation = await Donation.findOne({
    where: { stripe_payment_intent_id: paymentIntent.id }
  });

  if (donation) {
    await donation.update({
      status: 'failed'
    });
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  getDonation,
  getAllDonations,
  handleWebhook
}; 