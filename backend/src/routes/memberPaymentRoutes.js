const express = require('express');
const router = express.Router();
const { 
  getAllMemberPayments, 
  getMemberPaymentDetails, 
  addMemberPayment, 
  generatePaymentReport, 
  getPaymentStats 
} = require('../controllers/memberPaymentController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// All routes require Firebase authentication and treasurer role
router.use(firebaseAuthMiddleware);

// Get all member payments with filtering and pagination
router.get('/', roleMiddleware(['treasurer', 'admin']), getAllMemberPayments);

// Get payment statistics for dashboard
router.get('/stats', roleMiddleware(['treasurer', 'admin']), getPaymentStats);

// Get payment details for a specific member
router.get('/:memberId', roleMiddleware(['treasurer', 'admin']), getMemberPaymentDetails);

// Add or update payment for a member
router.post('/:memberId/payment', roleMiddleware(['treasurer', 'admin']), addMemberPayment);

// Generate payment reports
router.get('/reports/:reportType', roleMiddleware(['treasurer', 'admin']), generatePaymentReport);

module.exports = router; 