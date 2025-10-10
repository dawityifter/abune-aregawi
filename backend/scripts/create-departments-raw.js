require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function createTables() {
  let sequelize;
  
  try {
    console.log('🚀 Creating department tables with raw SQL...\n');
    
    const models = require('../src/models');
    sequelize = models.sequelize;
    
    console.log('🔌 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    console.log('📝 Creating departments table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL DEFAULT 'ministry',
        parent_department_id BIGINT,
        leader_id BIGINT,
        contact_email VARCHAR(255),
        contact_phone VARCHAR(20),
        meeting_schedule TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_public BOOLEAN NOT NULL DEFAULT true,
        max_members INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ departments table created\n');

    console.log('📝 Creating department_members table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS department_members (
        id BIGSERIAL PRIMARY KEY,
        department_id BIGINT NOT NULL,
        member_id BIGINT NOT NULL,
        role_in_department VARCHAR(50) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(department_id, member_id)
      );
    `);
    console.log('✅ department_members table created\n');

    console.log('📝 Adding foreign key constraints...');
    
    // Add foreign keys
    await sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_parent_department_id_fkey') THEN
          ALTER TABLE departments 
          ADD CONSTRAINT departments_parent_department_id_fkey 
          FOREIGN KEY (parent_department_id) 
          REFERENCES departments(id) 
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_leader_id_fkey') THEN
          ALTER TABLE departments 
          ADD CONSTRAINT departments_leader_id_fkey 
          FOREIGN KEY (leader_id) 
          REFERENCES members(id) 
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'department_members_department_id_fkey') THEN
          ALTER TABLE department_members 
          ADD CONSTRAINT department_members_department_id_fkey 
          FOREIGN KEY (department_id) 
          REFERENCES departments(id) 
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'department_members_member_id_fkey') THEN
          ALTER TABLE department_members 
          ADD CONSTRAINT department_members_member_id_fkey 
          FOREIGN KEY (member_id) 
          REFERENCES members(id) 
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    console.log('✅ Foreign keys added\n');

    console.log('📝 Creating indexes...');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_departments_type ON departments(type);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_departments_leader_id ON departments(leader_id);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_departments_parent_department_id ON departments(parent_department_id);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_department_members_department_id ON department_members(department_id);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_department_members_member_id ON department_members(member_id);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_department_members_status ON department_members(status);');
    console.log('✅ Indexes created\n');

    console.log('\n✅ Migration completed successfully!\n');
    console.log('📊 Tables created:');
    console.log('  ✓ departments');
    console.log('  ✓ department_members');
    console.log('  ✓ Foreign keys');
    console.log('  ✓ Indexes');
    console.log('\n🎉 Department management system is ready to use!');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nFull error:');
    console.error(error);
    
    if (sequelize) {
      await sequelize.close();
    }
    process.exit(1);
  }
}

createTables();
