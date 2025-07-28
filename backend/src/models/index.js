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
    config = {
      ...config,
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    };
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
const Dependant = require('./Dependant')(sequelize);
const MemberPayment = require('./MemberPayment')(sequelize);

// Define associations
Member.associate({ Dependant, Member, MemberPayment });
Dependant.associate({ Dependant, Member, MemberPayment });
MemberPayment.associate({ Dependant, Member, MemberPayment });

// Export models and sequelize instance
module.exports = {
  sequelize,
  Member,
  Dependant,
  MemberPayment
}; 