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
try {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Determine database type from URL
  const isPostgres = process.env.DATABASE_URL.startsWith('postgres');
  const isSQLite = process.env.DATABASE_URL.startsWith('sqlite');
  
  let config = {
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true,
      underscored: true
    }
  };

  if (isPostgres) {
    // Make SSL optional for local development
    const wantSSL = process.env.DATABASE_SSL === 'true';
    const base = {
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
          /TimeoutError/,
          /SASL/
        ],
        max: 3
      }
    };

    if (wantSSL) {
      base.dialectOptions = {
        ssl: {
          require: true,
          rejectUnauthorized: false
        },
        connectTimeout: 60000,
        socketTimeout: 60000
      };
    }

    config = base;
  } else if (isSQLite) {
    config = {
      ...config,
      dialect: 'sqlite',
      storage: process.env.DATABASE_URL === 'sqlite::memory:' ? ':memory:' : process.env.DATABASE_URL.replace('sqlite:', ''),
      logging: process.env.NODE_ENV === 'test' ? false : config.logging
    };
  } else {
    throw new Error(`Unsupported database URL format: ${process.env.DATABASE_URL}`);
  }

  sequelize = new Sequelize(process.env.DATABASE_URL, config);
  console.log(`✅ Sequelize instance created successfully (${config.dialect})`);
} catch (error) {
  console.error('❌ Error creating Sequelize instance:', error.message);
  throw error;
}

// Import models
const Member = require('./Member')(sequelize);
const Dependent = require('./Dependent')(sequelize);
const Transaction = require('./Transaction')(sequelize);
const MemberPayment = require('./MemberPayment')(sequelize);
const Donation = require('./Donation')(sequelize);
const Pledge = require('./Pledge')(sequelize);
const Outreach = require('./Outreach')(sequelize);
const SmsLog = require('./SmsLog')(sequelize);
const Group = require('./Group')(sequelize);
const MemberGroup = require('./MemberGroup')(sequelize);
const ZelleMemoMatch = require('./ZelleMemoMatch')(sequelize);

// Define associations
Member.associate({ Dependent, Member, Transaction, MemberPayment, Donation, Pledge, SmsLog, Group, MemberGroup, ZelleMemoMatch, Outreach });
Dependent.associate({ Dependent, Member, Transaction, MemberPayment, Donation, Pledge, SmsLog, Group, MemberGroup, ZelleMemoMatch, Outreach });
Transaction.associate({ Dependent, Member, Transaction, MemberPayment, Donation, Pledge, SmsLog, Group, MemberGroup, ZelleMemoMatch, Outreach });
MemberPayment.associate({ Dependent, Member, Transaction, MemberPayment, Donation, Pledge, SmsLog, Group, MemberGroup, ZelleMemoMatch, Outreach });
Donation.associate({ Dependent, Member, Transaction, MemberPayment, Donation, Pledge, SmsLog, Group, MemberGroup, ZelleMemoMatch, Outreach });
Pledge.associate({ Dependent, Member, Transaction, MemberPayment, Donation, Pledge, SmsLog, Group, MemberGroup, ZelleMemoMatch, Outreach });
Outreach.associate({ Dependent, Member, Transaction, MemberPayment, Donation, Pledge, SmsLog, Group, MemberGroup, ZelleMemoMatch, Outreach });
if (typeof Group.associate === 'function') {
  Group.associate({ Dependent, Member, Transaction, MemberPayment, Donation, SmsLog, Group, MemberGroup, ZelleMemoMatch });
}
if (typeof MemberGroup.associate === 'function') {
  MemberGroup.associate({ Dependent, Member, Transaction, MemberPayment, Donation, SmsLog, Group, MemberGroup, ZelleMemoMatch });
}
if (typeof ZelleMemoMatch.associate === 'function') {
  ZelleMemoMatch.associate({ Dependent, Member, Transaction, MemberPayment, Donation, SmsLog, Group, MemberGroup, ZelleMemoMatch });
}

// Export models and sequelize instance
module.exports = {
  sequelize,
  Member,
  Dependent,
  Transaction,
  MemberPayment,
  Donation,
  Pledge,
  Outreach,
  SmsLog,
  Group,
  MemberGroup,
  ZelleMemoMatch
}; 