const express = require('express');
const router = express.Router();
const {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionStats,
  getMemberPaymentSummaries,
  updateTransactionPaymentType,
  generateTransactionReport
} = require('../controllers/transactionController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Apply authentication middleware to all routes
router.use(firebaseAuthMiddleware);

// Define role groups
const viewRoles = ['admin', 'treasurer', 'church_leadership', 'secretary']; // Can view financial data
const editRoles = ['admin', 'treasurer']; // Can edit financial data
const deleteRoles = ['admin']; // Can delete transactions

// Get transaction statistics (READ-ONLY)
router.get('/stats', roleMiddleware(viewRoles), getTransactionStats);

// Generate transaction reports (READ-ONLY)
router.get('/reports/:reportType', roleMiddleware(viewRoles), generateTransactionReport);

// Get member payment summaries for new system (READ-ONLY)
router.get('/member-summaries', roleMiddleware(viewRoles), getMemberPaymentSummaries);

// Get all transactions (READ-ONLY)
router.get('/', roleMiddleware(viewRoles), getAllTransactions);

// Get a single transaction by ID (READ-ONLY)
router.get('/:id', roleMiddleware(viewRoles), getTransactionById);

// Create a new transaction (WRITE - treasurer/admin only)
router.post('/', roleMiddleware(editRoles), createTransaction);

// Update a transaction (WRITE - treasurer/admin only)
router.put('/:id', roleMiddleware(editRoles), updateTransaction);

// Update only payment_type (Zelle-only) (WRITE - treasurer/admin only)
router.patch('/:id/payment-type', roleMiddleware(editRoles), updateTransactionPaymentType);

// Delete a transaction (DELETE - admin only)
router.delete('/:id', roleMiddleware(deleteRoles), deleteTransaction);

module.exports = router; 