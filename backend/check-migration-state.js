require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkMigrationState() {
  const client = await pool.connect();
  try {
    // Check if SequelizeMeta table exists
    const metaTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'SequelizeMeta'
      );
    `);

    if (!metaTableExists.rows[0].exists) {
      console.log('❌ SequelizeMeta table does not exist. No migrations have been applied.');
      return;
    }

    // Get list of applied migrations
    const appliedMigrations = await client.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
    
    console.log('✅ Applied Migrations:');
    if (appliedMigrations.rows.length === 0) {
      console.log('   No migrations have been applied yet.');
    } else {
      appliedMigrations.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.name}`);
      });
    }

    // Check for _new tables from manual migration
    const newTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%_new';
    `);

    if (newTables.rows.length > 0) {
      console.log('\n⚠️  Found _new tables from manual migration:');
      newTables.rows.forEach(row => console.log(`   - ${row.table_name}`));
    }

    // Check for original tables (support both 'dependents' and legacy 'dependants')
    const originalTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('members', 'dependents', 'dependants', 'transactions', 'church_transactions')
      ORDER BY table_name;
    `);

    console.log('\n📊 Current Tables in Database:');
    if (originalTables.rows.length === 0) {
      console.log('   No standard tables found.');
    } else {
      originalTables.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking migration state:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkMigrationState().catch(console.error);
