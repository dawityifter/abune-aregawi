const { google } = require('googleapis');
const readline = require('readline');

// Create interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupAuth() {
    console.log('\n--- Google Drive OAuth2 Setup ---\n');
    console.log('This script will help you generate a Refresh Token for your personal account.');
    console.log('You need a Client ID and Client Secret from Google Cloud Console.\n');

    const clientId = await question('Enter your Client ID: ');
    const clientSecret = await question('Enter your Client Secret: ');

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground' // Redirect URI
    );

    // Generate the url that will be used for authorization
    const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
    });

    console.log('\n1. Open this URL in your browser:');
    console.log(authorizeUrl);
    console.log('\n2. Authorize with the account that OWNS the folder.');
    console.log('3. You will be redirected to OAuth Playground.');
    console.log('4. Copy the "Authorization code" from the box (it starts with 4/).\n');

    const code = await question('Enter the Authorization Code: ');

    try {
        const { tokens } = await oauth2Client.getToken(code);

        console.log('\n✅ SUCCESS! Here are your credentials:\n');
        console.log('Add these to your backend/.env file:');
        console.log('---------------------------------------------------');
        console.log(`GALLERY_DRIVE_CLIENT_ID=${clientId}`);
        console.log(`GALLERY_DRIVE_CLIENT_SECRET=${clientSecret}`);
        console.log(`GALLERY_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('---------------------------------------------------');

        if (!tokens.refresh_token) {
            console.log('\n⚠️ WARNING: No refresh token returned. Did you already authorize this app?');
            console.log('You might need to revoke access at https://myaccount.google.com/permissions and try again to get a new refresh token.');
        }

    } catch (error) {
        console.error('\n❌ Error retrieving access token:', error.message);
    }

    rl.close();
}

setupAuth();
