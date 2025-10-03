const { Sequelize } = require('sequelize');

/**
 * Migration: Add new payment types to ledger_entries type enum
 * 
 * Adds 'vow', 'tithe', and 'building_fund' to the enum_ledger_entries_type
 */

async function up(sequelize) {
  console.log('🔄 Adding new payment types to ledger_entries type enum...');

  try {
    // For PostgreSQL, we need to add new values to the enum
    // Note: This only works if the new values don't already exist
    const newTypes = ['vow', 'tithe', 'building_fund'];
    
    for (const newType of newTypes) {
      try {
        await sequelize.query(`
          ALTER TYPE enum_ledger_entries_type ADD VALUE IF NOT EXISTS '${newType}';
        `);
        console.log(`✅ Added '${newType}' to enum_ledger_entries_type`);
      } catch (error) {
        // If the value already exists, that's fine
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  '${newType}' already exists in enum`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Successfully updated ledger_entries type enum');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function down(sequelize) {
  console.log('⚠️  WARNING: Cannot remove enum values in PostgreSQL');
  console.log('ℹ️  Enum values vow, tithe, building_fund will remain in the database');
  // PostgreSQL doesn't support removing enum values
  // You would need to recreate the enum type entirely
}

module.exports = { up, down };

// Allow running directly
if (require.main === module) {
  const { sequelize } = require('../../models');
  
  up(sequelize)
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}
