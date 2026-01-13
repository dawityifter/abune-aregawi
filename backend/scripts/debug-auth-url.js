const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// --- PASTE YOUR CREDENTIALS HERE OR USE ENV ---
const CLIENT_ID = process.env.GALLERY_DRIVE_CLIENT_ID || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.GALLERY_DRIVE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
// -----------------------------------

const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

console.log('\n--- Debug Auth URL Generator ---\n');
console.log(`Using Client ID: ${CLIENT_ID}`);
console.log(`Using Redirect URI: ${REDIRECT_URI}\n`);

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive'], // FULL DRIVE SCOPE
    prompt: 'consent' // FORCE prompt to ensure refresh token is returned
});

console.log('Copy and paste this URL into your browser:');
console.log('---------------------------------------------------');
console.log(authorizeUrl);
console.log('---------------------------------------------------');
