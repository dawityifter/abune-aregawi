/**
 * Run Department Migrations in Production
 * 
 * This script runs the department-related migrations that create:
 * - departments table
 * - department_members table
 * - Updates to sms_logs table
 * 
 * Usage: node src/database/runDepartmentMigrations.js
 */

const { sequelize } = require('../models');

async function runDepartmentMigrations() {
  try {
    console.log('🚀 Starting Department Migrations...\n');
    console.log('📊 Database:', sequelize.config.database);
    console.log('🔗 Host:', sequelize.config.host);
    console.log('');

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Check if tables already exist
    console.log('🔍 Checking existing tables...');
    const [departmentsExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'departments'
      );
    `);
    
    const [departmentMembersExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'department_members'
      );
    `);

    if (departmentsExists[0].exists && departmentMembersExists[0].exists) {
      console.log('✅ Departments tables already exist!');
      console.log('   - departments: ✓');
      console.log('   - department_members: ✓');
      console.log('\n⚠️  Skipping table creation (tables exist)\n');
    } else {
      console.log('📝 Tables to create:');
      console.log(`   - departments: ${!departmentsExists[0].exists ? '❌ Missing' : '✓ Exists'}`);
      console.log(`   - department_members: ${!departmentMembersExists[0].exists ? '❌ Missing' : '✓ Exists'}`);
      console.log('');

      // Migration 1: Create departments and department_members tables
      if (!departmentsExists[0].exists) {
        console.log('📦 Creating departments table...');
        await sequelize.query(`
          CREATE TABLE departments (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            description TEXT,
            type VARCHAR(50) NOT NULL DEFAULT 'ministry',
            parent_department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL ON UPDATE CASCADE,
            leader_id BIGINT REFERENCES members(id) ON DELETE SET NULL ON UPDATE CASCADE,
            contact_email VARCHAR(255),
            contact_phone VARCHAR(20),
            meeting_schedule TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            is_public BOOLEAN NOT NULL DEFAULT true,
            max_members INTEGER,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        console.log('✅ departments table created');
      }

      if (!departmentMembersExists[0].exists) {
        console.log('📦 Creating department_members table...');
        await sequelize.query(`
          CREATE TABLE department_members (
            id BIGSERIAL PRIMARY KEY,
            department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE ON UPDATE CASCADE,
            member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE ON UPDATE CASCADE,
            role_in_department VARCHAR(50) NOT NULL DEFAULT 'member',
            joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            notes TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_department_member UNIQUE (department_id, member_id)
          );
        `);
        console.log('✅ department_members table created');
      }

      // Create indexes
      console.log('📦 Creating indexes...');
      await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_departments_type ON departments(type);`);
      await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);`);
      await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_departments_leader_id ON departments(leader_id);`);
      await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_departments_parent_department_id ON departments(parent_department_id);`);
      await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_department_members_department_id ON department_members(department_id);`);
      await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_department_members_member_id ON department_members(member_id);`);
      await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_department_members_status ON department_members(status);`);
      console.log('✅ Indexes created');
    }

    // Migration 2: Update sms_logs table
    console.log('\n📦 Updating sms_logs table...');
    
    // Check if department_id column exists
    const [columnExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'sms_logs' 
        AND column_name = 'department_id'
      );
    `);

    if (!columnExists[0].exists) {
      console.log('   - Adding department_id column...');
      await sequelize.query(`ALTER TABLE sms_logs ADD COLUMN department_id BIGINT;`);
      console.log('   ✅ department_id column added');
    } else {
      console.log('   ✓ department_id column already exists');
    }

    // Update recipient_type enum
    console.log('   - Updating recipient_type enum...');
    try {
      await sequelize.query(`ALTER TYPE enum_sms_logs_recipient_type ADD VALUE IF NOT EXISTS 'department';`);
      console.log('   ✅ recipient_type enum updated');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('   ✓ recipient_type enum already includes "department"');
      } else {
        throw error;
      }
    }

    // Final verification
    console.log('\n🔍 Verifying migrations...');
    
    const [finalCheck] = await sequelize.query(`
      SELECT 
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'departments')) as departments_exists,
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'department_members')) as department_members_exists,
        (SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sms_logs' AND column_name = 'department_id')) as department_id_exists;
    `);

    console.log('');
    console.log('📊 Final Status:');
    console.log(`   ✓ departments table: ${finalCheck[0].departments_exists ? '✅' : '❌'}`);
    console.log(`   ✓ department_members table: ${finalCheck[0].department_members_exists ? '✅' : '❌'}`);
    console.log(`   ✓ sms_logs.department_id: ${finalCheck[0].department_id_exists ? '✅' : '❌'}`);

    if (finalCheck[0].departments_exists && finalCheck[0].department_members_exists && finalCheck[0].department_id_exists) {
      console.log('\n🎉 All migrations completed successfully!');
      console.log('\n✅ Your production database now has:');
      console.log('   • departments table');
      console.log('   • department_members table');
      console.log('   • SMS department support');
      console.log('\n🚀 You can now:');
      console.log('   • Use /api/departments endpoints');
      console.log('   • Send SMS to departments');
      console.log('   • Use the department preview feature');
    } else {
      console.log('\n⚠️  Some migrations may have failed. Check the logs above.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run migrations
if (require.main === module) {
  runDepartmentMigrations()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = runDepartmentMigrations;
