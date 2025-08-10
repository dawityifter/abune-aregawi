const express = require('express');
const router = express.Router();
const { syncFromGmail, previewFromGmail } = require('../controllers/zelleController');

// Manual trigger: GET /api/zelle/sync/gmail?dryRun=true
router.get('/sync/gmail', syncFromGmail);
// Preview only (no writes, no labels): limit default 5
router.get('/preview/gmail', previewFromGmail);

module.exports = router;
