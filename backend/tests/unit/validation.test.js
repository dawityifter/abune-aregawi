const { validationResult } = require('express-validator');
const validation = require('../src/middleware/validation');

// Mock express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn()
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

  describe('validateRegistration', () => {
    it('should validate required fields', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        phoneNumber: '+1234567890'
      };

      // Mock validation chain
      const mockChain = {
        notEmpty: jest.fn().mockReturnThis(),
        isEmail: jest.fn().mockReturnThis(),
        isLength: jest.fn().mockReturnThis(),
        matches: jest.fn().mockReturnThis(),
        custom: jest.fn().mockReturnThis()
      };

      const result = validation.validateRegistration(mockChain);

      expect(mockChain.notEmpty).toHaveBeenCalled();
      expect(mockChain.isEmail).toHaveBeenCalled();
      expect(mockChain.isLength).toHaveBeenCalled();
    });
  });

  describe('validateLogin', () => {
    it('should validate login credentials', () => {
      const mockChain = {
        notEmpty: jest.fn().mockReturnThis(),
        isEmail: jest.fn().mockReturnThis(),
        isLength: jest.fn().mockReturnThis()
      };

      const result = validation.validateLogin(mockChain);

      expect(mockChain.notEmpty).toHaveBeenCalled();
      expect(mockChain.isEmail).toHaveBeenCalled();
    });
  });

  describe('validateProfileUpdate', () => {
    it('should validate profile update data', () => {
      const mockChain = {
        optional: jest.fn().mockReturnThis(),
        isEmail: jest.fn().mockReturnThis(),
        isLength: jest.fn().mockReturnThis(),
        isIn: jest.fn().mockReturnThis(),
        isDate: jest.fn().mockReturnThis()
      };

      const result = validation.validateProfileUpdate(mockChain);

      expect(mockChain.optional).toHaveBeenCalled();
      expect(mockChain.isEmail).toHaveBeenCalled();
    });
  });
}); 