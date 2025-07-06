const axios = require('axios');

const BACKEND_URL = 'https://abune-aregawi.onrender.com';

async function testBackend() {
  console.log('🔍 Testing Backend API...\n');
  
  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthResponse = await axios.get(`${BACKEND_URL}/health`);
    console.log('✅ Health Check:', healthResponse.data);
    
    // Test 2: Test Registration with correct field names
    console.log('\n2. Testing Registration Validation...');
    const testData = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phoneNumber: '(555) 123-4567',
      dateOfBirth: '1990-01-01',
      gender: 'Male',
      maritalStatus: 'Single',
      streetLine1: '123 Test St',
      city: 'Test City',
      state: 'CA',
      postalCode: '12345',
      country: 'USA',
      languagePreference: 'English',
      preferredGivingMethod: 'Online',
      titheParticipation: true,
      loginEmail: 'test@example.com',
      isHeadOfHousehold: true,
      role: 'member'
    };
    
    try {
      const regResponse = await axios.post(`${BACKEND_URL}/api/members/register`, testData, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✅ Registration Test:', regResponse.data);
    } catch (error) {
      console.log('❌ Registration Error:', error.response?.data || error.message);
      console.log('Status:', error.response?.status);
    }
    
  } catch (error) {
    console.log('❌ Backend Connection Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

testBackend(); 