const { checkYouTubeLiveStatus } = require('../services/youtubeService');

/**
 * Get YouTube live stream status for the church channel
 */
exports.getLiveStatus = async (req, res) => {
    try {
        const channelId = req.query.channelId || process.env.YOUTUBE_CHANNEL_ID || 'UCvK6pJUKU2pvoX7bQ3PN2aA';

        // Check for override flag
        if (process.env.OVERRIDE_YOUTUBE_LIVE_FLAG === 'true') {
            return res.json({
                isLive: true,
                videoId: 'test_video_id',
                title: 'Test Live Stream (Override)'
            });
        }

        const liveStatus = await checkYouTubeLiveStatus(channelId);

        res.json(liveStatus);
    } catch (error) {
        console.error('Error in getLiveStatus:', error);
        res.status(500).json({
            isLive: false,
            error: 'Failed to check live status'
        });
    }
};

/**
 * Get YouTube configuration (Channel IDs)
 */
exports.getConfig = (req, res) => {
    res.json({
        mainChannelId: process.env.YOUTUBE_CHANNEL_ID || 'UCvK6pJUKU2pvoX7bQ3PN2aA',
        spiritualChannelId: process.env.YOUTUBE_SPIRITUAL_CHANNEL_ID || 'UCQXFCGSNdQ1y8GOmqbvRefg'
    });
};
