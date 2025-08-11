const express = require('express');
const router = express.Router();
const { syncFromGmail, previewFromGmail, createTransactionFromPreview } = require('../controllers/zelleController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// All Zelle routes require Firebase auth and treasurer/admin role
router.use(firebaseAuthMiddleware);
router.use(roleMiddleware(['treasurer', 'admin']));

// Manual trigger: GET /api/zelle/sync/gmail?dryRun=true
router.get('/sync/gmail', syncFromGmail);
// Preview only (no writes, no labels): limit default 5
router.get('/preview/gmail', previewFromGmail);

// Reconciliation: create a Transaction from a preview item
router.post('/reconcile/create-transaction', createTransactionFromPreview);

module.exports = router;
