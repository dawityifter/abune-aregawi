const express = require('express');
const { body } = require('express-validator');
const donationController = require('../controllers/donationController');

const router = express.Router();

// Validation middleware for donation creation
const validateDonation = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least $1.00'),
  body('donation_type')
    .isIn(['one-time', 'recurring'])
    .withMessage('Donation type must be one-time or recurring'),
  body('payment_method')
    .isIn(['card', 'ach'])
    .withMessage('Payment method must be card or ach'),
  body('donor_first_name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name is required'),
  body('donor_last_name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name is required'),
  body('donor_email')
    .optional({ checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('frequency')
    .optional({ checkFalsy: true })
    .isIn(['weekly', 'monthly', 'quarterly', 'yearly'])
    .withMessage('Frequency must be weekly, monthly, quarterly, or yearly'),
  body('donor_phone')
    .optional({ checkFalsy: true })
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  body('donor_address')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1 })
    .withMessage('Address must not be empty'),
  body('donor_zip_code')
    .optional({ checkFalsy: true })
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Valid ZIP code is required')
];

// Create payment intent
router.post('/create-payment-intent', validateDonation, donationController.createPaymentIntent);

// Confirm payment
router.post('/confirm-payment', donationController.confirmPayment);

// Get donation by ID
router.get('/:id', donationController.getDonation);

// Get all donations (admin only)
router.get('/', donationController.getAllDonations);

// Webhook is mounted in server.js before body parsers to preserve raw body for signature verification

module.exports = router; 