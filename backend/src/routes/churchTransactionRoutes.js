const express = require('express');
const router = express.Router();
const {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionStats
} = require('../controllers/churchTransactionController');
const { authenticateToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/role');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all transactions (requires admin or treasurer role)
router.get('/', checkRole(['admin', 'treasurer']), getAllTransactions);

// Get transaction statistics (requires admin or treasurer role)
router.get('/stats', checkRole(['admin', 'treasurer']), getTransactionStats);

// Get a single transaction by ID (requires admin or treasurer role)
router.get('/:id', checkRole(['admin', 'treasurer']), getTransactionById);

// Create a new transaction (requires admin or treasurer role)
router.post('/', checkRole(['admin', 'treasurer']), createTransaction);

// Update a transaction (requires admin or treasurer role)
router.put('/:id', checkRole(['admin', 'treasurer']), updateTransaction);

// Delete a transaction (requires admin role only)
router.delete('/:id', checkRole(['admin']), deleteTransaction);

module.exports = router; 