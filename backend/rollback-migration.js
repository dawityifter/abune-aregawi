require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function rollbackMigration() {
  try {
    console.log('🔄 Rolling back partial migration changes...');

    // Step 1: Drop any _new tables that were created
    console.log('🗑️ Dropping any _new tables...');
    await pool.query('DROP TABLE IF EXISTS transactions_new CASCADE');
    await pool.query('DROP TABLE IF EXISTS dependents_new CASCADE');
    await pool.query('DROP TABLE IF EXISTS members_new CASCADE');
    console.log('✅ Dropped _new tables');

    // Step 2: Check if original tables still exist
    console.log('🔍 Checking original tables...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('members', 'dependants', 'church_transactions')
      ORDER BY table_name
    `);

    console.log('Original tables found:', tables.rows.map(row => row.table_name));

    // Step 3: Verify data integrity
    if (tables.rows.length > 0) {
      console.log('📊 Checking data counts...');
      
      if (tables.rows.some(row => row.table_name === 'members')) {
        const memberCount = await pool.query('SELECT COUNT(*) FROM members');
        console.log(`Members count: ${memberCount.rows[0].count}`);
      }
      
      if (tables.rows.some(row => row.table_name === 'dependants')) {
        const dependantCount = await pool.query('SELECT COUNT(*) FROM dependants');
        console.log(`Dependants count: ${dependantCount.rows[0].count}`);
      }
      
      if (tables.rows.some(row => row.table_name === 'church_transactions')) {
        const transactionCount = await pool.query('SELECT COUNT(*) FROM church_transactions');
        console.log(`Church transactions count: ${transactionCount.rows[0].count}`);
      }
    }

    // Step 4: Reset migration status
    console.log('🔄 Resetting migration status...');
    await pool.query(`
      DELETE FROM "SequelizeMeta" 
      WHERE name IN (
        '20250125000000-refactor-tables-to-bigint.js',
        '20250125000001-simple-refactor-to-bigint.js'
      )
    `);
    console.log('✅ Migration status reset');

    console.log('✅ Rollback completed successfully!');
    console.log('📋 Database is now back to its original state with UUID structure');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

rollbackMigration().catch(console.error); 