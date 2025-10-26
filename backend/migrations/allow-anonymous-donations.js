/**
 * Migration: Allow Anonymous Donations
 * 
 * Purpose: Make donor name and email fields nullable in donations table
 * to support anonymous donations on the public donate page
 */

const { sequelize } = require('../src/models');

async function allowAnonymousDonations() {
  console.log('🔄 Starting migration: Allow anonymous donations\n');

  try {
    // Alter columns to allow NULL
    await sequelize.query(`
      ALTER TABLE donations 
      ALTER COLUMN donor_first_name DROP NOT NULL,
      ALTER COLUMN donor_last_name DROP NOT NULL,
      ALTER COLUMN donor_email DROP NOT NULL;
    `);

    console.log('✅ Successfully updated donations table:');
    console.log('   - donor_first_name: now nullable');
    console.log('   - donor_last_name: now nullable');
    console.log('   - donor_email: now nullable');
    console.log('\n✅ Anonymous donations are now supported!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
allowAnonymousDonations();
