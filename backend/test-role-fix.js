const { Member } = require('./src/models');
require('dotenv').config();

async function testRoleFix() {
  try {
    console.log('🔍 Testing role fix...');
    
    // Test 1: Check your user's role in PostgreSQL
    console.log('\n📊 Test 1: Your role in PostgreSQL');
    const yourMember = await Member.findOne({
      where: { email: 'dawityifter@gmail.com' }
    });
    
    if (yourMember) {
      console.log(`✅ Found your member record:`);
      console.log(`   Name: ${yourMember.firstName} ${yourMember.lastName}`);
      console.log(`   Email: ${yourMember.email}`);
      console.log(`   Role: ${yourMember.role}`);
      console.log(`   ID: ${yourMember.id}`);
    } else {
      console.log('❌ Member not found');
    }
    
    // Test 2: Simulate auth middleware
    console.log('\n🔐 Test 2: Simulate auth middleware');
    if (yourMember) {
      const userInfo = {
        id: yourMember.id,
        email: yourMember.loginEmail || yourMember.email,
        role: yourMember.role,
        memberId: yourMember.memberId
      };
      console.log('User info that would be set in req.user:', userInfo);
      
      // Check if you have admin permissions
      const adminRoles = ['admin', 'church_leadership', 'treasurer', 'secretary'];
      const hasAdminAccess = adminRoles.includes(yourMember.role);
      console.log(`Admin access: ${hasAdminAccess ? '✅ Yes' : '❌ No'}`);
    }
    
    // Test 3: Check all members and their roles
    console.log('\n📋 Test 3: All members and their roles');
    const allMembers = await Member.findAll({
      attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'isActive'],
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`Total members: ${allMembers.length}`);
    allMembers.forEach((member, index) => {
      console.log(`${index + 1}. ${member.firstName} ${member.lastName} - ${member.role} (${member.isActive ? 'Active' : 'Inactive'})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

testRoleFix(); 