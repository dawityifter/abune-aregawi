const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const {
  createLoan,
  recordRepayment,
  getLoans,
  getLoanById,
  getLoanStats,
  getLoanReceipt
} = require('../controllers/loanController');

const allowedRoles = ['admin', 'treasurer'];

router.get('/stats', firebaseAuthMiddleware, roleMiddleware(allowedRoles), getLoanStats);
router.get('/', firebaseAuthMiddleware, roleMiddleware(allowedRoles), getLoans);
router.get('/:id/receipt', firebaseAuthMiddleware, roleMiddleware(allowedRoles), getLoanReceipt);
router.get('/:id', firebaseAuthMiddleware, roleMiddleware(allowedRoles), getLoanById);
router.post('/', firebaseAuthMiddleware, roleMiddleware(allowedRoles), createLoan);
router.post('/:id/repayments', firebaseAuthMiddleware, roleMiddleware(allowedRoles), recordRepayment);

module.exports = router;
