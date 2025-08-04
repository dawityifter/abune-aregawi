const express = require('express');
const router = express.Router();
const {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionStats,
  getMemberPaymentSummaries
} = require('../controllers/transactionController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Apply authentication middleware to all routes
router.use(firebaseAuthMiddleware);

// Get all transactions (requires admin or treasurer role)
router.get('/', roleMiddleware(['admin', 'treasurer']), getAllTransactions);

// Get transaction statistics (requires admin or treasurer role)
router.get('/stats', roleMiddleware(['admin', 'treasurer']), getTransactionStats);

// Get member payment summaries for new system (requires admin or treasurer role)
router.get('/member-summaries', roleMiddleware(['admin', 'treasurer']), getMemberPaymentSummaries);

// Get a single transaction by ID (requires admin or treasurer role)
router.get('/:id', roleMiddleware(['admin', 'treasurer']), getTransactionById);

// Create a new transaction (requires admin or treasurer role)
router.post('/', roleMiddleware(['admin', 'treasurer']), createTransaction);

// Update a transaction (requires admin or treasurer role)
router.put('/:id', roleMiddleware(['admin', 'treasurer']), updateTransaction);

// Delete a transaction (requires admin role only)
router.delete('/:id', roleMiddleware(['admin']), deleteTransaction);

module.exports = router; 