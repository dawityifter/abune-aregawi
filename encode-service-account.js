#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get the file path from command line arguments
const filePath = process.argv[2];

if (!filePath) {
    console.error('Usage: node encode-service-account.js <path-to-service-account.json>');
    console.error('Example: node encode-service-account.js ~/Downloads/service-account.json');
    process.exit(1);
}

try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
    }

    // Read the JSON file
    const serviceAccountJson = fs.readFileSync(filePath, 'utf8');
    
    // Validate it's valid JSON
    JSON.parse(serviceAccountJson);
    
    // Convert to base64
    const base64String = Buffer.from(serviceAccountJson).toString('base64');
    
    console.log('✅ Service account successfully encoded to base64!');
    console.log('\n📋 Copy this value to your FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable:');
    console.log('\n' + base64String);
    console.log('\n💡 Add this to your .env file:');
    console.log(`FIREBASE_SERVICE_ACCOUNT_BASE64=${base64String}`);
    
} catch (error) {
    console.error('❌ Error processing file:', error.message);
    process.exit(1);
}
