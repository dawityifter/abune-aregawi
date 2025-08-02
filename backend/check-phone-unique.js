require('dotenv').config();
const { sequelize } = require('./src/models');

const checkPhoneUniqueConstraint = async () => {
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Query to check unique constraints on the members table
    const [results] = await sequelize.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'members' 
        AND tc.constraint_type = 'UNIQUE'
        AND kcu.column_name = 'phone_number'
    `);

    console.log('🔍 Checking unique constraints on phone_number field...');
    console.log('Results:', results);

    if (results.length > 0) {
      console.log('✅ phone_number field has unique constraint!');
      results.forEach(constraint => {
        console.log(`   - Constraint: ${constraint.constraint_name}`);
        console.log(`   - Column: ${constraint.column_name}`);
        console.log(`   - Type: ${constraint.constraint_type}`);
      });
    } else {
      console.log('❌ phone_number field does NOT have unique constraint!');
    }

    // Also check the email field for comparison
    const [emailResults] = await sequelize.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'members' 
        AND tc.constraint_type = 'UNIQUE'
        AND kcu.column_name = 'email'
    `);

    console.log('\n🔍 Checking unique constraints on email field...');
    if (emailResults.length > 0) {
      console.log('✅ email field has unique constraint!');
    } else {
      console.log('❌ email field does NOT have unique constraint!');
    }

    // Show all unique constraints on the members table
    const [allUniqueConstraints] = await sequelize.query(`
      SELECT 
        tc.constraint_name,
        kcu.column_name,
        tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'members' 
        AND tc.constraint_type = 'UNIQUE'
      ORDER BY kcu.column_name
    `);

    console.log('\n📋 All unique constraints on members table:');
    if (allUniqueConstraints.length > 0) {
      allUniqueConstraints.forEach(constraint => {
        console.log(`   - ${constraint.column_name}: ${constraint.constraint_name}`);
      });
    } else {
      console.log('   No unique constraints found!');
    }

    // Show field mapping information
    console.log('\n📝 Field Mapping Information:');
    console.log('   - Model field: phoneNumber (camelCase)');
    console.log('   - Database column: phone_number (snake_case)');
    console.log('   - This is due to Sequelize underscored: true setting');
    console.log('   - The unique constraint should be on phone_number column');

  } catch (error) {
    console.error('❌ Error checking constraints:', error);
  } finally {
    await sequelize.close();
  }
};

checkPhoneUniqueConstraint(); 