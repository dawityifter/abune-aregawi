require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanup() {
  try {
    console.log('🧹 Cleaning up leftover tables...');
    
    await pool.query('DROP TABLE IF EXISTS transactions_new CASCADE');
    await pool.query('DROP TABLE IF EXISTS dependents_new CASCADE');
    await pool.query('DROP TABLE IF EXISTS members_new CASCADE');
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    await pool.end();
  }
}

cleanup(); 