const express = require('express');
const router = express.Router();
const { 
  getAllMemberPayments, 
  getMemberPaymentDetails, 
  addMemberPayment, 
  generatePaymentReport, 
  getPaymentStats,
  getWeeklyReport
} = require('../controllers/memberPaymentController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Apply authentication middleware to all routes
router.use(firebaseAuthMiddleware);

// All routes require treasurer or admin role
router.use(roleMiddleware(['treasurer', 'admin']));

// Get all member payments with filtering and pagination
router.get('/', getAllMemberPayments);

// Get payment statistics for dashboard
router.get('/stats', getPaymentStats);

// Get weekly collection report (must be before /:memberId to avoid conflicts)
router.get('/weekly-report', getWeeklyReport);

// Get payment details for a specific member
router.get('/:memberId', getMemberPaymentDetails);

// Add or update payment for a member
router.post('/:memberId/payment', addMemberPayment);

// Generate payment reports
router.get('/reports/:reportType', generatePaymentReport);

module.exports = router; 