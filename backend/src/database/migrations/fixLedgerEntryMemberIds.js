const { sequelize } = require('../../models');

async function fixLedgerEntryMemberIds() {
  try {
    console.log('🔧 Fixing ledger_entries member_id and collected_by to match members table...');

    // Set schema to public
    await sequelize.query(`SET search_path TO public;`);

    // Check current data types
    const [memberIdType] = await sequelize.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'members' 
      AND column_name = 'id';
    `);

    const [ledgerMemberIdType] = await sequelize.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ledger_entries' 
      AND column_name = 'member_id';
    `);

    console.log('📊 Current schema:');
    console.log(`  members.id: ${memberIdType[0]?.data_type || 'unknown'}`);
    console.log(`  ledger_entries.member_id: ${ledgerMemberIdType[0]?.data_type || 'unknown'}`);

    // Check if there's a mismatch
    if (memberIdType[0]?.data_type === 'uuid' && ledgerMemberIdType[0]?.data_type === 'bigint') {
      console.log('\n⚠️  Schema mismatch detected! Fixing...');
      
      // Step 1: Check if ledger_entries has any data
      const [countResult] = await sequelize.query(`
        SELECT COUNT(*) as count FROM ledger_entries;
      `);
      const count = parseInt(countResult[0].count);
      console.log(`\n📋 Found ${count} existing ledger entries`);

      if (count > 0) {
        console.log('⚠️  WARNING: Existing ledger entries will be cleared to change column types');
        console.log('   (This is safe if ledger entries are regenerated from transactions)');
        
        // Clear existing entries to allow column type change
        await sequelize.query(`TRUNCATE TABLE ledger_entries CASCADE;`);
        console.log('✅ Cleared ledger entries');
      }

      // Step 2: Drop existing foreign key constraints
      console.log('\n📋 Dropping existing foreign key constraints...');
      await sequelize.query(`
        ALTER TABLE ledger_entries 
        DROP CONSTRAINT IF EXISTS ledger_entries_member_id_fkey;
      `);
      await sequelize.query(`
        ALTER TABLE ledger_entries 
        DROP CONSTRAINT IF EXISTS ledger_entries_collected_by_fkey;
      `);
      console.log('✅ Foreign key constraints dropped');

      // Step 3: Change column types to UUID
      console.log('\n📋 Changing column types to UUID...');
      await sequelize.query(`
        ALTER TABLE ledger_entries 
        ALTER COLUMN member_id TYPE UUID USING NULL;
      `);
      await sequelize.query(`
        ALTER TABLE ledger_entries 
        ALTER COLUMN collected_by TYPE UUID USING NULL;
      `);
      console.log('✅ Column types changed to UUID');

      // Step 4: Re-add foreign key constraints
      console.log('\n📋 Re-adding foreign key constraints...');
      await sequelize.query(`
        ALTER TABLE ledger_entries 
        ADD CONSTRAINT ledger_entries_member_id_fkey 
        FOREIGN KEY (member_id) 
        REFERENCES members(id) 
        ON UPDATE CASCADE 
        ON DELETE SET NULL;
      `);
      await sequelize.query(`
        ALTER TABLE ledger_entries 
        ADD CONSTRAINT ledger_entries_collected_by_fkey 
        FOREIGN KEY (collected_by) 
        REFERENCES members(id) 
        ON UPDATE CASCADE 
        ON DELETE SET NULL;
      `);
      console.log('✅ Foreign key constraints re-added');

      console.log('\n✅ Migration completed successfully!');
      console.log('   - ledger_entries.member_id now matches members.id (UUID)');
      console.log('   - ledger_entries.collected_by now matches members.id (UUID)');
      console.log('   - Ledger entries will be regenerated from transactions');
    } else if (memberIdType[0]?.data_type === 'bigint' && ledgerMemberIdType[0]?.data_type === 'bigint') {
      console.log('\n✅ Schema already correct (both BIGINT) - no changes needed');
    } else if (memberIdType[0]?.data_type === 'uuid' && ledgerMemberIdType[0]?.data_type === 'uuid') {
      console.log('\n✅ Schema already correct (both UUID) - no changes needed');
    } else {
      console.log('\n⚠️  Unexpected schema configuration:');
      console.log(`   members.id: ${memberIdType[0]?.data_type}`);
      console.log(`   ledger_entries.member_id: ${ledgerMemberIdType[0]?.data_type}`);
      console.log('   Manual intervention may be required');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  fixLedgerEntryMemberIds()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = fixLedgerEntryMemberIds;
