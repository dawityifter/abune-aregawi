const { sequelize } = require('../../models');

async function fixINC007Mapping() {
  try {
    console.log('🔧 Fixing INC007 payment_type_mapping...');

    // Set schema to public for Supabase
    await sequelize.query(`SET search_path TO public;`);

    // Update INC007 to remove payment_type_mapping (set to NULL)
    // INC007 (Event Hall & Church Item Rental) should not have automatic mapping
    const result = await sequelize.query(`
      UPDATE income_categories 
      SET payment_type_mapping = NULL,
          updated_at = NOW()
      WHERE gl_code = 'INC007';
    `);

    console.log('✅ INC007 mapping fixed successfully');
    console.log('   - INC007 (Event Hall & Church Item Rental) now requires manual selection');
    console.log('   - Only INC003 (Fundraising) maps to "event" payment type');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  fixINC007Mapping()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = fixINC007Mapping;
