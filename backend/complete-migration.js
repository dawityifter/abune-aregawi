require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function completeMigration() {
  try {
    console.log('🔄 Completing database migration...');

    // Step 1: Migrate data from old tables to new tables
    console.log('📊 Migrating members data...');
    const members = await pool.query('SELECT * FROM members ORDER BY created_at');
    
    for (const member of members.rows) {
      await pool.query(`
        INSERT INTO members_new (
          firebase_uid, first_name, middle_name, last_name, email, phone_number,
          date_of_birth, gender, baptism_name, repentance_father, household_size,
          street_line1, apartment_no, city, state, postal_code, country, 
          emergency_contact_name, emergency_contact_phone, occupation, employer,
          education_level, skills, interests, languages_spoken, date_joined_parish,
          baptism_date, confirmation_date, marriage_date, spouse_name, children_count,
          role, is_active, registration_status, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37)
      `, [
        member.firebase_uid,
        member.first_name,
        member.middle_name,
        member.last_name,
        member.email,
        member.phone_number,
        member.date_of_birth,
        member.gender,
        member.baptism_name,
        member.repentance_father,
        member.household_size,
        member.street_line1,
        member.apartment_no,
        member.city,
        member.state,
        member.postal_code,
        member.country,
        member.emergency_contact_name,
        member.emergency_contact_phone,
        member.occupation,
        member.employer,
        member.education_level,
        member.skills,
        member.interests,
        member.languages_spoken,
        member.date_joined_parish,
        member.baptism_date,
        member.confirmation_date,
        member.marriage_date,
        member.spouse_name,
        member.children_count,
        member.role,
        member.is_active,
        member.registration_status || 'pending',
        member.notes,
        member.created_at,
        member.updated_at
      ]);
    }

    console.log(`✅ Migrated ${members.rows.length} members`);

    // Step 2: Migrate dependants data
    console.log('📊 Migrating dependants data...');
    const dependants = await pool.query(`
      SELECT d.*, m.id as new_member_id 
      FROM dependants d 
      JOIN members m ON d.member_id = m.id 
      ORDER BY d.created_at
    `);

    for (const dependant of dependants.rows) {
      await pool.query(`
        INSERT INTO dependents_new (
          member_id, first_name, middle_name, last_name, date_of_birth, gender,
          relationship, medical_conditions, allergies, medications, dietary_restrictions,
          notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        dependant.new_member_id,
        dependant.first_name,
        dependant.middle_name,
        dependant.last_name,
        dependant.date_of_birth,
        dependant.gender,
        dependant.relationship,
        dependant.medical_conditions,
        dependant.allergies,
        dependant.medications,
        dependant.dietary_restrictions,
        dependant.notes,
        dependant.created_at,
        dependant.updated_at
      ]);
    }

    console.log(`✅ Migrated ${dependants.rows.length} dependants`);

    // Step 3: Migrate church_transactions data
    console.log('📊 Migrating church_transactions data...');
    const transactions = await pool.query(`
      SELECT ct.*, m1.id as new_member_id, m2.id as new_collector_id 
      FROM church_transactions ct 
      JOIN members m1 ON ct.member_id = m1.id 
      JOIN members m2 ON ct.collected_by = m2.id 
      ORDER BY ct.created_at
    `);

    for (const transaction of transactions.rows) {
      await pool.query(`
        INSERT INTO transactions_new (
          member_id, collected_by, payment_date, amount, payment_type, payment_method,
          receipt_number, note, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        transaction.new_member_id,
        transaction.new_collector_id,
        transaction.payment_date,
        transaction.amount,
        transaction.payment_type,
        transaction.payment_method,
        transaction.receipt_number,
        transaction.note,
        transaction.created_at,
        transaction.updated_at
      ]);
    }

    console.log(`✅ Migrated ${transactions.rows.length} transactions`);

    // Step 4: Update family_id references in members_new
    console.log('🔄 Updating family_id references...');
    const familyUpdates = await pool.query(`
      SELECT m1.id as old_id, m1.family_id as old_family_id, m2.id as new_family_id 
      FROM members m1 
      JOIN members m2 ON m1.family_id = m2.id 
      WHERE m1.family_id IS NOT NULL
    `);

    for (const update of familyUpdates.rows) {
      await pool.query(`
        UPDATE members_new SET family_id = $1 WHERE id = $2
      `, [update.new_family_id, update.old_id]);
    }

    console.log(`✅ Updated ${familyUpdates.rows.length} family references`);

    // Step 5: Drop old tables and rename new tables
    console.log('🗑️ Dropping old tables...');
    await pool.query('DROP TABLE IF EXISTS church_transactions CASCADE');
    await pool.query('DROP TABLE IF EXISTS dependants CASCADE');
    await pool.query('DROP TABLE IF EXISTS members CASCADE');

    console.log('🔄 Renaming new tables...');
    await pool.query('ALTER TABLE members_new RENAME TO members');
    await pool.query('ALTER TABLE dependents_new RENAME TO dependents');
    await pool.query('ALTER TABLE transactions_new RENAME TO transactions');

    console.log('✅ Migration completed successfully!');

    // Verify the migration
    console.log('🔍 Verifying migration...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('members', 'dependents', 'transactions')
      ORDER BY table_name
    `);

    console.log('Final tables:', tables.rows.map(row => row.table_name));

    const memberCount = await pool.query('SELECT COUNT(*) FROM members');
    const dependentCount = await pool.query('SELECT COUNT(*) FROM dependents');
    const transactionCount = await pool.query('SELECT COUNT(*) FROM transactions');

    console.log(`📊 Final counts: ${memberCount.rows[0].count} members, ${dependentCount.rows[0].count} dependents, ${transactionCount.rows[0].count} transactions`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

completeMigration().catch(console.error); 