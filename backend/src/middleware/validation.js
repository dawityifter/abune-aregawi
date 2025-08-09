const { body, param, query } = require('express-validator');

// Define allowed relationship values
const RELATIONSHIP_VALUES = ['Son', 'Daughter', 'Spouse', 'Parent', 'Sibling', 'Other'];

// Validation for member queries
const validateMemberQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('role').optional().isIn(['member', 'admin', 'church_leadership', 'treasurer', 'secretary']).withMessage('Invalid role filter'),
  query('phone').optional().isString().withMessage('Phone must be a string')
];

// Validation for member ID parameter
const validateMemberId = [
  param('id').isInt({ min: 1 }).withMessage('Member ID must be a positive integer')
];

// Validation for dependent ID parameter
const validateDependentId = [
  param('dependentId').isInt({ min: 1 }).withMessage('Dependent ID must be a positive integer')
];

// Validation for dependent data
const validateDependentData = [
  body('firstName').notEmpty().trim().withMessage('First name is required'),
  body('lastName').notEmpty().trim().withMessage('Last name is required'),
  body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid date'),
  body('gender').optional().isIn(['Male', 'Female']).withMessage('Gender must be Male or Female'),
  body('relationship').optional().isIn(RELATIONSHIP_VALUES).withMessage(`Relationship must be one of: ${RELATIONSHIP_VALUES.join(', ')}`),
  body('phone').optional().isString().withMessage('Phone must be a string'),
  body('email').optional().isEmail().withMessage('Email must be a valid email address'),
  body('baptismName').optional().isString().withMessage('Baptism name must be a string'),
  body('isBaptized').optional().isBoolean().withMessage('Is baptized must be a boolean'),
  body('baptismDate').optional().isISO8601().withMessage('Baptism date must be a valid date'),
  body('nameDay').optional().isString().withMessage('Name day must be a string'),
  body('medicalConditions').optional().isString().withMessage('Medical conditions must be a string'),
  body('allergies').optional().isString().withMessage('Allergies must be a string'),
  body('medications').optional().isString().withMessage('Medications must be a string'),
  body('dietaryRestrictions').optional().isString().withMessage('Dietary restrictions must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string')
];

// Validation for profile updates
const validateProfileUpdate = [
  body('firstName').optional().notEmpty().trim().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().trim().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('Email must be a valid email address'),
  body('phoneNumber').optional().isString().withMessage('Phone number must be a string'),
  body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid date'),
  body('gender').optional().isIn(['male', 'female']).withMessage('Gender must be male or female'),
  body('baptismName').optional().isString().withMessage('Baptism name must be a string'),
  body('repentanceFather').optional().isString().withMessage('Repentance father must be a string'),
  body('householdSize').optional().isInt({ min: 1 }).withMessage('Household size must be a positive integer'),
  body('streetLine1').optional().isString().withMessage('Street line 1 must be a string'),
  body('apartmentNo').optional().isString().withMessage('Apartment number must be a string'),
  body('city').optional().isString().withMessage('City must be a string'),
  body('state').optional().isString().withMessage('State must be a string'),
  body('postalCode').optional().isString().withMessage('Postal code must be a string'),
  body('country').optional().isString().withMessage('Country must be a string'),
  body('emergencyContactName').optional().isString().withMessage('Emergency contact name must be a string'),
  body('emergencyContactPhone').optional().isString().withMessage('Emergency contact phone must be a string'),
  body('dateJoinedParish').optional().isISO8601().withMessage('Date joined parish must be a valid date'),
  body('spouseName').optional().isString().withMessage('Spouse name must be a string'),
  body('familyId').optional().isString().withMessage('Family ID must be a string')
];

// Validation for member registration
const validateMemberRegistration = [
  body('firstName').notEmpty().trim().withMessage('First name is required'),
  body('lastName').notEmpty().trim().withMessage('Last name is required'),
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('email').optional().isEmail().withMessage('Email must be a valid email address'),
  body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid date'),
  body('gender').optional().isIn(['male', 'female']).withMessage('Gender must be male or female'),
  body('maritalStatus').optional().isIn(['single', 'married', 'divorced', 'widowed']).withMessage('Invalid marital status'),
  body('firebaseUid').notEmpty().withMessage('Firebase UID is required'),
  body('role').optional().isIn(['member', 'admin', 'church_leadership', 'treasurer', 'secretary']).withMessage('Invalid role'),
  body('streetLine1').optional().isString().withMessage('Street line 1 must be a string'),
  body('apartmentNo').optional().isString().withMessage('Apartment number must be a string'),
  body('city').optional().isString().withMessage('City must be a string'),
  body('state').optional().isString().withMessage('State must be a string'),
  body('postalCode').optional().isString().withMessage('Postal code must be a string'),
  body('country').optional().isString().withMessage('Country must be a string'),
  body('emergencyContactName').optional().isString().withMessage('Emergency contact name must be a string'),
  body('emergencyContactPhone').optional().isString().withMessage('Emergency contact phone must be a string'),
  body('dateJoinedParish').optional().isISO8601().withMessage('Date joined parish must be a valid date'),
  body('spouseName').optional().isString().withMessage('Spouse name must be a string'),
  body('baptismName').optional().isString().withMessage('Baptism name must be a string'),
  body('repentanceFather').optional().isString().withMessage('Repentance father must be a string'),
  body('householdSize').optional().isInt({ min: 1 }).withMessage('Household size must be a positive integer'),
  body('isHeadOfHousehold').optional().isBoolean().withMessage('Is head of household must be a boolean'),
  body('spouseEmail').optional().isEmail().withMessage('Spouse email must be a valid email address'),
  body('interestedInServing').optional().isIn(['yes', 'no', 'maybe']).withMessage('Interested in serving must be one of: yes, no, maybe'),
  body('ministries').optional().isArray().withMessage('Ministries must be an array'),
  body('languagePreference').optional().isIn(['en', 'ti']).withMessage('Language preference must be en or ti'),
  body('preferredGivingMethod').optional().isIn(['cash', 'check', 'online', 'other']).withMessage('Invalid preferred giving method'),
  body('titheParticipation').optional().isBoolean().withMessage('Tithe participation must be a boolean'),
  // Prefer 'dependents', support legacy 'dependants'
  body('dependents').optional().isArray().withMessage('Dependents must be an array'),
  body('dependants').optional().isArray().withMessage('Dependents must be an array')
];

// Validation for login
const validateLogin = [
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('otp').notEmpty().withMessage('OTP is required')
];

module.exports = {
  validateMemberRegistration,
  validateMemberQuery,
  validateMemberId,
  validateDependentId,
  validateDependentData,
  validateProfileUpdate,
  validateLogin,
  RELATIONSHIP_VALUES
}; 