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

  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true,
      underscored: true
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });

  console.log('✅ Sequelize instance created successfully');
} catch (error) {
  console.error('❌ Error creating Sequelize instance:', error.message);
  throw error;
}

// Import models
const Member = require('./Member')(sequelize);
const Dependant = require('./Dependant')(sequelize);

// Define associations
Member.associate({ Dependant, Member });
Dependant.associate({ Dependant, Member });

// Export models and sequelize instance
module.exports = {
  sequelize,
  Member,
  Dependant
}; 