const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Get database URL from environment variables
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Initialize Sequelize
const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // Disable logging for cleaner output
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  }
});

async function dryRunMigration() {
  console.log('=== DRY RUN: LEDGER MIGRATION ANALYSIS ===\n');
  
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✓ Connected to database successfully');
    
    // Check if ledger_entries table exists
    const [tableExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ledger_entries'
      );
    `);
    
    if (tableExists[0].exists) {
      console.log('⚠️  Warning: ledger_entries table already exists');
      const [count] = await sequelize.query('SELECT COUNT(*) FROM ledger_entries;');
      console.log(`   Existing records in ledger_entries: ${count[0].count}\n`);
    } else {
      console.log('✓ ledger_entries table does not exist yet (expected)\n');
    }
    
    // Analyze transactions table
    console.log('=== TRANSACTIONS ANALYSIS ===');
    const [transactionsCount] = await sequelize.query('SELECT COUNT(*) FROM transactions;');
    console.log(`Total transactions to migrate: ${transactionsCount[0].count}`);
    
    // Show payment type distribution
    const [paymentTypes] = await sequelize.query(`
      SELECT payment_type, COUNT(*) as count 
      FROM transactions 
      GROUP BY payment_type 
      ORDER BY count DESC;
    `);
    console.log('\nPayment type distribution:');
    console.table(paymentTypes);
    
    // Show sample transactions
    const [sampleTx] = await sequelize.query('SELECT * FROM transactions LIMIT 3;');
    console.log('\nSample transactions (first 3 records):');
    console.table(sampleTx.map(tx => ({
      id: tx.id,
      payment_type: tx.payment_type,
      amount: tx.amount,
      member_id: tx.member_id,
      payment_date: tx.payment_date
    })));
    
    // Show estimated ledger entries summary
    console.log('\n=== ESTIMATED LEDGER ENTRIES ===');
    const totalEntries = parseInt(transactionsCount[0].count);
    console.log(`Total ledger entries to be created: ${totalEntries}`);
    
    console.log('\n=== DRY RUN COMPLETE ===');
    console.log('No changes were made to the database.');
    console.log('To proceed with the actual migration, run:');
    console.log('1. npx sequelize-cli db:migrate');
    console.log('2. node scripts/backfill-ledger-entries.js');
    
  } catch (error) {
    console.error('Error during dry run:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

// Run the dry run
dryRunMigration();
