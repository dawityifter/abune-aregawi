const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Protect all routes
router.use(firebaseAuthMiddleware);

/**
 * @route   GET /api/activity-logs
 * @desc    Get system activity logs
 * @access  Private (Admin only)
 */
router.get(
    '/',
    roleMiddleware(['admin']),
    activityLogController.getActivityLogs
);

module.exports = router;
