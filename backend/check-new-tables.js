require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkNewTables() {
  const client = await pool.connect();
  try {
    // Check row counts in _new tables
    const membersNewCount = await client.query('SELECT COUNT(*) FROM members_new');
    console.log(`📊 members_new row count: ${membersNewCount.rows[0].count}`);
    
    const dependentsNewCount = await client.query('SELECT COUNT(*) FROM dependents_new');
    console.log(`📊 dependents_new row count: ${dependentsNewCount.rows[0].count}`);
    
    const transactionsNewCount = await client.query('SELECT COUNT(*) FROM transactions_new');
    console.log(`📊 transactions_new row count: ${transactionsNewCount.rows[0].count}`);
    
    // Check if the migration has already been completed
    const originalMembersCount = await client.query('SELECT COUNT(*) FROM members');
    // Prefer new table name 'dependents', fall back to legacy 'dependants' if needed
    let originalDependentsCount;
    try {
      originalDependentsCount = await client.query('SELECT COUNT(*) FROM dependents');
    } catch (e) {
      originalDependentsCount = await client.query('SELECT COUNT(*) FROM dependants');
    }
    
    console.log('\n📊 Original tables row counts:');
    console.log(`   - members: ${originalMembersCount.rows[0].count}`);
    console.log(`   - dependents: ${originalDependentsCount.rows[0].count}`);
    
    // Check if the new tables have data
    if (membersNewCount.rows[0].count > 0) {
      console.log('\nℹ️  Data found in _new tables. It seems the migration was partially completed.');
      
      // Check if the counts match
      if (membersNewCount.rows[0].count === parseInt(originalMembersCount.rows[0].count)) {
        console.log('✅ members_new count matches members count - data migration appears complete');
      } else {
        console.log(`⚠️  members_new count (${membersNewCount.rows[0].count}) does not match members count (${originalMembersCount.rows[0].count})`);
      }
      
      if (dependentsNewCount.rows[0].count === parseInt(originalDependentsCount.rows[0].count)) {
        console.log('✅ dependents_new count matches dependents count - data migration appears complete');
      } else {
        console.log(`⚠️  dependents_new count (${dependentsNewCount.rows[0].count}) does not match dependents count (${originalDependentsCount.rows[0].count})`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking new tables:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkNewTables().catch(console.error);
