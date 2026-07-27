const express = require('express');
const router = express.Router();
const {
  syncFromSquare, getQueue, createTransactionFromReview,
  createBatchTransactions, ignoreQueueItem
} = require('../controllers/squareController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// NOTE: the webhook is mounted separately in server.js (raw body, public).
router.use(firebaseAuthMiddleware);
router.use(roleMiddleware(['treasurer', 'admin']));

router.post('/sync', syncFromSquare);
router.get('/queue', getQueue);
router.post('/reconcile/create-transaction', createTransactionFromReview);
router.post('/reconcile/batch-create', createBatchTransactions);
router.post('/queue/:id/ignore', ignoreQueueItem);

module.exports = router;
