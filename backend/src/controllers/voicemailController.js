const { Voicemail } = require('../models');
const { notifyLeadershipOfVoicemail } = require('../utils/notifications');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

// Public method: TwiML for incoming call
exports.handleIncomingCall = (req, res) => {
    // Respond with TwiML to Say a message and Record
    // We point the 'action' to our recording handler
    // We enable 'transcribe=true' and point 'transcribeCallback' to our transcription handler
    // Note: Env vars BASE_URL should be set, or we assume a fixed path relative to current host

    // Use a relative path if Twilio is hitting the same domain, or construct absolute URL if needed.
    // Ideally, use process.env.API_BASE_URL + '/api/twilio/voice/recording'

    const response = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please leave a message after the beep.</Say>
  <Record 
    maxLength="120"
    action="/api/twilio/voice/recording"
    transcribe="true" 
    transcribeCallback="/api/twilio/voice/transcription"
  />
  <Say>We did not receive a recording. Goodbye.</Say>
</Response>`;

    res.type('text/xml');
    res.send(response);
};

// Webhook: Twilio posts here when recording is done
exports.handleRecordingCallback = async (req, res) => {
    try {
        const { From, RecordingUrl, RecordingDuration, CallSid } = req.body;

        logger.info('Voicemail recording received', { from: From, duration: RecordingDuration });

        if (!RecordingUrl) {
            logger.warn('No RecordingUrl in callback');
            return res.status(200).end();
        }

        const voicemail = await Voicemail.create({
            fromNumber: From || 'Unknown',
            recordingUrl: RecordingUrl,
            recordingDuration: RecordingDuration ? parseInt(RecordingDuration, 10) : 0,
            transcriptionText: null // Will be updated later via transcription callback
        });

        // Notify immediately (transcription is pending)
        notifyLeadershipOfVoicemail(voicemail);

        res.status(200).end();
    } catch (error) {
        logger.error('Error handling recording callback', error);
        res.status(500).end();
    }
};

// Webhook: Twilio posts here when transcription is ready
exports.handleTranscriptionCallback = async (req, res) => {
    try {
        const { TranscriptionText, RecordingUrl } = req.body;

        logger.info('Voicemail transcription received');

        if (!RecordingUrl) {
            return res.status(200).end();
        }

        // Find the record by RecordingUrl
        // Note: If RecordingUrl is unique enough. Twilio adds extensions .mp3 sometimes. 
        // Usually the base URL matches. We'll try exact match first.
        let voicemail = await Voicemail.findOne({ where: { recordingUrl: RecordingUrl } });

        // If not found, trying fuzzy match or logging warning
        if (!voicemail) {
            // Sometimes Twilio sends json vs xml extension diffs. 
            // For now, strict match.
            logger.warn('Could not find voicemail record for transcription update', { url: RecordingUrl });
            return res.status(200).end();
        }

        // Update text
        voicemail.transcriptionText = TranscriptionText;
        await voicemail.save();

        // Optionally: re-notify with text
        // notifyLeadershipOfVoicemail(voicemail); 

        res.status(200).end();
    } catch (error) {
        logger.error('Error handling transcription callback', error);
        res.status(500).end();
    }
};

// Admin: List voicemails
exports.getVoicemails = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const { count, rows } = await Voicemail.findAndCountAll({
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: {
                voicemails: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    pages: Math.ceil(count / limit)
                }
            }
        });
    } catch (error) {
        logger.error('Error fetching voicemails', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Stream recording (Proxy to avoid 403 Forbidden on client)
exports.streamRecording = async (req, res) => {
    const https = require('https');
    try {
        const { id } = req.params;
        const voicemail = await Voicemail.findByPk(id);

        if (!voicemail || !voicemail.recordingUrl) {
            return res.status(404).send('Recording not found');
        }

        // Append .mp3 if missing to ensure Twilio serves audio
        let mediaUrl = voicemail.recordingUrl;
        if (!mediaUrl.endsWith('.mp3')) {
            mediaUrl += '.mp3';
        }

        // Verify credentials
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (!accountSid || !authToken) {
            console.error('❌ Twilio credentials missing in .env');
            return res.status(500).send('Server configuration error: Missing Twilio Credentials');
        }

        console.log(`Debug Proxy: Streaming ${mediaUrl}`);
        console.log(`Debug Proxy: Using SID ${accountSid.substring(0, 6)}...`);

        // Helper to handle redirects (Twilio often redirects to S3)
        const fetchUrl = (url, headers, redirectCount = 0) => {
            if (redirectCount > 3) {
                return res.status(500).send('Too many redirects');
            }

            const client = url.startsWith('https') ? require('https') : require('http');
            const reqOptions = { headers };

            client.get(url, reqOptions, (response) => {
                const { statusCode } = response;
                console.log(`Debug Proxy: Response ${statusCode} from ${url}`);

                // Handle Redirects (301, 302, 307) - Twilio redirects to S3
                if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
                    console.log('Debug Proxy: Following redirect...');
                    // S3 presigned URLs fail if we send Twilio Basic Auth headers, so strip them
                    return fetchUrl(response.headers.location, {}, redirectCount + 1);
                }

                if (statusCode >= 400) {
                    console.error(`Twilio/S3 Error: ${statusCode}`);
                    // If 403/401, likely auth issue
                    if (statusCode === 403 || statusCode === 401) {
                        return res.status(statusCode).send('Upstream Authentication Failed');
                    }
                    return res.status(statusCode).end();
                }

                // Pipe successful response
                res.status(statusCode);
                if (response.headers['content-type']) {
                    res.setHeader('Content-Type', response.headers['content-type']);
                }
                if (response.headers['content-length']) {
                    res.setHeader('Content-Length', response.headers['content-length']);
                }

                response.pipe(res);
            }).on('error', (e) => {
                logger.error('Error streaming from Twilio', e);
                res.status(500).end();
            });
        };

        // Initial Request with Auth
        const initialHeaders = {
            'Authorization': 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64')
        };

        fetchUrl(mediaUrl, initialHeaders);

    } catch (error) {
        logger.error('Error in streamRecording', error);
        res.status(500).send('Internal Server Error');
    }
};
