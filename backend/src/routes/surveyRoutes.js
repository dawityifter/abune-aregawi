'use strict';
const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const { SURVEY_DEFINITIONS, MEMBER_STATUS_OPTIONS } = require('../config/surveyDefinitions/churchServicesAssessment2026');
const { firebaseAuthMiddleware: protect } = require('../middleware/auth');
const authorize = require('../middleware/role');

// Loose enough that multiple family members on the same church wifi can each
// submit without being blocked, while still stopping a scripted flood.
const surveySubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many survey submissions from this IP, please try again later.' }
});

const validateSubmission = [
  body('survey_slug').isIn(Object.keys(SURVEY_DEFINITIONS)).withMessage('Unknown survey_slug'),
  body('locale').isIn(['en', 'ti']).withMessage('locale must be en or ti'),
  body('member_status').optional({ checkFalsy: true }).isIn(MEMBER_STATUS_OPTIONS).withMessage('Invalid member_status'),
  body('answers').isObject().withMessage('answers must be an object')
];

// Public — anonymous, no auth. Rate-limited on top of the global /api/ limiter in server.js.
router.post('/responses', surveySubmitLimiter, validateSubmission, surveyController.submitResponse);

// Admin/secretary/leadership only. Uses the array form of authorize() — see Global Constraints.
router.get('/report', protect, authorize(['admin', 'secretary', 'church_leadership']), surveyController.getReport);

module.exports = router;
