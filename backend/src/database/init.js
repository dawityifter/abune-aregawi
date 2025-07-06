require('dotenv').config();
const { sequelize, Member, Child } = require('../models');

const initializeDatabase = async () => {
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Sync all models (create tables)
    console.log('🔄 Syncing database models...');
    await sequelize.sync({ force: true }); // force: true will drop existing tables
    console.log('✅ Database tables created successfully.');
    
    console.log('🎉 Database initialization completed!');
    console.log('📊 Available tables:');
    console.log('   - members');
    console.log('   - children');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

// Run if this file is executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase }; 