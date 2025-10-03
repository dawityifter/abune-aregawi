const { sequelize } = require('../../models');

async function updateLedgerEntryTypeEnum() {
  try {
    console.log('📋 Checking current enum_ledger_entries_type values...');

    // First, let's see what values currently exist
    const currentValues = await sequelize.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'enum_ledger_entries_type'
      )
      ORDER BY enumsortorder;
    `, { type: sequelize.QueryTypes.SELECT });

    console.log('Current enum values:', currentValues.map(v => v.enumlabel));

    console.log('\n🔧 Adding new enum values for ledger_entries.type...');

    // Add new enum values one by one (PostgreSQL doesn't allow adding multiple at once)
    const newValues = [
      'membership_due',
      'offering',
      'tithe',
      'donation',
      'pledge_payment',
      'special_offering',
      'building_fund',
      'mission_fund',
      'other'
    ];

    for (const value of newValues) {
      try {
        // Check if value already exists
        const exists = currentValues.find(v => v.enumlabel === value);
        if (!exists) {
          await sequelize.query(`
            ALTER TYPE enum_ledger_entries_type ADD VALUE IF NOT EXISTS '${value}';
          `);
          console.log(`  ✅ Added: ${value}`);
        } else {
          console.log(`  ⏭️  Skipped (already exists): ${value}`);
        }
      } catch (err) {
        // IF NOT EXISTS clause not supported in older PostgreSQL, so catch and continue
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          console.log(`  ⏭️  Skipped (already exists): ${value}`);
        } else {
          console.log(`  ⚠️  Warning for ${value}: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Enum update completed');

    // Show final enum values
    const finalValues = await sequelize.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'enum_ledger_entries_type'
      )
      ORDER BY enumsortorder;
    `, { type: sequelize.QueryTypes.SELECT });

    console.log('\n📋 Final enum values:', finalValues.map(v => v.enumlabel));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  updateLedgerEntryTypeEnum()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = updateLedgerEntryTypeEnum;
