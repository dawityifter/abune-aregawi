const dotenv = require('dotenv');

// Load test environment variables FIRST
dotenv.config({ path: '.env.test' });

// Set test environment variables BEFORE requiring models
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

// NOW require models after environment is set
const { sequelize } = require('../src/models');

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  },
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-firebase-uid',
      email: 'test@example.com'
    })
  }))
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id'
    })
  })
}));

// Global test setup
beforeAll(async () => {
  try {
    // Initialize database connection
    await sequelize.authenticate();
    console.log('✅ Test database connection established');

    // Sync database models for testing
    await sequelize.sync({ force: true });
    console.log('✅ Test database synchronized');
  } catch (error) {
    console.error('❌ Test database setup failed:', error);
    throw error;
  }
});

// Global test teardown
afterAll(async () => {
  try {
    // Close database connection
    await sequelize.close();
    console.log('✅ Test database connection closed');
  } catch (error) {
    console.error('❌ Error closing test database:', error);
  }

  // Clean up any remaining connections
  jest.clearAllMocks();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}; 