require('dotenv').config();
const { sequelize, Member, Child } = require('../models');

const testDatabase = async () => {
  try {
    console.log('🧪 Testing database connection...');
    console.log('🔍 Test Environment Debug:');
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    console.log('  DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('  DATABASE_URL preview:', process.env.DATABASE_URL ? 
      process.env.DATABASE_URL.substring(0, 20) + '...' + process.env.DATABASE_URL.substring(process.env.DATABASE_URL.length - 20) : 
      'NOT SET');
    
    console.log(`📊 Database: Connected via DATABASE_URL`);
    
    await sequelize.authenticate();
    console.log('✅ Database connection test successful!');
    
    // Test a simple query
    const result = await sequelize.query('SELECT NOW() as current_time');
    console.log('✅ Database query test successful:', result[0][0]);
    
    await sequelize.close();
    console.log('✅ Database connection closed.');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('❌ Full error:', error);
    process.exit(1);
  }
};

// Run if this file is executed directly
if (require.main === module) {
  testDatabase();
}

module.exports = { testDatabase }; 