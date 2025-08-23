const { validationResult } = require('express-validator');
const validation = require('../../src/middleware/validation');

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
  body: jest.fn(() => ({
    trim: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    isEmail: jest.fn().mockReturnThis(),
    isString: jest.fn().mockReturnThis(),
    isInt: jest.fn().mockReturnThis(),
    isFloat: jest.fn().mockReturnThis(),
    normalizeEmail: jest.fn().mockReturnThis(),
    notEmpty: jest.fn().mockReturnThis(),
    isIn: jest.fn().mockReturnThis(),
    isISO8601: jest.fn().mockReturnThis(),
    isBoolean: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
    custom: jest.fn().mockReturnThis(),
    if: jest.fn().mockReturnThis(),
    isArray: jest.fn().mockReturnThis(),
    equals: jest.fn().mockReturnThis(),
    default: jest.fn().mockReturnThis()
  })),
  param: jest.fn(() => ({
    isInt: jest.fn().mockReturnThis(),
    isUUID: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis()
  })),
  query: jest.fn(() => ({
    optional: jest.fn().mockReturnThis(),
    isInt: jest.fn().mockReturnThis(),
    isString: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    trim: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    isIn: jest.fn().mockReturnThis()
  }))
}));

describe('Validation Middleware', () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('handleValidationErrors', () => {
    it('should call next() when no validation errors', () => {
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      validation.handleValidationErrors(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 400 with validation errors when errors exist', () => {
      const mockErrors = [
        { msg: 'Email is required', param: 'email', location: 'body' },
        { msg: 'Password must be at least 6 characters', param: 'password', location: 'body' }
      ];

      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => mockErrors
      });

      validation.handleValidationErrors(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: mockErrors
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle empty errors array', () => {
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => []
      });

      validation.handleValidationErrors(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: []
      });
    });
  });

  describe('validateMemberRegistration', () => {
    it('should be an array of validation middleware', () => {
      expect(Array.isArray(validation.validateMemberRegistration)).toBe(true);
      expect(validation.validateMemberRegistration.length).toBeGreaterThan(0);
    });
  });

  describe('validateLogin', () => {
    it('should be an array of validation middleware', () => {
      expect(Array.isArray(validation.validateLogin)).toBe(true);
      expect(validation.validateLogin.length).toBeGreaterThan(0);
    });
  });

  describe('validateProfileUpdate', () => {
    it('should be an array of validation middleware', () => {
      expect(Array.isArray(validation.validateProfileUpdate)).toBe(true);
      expect(validation.validateProfileUpdate.length).toBeGreaterThan(0);
    });
  });
}); 