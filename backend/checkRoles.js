const { Sequelize } = require('sequelize');
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

async function checkMemberRoles() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');
    
    const [results] = await sequelize.query(`
      SELECT 
        id, 
        email, 
        role, 
        first_name, 
        last_name,
        created_at
      FROM members 
      ORDER BY created_at DESC
    `);
    
    console.log('\n📋 Member Roles:');
    console.log('='.repeat(80));
    
    if (results.length === 0) {
      console.log('No members found in database');
    } else {
      results.forEach((member, index) => {
        console.log(`${index + 1}. ${member.first_name} ${member.last_name}`);
        console.log(`   Email: ${member.email}`);
        console.log(`   Role: ${member.role}`);
        console.log(`   ID: ${member.id}`);
        console.log(`   Created: ${member.created_at}`);
        console.log('');
      });
    }
    
    // Also check available roles
    const [roleResults] = await sequelize.query(`
      SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace 
      WHERE n.nspname = 'public' AND t.typname='enum_members_role' 
      GROUP BY 1
    `);
    
    console.log('🎭 Available Roles:');
    console.log('='.repeat(40));
    if (roleResults.length > 0) {
      console.log(roleResults[0].enum_value.join(', '));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkMemberRoles(); 