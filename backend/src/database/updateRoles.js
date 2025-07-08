const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function updateRoles() {
  try {
    console.log('🔄 Starting role update migration...');
    
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Update existing members with old roles to new roles
    const updateQueries = [
      // Update accountant to treasurer
      `UPDATE members SET role = 'treasurer' WHERE role = 'accountant'`,
      // Update auditor to church_leadership  
      `UPDATE members SET role = 'church_leadership' WHERE role = 'auditor'`,
      // Update clergy to church_leadership
      `UPDATE members SET role = 'church_leadership' WHERE role = 'clergy'`
    ];
    
    for (const query of updateQueries) {
      await sequelize.query(query);
      console.log(`✅ Executed: ${query}`);
    }
    
    // Create new enum type with updated values
    await sequelize.query(`
      CREATE TYPE enum_members_role_new AS ENUM (
        'admin',
        'church_leadership', 
        'treasurer',
        'secretary',
        'member',
        'guest'
      )
    `);
    console.log('✅ Created new enum type with updated roles');
    
    // Drop the default constraint first
    await sequelize.query(`
      ALTER TABLE members 
      ALTER COLUMN role DROP DEFAULT
    `);
    console.log('✅ Dropped default constraint');
    
    // Update the column to use the new enum
    await sequelize.query(`
      ALTER TABLE members 
      ALTER COLUMN role TYPE enum_members_role_new 
      USING role::text::enum_members_role_new
    `);
    console.log('✅ Updated column to use new enum type');
    
    // Add the default constraint back
    await sequelize.query(`
      ALTER TABLE members 
      ALTER COLUMN role SET DEFAULT 'member'
    `);
    console.log('✅ Added default constraint back');
    
    // Drop the old enum type
    await sequelize.query(`DROP TYPE IF EXISTS enum_members_role`);
    console.log('✅ Dropped old enum type');
    
    // Rename the new enum type to the original name
    await sequelize.query(`ALTER TYPE enum_members_role_new RENAME TO enum_members_role`);
    console.log('✅ Renamed new enum type to original name');
    
    console.log('🎉 Role update migration completed successfully!');
    
    // Show summary of current roles
    const [results] = await sequelize.query(`
      SELECT role, COUNT(*) as count 
      FROM members 
      GROUP BY role 
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Current role distribution:');
    results.forEach(row => {
      console.log(`  ${row.role}: ${row.count} members`);
    });
    
  } catch (error) {
    console.error('❌ Error during role update migration:', error);
    throw error;
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  updateRoles()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = updateRoles; 