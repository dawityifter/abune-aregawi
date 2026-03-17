'use strict';
const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { listAnnouncements, getActiveAnnouncements, createAnnouncement, updateAnnouncement, cancelAnnouncement } = require('../controllers/announcementController');

const ALLOWED_ROLES = ['admin', 'relationship'];

// TV feed — active only, auth required
router.get('/active', firebaseAuthMiddleware, getActiveAnnouncements);
// List all with ?status= filter
router.get('/', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), listAnnouncements);
// Create
router.post('/', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), createAnnouncement);
// Update
router.put('/:id', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), updateAnnouncement);
// Cancel (soft delete)
router.patch('/:id/cancel', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), cancelAnnouncement);

module.exports = router;
