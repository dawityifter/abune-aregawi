const express = require('express');
const router = express.Router();
const volunteerController = require('../controllers/volunteerController');
const { firebaseAuthMiddleware: protect } = require('../middleware/auth');
const authorize = require('../middleware/role');

// Public/Protected access for submission (users must be logged in to submit)
router.post('/', protect, volunteerController.createVolunteerRequest);

// Admin access for viewing requests
router.get('/', protect, authorize('admin', 'secretary', 'board'), volunteerController.getVolunteerRequests);

// Update status
router.patch('/:id/status', protect, authorize('admin', 'secretary', 'board'), volunteerController.updateVolunteerRequestStatus);

module.exports = router;
