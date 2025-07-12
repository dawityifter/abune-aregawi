require('dotenv').config();
const { sequelize, Member, Dependant } = require('../models');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const resetDatabase = async () => {
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Warning about data loss
    console.log('⚠️  WARNING: This will DROP ALL TABLES and DELETE ALL DATA!');
    console.log('⚠️  This action cannot be undone!');
    
    const answer = await new Promise((resolve) => {
      rl.question('Are you sure you want to reset the database? Type "YES" to confirm: ', resolve);
    });
    
    if (answer !== 'YES') {
      console.log('❌ Database reset cancelled.');
      rl.close();
      await sequelize.close();
      return;
    }
    
    // Sync all models (drop and recreate tables)
    console.log('🔄 Dropping and recreating database tables...');
    await sequelize.sync({ force: true }); // force: true will drop existing tables
    console.log('✅ Database tables reset successfully.');
    
    console.log('🎉 Database reset completed!');
    console.log('📊 Available tables:');
    console.log('   - members');
    console.log('   - dependants');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  } finally {
    rl.close();
    await sequelize.close();
  }
};

// Run if this file is executed directly
if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase }; 