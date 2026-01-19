require('dotenv').config();
const { google } = require('googleapis');

async function testAuth() {
    console.log('--- Diagnostic Test Start ---');

    // 1. Check Env Vars
    const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    console.log(`Has FIREBASE_SERVICE_ACCOUNT_BASE64: ${hasServiceAccount}`);

    if (!hasServiceAccount) {
        console.error('❌ Missing FIREBASE_SERVICE_ACCOUNT_BASE64 env var');
        return;
    }

    // 2. Parsed SA
    try {
        const buffer = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64');
        const serviceAccount = JSON.parse(buffer.toString('utf8'));
        console.log(`✅ Service Account Parsed. Email: ${serviceAccount.client_email}`);
        console.log(`🔑 Available Keys: ${Object.keys(serviceAccount).join(', ')}`);
        let privateKey = serviceAccount.private_key;
        console.log(`🔑 Key Length: ${privateKey?.length}`);
        console.log(`🔑 Starts with BEGIN: ${privateKey?.startsWith('-----BEGIN PRIVATE KEY-----')}`);
        console.log(`🔑 Contains escaped \\n: ${privateKey?.includes('\\n')}`);

        // Fix for common issue where newlines are escaped in the ENV string
        if (privateKey && privateKey.includes('\\n')) {
            console.log('⚠️ Detected escaped newlines in private key. Fixing...');
            privateKey = privateKey.replace(/\\n/g, '\n');
        }

        // 3. Test Auth Client Creation (Alternative Method)
        console.log('🔄 Attempting google.auth.fromJSON...');
        const authClient = google.auth.fromJSON(serviceAccount);
        authClient.scopes = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'];

        console.log('✅ Client created fromJSON');

        // 4. Test Token Fetch
        await authClient.authorize();
        console.log('✅ Successfully authorized with Google! Token fetched.');

    } catch (err) {
        console.error('❌ Error parsing or authorizing:', err.message);
    }
    console.log('--- Diagnostic Test End ---');
}

testAuth();
