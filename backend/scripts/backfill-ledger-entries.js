const { Sequelize, DataTypes, Op } = require('sequelize');
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
  logging: console.log, // Enable logging
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  }
});

// Helper function to map old payment types to new ledger categories
const mapPaymentTypeToCategory = (paymentType) => {
  const mapping = {
    'membership_due': 'membership_due',
    'tithe': 'tithe',
    'donation': 'donation',
    'event': 'event_income',
    'building_fund': 'building_fund',
    'other': 'other_income'
  };
  return mapping[paymentType] || 'other_income';
};

// Helper function to map payment methods
const mapPaymentMethod = (method) => {
  const mapping = {
    'cash': 'cash',
    'check': 'check',
    'credit_card': 'credit_card',
    'debit_card': 'debit_card',
    'bank_transfer': 'bank_transfer',
    'zelle': 'zelle',
    'venmo': 'venmo',
    'paypal': 'paypal',
    'other': 'other'
  };
  return mapping[method] || 'other';
};

async function backfillLedgerEntries() {
  console.log('Starting ledger entries backfill...');
  
  // Log database connection info
  const [dbInfo] = await sequelize.query("SELECT current_database() as db, current_schema() as schema, current_user as user;");
  console.log('Connected to database:', dbInfo[0].db);
  console.log('Current schema:', dbInfo[0].schema);
  console.log('Current user:', dbInfo[0].user);
  
  // For debugging, let's not use a transaction
  console.log('Running in non-transactional mode for debugging...');
  const transaction = null; // No transaction
  
  try {
    // 1. Backfill from transactions table (income)
    console.log('Backfilling from transactions table...');
    
    // Log the current state of the ledger_entries table
    const [ledgerCount] = await sequelize.query('SELECT COUNT(*) as count FROM ledger_entries', { transaction });
    console.log(`Current ledger_entries count: ${ledgerCount[0].count}`);
    
    // First, get all transactions that haven't been migrated yet
    const [transactions] = await sequelize.query(`
      SELECT t.*, 
        CASE 
          WHEN t.payment_type = 'building_fund' THEN 'building'::text
          ELSE 'general'::text
        END as fund,
        'income' as type,
        'USD' as currency
      FROM transactions t
      WHERE NOT EXISTS (
        SELECT 1 FROM ledger_entries le 
        WHERE le.external_id = t.external_id 
        AND le.external_id IS NOT NULL
      )
    `, { transaction });
    
    console.log(`Found ${transactions.length} transactions to migrate`);
    
    if (transactions.length === 0) {
      console.log('No transactions found to migrate. Checking if all are already migrated...');
      const [allTransactions] = await sequelize.query('SELECT COUNT(*) as count FROM transactions', { transaction });
      console.log(`Total transactions in database: ${allTransactions[0].count}`);
      
      const [migratedCount] = await sequelize.query(`
        SELECT COUNT(DISTINCT t.id) as count 
        FROM transactions t
        JOIN ledger_entries le ON le.external_id = t.external_id AND le.external_id IS NOT NULL
      `, { transaction });
      
      console.log(`Already migrated: ${migratedCount[0].count}`);
    } else {
      // Log the first transaction to debug column names
      console.log('First transaction sample:', JSON.stringify(transactions[0], null, 2));
    }
    
    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      // Process each transaction to create ledger entries
      for (const tx of batch) {
        // Determine source system based on external ID
        let sourceSystem = 'manual';
        if (tx.external_id) {
          if (tx.external_id.startsWith('stripe_')) {
            sourceSystem = 'stripe';
          } else if (tx.external_id.startsWith('zelle_')) {
            sourceSystem = 'zelle';
          }
        }
        
        // Determine receipt number
        const receiptNumber = (tx.payment_method === 'cash' || tx.payment_method === 'check') ? tx.receipt_number : null;
        
        // Generate a new UUID for the ledger entry
        const [uuidResult] = await sequelize.query('SELECT gen_random_uuid() as uuid', { transaction });
        const newId = uuidResult[0].uuid;
        
        // Insert the ledger entry with the new UUID
        await sequelize.query(
          `INSERT INTO ledger_entries (
            id, entry_date, type, amount, currency, fund, category, 
            memo, member_id, collected_by, source_system, external_id,
            payment_method, receipt_number, bank_txn_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          {
            transaction,
            replacements: [
              newId, // Use the new UUID
              tx.payment_date,
              'income',
              tx.amount,
              'USD',
              tx.payment_type === 'building_fund' ? 'building' : 'general',
              mapPaymentTypeToCategory(tx.payment_type),
              tx.note || null,
              tx.member_id,
              tx.collected_by,
              sourceSystem,
              tx.external_id || null,
              mapPaymentMethod(tx.payment_method),
              receiptNumber,
              null, // bank_txn_id is not in the sample data
              tx.created_at,
              tx.updated_at
            ],
            type: sequelize.QueryTypes.INSERT
          }
        );
      }
      
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(transactions.length / batchSize)}`);
    }
    
    // No transaction to commit in debug mode
    console.log('Processing completed. Verifying results...');
    
    // Verify the records were inserted
    const [result] = await sequelize.query('SELECT COUNT(*) as count FROM ledger_entries');
    console.log(`Total records in ledger_entries: ${result[0].count}`);
    
    if (result[0].count > 0) {
      console.log('Successfully inserted records into the database.');
      // Show a sample of the inserted records
      const [sample] = await sequelize.query('SELECT id, entry_date, type, amount, currency, fund, category FROM ledger_entries LIMIT 5');
      console.log('Sample of inserted records:', JSON.stringify(sample, null, 2));
    } else {
      console.warn('WARNING: No records found in ledger_entries. Check for any errors above.');
    }
    
    console.log('Ledger entries backfill completed!');
  } catch (error) {
    // Just log the error since we're not using a transaction
    console.error('Error during ledger entries backfill:', error);
    throw error;
  }
}

// Run the backfill
backfillLedgerEntries()
  .then(() => {
    console.log('Backfill process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
