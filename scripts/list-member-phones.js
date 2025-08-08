const axios = require('axios');
require('dotenv').config();

// Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL; // Set this in your .env file
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Set this in your .env file

async function getAuthToken() {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    if (response.data && response.data.token) {
      return response.data.token;
    }
    throw new Error('No token received');
  } catch (error) {
    console.error('Authentication failed:', error.response?.data?.message || error.message);
    process.exit(1);
  }
}

async function getAllMembers(token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/members/all`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching members:', error.response?.data?.message || error.message);
    process.exit(1);
  }
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file');
    process.exit(1);
  }

  console.log('🔑 Authenticating...');
  const token = await getAuthToken();
  
  console.log('📋 Fetching member list...');
  const members = await getAllMembers(token);
  
  if (members.length === 0) {
    console.log('No members found in the database.');
    return;
  }
  
  console.log('\n📱 Member Phone Numbers:');
  console.log('='.repeat(50));
  
  members.forEach((member, index) => {
    console.log(`\n${index + 1}. ${member.firstName} ${member.lastName}`);
    console.log(`   📞 Phone: ${member.phoneNumber || 'Not provided'}`);
    console.log(`   ✉️  Email: ${member.email || 'Not provided'}`);
    if (member.role) {
      console.log(`   👑 Role: ${member.role}`);
    }
    console.log('   ' + '-'.repeat(40));
  });
  
  console.log(`\n✅ Found ${members.length} members in total`);
}

main().catch(console.error);
