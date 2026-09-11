const express = require('express');
const router = express.Router();
const voicemailController = require('../controllers/voicemailController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { validateTwilioWebhook } = require('../middleware/twilioWebhook');

// Twilio webhooks. Unauthenticated by necessity — Twilio has no token to
// present — so the signature IS the authentication. Until this guard existed
// these were open POST handlers: anyone who learned the path could forge a
// voicemail with an attacker-chosen caller and recording URL, and trigger the
// notification that goes to leadership.
router.post('/voice', validateTwilioWebhook, voicemailController.handleIncomingCall);
router.post('/voice/recording', validateTwilioWebhook, voicemailController.handleRecordingCallback);
router.post('/voice/transcription', validateTwilioWebhook, voicemailController.handleTranscriptionCallback);

// Admin Access
router.get('/admin/voicemails',
    firebaseAuthMiddleware, // Ensure valid user
    roleMiddleware(['admin', 'church_leadership', 'secretary']), // ACL
    voicemailController.getVoicemails
);

router.get('/admin/voicemails/:id/stream',
    firebaseAuthMiddleware,
    roleMiddleware(['admin', 'church_leadership', 'secretary']),
    voicemailController.streamRecording
);

router.put('/admin/voicemails/:id/archive',
    firebaseAuthMiddleware,
    roleMiddleware(['admin', 'church_leadership', 'secretary']),
    voicemailController.archiveVoicemail
);

module.exports = router;
