require('dotenv').config();

console.log('🧪 Testing Firebase configuration...');

// Check if environment variable exists
if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable not found');
  process.exit(1);
}

console.log('✅ FIREBASE_SERVICE_ACCOUNT_BASE64 exists');
console.log('📏 Length:', process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.length);

try {
  // Decode the base64 string
  const serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
  console.log('✅ Base64 decoding successful');
  
  // Parse the JSON
  const serviceAccount = JSON.parse(serviceAccountJson);
  console.log('✅ JSON parsing successful');
  
  // Check required fields
  const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id'];
  const missingFields = requiredFields.filter(field => !serviceAccount[field]);
  
  if (missingFields.length > 0) {
    console.error('❌ Missing required fields:', missingFields);
    process.exit(1);
  }
  
  console.log('✅ All required fields present');
  console.log('📋 Service Account Details:');
  console.log('  Project ID:', serviceAccount.project_id);
  console.log('  Client Email:', serviceAccount.client_email);
  console.log('  Type:', serviceAccount.type);
  
  // Test Firebase Admin initialization
  const admin = require('firebase-admin');
  
  if (admin.apps.length > 0) {
    console.log('ℹ️  Firebase Admin already initialized');
  } else {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  }
  
  console.log('🎉 All tests passed! Firebase configuration is valid.');
  
} catch (error) {
  console.error('❌ Error testing Firebase configuration:', error.message);
  console.error('❌ Error details:', error);
  process.exit(1);
} 