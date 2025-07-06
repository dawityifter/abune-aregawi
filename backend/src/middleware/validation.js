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
    .isIn(['Male', 'Female', 'Prefer not to say'])
    .withMessage('Gender must be Male, Female, or Prefer not to say'),
  
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
    .trim()
    .isLength({ max: 200 })
    .withMessage('Spouse name must be less than 200 characters'),
  
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
    .optional()
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
  
  // Children validation
  body('children')
    .optional()
    .isArray()
    .withMessage('Children must be an array'),
  
  body('children.*.firstName')
    .if(body('children').isArray({ min: 1 }))
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Child first name is required and must be between 1 and 100 characters'),
  
  body('children.*.lastName')
    .if(body('children').isArray({ min: 1 }))
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Child last name is required and must be between 1 and 100 characters'),
  
  body('children.*.dateOfBirth')
    .if(body('children').isArray({ min: 1 }))
    .isISO8601()
    .withMessage('Child date of birth must be a valid date'),
  
  body('children.*.gender')
    .if(body('children').isArray({ min: 1 }))
    .isIn(['Male', 'Female'])
    .withMessage('Child gender must be Male or Female')
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