const express = require('express');
const router = express.Router();
const multer = require('multer');
const authorize = require('../middleware/role');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const { uploadBankCSV, getBankTransactions, reconcileTransaction } = require('../controllers/bankTransactionController');

// Configure Multer for memory storage (direct buffer access)
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication and Treasurer/Admin role
router.use(firebaseAuthMiddleware); // Verify Firebase Token

// Upload CSV
router.post('/upload', upload.single('file'), uploadBankCSV);

// List Transactions
router.get('/transactions', getBankTransactions);

// Reconcile transaction
router.post('/reconcile', authorize(['admin', 'treasurer', 'bookkeeper']), reconcileTransaction);

module.exports = router;
