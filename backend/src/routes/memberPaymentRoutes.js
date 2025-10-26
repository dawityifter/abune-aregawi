const express = require('express');
const router = express.Router();
const { 
  getAllMemberPayments, 
  getMemberPaymentDetails, 
  addMemberPayment, 
  generatePaymentReport, 
  getPaymentStats,
  getWeeklyReport,
  getMemberDuesForTreasurer
} = require('../controllers/memberPaymentController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Apply authentication middleware to all routes
router.use(firebaseAuthMiddleware);

// Read-only routes - allow church_leadership to view financial data
const viewRoles = ['treasurer', 'admin', 'church_leadership'];
const editRoles = ['treasurer', 'admin'];

// Get payment statistics for dashboard (READ-ONLY)
router.get('/stats', roleMiddleware(viewRoles), getPaymentStats);

// Get weekly collection report (READ-ONLY - must be before /:memberId to avoid conflicts)
router.get('/weekly-report', roleMiddleware(viewRoles), getWeeklyReport);

// Generate payment reports (READ-ONLY)
router.get('/reports/:reportType', roleMiddleware(viewRoles), generatePaymentReport);

// Get all member payments with filtering and pagination (READ-ONLY)
router.get('/', roleMiddleware(viewRoles), getAllMemberPayments);

// Get payment details for a specific member (READ-ONLY)
router.get('/:memberId', roleMiddleware(viewRoles), getMemberPaymentDetails);

// Get dues and payment history for any member (treasurer only - same as /dues page)
router.get('/:memberId/dues', roleMiddleware(viewRoles), getMemberDuesForTreasurer);

module.exports = router; 