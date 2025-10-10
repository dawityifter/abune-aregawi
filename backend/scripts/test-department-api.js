require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function testDepartmentAPI() {
  try {
    console.log('🧪 Testing Department API Endpoints...\n');

    // Test 1: Check if server is running
    console.log('1. Testing server health...');
    const healthResponse = await fetch('http://localhost:5001/health');
    if (healthResponse.ok) {
      console.log('✅ Server is running\n');
    } else {
      console.log('❌ Server health check failed');
      return;
    }

    // Test 2: Check root endpoint
    console.log('2. Checking available endpoints...');
    const rootResponse = await fetch('http://localhost:5001/');
    const rootData = await rootResponse.json();
    console.log('✅ Available endpoints:', Object.keys(rootData.endpoints).join(', '));
    if (rootData.endpoints.departments) {
      console.log('✅ Departments endpoint is registered\n');
    } else {
      console.log('❌ Departments endpoint is NOT registered\n');
    }

    // Test 3: Test department stats endpoint (requires auth)
    console.log('3. Testing /api/departments/stats endpoint...');
    const statsResponse = await fetch('http://localhost:5001/api/departments/stats');
    console.log('   Status:', statsResponse.status);
    
    if (statsResponse.status === 401) {
      console.log('✅ Endpoint exists (requires authentication)\n');
    } else if (statsResponse.status === 200) {
      const statsData = await statsResponse.json();
      console.log('✅ Stats data:', statsData);
    } else {
      console.log('❌ Unexpected status:', statsResponse.status);
      const errorText = await statsResponse.text();
      console.log('   Error:', errorText, '\n');
    }

    // Test 4: Test department list endpoint
    console.log('4. Testing /api/departments endpoint...');
    const listResponse = await fetch('http://localhost:5001/api/departments');
    console.log('   Status:', listResponse.status);
    
    if (listResponse.status === 401) {
      console.log('✅ Endpoint exists (requires authentication)\n');
    } else if (listResponse.status === 200) {
      const listData = await listResponse.json();
      console.log('✅ List data:', listData);
    } else {
      console.log('❌ Unexpected status:', listResponse.status);
      const errorText = await listResponse.text();
      console.log('   Error:', errorText, '\n');
    }

    console.log('📋 Summary:');
    console.log('If you see 401 (Unauthorized) errors, that\'s GOOD!');
    console.log('It means the endpoints exist but require Firebase authentication.');
    console.log('\nNext steps:');
    console.log('1. Make sure your backend server is running');
    console.log('2. Check browser console for the actual error');
    console.log('3. Verify you\'re logged in with proper permissions');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nPossible issues:');
    console.error('- Backend server is not running (run: npm start in backend folder)');
    console.error('- Backend is running on a different port');
    console.error('- Network connection issue');
  }
}

testDepartmentAPI();
