'use strict';
const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { listAnnouncements, getActiveAnnouncements, createAnnouncement, updateAnnouncement, cancelAnnouncement } = require('../controllers/announcementController');

const ALLOWED_ROLES = ['admin', 'relationship'];

// Public feed — active announcements only, projected to public fields.
// Deliberately unauthenticated: a visitor deciding whether to come on Sunday
// needs to see what the parish has announced.
router.get('/active', getActiveAnnouncements);
// List all with ?status= filter
router.get('/', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), listAnnouncements);
// Create
router.post('/', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), createAnnouncement);
// Update
router.put('/:id', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), updateAnnouncement);
// Cancel (soft delete)
router.patch('/:id/cancel', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), cancelAnnouncement);

module.exports = router;
