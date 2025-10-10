require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function runMigration() {
  let sequelize;
  
  try {
    console.log('🚀 Running department migration...\n');
    
    // Import models to get sequelize instance
    console.log('📦 Loading models...');
    const models = require('../src/models');
    sequelize = models.sequelize;
    console.log('✅ Models loaded\n');

    // Test database connection
    console.log('🔌 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Import the migration
    console.log('📥 Loading migration file...');
    const migration = require('../src/database/migrations/20250108-create-departments');
    console.log('✅ Migration file loaded\n');

    console.log('📝 Creating departments and department_members tables...');
    
    // Run the up migration
    await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    
    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 Tables created:');
    console.log('  ✓ departments');
    console.log('  ✓ department_members');
    console.log('\n🎉 Department management system is ready to use!');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nFull error:');
    console.error(error);
    
    if (sequelize) {
      await sequelize.close();
    }
    process.exit(1);
  }
}

runMigration();
