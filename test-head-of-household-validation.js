const axios = require('axios');

const BACKEND_URL = 'http://localhost:3001'; // Adjust if your backend runs on a different port

async function testHeadOfHouseholdValidation() {
  console.log('🔍 Testing Head of Household Phone Validation...\n');
  
  try {
    // Test 1: Valid phone number (assuming you have a head of household in your database)
    console.log('1. Testing with a valid phone number...');
    const validPhone = '(555) 123-4567'; // Replace with an actual phone number from your database
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/members/validate-head-of-household/${encodeURIComponent(validPhone)}`);
      console.log('✅ Valid phone response:', response.data);
    } catch (error) {
      console.log('❌ Valid phone test failed:', error.response?.data || error.message);
    }
    
    // Test 2: Invalid phone number
    console.log('\n2. Testing with an invalid phone number...');
    const invalidPhone = '(555) 999-9999';
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/members/validate-head-of-household/${encodeURIComponent(invalidPhone)}`);
      console.log('✅ Invalid phone response:', response.data);
    } catch (error) {
      console.log('❌ Invalid phone test failed:', error.response?.data || error.message);
    }
    
    // Test 3: Empty phone number
    console.log('\n3. Testing with empty phone number...');
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/members/validate-head-of-household/`);
      console.log('✅ Empty phone response:', response.data);
    } catch (error) {
      console.log('❌ Empty phone test failed:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testHeadOfHouseholdValidation(); 