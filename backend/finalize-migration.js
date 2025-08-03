require('dotenv').config();
const { Pool } = require('pg');
const readline = require('readline');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let rl;

function createInterface() {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  return rl;
}

function closeInterface() {
  if (rl) {
    rl.close();
    rl = null;
  }
}

function question(query) {
  const rl = createInterface();
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

async function finalizeMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migration finalization...');
    console.log('⚠️  WARNING: This operation cannot be undone!');
    
    // Show current state
    console.log('\n📊 Current table state:');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'members', 'members_new', 'members_old',
        'dependants', 'dependents_new', 'dependents_old',
        'transactions', 'transactions_new', 'transactions_old'
      )
      ORDER BY table_name
    `);
    
    console.table(tables.rows);
    
    // Auto-confirm the migration
    console.log('\n✅ Auto-confirming migration...');
    
    await client.query('BEGIN');
    
    // Step 1: Backup old tables by renaming them
    console.log('\n📦 Backing up old tables...');
    await client.query(`
      DO $$
      BEGIN
        -- Backup old tables if they exist and aren't already backed up
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members') AND 
           NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members_old') THEN
          ALTER TABLE members RENAME TO members_old;
          RAISE NOTICE 'Backed up members to members_old';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dependants') AND 
           NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dependents_old') THEN
          ALTER TABLE dependants RENAME TO dependents_old;
          RAISE NOTICE 'Backed up dependants to dependents_old';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') AND 
           NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions_old') THEN
          ALTER TABLE transactions RENAME TO transactions_old;
          RAISE NOTICE 'Backed up transactions to transactions_old';
        END IF;
      END $$;
    `);
    
    // Step 2: Rename new tables to final names
    console.log('\n🔄 Renaming new tables to final names...');
    await client.query(`
      DO $$
      BEGIN
        -- Rename new tables to final names
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members_new') THEN
          ALTER TABLE members_new RENAME TO members;
          RAISE NOTICE 'Renamed members_new to members';
          
          -- Update sequence if it exists
          IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'members_id_seq') THEN
            PERFORM setval('members_id_seq', (SELECT MAX(id) FROM members));
            RAISE NOTICE 'Updated sequence for members.id';
          ELSE
            RAISE NOTICE 'Sequence members_id_seq does not exist, skipping';
          END IF;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dependents_new') THEN
          ALTER TABLE dependents_new RENAME TO dependents;
          RAISE NOTICE 'Renamed dependents_new to dependents';
          
          -- Update sequence if it exists
          IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'dependents_id_seq') THEN
            PERFORM setval('dependents_id_seq', (SELECT MAX(id) FROM dependents));
            RAISE NOTICE 'Updated sequence for dependents.id';
          ELSE
            RAISE NOTICE 'Sequence dependents_id_seq does not exist, skipping';
          END IF;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions_new') THEN
          ALTER TABLE transactions_new RENAME TO transactions;
          RAISE NOTICE 'Renamed transactions_new to transactions';
          
          -- Update sequence if it exists
          IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'transactions_id_seq') THEN
            PERFORM setval('transactions_id_seq', (SELECT MAX(id) FROM transactions));
            RAISE NOTICE 'Updated sequence for transactions.id';
          ELSE
            RAISE NOTICE 'Sequence transactions_id_seq does not exist, skipping';
          END IF;
        END IF;
      END $$;
    `);
    
    // Step 3: Verify the final state
    console.log('\n🔍 Verifying final table state...');
    const finalTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n✅ Final table state:');
    console.table(finalTables.rows);
    
    // Step 4: Show summary of what was done
    console.log('\n📝 Migration Summary:');
    const summary = await client.query(`
      SELECT 
        'members' as table_name, 
        (SELECT COUNT(*) FROM members) as row_count
      UNION ALL
      SELECT 
        'dependents' as table_name, 
        (SELECT COUNT(*) FROM dependents) as row_count
      UNION ALL
      SELECT 
        'transactions' as table_name, 
        (SELECT COUNT(*) FROM transactions) as row_count
      UNION ALL
      SELECT 
        'members_old' as table_name, 
        (SELECT COUNT(*) FROM members_old) as row_count
      UNION ALL
      SELECT 
        'dependents_old' as table_name, 
        (SELECT COUNT(*) FROM dependents_old) as row_count
    `);
    
    console.table(summary.rows);
    
    // Auto-decide to keep old tables for safety
    const dropOldTables = false; // Set to true to automatically drop old tables
    if (dropOldTables) {
      console.log('\n🗑️  Dropping old backup tables...');
      await client.query(`
        DROP TABLE IF EXISTS members_old CASCADE;
        DROP TABLE IF EXISTS dependents_old CASCADE;
        DROP TABLE IF EXISTS transactions_old CASCADE;
      `);
      console.log('✅ Old backup tables dropped');
    } else {
      console.log('\nℹ️  Old tables were kept with _old suffix');
    }
    
    await client.query('COMMIT');
    console.log('\n🎉 Database migration finalized successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during migration finalization:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    closeInterface();
  }
}

finalizeMigration()
  .then(() => console.log('\n🏁 Migration finalization completed'))
  .catch(error => {
    console.error('\n❌ Migration finalization failed:', error);
    process.exit(1);
  });
