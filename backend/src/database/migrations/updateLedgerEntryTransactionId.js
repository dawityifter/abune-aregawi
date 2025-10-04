const { sequelize } = require('../../models');

async function updateLedgerEntryTransactionId() {
  try {
    console.log('Updating ledger_entries transaction_id column...');

    // Set schema to public for Supabase
    await sequelize.query(`SET search_path TO public;`);

    // Check if ledger_entries table exists
    await sequelize.query(`
      ALTER TABLE ledger_entries 
      ALTER COLUMN transaction_id DROP NOT NULL;
    `);

    console.log('✅ ledger_entries.transaction_id now allows NULL values');
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  updateLedgerEntryTransactionId()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = updateLedgerEntryTransactionId;
