const jwt = require('jsonwebtoken');
const { Member } = require('./src/models');
require('dotenv').config();

async function debugRoleIssue() {
  try {
    console.log('🔍 Debugging role issue...');
    
    // Test 1: Check database directly
    console.log('\n📊 Test 1: Direct database query');
    const member = await Member.findByPk('00e0f340-27c4-4206-b2b0-b0e97f756700');
    if (member) {
      console.log(`Database role for Dawit: ${member.role}`);
    } else {
      console.log('Member not found in database');
    }
    
    // Test 2: Check JWT token (if you have one)
    console.log('\n🎫 Test 2: JWT token analysis');
    console.log('If you have a JWT token, decode it to see what role is stored');
    console.log('You can use jwt.io to decode your token');
    
    // Test 3: Simulate auth middleware
    console.log('\n🔐 Test 3: Simulate auth middleware');
    const testMember = await Member.findByPk('00e0f340-27c4-4206-b2b0-b0e97f756700');
    if (testMember) {
      const userInfo = {
        id: testMember.id,
        email: testMember.loginEmail,
        role: testMember.role,
        memberId: testMember.memberId
      };
      console.log('User info that would be set in req.user:', userInfo);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

debugRoleIssue(); 