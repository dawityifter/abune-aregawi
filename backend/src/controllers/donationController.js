// Initialize Stripe with proper error handling
let stripe;
try {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️  STRIPE_SECRET_KEY not found in environment variables. Stripe functionality will be disabled.');
    stripe = null;
  } else {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized successfully');
  }
} catch (error) {
  console.error('❌ Error initializing Stripe:', error.message);
  stripe = null;
}

const { Donation, Member, Transaction, LedgerEntry, IncomeCategory } = require('../models');
const { validationResult } = require('express-validator');
const { parseFullName } = require('../../utils/nameParser');

// Create payment intent for donation
const createPaymentIntent = async (req, res) => {
  try {
    // Check if Stripe is available
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: 'Payment processing is currently unavailable. Please try again later.'
      });
    }

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.warn('⚠️ Payment Intent Validation Failed:', JSON.stringify(errors.array()));
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
      donor_full_name, // New: full name from "Name on Card" or "Account Holder Name"
      donor_email, // Don't default here yet
      donor_phone,
      donor_address,
      donor_zip_code,
      metadata = {}
    } = req.body;

    // Determine final email to use
    let finalEmail = donor_email;

    // If no email provided and we have a memberId, look up member's email
    if (!finalEmail && metadata.memberId) {
      try {
        const member = await Member.findByPk(metadata.memberId);
        if (member && member.email && member.email !== '' && member.email !== 'abunearegawitx@gmail.com') {
          finalEmail = member.email;
          console.log(`📧 Using member's email from database: ${finalEmail} for member ID: ${metadata.memberId}`);
        }
      } catch (err) {
        console.warn('⚠️ Failed to lookup member email:', err.message);
      }
    }

    // If still no email, use default church email
    if (!finalEmail || finalEmail === '') {
      finalEmail = 'abunearegawitx@gmail.com';
      console.log('📧 Using default church email (no member email available or no memberId)');
    }

    // Parse full name if provided (from Name on Card/Account Holder Name)
    // Otherwise fall back to separate first/last names for backward compatibility
    let parsedName = { firstName: null, middleName: null, lastName: null };
    if (donor_full_name) {
      parsedName = parseFullName(donor_full_name);
      console.log(`📝 Parsed name: "${donor_full_name}" → First: "${parsedName.firstName}", Middle: "${parsedName.middleName}", Last: "${parsedName.lastName}"`);
    }

    // Use parsed names, fallback to original fields if parsing didn't happen
    const finalFirstName = parsedName.firstName || donor_first_name || null;
    const finalLastName = parsedName.lastName || donor_last_name || null;
    const finalMiddleName = parsedName.middleName || null;

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least $1.00'
      });
    }

    // Convert amount to cents for Stripe
    const amountInCents = Math.round(parseFloat(amount) * 100);

    // Attempt to find a member by email or phone for metadata linking
    let linkedMember = null;
    try {
      if (finalEmail && finalEmail !== 'abunearegawitx@gmail.com') {
        linkedMember = await Member.findOne({ where: { email: finalEmail } });
      }
      if (!linkedMember && donor_phone) {
        // Ensure phone starts with + for E.164
        const normalizedPhone = donor_phone.startsWith('+') ? donor_phone : `+${donor_phone}`;
        linkedMember = await Member.findOne({ where: { phone_number: normalizedPhone } });
      }
    } catch (memberErr) {
      console.warn('⚠️ Member lookup failed while creating payment intent:', memberErr.message);
    }

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency,
      payment_method_types: payment_method === 'ach' ? ['us_bank_account'] : ['card'],
      metadata: {
        donation_type,
        frequency: frequency || '',
        payment_method,
        donor_first_name: finalFirstName || '',
        donor_last_name: finalLastName || '',
        donor_middle_name: finalMiddleName || '',
        donor_full_name: donor_full_name || '',
        donor_email: finalEmail || '',
        donor_phone: donor_phone || '',
        donor_address: donor_address || '',
        donor_zip_code: donor_zip_code || '',
        // Link to member when possible
        memberId: linkedMember ? String(linkedMember.id) : (metadata.memberId || ''),
        firebaseUid: metadata.firebaseUid || '',
        purpose: metadata.purpose || 'donation',
        year: metadata.year || String(new Date().getFullYear()),
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
      donor_first_name: finalFirstName,
      donor_last_name: finalLastName,
      donor_email: finalEmail,
      donor_phone,
      donor_address,
      donor_zip_code,
      metadata: {
        ...metadata,
        donor_middle_name: finalMiddleName,
        donor_full_name: donor_full_name
      }
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
    // Check if Stripe is available
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: 'Payment processing is currently unavailable. Please try again later.'
      });
    }

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

    // Also upsert a Transaction immediately on success so the Treasurer dashboard reflects it
    // without relying solely on the webhook (which can be delayed or misconfigured in dev)
    try {
      if (status === 'succeeded') {
        await handlePaymentSucceeded(paymentIntent);
      }
    } catch (txnErr) {
      console.warn('⚠️  Failed to upsert Transaction during confirmPayment:', txnErr.message);
    }

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
  // Update donation record if present
  try {
    const donation = await Donation.findOne({
      where: { stripe_payment_intent_id: paymentIntent.id }
    });
    if (donation) {
      await donation.update({
        status: 'succeeded',
        stripe_customer_id: paymentIntent.customer || null
      });
    }
  } catch (e) {
    console.warn('⚠️ Failed updating donation on success:', e.message);
  }

  // Upsert Transaction tied to member for dues/history
  try {
    const md = paymentIntent.metadata || {};

    // Resolve member id
    let memberId = md.memberId ? md.memberId : null;
    if (!memberId && md.firebaseUid) {
      const member = await Member.findOne({ where: { firebase_uid: md.firebaseUid } });
      memberId = member ? member.id : null;
    }

    // As a fallback, try donor_email/phone in metadata
    if (!memberId && md.donor_email) {
      const byEmail = await Member.findOne({ where: { email: md.donor_email } });
      memberId = byEmail ? byEmail.id : memberId;
    }
    if (!memberId && md.donor_phone) {
      const normalizedPhone = md.donor_phone.startsWith('+') ? md.donor_phone : `+${md.donor_phone}`;
      const byPhone = await Member.findOne({ where: { phone_number: normalizedPhone } });
      memberId = byPhone ? byPhone.id : memberId;
    }

    if (!memberId) {
      console.warn('⚠️ Stripe webhook: could not resolve member for paymentIntent', paymentIntent.id);
      return;
    }

    // Map purpose to allowed enum
    const allowedTypes = ['membership_due', 'tithe', 'donation', 'event', 'other'];
    const purpose = (md.purpose || 'donation').toLowerCase();
    const payment_type = allowedTypes.includes(purpose) ? purpose : 'donation';

    // Map method
    const methodRaw = (md.payment_method || md.method || 'card').toLowerCase();
    const payment_method = methodRaw === 'ach' ? 'ach' : 'credit_card';

    // Amount and date
    const amount = (paymentIntent.amount_received || paymentIntent.amount) / 100.0;
    const occurredAt = new Date((paymentIntent.created || Math.floor(Date.now() / 1000)) * 1000);

    // Idempotent upsert by external_id (payment_intent.id)
    const existing = await Transaction.findOne({ where: { external_id: paymentIntent.id } });
    if (existing) {
      // Ensure it matches succeeded status use-case; optionally update
      await existing.update({ amount, payment_date: occurredAt, status: 'succeeded' });

      // Update or create ledger entry for existing transaction
      try {
        const existingLedger = await LedgerEntry.findOne({ where: { transaction_id: existing.id } });

        const incomeCategory = await IncomeCategory.findOne({
          where: { payment_type_mapping: payment_type }
        });
        const glCode = incomeCategory?.gl_code || 'INC999';
        const memo = `${glCode} - Stripe payment ${paymentIntent.id}`;

        if (existingLedger) {
          await existingLedger.update({
            amount: parseFloat(amount),
            entry_date: occurredAt,
            category: glCode,
            memo: memo
          });
          console.log(`✅ Updated existing ledger entry for transaction ${existing.id}`);
        } else {
          await LedgerEntry.create({
            type: payment_type,
            category: glCode,
            amount: parseFloat(amount),
            entry_date: occurredAt,
            member_id: memberId,
            payment_method: payment_method,
            memo: memo,
            transaction_id: existing.id
          });
          console.log(`✅ Created ledger entry for existing transaction ${existing.id}`);
        }
      } catch (ledgerErr) {
        console.error('⚠️ Failed to update/create ledger entry for existing transaction:', ledgerErr.message);
      }

      return;
    }

    const transaction = await Transaction.create({
      member_id: memberId,
      collected_by: memberId, // automated collection – attribute to member
      payment_date: occurredAt,
      amount,
      payment_type,
      payment_method,
      receipt_number: paymentIntent.charges?.data?.[0]?.receipt_number || null,
      note: `Stripe payment ${paymentIntent.id}`,
      external_id: paymentIntent.id,
      status: 'succeeded',
      donation_id: (await Donation.findOne({ where: { stripe_payment_intent_id: paymentIntent.id } }))?.id || null
    });

    // Create corresponding ledger entry
    try {
      // Map payment_type to GL code
      const incomeCategory = await IncomeCategory.findOne({
        where: { payment_type_mapping: payment_type }
      });

      const glCode = incomeCategory?.gl_code || 'INC999'; // Fallback GL code
      const memo = `${glCode} - Stripe payment ${paymentIntent.id}`;

      await LedgerEntry.create({
        type: payment_type,
        category: glCode,
        amount: parseFloat(amount),
        entry_date: occurredAt,
        member_id: memberId,
        payment_method: payment_method,
        memo: memo,
        transaction_id: transaction.id
      });

      console.log(`✅ Created ledger entry for transaction ${transaction.id} with GL code ${glCode}`);
    } catch (ledgerErr) {
      console.error('⚠️ Failed to create ledger entry for Stripe payment:', ledgerErr.message);
      // Don't fail the entire operation if ledger entry creation fails
    }
  } catch (err) {
    console.error('❌ Failed to upsert Transaction on payment success:', err.message);
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
  try {
    const existing = await Transaction.findOne({ where: { external_id: paymentIntent.id } });
    if (existing) {
      await existing.update({ status: 'failed' });
    }
  } catch (e) {
    console.warn('⚠️ Failed updating transaction on payment failure:', e.message);
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  getDonation,
  getAllDonations,
  handleWebhook
}; 