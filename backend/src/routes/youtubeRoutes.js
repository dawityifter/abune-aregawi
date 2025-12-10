const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtubeController');

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

module.exports = router;
