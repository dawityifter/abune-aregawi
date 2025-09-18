const express = require('express');
const { body } = require('express-validator');
const pledgeController = require('../controllers/pledgeController');

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

// Create a new pledge
router.post('/', validatePledge, pledgeController.createPledge);

// Get all pledges (admin only)
router.get('/', pledgeController.getAllPledges);

// Get pledge statistics
router.get('/stats', pledgeController.getPledgeStats);

// Get pledge by ID
router.get('/:id', pledgeController.getPledge);

// Update pledge (admin only)
router.put('/:id', pledgeController.updatePledge);

module.exports = router;
