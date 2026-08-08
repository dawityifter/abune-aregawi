const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtubeController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

/**
 * @route   GET /api/youtube/live-status
 * @desc    Check if church YouTube channel is currently live streaming
 * @access  Public
 */
router.get('/live-status', youtubeController.getLiveStatus);

/**
 * @route   GET /api/youtube/config
 * @desc    Get YouTube Channel IDs configuration
 * @access  Public
 */
router.get('/config', youtubeController.getConfig);

/**
 * @route   GET /api/youtube/multi-live-status
 * @desc    Check live status for both channels (polled by the homepage banner)
 * @access  Public
 */
router.get('/multi-live-status', youtubeController.getMultiLiveStatus);

/**
 * @route   POST /api/youtube/refresh
 * @desc    Bypass the cache and re-check both channels
 * @access  Admin — a cache bypass costs API quota on every call
 */
router.post(
    '/refresh',
    firebaseAuthMiddleware,
    roleMiddleware(['admin']),
    youtubeController.refreshLiveStatus
);

module.exports = router;
