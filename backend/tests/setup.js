// Mock Firebase Admin - MUST BE AT TOP
jest.mock('firebase-admin', () => {
  return {
    initializeApp: jest.fn(),
    apps: [],
    credential: { cert: jest.fn() },
    auth: () => ({
      verifyIdToken: async () => ({
        uid: 'test-firebase-uid',
        email: 'test@example.com'
      }),
      getUser: async () => ({
        uid: 'test-firebase-uid',
        email: 'test@example.com',
        phoneNumber: '+1234567890'
      })
    })
  };
});

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

    // Tests sync models rather than running migrations, so views must be created
    // here too. PledgeBalance/CampaignTotal disable their own sync()/drop() (see
    // those model files) so sequelize.sync() never manages a real table under
    // these names — createPledgeViews() (which itself does DROP VIEW IF EXISTS
    // before CREATE VIEW) is the only thing that ever touches them.
    const { createPledgeViews } = require('../src/database/pledgeViews');
    await createPledgeViews(sequelize.getQueryInterface());
    console.log('✅ Pledge views created');
  } catch (error) {
    console.error('❌ Test database setup failed:', error);
    throw error;
  }
});

// Tests that call sequelize.sync({ force: true }) themselves (in their own
// beforeAll, after this file's beforeAll already ran) drop and recreate every
// other table; PledgeBalance/CampaignTotal opt out of that (see the sync/drop
// no-ops in their model files), so the views survive untouched. Call this
// afterward anyway so any file exercising pledge balances is explicit about
// depending on fresh views tied to the freshly-synced rows.
global.recreatePledgeViews = async () => {
  const { createPledgeViews } = require('../src/database/pledgeViews');
  await createPledgeViews(sequelize.getQueryInterface());
};

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