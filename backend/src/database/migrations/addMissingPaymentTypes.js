const { sequelize } = require('../../models');

async function addMissingPaymentTypes() {
  try {
    console.log('🔧 Adding missing payment types to enum...');

    // Set schema to public for Supabase
    await sequelize.query(`SET search_path TO public;`);

    // Get current enum values
    const currentValues = await sequelize.query(`
      SELECT unnest(enum_range(NULL::enum_transactions_payment_type)) as value;
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('Current enum values:', currentValues.map(v => v.value));

    // Add missing payment types: offering, vow, building_fund
    const typesToAdd = ['offering', 'vow', 'building_fund'];
    
    for (const type of typesToAdd) {
      const exists = currentValues.some(v => v.value === type);
      if (!exists) {
        console.log(`\n📋 Adding payment type: ${type}...`);
        await sequelize.query(`
          ALTER TYPE enum_transactions_payment_type 
          ADD VALUE IF NOT EXISTS '${type}';
        `);
        console.log(`✅ Added: ${type}`);
      } else {
        console.log(`ℹ️  ${type} already exists`);
      }
    }

    // Verify final enum values
    const finalValues = await sequelize.query(`
      SELECT unnest(enum_range(NULL::enum_transactions_payment_type)) as value;
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('\n✅ Migration completed successfully!');
    console.log('Final enum values:', finalValues.map(v => v.value));
    console.log('\nSupported payment types:');
    console.log('  - membership_due: Membership fees');
    console.log('  - tithe: Tithes');
    console.log('  - offering: Weekly offerings');
    console.log('  - donation: General donations');
    console.log('  - vow: Vows (Selet)');
    console.log('  - building_fund: Building fund contributions');
    console.log('  - event: Event-related payments');
    console.log('  - other: Other payments');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addMissingPaymentTypes()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = addMissingPaymentTypes;
