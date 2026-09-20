'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param } = require('express-validator');
const merchController = require('../controllers/merchController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

const router = express.Router();

// Who may see purchaser contact details and work the fulfillment list. Narrower
// than the donation view roles: this is an operational list, not a financial
// report, so it is the people who actually hand over shirts plus the treasury.
const merchAdminRoles = ['admin', 'treasurer', 'church_leadership', 'secretary', 'bookkeeper'];

/**
 * Same card-testing threat as the donation endpoint: a public endpoint that
 * opens Stripe sessions is a convenient oracle. Sized well above any plausible
 * burst of real ordering — the limiter is per IP and a congregation ordering
 * from the church's WiFi shares one.
 */
const merchLimiter = rateLimit({
  windowMs: Number(process.env.MERCH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.MERCH_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.warn(`⚠️  Merch rate limit reached for ${req.ip} on ${req.originalUrl}`);
    res.status(options.statusCode).json({
      success: false,
      message: 'Too many checkout attempts from this network. Please wait a few minutes and try again.'
    });
  }
});

// Sizes and quantities are checked against the catalog in merchPricingService —
// these only assert the request is shaped like an order at all.
const validateCheckout = [
  body('purchaser_name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required'),
  body('purchaser_email')
    .trim()
    .isEmail()
    .withMessage('A valid email address is required'),
  body('purchaser_phone')
    .optional({ checkFalsy: true })
    .isMobilePhone('any')
    .withMessage('A valid phone number is required'),
  body('event_key')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 }),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Please choose at least one size')
];

// PUBLIC
router.get('/catalog', merchController.getCatalog);
router.post('/checkout-session', merchLimiter, validateCheckout, merchController.createCheckoutSession);

// STAFF ONLY.
// Guards sit on individual routes rather than a router-level use(), because the
// two routes above must stay public: a purchaser has no token.
router.get('/orders',
  firebaseAuthMiddleware,
  roleMiddleware(merchAdminRoles),
  merchController.listOrders
);

router.get('/orders/size-summary',
  firebaseAuthMiddleware,
  roleMiddleware(merchAdminRoles),
  merchController.getSizeSummary
);

router.patch('/orders/:id/fulfillment',
  firebaseAuthMiddleware,
  roleMiddleware(merchAdminRoles),
  param('id').isInt().withMessage('Invalid order id'),
  body('fulfillment_status')
    .isIn(['unfulfilled', 'fulfilled'])
    .withMessage('fulfillment_status must be unfulfilled or fulfilled'),
  merchController.updateFulfillment
);

// Webhook is mounted in server.js before the body parsers to preserve the raw
// body for signature verification.

module.exports = router;
