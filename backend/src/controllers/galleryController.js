const { google } = require('googleapis');

/**
 * Get images from a specific Google Drive folder
 * @route GET /api/gallery/:folderId
 * @access Public
 */
const getFolderImages = async (req, res) => {
    try {
        const { folderId } = req.params;

        let authClient = process.env.GOOGLE_API_KEY || null;

        // Priority 1: OAuth2 (Refresh Token) - Best for Personal Accounts
        if (process.env.GALLERY_DRIVE_REFRESH_TOKEN && process.env.GALLERY_DRIVE_CLIENT_ID && process.env.GALLERY_DRIVE_CLIENT_SECRET) {
            try {
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GALLERY_DRIVE_CLIENT_ID,
                    process.env.GALLERY_DRIVE_CLIENT_SECRET,
                    'https://developers.google.com/oauthplayground'
                );
                oauth2Client.setCredentials({ refresh_token: process.env.GALLERY_DRIVE_REFRESH_TOKEN });
                authClient = oauth2Client;
                console.log('🔐 Using OAuth2 (Refresh Token) for Listing');
            } catch (err) {
                console.error('Failed to setup OAuth2 Client:', err.message);
            }
        }
        // Priority 2: Dedicated Service Account
        else if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64) {
            try {
                const buffer = Buffer.from(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64, 'base64');
                const serviceAccount = JSON.parse(buffer.toString('utf8'));
                authClient = google.auth.fromJSON(serviceAccount);
                authClient.scopes = ['https://www.googleapis.com/auth/drive.readonly'];
            } catch (err) {
                console.error('Failed to parse Dedicated Service Account:', err.message);
            }
        }
        // Priority 3: Firebase Service Account (Fallback)
        else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
            try {
                const buffer = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64');
                const serviceAccount = JSON.parse(buffer.toString('utf8'));
                authClient = google.auth.fromJSON(serviceAccount);
                authClient.scopes = ['https://www.googleapis.com/auth/drive.readonly'];
            } catch (err) {
                console.error('Failed to parse Firebase Service Account:', err.message);
            }
        }

        if (!authClient) {
            console.error('❌ Server configuration error: No valid Google Drive authentication found (API Key, OAuth2, or Service Account)');
            return res.status(500).json({
                message: 'Server configuration error: Google Drive credentials missing'
            });
        }

        const drive = google.drive({
            version: 'v3',
            auth: authClient
        });

        const response = await drive.files.list({
            q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
            fields: 'files(id, name, mimeType, webContentLink, webViewLink, thumbnailLink)',
            pageSize: 100, // Adjust as needed
            orderBy: 'createdTime desc'
        });

        console.log(`✅ Google Drive API Response for folder ${folderId}: Found ${response.data.files.length} files`);
        if (response.data.files.length === 0) {
            console.log('⚠️ Warning: No files found. Check folder permissions (must be Public "Anyone with link") or if folder is empty.');
        }

        res.json(response.data.files);
    } catch (error) {
        console.error('Error fetching gallery images:', error);
        res.status(500).json({
            message: 'Failed to fetch gallery images',
            error: error.message
        });
    }
};



/**
 * Upload an image to a specific Google Drive folder
 * @route POST /api/gallery/:folderId/upload
 * @access Private (Admin, Church Leadership, Secretary, Relationship)
 */
const uploadImage = async (req, res) => {
    try {
        const { folderId } = req.params;

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Note: Google API Key is read-only. We MUST use a Service Account for uploads.
        let authClient = process.env.GOOGLE_API_KEY || null;

        // Priority 1: OAuth2 (Refresh Token) - Best for Personal Accounts
        if (process.env.GALLERY_DRIVE_REFRESH_TOKEN && process.env.GALLERY_DRIVE_CLIENT_ID && process.env.GALLERY_DRIVE_CLIENT_SECRET) {
            try {
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GALLERY_DRIVE_CLIENT_ID,
                    process.env.GALLERY_DRIVE_CLIENT_SECRET,
                    'https://developers.google.com/oauthplayground'
                );
                oauth2Client.setCredentials({ refresh_token: process.env.GALLERY_DRIVE_REFRESH_TOKEN });
                authClient = oauth2Client;
                // console.log('🔐 Using OAuth2 (Refresh Token) for Drive Upload');
            } catch (err) {
                console.error('Failed to setup OAuth2 Client:', err.message);
            }
        }
        // Priority 2: Dedicated Service Account
        else if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64) {
            try {
                const buffer = Buffer.from(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_BASE64, 'base64');
                const serviceAccount = JSON.parse(buffer.toString('utf8'));
                authClient = google.auth.fromJSON(serviceAccount);
                authClient.scopes = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'];
            } catch (err) {
                console.error('Failed to parse Dedicated Service Account:', err.message);
            }
        }
        // Priority 3: Firebase Service Account (Fallback)
        else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
            try {
                const buffer = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64');
                const serviceAccount = JSON.parse(buffer.toString('utf8'));
                authClient = google.auth.fromJSON(serviceAccount);
                authClient.scopes = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'];
            } catch (err) {
                console.error('Failed to parse Firebase Service Account:', err.message);
            }
        }

        if (!authClient) {
            return res.status(500).json({
                message: 'Server configuration error: Google Drive credentials missing'
            });
        }

        const drive = google.drive({
            version: 'v3',
            auth: authClient
        });

        // Let's create a stream from the buffer
        const { Readable } = require('stream');
        const stream = Readable.from(req.file.buffer);

        const fileMetadata = {
            name: req.file.originalname,
            parents: [folderId]
        };

        const media = {
            mimeType: req.file.mimetype,
            body: stream
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, webContentLink, webViewLink, thumbnailLink'
        });

        res.status(201).json({
            message: 'Image uploaded successfully',
            file: response.data
        });

    } catch (error) {
        console.error('Error uploading gallery image:', error);

        // Use specific status code if available (e.g., 403, 400), otherwise 500
        const statusCode = (typeof error.code === 'number' ? error.code : parseInt(error.code)) || (typeof error.status === 'number' ? error.status : parseInt(error.status)) || 500;

        // Use the actual error message from Google/Gaxios so the frontend displays it
        const message = error.message || 'Failed to upload image';

        res.status(statusCode).json({
            message: message,
            error: error.message,
            details: error.response?.data
        });
    }
};

module.exports = {
    getFolderImages,
    uploadImage
};
