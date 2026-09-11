const express = require('express');
const { body } = require('express-validator');
const donationController = require('../controllers/donationController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

const router = express.Router();

// Mirrors the view roles used by the pledge and campaign routers, so who may
// read giving history is one decision rather than three.
const viewRoles = ['admin', 'treasurer', 'church_leadership', 'secretary',
  'bookkeeper', 'auditor', 'budget_committee', 'ar_team', 'ap_team'];

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

// READ ROUTES ARE STAFF-ONLY.
//
// These two were reachable by anyone: the list below was marked "admin only"
// in a comment while carrying no middleware at all, and returned every donor's
// name, email and amount — with the page size chosen by the caller. Giving
// history is among the most sensitive data the church holds, and this file was
// the only financial router without a router.use(firebaseAuthMiddleware).
//
// The guards stay on the individual routes rather than a router-level use(),
// because the two routes above them must remain public: an anonymous giver has
// no token when they reach the payment form.
router.get('/:id',
  firebaseAuthMiddleware,
  roleMiddleware(viewRoles),
  donationController.getDonation
);

router.get('/',
  firebaseAuthMiddleware,
  roleMiddleware(viewRoles),
  donationController.getAllDonations
);

// Webhook is mounted in server.js before body parsers to preserve raw body for signature verification

module.exports = router; 