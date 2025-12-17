const { Sequelize } = require('sequelize');
require('dotenv').config();

// Debug logging for environment variables
console.log('🔍 Environment Debug Info:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('  DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0);
console.log('  DATABASE_URL preview:', process.env.DATABASE_URL ?
  process.env.DATABASE_URL.substring(0, 20) + '...' + process.env.DATABASE_URL.substring(process.env.DATABASE_URL.length - 20) :
  'NOT SET');

// Database configuration
let sequelize;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

try {
  // Determine database type from URL
  const isPostgres = process.env.DATABASE_URL.startsWith('postgres');
  const isSQLite = process.env.DATABASE_URL.startsWith('sqlite');

  let config = {
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    timezone: '-06:00', // CST timezone offset
    define: {
      timestamps: true,
      underscored: true
    }
  };

  if (isPostgres) {
    // Make SSL optional for local development
    const wantSSL = process.env.DATABASE_SSL === 'true';
    config = {
      ...config,
      dialect: 'postgres',
      pool: {
        max: 5,
        min: 0,
        acquire: 60000,
        idle: 10000,
        evict: 1000,
        handleDisconnects: true
      },
      retry: {
        match: [
          /ConnectionError/,
          /ConnectionRefusedError/,
          /ConnectionTimedOutError/,
          /SequelizeConnectionError/,
          /SequelizeConnectionRefusedError/,
          /SequelizeHostNotFoundError/,
          /SequelizeHostNotReachableError/,
          /SequelizeInvalidConnectionError/,
          /SequelizeConnectionTimedOutError/,
          /SequelizeConnectionAcquireTimeoutError/
        ],
        max: 3,
        timeout: 30000
      },
      dialectOptions: {
        ssl: wantSSL ? {
          require: true,
          rejectUnauthorized: false
        } : false,
        statement_timeout: 10000,
        idle_in_transaction_session_timeout: 10000,
        timezone: '-06:00' // CST timezone offset for PostgreSQL
      }
    };
  } else if (isSQLite) {
    config = {
      ...config,
      dialect: 'sqlite',
      storage: process.env.DATABASE_URL === 'sqlite::memory:' ? ':memory:' : process.env.DATABASE_URL.replace('sqlite:', '')
    };
    delete config.timezone;
  } else {
    throw new Error(`Unsupported database URL format: ${process.env.DATABASE_URL}`);
  }

  // Initialize Sequelize
  sequelize = new Sequelize(process.env.DATABASE_URL, config);
  console.log(`✅ Sequelize instance created successfully (${config.dialect})`);

  // Import models
  const Member = require('./Member')(sequelize);
  const Dependent = require('./Dependent')(sequelize);
  const Transaction = require('./Transaction')(sequelize);
  const MemberPayment = require('./MemberPayment')(sequelize);
  const Donation = require('./Donation')(sequelize);
  const Pledge = require('./Pledge')(sequelize);
  const SmsLog = require('./SmsLog')(sequelize);
  const Group = require('./Group')(sequelize);
  const MemberGroup = require('./MemberGroup')(sequelize);
  const Department = require('./Department')(sequelize);
  const DepartmentMember = require('./DepartmentMember')(sequelize);
  const ZelleMemoMatch = require('./ZelleMemoMatch')(sequelize);
  const Outreach = require('./Outreach')(sequelize);
  const LedgerEntry = require('./LedgerEntry')(sequelize);
  const ExpenseCategory = require('./ExpenseCategory')(sequelize);
  const IncomeCategory = require('./IncomeCategory')(sequelize);
  const Employee = require('./Employee')(sequelize);
  const Vendor = require('./Vendor')(sequelize);
  const ActivityLog = require('./ActivityLog')(sequelize);

  const DepartmentMeeting = require('./DepartmentMeeting')(sequelize);
  const DepartmentTask = require('./DepartmentTask')(sequelize);
  const Voicemail = require('./Voicemail')(sequelize);
  const VolunteerRequest = require('./VolunteerRequest')(sequelize);
  const BankTransaction = require('./BankTransaction')(sequelize);
  const Title = require('./Title')(sequelize);

  // Define models object
  const models = {
    Member,
    Dependent,
    Transaction,
    MemberPayment,
    Donation,
    Pledge,
    SmsLog,
    Group,
    MemberGroup,
    Department,
    DepartmentMember,
    DepartmentMeeting,
    DepartmentTask,
    ZelleMemoMatch,
    Outreach,
    LedgerEntry,
    ExpenseCategory,
    IncomeCategory,
    Employee,
    Vendor,
    ActivityLog,
    Voicemail,
    VolunteerRequest,
    BankTransaction,
    Title
  };

  // Call associate on each model
  Object.values(models).forEach(model => {
    if (typeof model.associate === 'function') {
      model.associate(models);
    }
  });

  // Export models and sequelize instance
  module.exports = {
    sequelize,
    ...models
  };

} catch (error) {
  console.error('❌ Error initializing database:', error.message);
  process.exit(1);
}