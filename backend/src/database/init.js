require('dotenv').config();
const { sequelize, Member, Dependent } = require('../models');

const initializeDatabase = async () => {
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Sync all models (create tables if they don't exist)
    console.log('🔄 Syncing database models...');
    console.log('⚠️  WARNING: This will preserve existing data. Use force: true only if you want to drop all tables.');
    await sequelize.sync({ force: false }); // force: false preserves existing data
    console.log('✅ Database tables synchronized successfully.');
    
    console.log('🎉 Database initialization completed!');
    console.log('📊 Available tables:');
    console.log('   - members');
    console.log('   - dependents');
    
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