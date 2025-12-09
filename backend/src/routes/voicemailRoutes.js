const express = require('express');
const router = express.Router();
const voicemailController = require('../controllers/voicemailController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Public Twilio Webhooks (Twilio verifies signature usually, but for now open POSt)
router.post('/voice', voicemailController.handleIncomingCall);
router.post('/voice/recording', voicemailController.handleRecordingCallback);
router.post('/voice/transcription', voicemailController.handleTranscriptionCallback);

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
