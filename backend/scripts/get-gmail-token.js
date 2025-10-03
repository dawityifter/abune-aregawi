// One-time Gmail OAuth token generator for gmail.readonly
// Usage:
//   Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to your .env file
//   OR export them as environment variables
//   node scripts/get-gmail-token.js
// It will open a browser for consent and print tokens, including refresh_token.

// Load environment variables from .env file
require('dotenv').config();

const http = require('http');
const url = require('url');
const open = require('open');
const { google } = require('googleapis');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'http://127.0.0.1:53682/callback'; // loopback redirect
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET environment variables.');
  process.exit(1);
}

async function main() {
  const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/callback')) {
        const qs = new url.URL(req.url, REDIRECT_URI).searchParams;
        const code = qs.get('code');
        if (!code) {
          res.statusCode = 400;
          res.end('No code in callback.');
          return;
        }
        const { tokens } = await oAuth2Client.getToken(code);
        res.end('Success! You can close this tab. Check your terminal for tokens.');
        console.log('\n=== GOOGLE OAUTH TOKENS ===');
        console.log(JSON.stringify(tokens, null, 2));
        console.log('\nSave refresh_token securely as GMAIL_REFRESH_TOKEN.');
        server.close();
      } else {
        res.end('OK');
      }
    } catch (err) {
      console.error(err);
      try { res.end('Error during token exchange; see terminal.'); } catch (_) {}
      server.close();
    }
  });

  server.listen(53682, async () => {
    console.log('Open this URL in your browser to authorize:', authUrl);
    try { await open(authUrl); } catch (_) {}
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
