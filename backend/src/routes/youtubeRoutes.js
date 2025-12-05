const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtubeController');

/**
 * @route   GET /api/youtube/live-status
 * @desc    Check if church YouTube channel is currently live streaming
 * @access  Public
 */
router.get('/live-status', youtubeController.getLiveStatus);

module.exports = router;
