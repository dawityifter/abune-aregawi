require('dotenv').config();
const { google } = require('googleapis');

const folderId = '1Bw2RcJYzfIPmamNPYvM-pQe_VhD51Aw_'; // The folder ID we are using
const apiKey = process.env.GOOGLE_API_KEY;

console.log('--- Debugging Google Drive Gallery ---');
console.log(`Folder ID: ${folderId}`);
console.log(`API Key defined: ${apiKey ? 'Yes' : 'No'}`);

if (!apiKey) {
    console.error('❌ Error: GOOGLE_API_KEY is missing in .env');
    process.exit(1);
}

const drive = google.drive({
    version: 'v3',
    auth: apiKey
});

async function checkFolder() {
    try {
        console.log('Attempting to fetch files...');
        const response = await drive.files.list({
            q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
            fields: 'files(id, name, mimeType, webContentLink, webViewLink, thumbnailLink)',
            pageSize: 10,
            orderBy: 'createdTime desc'
        });

        const files = response.data.files;
        console.log(`✅ Success! Found ${files.length} images.`);

        if (files.length > 0) {
            console.log('First file details:');
            console.log(JSON.stringify(files[0], null, 2));
        } else {
            console.log('⚠️ No files found. Possible reasons:');
            console.log('1. Folder is empty.');
            console.log('2. Folder permissions are not set to "Anyone with the link".');
            console.log('3. API Key does not have permissions (unlikely if it is a general key).');
        }

    } catch (error) {
        console.error('❌ API Error:');
        console.error(error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

checkFolder();
