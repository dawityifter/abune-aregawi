require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixDependantsMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('🔄 Starting dependants migration fix...');

    // Step 1: Check if we have any data in dependants table
    const dependantsCount = await client.query('SELECT COUNT(*) FROM dependants');
    console.log(`📊 Found ${dependantsCount.rows[0].count} records in dependants table`);

    if (dependantsCount.rows[0].count === 0) {
      console.log('✅ No data to migrate in dependants table');
      return;
    }

    // Step 2: Check if dependents_new has data
    const dependentsNewCount = await client.query('SELECT COUNT(*) FROM dependents_new');
    if (dependentsNewCount.rows[0].count > 0) {
      console.log('⚠️  Warning: dependents_new table already contains data. Backing up first...');
      await client.query('CREATE TABLE IF NOT EXISTS dependents_new_backup AS TABLE dependents_new');
      console.log('✅ Created backup of dependents_new as dependents_new_backup');
    }

    // Step 3: Truncate dependents_new to ensure clean migration
    await client.query('TRUNCATE TABLE dependents_new CASCADE');
    console.log('🧹 Cleared dependents_new table');

    // Step 4: Get all dependants with their corresponding member's new ID
    console.log('🔍 Fetching dependants with member ID mapping...');
    const dependants = await client.query(`
      SELECT d.*, m.id AS new_member_id
      FROM dependants d
      JOIN members m_old ON d.member_id = m_old.id
      JOIN members_new m ON m_old.firebase_uid = m.firebase_uid
      ORDER BY d.created_at
    `);

    console.log(`📝 Processing ${dependants.rows.length} dependants...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Step 5: Migrate each dependant
    for (const [index, dependant] of dependants.rows.entries()) {
      try {
        // Log progress every 10 records
        if (index > 0 && index % 10 === 0) {
          console.log(`   Processed ${index} of ${dependants.rows.length} dependants...`);
        }

        // Map old fields to new schema
        const result = await client.query(
          `INSERT INTO dependents_new (
            member_id, first_name, middle_name, last_name, date_of_birth, 
            gender, relationship, medical_conditions, allergies, 
            medications, dietary_restrictions, notes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id`,
          [
            dependant.new_member_id, // member_id (BIGINT from members_new)
            dependant.first_name,
            dependant.middle_name,
            dependant.last_name,
            dependant.date_of_birth,
            dependant.gender,
            'Child', // Default relationship since old schema doesn't have this field
            null,    // medical_conditions (not in old schema)
            null,    // allergies (not in old schema)
            null,    // medications (not in old schema)
            null,    // dietary_restrictions (not in old schema)
            `Original ID: ${dependant.id}\n` +  // Preserve original ID in notes
            `Phone: ${dependant.phone || 'N/A'}\n` +
            `Email: ${dependant.email || 'N/A'}\n` +
            `Baptism: ${dependant.baptism_name || 'N/A'} ` +
            `${dependant.is_baptized ? '(Baptized)' : '(Not Baptized)'}\n` +
            `Baptism Date: ${dependant.baptism_date || 'N/A'}\n` +
            `Name Day: ${dependant.name_day || 'N/A'}`,
            dependant.created_at,
            dependant.updated_at || new Date()
          ]
        );
        
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          id: dependant.id,
          name: `${dependant.first_name} ${dependant.last_name}`,
          error: error.message
        });
        console.error(`❌ Error migrating dependant ${dependant.id}:`, error.message);
      }
    }

    // Step 6: Verify the migration
    const newCount = await client.query('SELECT COUNT(*) FROM dependents_new');
    console.log(`\n✅ Migration complete!`);
    console.log(`   Successfully migrated: ${successCount} dependants`);
    console.log(`   Failed to migrate: ${errorCount} dependants`);
    console.log(`   Total in source (dependants): ${dependants.rows.length}`);
    console.log(`   Total in target (dependents_new): ${newCount.rows[0].count}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered during migration:');
      errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ID: ${err.id}, Name: ${err.name}`);
        console.log(`      Error: ${err.error}\n`);
      });
    }

    // Step 7: Show sample of migrated data
    console.log('\n🔍 Sample of migrated data (first 5 records):');
    const sample = await client.query('SELECT id, member_id, first_name, last_name, date_of_birth FROM dependents_new LIMIT 5');
    console.table(sample.rows);

    await client.query('COMMIT');
    console.log('\n🎉 Migration transaction committed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed. Rolling back changes...', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
fixDependantsMigration()
  .then(() => console.log('\n🏁 Migration script completed'))
  .catch(error => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
