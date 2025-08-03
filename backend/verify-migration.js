require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyMigration() {
  const client = await pool.connect();
  try {
    console.log('🔍 Verifying database migration...');

    // Check row counts
    const [
      membersCount,
      membersNewCount,
      dependantsCount,
      dependentsNewCount,
      transactionsCount,
      transactionsNewCount
    ] = await Promise.all([
      client.query('SELECT COUNT(*) FROM members'),
      client.query('SELECT COUNT(*) FROM members_new'),
      client.query('SELECT COUNT(*) FROM dependants'),
      client.query('SELECT COUNT(*) FROM dependents_new'),
      client.query("SELECT COUNT(*) FROM transactions").catch(() => ({ rows: [{ count: '0' }] })),
      client.query("SELECT COUNT(*) FROM transactions_new").catch(() => ({ rows: [{ count: '0' }] }))
    ]);

    console.log('\n📊 Table Row Counts:');
    console.table([
      { Table: 'members', Count: membersCount.rows[0].count },
      { Table: 'members_new', Count: membersNewCount.rows[0].count },
      { Table: 'dependants', Count: dependantsCount.rows[0].count },
      { Table: 'dependents_new', Count: dependentsNewCount.rows[0].count },
      { Table: 'transactions', Count: transactionsCount.rows[0].count },
      { Table: 'transactions_new', Count: transactionsNewCount.rows[0].count }
    ]);

    // Check foreign key relationships
    console.log('\n🔍 Checking foreign key relationships...');
    const fkCheck = await client.query(`
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
        AND tc.table_name IN ('dependents_new')
    `);

    console.log('\n🔑 Foreign Key Relationships:');
    console.table(fkCheck.rows);

    // Check for any data inconsistencies
    console.log('\n🔍 Checking for data inconsistencies...');
    
    // Check for members without corresponding entries in members_new
    const missingMembers = await client.query(`
      SELECT COUNT(*) 
      FROM members m
      LEFT JOIN members_new mn ON m.firebase_uid = mn.firebase_uid
      WHERE mn.id IS NULL
    `);
    console.log(`Members missing in members_new: ${missingMembers.rows[0].count}`);

    // Check for dependants without corresponding entries in dependents_new
    const missingDependants = await client.query(`
      SELECT COUNT(*) 
      FROM dependants d
      LEFT JOIN dependents_new dn ON d.first_name = dn.first_name 
                                AND d.last_name = dn.last_name 
                                AND d.date_of_birth = dn.date_of_birth
      WHERE dn.id IS NULL
    `);
    console.log(`Dependants missing in dependents_new: ${missingDependants.rows[0].count}`);

    // Sample data from dependents_new
    console.log('\n📋 Sample of dependents_new data:');
    const sampleDependents = await client.query(`
      SELECT id, member_id, first_name, last_name, date_of_birth, 
             substring(notes, 1, 50) || '...' as notes_preview
      FROM dependents_new 
      LIMIT 5
    `);
    console.table(sampleDependents.rows);

    console.log('\n✅ Verification complete!');
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyMigration().catch(console.error);
