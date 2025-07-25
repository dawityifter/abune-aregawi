const jwt = require('jsonwebtoken');
const auth = require('../../../src/middleware/auth');

// Mock the request, response, and next function
const mockRequest = (headers = {}) => ({
  headers,
  user: null
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('Token Validation', () => {
    it('should call next() with valid token', () => {
      const token = jwt.sign({ id: 'test-id', email: 'test@example.com' }, 'test-secret');
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();

      auth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('test-id');
      expect(req.user.email).toBe('test@example.com');
    });

    it('should return 401 when no token provided', () => {
      const req = mockRequest();
      const res = mockResponse();

      auth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No token provided'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token format is invalid', () => {
      const req = mockRequest({ authorization: 'InvalidFormat token123' });
      const res = mockResponse();

      auth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token format invalid'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', () => {
      const req = mockRequest({ authorization: 'Bearer invalid-token' });
      const res = mockResponse();

      auth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when token is expired', () => {
      const token = jwt.sign(
        { id: 'test-id', email: 'test@example.com' }, 
        'test-secret', 
        { expiresIn: '1ms' }
      );
      
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();

      // Wait for token to expire
      setTimeout(() => {
        auth(req, res, mockNext);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid token'
        });
        expect(mockNext).not.toHaveBeenCalled();
      }, 10);
    });
  });

  describe('Error Handling', () => {
    it('should handle JWT verification errors', () => {
      const req = mockRequest({ authorization: 'Bearer malformed.token.here' });
      const res = mockResponse();

      auth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
    });

    it('should handle missing JWT_SECRET environment variable', () => {
      delete process.env.JWT_SECRET;
      const token = jwt.sign({ id: 'test-id' }, 'fallback-secret');
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();

      auth(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server configuration error'
      });
    });
  });

  describe('Token Payload Validation', () => {
    it('should validate token with required fields', () => {
      const token = jwt.sign({ 
        id: 'test-id', 
        email: 'test@example.com',
        role: 'member'
      }, 'test-secret');
      
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();

      auth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toHaveProperty('id', 'test-id');
      expect(req.user).toHaveProperty('email', 'test@example.com');
      expect(req.user).toHaveProperty('role', 'member');
    });

    it('should handle token with missing required fields', () => {
      const token = jwt.sign({ email: 'test@example.com' }, 'test-secret');
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();

      auth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(req.user).toHaveProperty('email', 'test@example.com');
      expect(req.user).not.toHaveProperty('id');
    });
  });
}); 