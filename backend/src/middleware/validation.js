const { body, param, query } = require('express-validator');

// Member registration validation
exports.validateMemberRegistration = [
  // Personal Information
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required and must be between 1 and 100 characters'),
  
  body('middleName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Middle name must be less than 100 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name is required and must be between 1 and 100 characters'),
  
  body('gender')
    .isIn(['Male', 'Female'])
    .withMessage('Gender must be Male or Female'),
  
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  
  body('maritalStatus')
    .isIn(['Single', 'Married', 'Divorced', 'Widowed'])
    .withMessage('Marital status must be Single, Married, Divorced, or Widowed'),
  
  // Contact & Address
  body('phoneNumber')
    .trim()
    .isLength({ min: 1, max: 25 })
    .withMessage('Phone number is required and must be less than 25 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email must be a valid email address'),
  
  body('streetLine1')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Street address is required and must be less than 255 characters'),
  
  body('city')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City is required and must be less than 100 characters'),
  
  body('state')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('State is required and must be less than 100 characters'),
  
  body('postalCode')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Postal code is required and must be less than 20 characters'),
  
  body('country')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Country is required and must be less than 100 characters'),
  
  // Family Information
  body('isHeadOfHousehold')
    .optional()
    .isBoolean()
    .withMessage('Head of household must be true or false'),
  
  body('spouseName')
    .optional()
    .custom((value, { req }) => {
      // Only validate spouse name if marital status is Married
      if (req.body.maritalStatus === 'Married') {
        if (!value || value.trim() === '') {
          throw new Error('Spouse name is required for married members');
        }
        if (value.trim().length > 200) {
          throw new Error('Spouse name must be less than 200 characters');
        }
      }
      return true;
    })
    .trim(),
  
  body('spouseEmail')
    .optional()
    .custom((value, { req }) => {
      // Only validate spouse email if marital status is Married
      if (req.body.maritalStatus === 'Married') {
        if (!value || value.trim() === '') {
          throw new Error('Spouse email is required for married members');
        }
        // Use a simple email regex for validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new Error('Spouse email must be a valid email address');
        }
      }
      return true;
    })
    .normalizeEmail(),
  
  body('headOfHouseholdEmail')
    .optional()
    .custom(async (value, { req }) => {
      // Only validate head of household email if user is not head of household
      if (!req.body.isHeadOfHousehold) {
        if (!value || value.trim() === '') {
          throw new Error('Head of household email is required when you are not the head of household');
        }
        
        // Use a simple email regex for validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new Error('Head of household email must be a valid email address');
        }
        
        // Check if the email exists in the database and belongs to a head of household
        try {
          const { Member } = require('../models');
          const existingMember = await Member.findOne({
            where: { 
              email: value,
              isHeadOfHousehold: true,
              isActive: true
            }
          });
          
          if (!existingMember) {
            throw new Error('No active head of household found with this email address. Please register as head of household or provide a valid head of household email.');
          }
        } catch (error) {
          if (error.message.includes('No active head of household found')) {
            throw error;
          }
          throw new Error('Error validating head of household email');
        }
      }
      return true;
    })
    .normalizeEmail(),
  
  body('emergencyContactName')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Emergency contact name must be less than 200 characters'),
  
  body('emergencyContactPhone')
    .optional()
    .trim()
    .isLength({ max: 25 })
    .withMessage('Emergency contact phone must be less than 25 characters'),
  
  // Spiritual Information
  body('dateJoinedParish')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Date joined parish must be a valid date'),
  
  body('isBaptized')
    .optional()
    .isBoolean()
    .withMessage('Baptized must be true or false'),
  
  body('baptismDate')
    .optional()
    .isISO8601()
    .withMessage('Baptism date must be a valid date'),
  
  body('isChrismated')
    .optional()
    .isBoolean()
    .withMessage('Chrismated must be true or false'),
  
  body('chrismationDate')
    .optional()
    .isISO8601()
    .withMessage('Chrismation date must be a valid date'),
  
  body('isCommunicantMember')
    .optional()
    .isBoolean()
    .withMessage('Communicant member must be true or false'),
  
  body('spiritualFather')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Spiritual father must be less than 200 characters'),
  
  body('nameDay')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name day must be less than 100 characters'),
  
  body('liturgicalRole')
    .optional()
    .isIn([
      'None',
      'Deacon',
      'Subdeacon',
      'Reader',
      'Choir',
      'Altar Server',
      'Sisterhood',
      'Brotherhood',
      'Other'
    ])
    .withMessage('Invalid liturgical role'),
  
  body('ministries')
    .optional()
    .isArray()
    .withMessage('Ministries must be an array'),
  
  body('languagePreference')
    .isIn(['English', 'Tigrigna', 'Amharic'])
    .withMessage('Language preference must be English, Tigrigna, or Amharic'),
  
  // Contribution
  body('preferredGivingMethod')
    .isIn(['Cash', 'Online', 'Envelope', 'Check'])
    .withMessage('Preferred giving method must be Cash, Online, Envelope, or Check'),
  
  body('titheParticipation')
    .isBoolean()
    .withMessage('Tithe participation must be true or false'),
  
  // Account
  body('firebaseUid')
    .optional()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage('Firebase UID must be less than 128 characters'),
  
  body('loginEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Login email must be a valid email address'),
  
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  
  body('role')
    .optional()
    .isIn([
      'member',
      'accountant',
      'auditor',
      'clergy'
    ])
    .withMessage('Invalid role'),
  
  // Dependants validation - only allow if head of household
  body('dependants')
    .optional()
    .custom((value, { req }) => {
      // Only allow dependants if member is head of household
      if (value && Array.isArray(value) && value.length > 0) {
        if (!req.body.isHeadOfHousehold) {
          throw new Error('Dependants can only be registered by the head of household');
        }
      }
      return true;
    })
    .isArray()
    .withMessage('Dependants must be an array'),
  
  body('dependants.*.firstName')
    .if(body('dependants').isArray({ min: 1 }))
    .if(body('isHeadOfHousehold').equals(true))
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Dependant first name is required and must be between 1 and 100 characters'),
  
  body('dependants.*.lastName')
    .if(body('dependants').isArray({ min: 1 }))
    .if(body('isHeadOfHousehold').equals(true))
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Dependant last name is required and must be between 1 and 100 characters'),
  
  body('dependants.*.dateOfBirth')
    .if(body('dependants').isArray({ min: 1 }))
    .if(body('isHeadOfHousehold').equals(true))
    .isISO8601()
    .withMessage('Dependant date of birth must be a valid date'),
  
  body('dependants.*.gender')
    .if(body('dependants').isArray({ min: 1 }))
    .if(body('isHeadOfHousehold').equals(true))
    .isIn(['Male', 'Female'])
    .withMessage('Dependant gender must be Male or Female'),
  
  body('dependants.*.phone')
    .if(body('dependants').isArray({ min: 1 }))
    .if(body('isHeadOfHousehold').equals(true))
    .optional()
    .trim()
    .isLength({ max: 25 })
    .withMessage('Dependant phone must be less than 25 characters'),
  
  body('dependants.*.email')
    .if(body('dependants').isArray({ min: 1 }))
    .if(body('isHeadOfHousehold').equals(true))
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Dependant email must be a valid email address'),
  
  body('dependants.*.baptismName')
    .if(body('dependants').isArray({ min: 1 }))
    .if(body('isHeadOfHousehold').equals(true))
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Dependant baptism name must be less than 100 characters')
];

// Login validation
exports.validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email must be a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Profile update validation
exports.validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters'),
  
  body('phoneNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 25 })
    .withMessage('Phone number must be less than 25 characters'),
  
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email must be a valid email address'),
  
  body('streetAddress')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Street address must be less than 255 characters'),
  
  body('city')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City must be less than 100 characters'),
  
  body('state')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('State must be less than 100 characters'),
  
  body('postalCode')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Postal code must be less than 20 characters'),

  body('emergencyContactName')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Emergency contact name must be less than 200 characters'),

  body('emergencyContactPhone')
    .optional()
    .trim()
    .isLength({ max: 25 })
    .withMessage('Emergency contact phone must be less than 25 characters')
];

// Member ID validation
exports.validateMemberId = [
  param('id')
    .isUUID()
    .withMessage('Invalid member ID format')
];

// Query validation for member listing
exports.validateMemberQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  query('role')
    .optional()
    .isIn([
      'member',
      'accountant',
      'auditor',
      'clergy'
    ])
    .withMessage('Invalid role filter'),
  
  query('isActive')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isActive must be true or false')
]; 