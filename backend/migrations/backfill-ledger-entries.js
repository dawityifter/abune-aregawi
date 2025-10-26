/**
 * Migration Script: Backfill Ledger Entries for Existing Transactions
 * 
 * Purpose: Create ledger_entries for transactions that don't have them
 * Safe to run multiple times - only creates missing entries (idempotent)
 */

const { Transaction, LedgerEntry, IncomeCategory, sequelize } = require('../src/models');

async function backfillLedgerEntries() {
  console.log('🔄 Starting ledger entries backfill migration...\n');

  try {
    // Check if id column is UUID or BIGINT
    console.log('🔧 Checking ledger_entries id column type...');
    const [columnInfo] = await sequelize.query(`
      SELECT data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'ledger_entries' AND column_name = 'id'
    `);
    
    const idType = columnInfo[0]?.data_type;
    console.log(`   ID column type: ${idType}\n`);
    
    if (idType === 'uuid') {
      // Ensure UUID generation is enabled
      console.log('🔧 Setting up UUID generation...');
      
      // Try modern PostgreSQL gen_random_uuid() first, fallback to uuid-ossp extension
      try {
        await sequelize.query(`ALTER TABLE ledger_entries ALTER COLUMN id SET DEFAULT gen_random_uuid();`);
        console.log('✅ UUID generation configured (using gen_random_uuid)\n');
      } catch (err) {
        // Fallback to uuid-ossp extension
        try {
          await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
          await sequelize.query(`ALTER TABLE ledger_entries ALTER COLUMN id SET DEFAULT uuid_generate_v4();`);
          console.log('✅ UUID generation configured (using uuid-ossp)\n');
        } catch (err2) {
          console.error('⚠️ Could not set UUID default, will try manual generation in INSERT');
        }
      }
    } else {
      // Set up sequence for BIGINT/INTEGER
      console.log('🔧 Setting up ledger_entries_id_seq...');
      await sequelize.query(`
        CREATE SEQUENCE IF NOT EXISTS ledger_entries_id_seq;
        SELECT setval('ledger_entries_id_seq', COALESCE((SELECT MAX(id) FROM ledger_entries), 0) + 1, false);
        ALTER TABLE ledger_entries ALTER COLUMN id SET DEFAULT nextval('ledger_entries_id_seq');
      `);
      console.log('✅ Sequence configured\n');
    }
    // Find all transactions that don't have ledger entries
    const transactionsWithoutLedger = await Transaction.findAll({
      include: [
        {
          model: LedgerEntry,
          as: 'ledgerEntries',
          required: false // LEFT JOIN
        }
      ],
      where: sequelize.literal('"ledgerEntries"."id" IS NULL')
    });

    console.log(`📊 Found ${transactionsWithoutLedger.length} transactions without ledger entries\n`);

    if (transactionsWithoutLedger.length === 0) {
      console.log('✅ All transactions already have ledger entries. Nothing to do!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const transaction of transactionsWithoutLedger) {
      try {
        // Double-check that no ledger entry exists (extra safety)
        const existingLedger = await LedgerEntry.findOne({
          where: { transaction_id: transaction.id }
        });

        if (existingLedger) {
          console.log(`⚠️  Skipping transaction ${transaction.id} - ledger entry already exists`);
          continue;
        }

        // Map payment_type to GL code
        const incomeCategory = await IncomeCategory.findOne({
          where: { payment_type_mapping: transaction.payment_type }
        });

        const glCode = incomeCategory?.gl_code || 'INC999'; // Fallback for unmapped types
        const memo = transaction.note || `${glCode} - ${transaction.payment_type}`;

        // Create ledger entry - let PostgreSQL auto-generate the ID (UUID or sequence)
        const [result] = await sequelize.query(`
          INSERT INTO ledger_entries 
            (type, category, amount, entry_date, member_id, payment_method, memo, transaction_id, created_at, updated_at, source_system)
          VALUES 
            (:type, :category, :amount, :entry_date, :member_id, :payment_method, :memo, :transaction_id, NOW(), NOW(), 'stripe')
          RETURNING id
        `, {
          replacements: {
            type: transaction.payment_type,
            category: glCode,
            amount: parseFloat(transaction.amount),
            entry_date: transaction.payment_date,
            member_id: transaction.member_id,
            payment_method: transaction.payment_method,
            memo: memo,
            transaction_id: transaction.id
          }
        });

        successCount++;
        console.log(`✅ Created ledger entry for transaction ${transaction.id} (${transaction.payment_type} → ${glCode})`);

      } catch (error) {
        errorCount++;
        errors.push({
          transactionId: transaction.id,
          error: error.message
        });
        console.error(`❌ Failed to create ledger entry for transaction ${transaction.id}:`, error.message);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total transactions processed: ${transactionsWithoutLedger.length}`);
    console.log(`✅ Successfully created: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(err => {
        console.log(`  - Transaction ${err.transactionId}: ${err.error}`);
      });
    }
    
    console.log('='.repeat(60) + '\n');

    // Verification query
    console.log('🔍 Verification: Checking for remaining transactions without ledger entries...');
    const remaining = await Transaction.findAll({
      include: [
        {
          model: LedgerEntry,
          as: 'ledgerEntries',
          required: false
        }
      ],
      where: sequelize.literal('"ledgerEntries"."id" IS NULL')
    });

    if (remaining.length === 0) {
      console.log('✅ SUCCESS! All transactions now have ledger entries.');
    } else {
      console.log(`⚠️  WARNING: ${remaining.length} transactions still without ledger entries.`);
      console.log('Transaction IDs:', remaining.map(t => t.id).join(', '));
    }

  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    throw error;
  }
}

// Run the migration
(async () => {
  try {
    await backfillLedgerEntries();
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
})();
