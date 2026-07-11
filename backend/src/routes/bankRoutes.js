const express = require('express');
const router = express.Router();
const multer = require('multer');
const authorize = require('../middleware/role');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const { uploadBankCSV, getBankTransactions, reconcileTransaction, reconcileBulkTransactions, reconcileExpense, runAutoReconcile, unreconcileTransaction, getMonthlySummary } = require('../controllers/bankTransactionController');

// Configure Multer for memory storage (direct buffer access)
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication and Treasurer/Admin role
router.use(firebaseAuthMiddleware); // Verify Firebase Token

// Upload CSV
router.post('/upload', upload.single('file'), uploadBankCSV);

// List Transactions
router.get('/transactions', getBankTransactions);

// Month-by-month income/expense summary (last 12 months)
router.get('/summary/monthly', getMonthlySummary);

// Reconcile transaction
router.post('/reconcile', authorize(['admin', 'treasurer', 'bookkeeper']), reconcileTransaction);
router.post('/reconcile-bulk', authorize(['admin', 'treasurer', 'bookkeeper']), reconcileBulkTransactions);
router.post('/reconcile-expense', authorize(['admin', 'treasurer', 'bookkeeper']), reconcileExpense);

// Automatic reconciliation: on-demand re-run + undo
router.post('/auto-reconcile', authorize(['admin', 'treasurer', 'bookkeeper']), runAutoReconcile);
router.post('/transactions/:id/unreconcile', authorize(['admin', 'treasurer', 'bookkeeper']), unreconcileTransaction);

module.exports = router;
