require('dotenv').config();
const { sequelize, Member, Child } = require('../models');

const testDatabase = async () => {
  try {
    console.log('🔌 Testing database connection...');
    console.log(`📊 Database: ${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful.');
    
    // Check existing data
    const memberCount = await Member.count();
    const childCount = await Child.count();
    
    console.log(`📊 Current data:`);
    console.log(`   - Members: ${memberCount}`);
    console.log(`   - Children: ${childCount}`);
    
    if (memberCount > 0) {
      const members = await Member.findAll({ limit: 3 });
      console.log('👥 Sample members:');
      members.forEach(m => {
        console.log(`   - ${m.firstName} ${m.lastName} (${m.email})`);
      });
    }
    
    // Test creating a member
    console.log('\n🧪 Testing member creation...');
    const testMember = await Member.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      loginEmail: 'test@example.com',
      firebaseUid: 'test-uid-' + Date.now(),
      phoneNumber: '123-456-7890',
      gender: 'Male',
      dateOfBirth: '1990-01-01',
      maritalStatus: 'Single',
      streetLine1: '123 Test St',
      city: 'Test City',
      state: 'CA',
      postalCode: '12345',
      country: 'USA',
      role: 'member',
      isActive: true
    });
    
    console.log(`✅ Test member created: ${testMember.firstName} ${testMember.lastName} (ID: ${testMember.id})`);
    
    // Verify the member was saved
    const savedMember = await Member.findByPk(testMember.id);
    if (savedMember) {
      console.log('✅ Member successfully saved and retrieved from database.');
    } else {
      console.log('❌ Member not found after creation - possible data persistence issue.');
    }
    
    // Clean up test data
    await testMember.destroy();
    console.log('🧹 Test member cleaned up.');
    
    console.log('\n🎉 Database test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

// Run if this file is executed directly
if (require.main === module) {
  testDatabase();
}

module.exports = { testDatabase }; 