#!/usr/bin/env node

/**
 * Firebase Migration Helper Script
 * 
 * This script helps with the Firebase project migration from 
 * abune-aregawit-church to abune-aregawi-church
 */

const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Migration Helper\n');

// Function to convert service account JSON to base64
function convertServiceAccountToBase64() {
  console.log('📋 To convert your new Firebase service account to base64:');
  console.log('1. Download the service account JSON from Firebase Console');
  console.log('2. Run this command in your terminal:');
  console.log('   cat path/to/your/service-account.json | base64');
  console.log('3. Copy the output and set it as FIREBASE_SERVICE_ACCOUNT_BASE64 in your .env files\n');
}

// Function to show what environment variables need updating
function showEnvironmentVariablesUpdate() {
  console.log('🔧 Environment Variables to Update:');
  console.log('');
  console.log('Frontend (.env):');
  console.log('- REACT_APP_FIREBASE_AUTH_DOMAIN=abune-aregawi-church.firebaseapp.com');
  console.log('- REACT_APP_FIREBASE_PROJECT_ID=abune-aregawi-church');
  console.log('- REACT_APP_FIREBASE_STORAGE_BUCKET=abune-aregawi-church.appspot.com');
  console.log('- REACT_APP_FIREBASE_API_KEY=<new_api_key>');
  console.log('- REACT_APP_FIREBASE_MESSAGING_SENDER_ID=<new_sender_id>');
  console.log('- REACT_APP_FIREBASE_APP_ID=<new_app_id>');
  console.log('');
  console.log('Backend (.env):');
  console.log('- FIREBASE_SERVICE_ACCOUNT_BASE64=<new_base64_encoded_service_account>');
  console.log('');
}

// Function to check current configuration
function checkCurrentConfig() {
  console.log('🔍 Current Configuration Check:');
  
  // Check frontend .env.example
  const frontendEnvExample = path.join(__dirname, 'frontend', '.env.example');
  if (fs.existsSync(frontendEnvExample)) {
    console.log('✅ Frontend .env.example found');
  } else {
    console.log('❌ Frontend .env.example not found');
  }
  
  // Check if firebase.ts exists
  const firebaseConfig = path.join(__dirname, 'frontend', 'src', 'firebase.ts');
  if (fs.existsSync(firebaseConfig)) {
    console.log('✅ Firebase configuration file found');
  } else {
    console.log('❌ Firebase configuration file not found');
  }
  
  console.log('');
}

// Main execution
function main() {
  checkCurrentConfig();
  showEnvironmentVariablesUpdate();
  convertServiceAccountToBase64();
  
  console.log('📝 Migration Checklist:');
  console.log('□ Create new Firebase project: abune-aregawi-church');
  console.log('□ Enable Authentication (Phone + Email/Password)');
  console.log('□ Configure reCAPTCHA Enterprise with 127.0.0.1');
  console.log('□ Create Firestore database');
  console.log('□ Generate new service account key');
  console.log('□ Update frontend/.env with new config values');
  console.log('□ Update backend/.env with new service account');
  console.log('□ Test authentication flows');
  console.log('□ Migrate existing user data (if any)');
  console.log('□ Delete old Firebase project');
  console.log('');
  console.log('🚀 Ready to start migration!');
}

main();
