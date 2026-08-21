const express = require('express');
const { body } = require('express-validator');
const pledgeController = require('../controllers/pledgeController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

const router = express.Router();

// Validation middleware for pledge creation
const validatePledge = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least $1.00'),
  body('pledge_type')
    .optional()
    .isIn(['general', 'event', 'fundraising', 'tithe'])
    .withMessage('Pledge type must be general, event, fundraising, or tithe'),
  body('first_name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name is required'),
  body('last_name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name is required'),
  body('email')
    .custom((value) => {
      // Allow empty, null, or undefined values
      if (!value || value.trim() === '') {
        return true;
      }
      // If value is provided, validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error('Please enter a valid email address');
      }
      return true;
    })
    .optional({ nullable: true, checkFalsy: true }),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('zip_code')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('Valid ZIP code is required')
];

// Same vocabulary as transactionRoutes.js — do not invent new role names.
const viewRoles = ['admin', 'treasurer', 'church_leadership', 'secretary', 'bookkeeper', 'auditor', 'budget_committee', 'ar_team', 'ap_team'];
const editRoles = ['admin', 'treasurer', 'bookkeeper', 'ar_team'];

// Aggregates are public (the progress bar on the public pledge page).
// ?detail=true exposes donor names and requires auth + view role.
const statsAuthGate = (req, res, next) => {
  if (req.query.detail !== 'true') return next();
  return firebaseAuthMiddleware(req, res, (err) =>
    err ? next(err) : roleMiddleware(viewRoles)(req, res, next));
};

// PUBLIC: visitors pledge at events. Rate-limited by the global /api/ limiter.
router.post('/', validatePledge, pledgeController.createPledge);

router.get('/', firebaseAuthMiddleware, roleMiddleware(viewRoles), pledgeController.getAllPledges);

// Get pledge statistics - must come before /:id to avoid wildcard catch
router.get('/stats', statsAuthGate, pledgeController.getPledgeStats);

router.get('/:id', firebaseAuthMiddleware, roleMiddleware(viewRoles), pledgeController.getPledge);
router.put('/:id', firebaseAuthMiddleware, roleMiddleware(editRoles), pledgeController.updatePledge);

module.exports = router;
