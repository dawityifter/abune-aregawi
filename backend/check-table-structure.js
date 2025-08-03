require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTableStructure() {
  const client = await pool.connect();
  try {
    // Check structure of dependants table
    console.log('🔍 Checking dependants table structure...');
    const dependantsStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'dependants';
    `);
    
    console.log('\n📋 dependants table structure:');
    console.table(dependantsStructure.rows);
    
    // Check structure of dependents_new table
    console.log('\n🔍 Checking dependents_new table structure...');
    const dependentsNewStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'dependents_new';
    `);
    
    console.log('\n📋 dependents_new table structure:');
    console.table(dependentsNewStructure.rows);
    
    // Check sample data from dependants table
    console.log('\n📊 Sample data from dependants table:');
    const sampleDependants = await client.query('SELECT * FROM dependants LIMIT 5');
    console.table(sampleDependants.rows);
    
    // Check foreign key relationships
    console.log('\n🔗 Foreign key relationships for dependants:');
    const fkInfo = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE 
        tc.constraint_type = 'FOREIGN KEY' 
        AND (tc.table_name = 'dependants' OR ccu.table_name = 'dependants');
    `);
    
    console.log('\n🔗 Foreign key relationships:');
    console.table(fkInfo.rows);
    
  } catch (error) {
    console.error('❌ Error checking table structure:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTableStructure().catch(console.error);
