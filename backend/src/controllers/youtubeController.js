const { checkYouTubeLiveStatus } = require('../services/youtubeService');

/**
 * Get YouTube live stream status for the church channel
 */
exports.getLiveStatus = async (req, res) => {
    try {
        const override = process.env.OVERRIDE_YOUTUBE_LIVE_FLAG === 'true';
        if (override) {
            return res.json({
                isLive: true,
                videoId: 'test_video_id',
                title: 'Test Live Stream (Override)',
                channelId: process.env.YOUTUBE_CHANNEL_ID || 'UCvK6pJUKU2pvoX7bQ3PN2aA'
            });
        }

        const force = req.query.force === 'true';

        // If specific channel requested, check only that
        if (req.query.channelId) {
            const liveStatus = await checkYouTubeLiveStatus(req.query.channelId, force);
            return res.json({ ...liveStatus, channelId: req.query.channelId });
        }

        // Otherwise check Main, then Spiritual
        const mainChannelId = process.env.YOUTUBE_CHANNEL_ID || 'UCvK6pJUKU2pvoX7bQ3PN2aA';
        const spiritualChannelId = process.env.YOUTUBE_SPIRITUAL_CHANNEL_ID || 'UCQXFCGSNdQ1y8GOmqbvRefg';

        // Check Main
        const mainStatus = await checkYouTubeLiveStatus(mainChannelId);

        if (mainStatus.isLive) {
            return res.json({ ...mainStatus, channelId: mainChannelId });
        }

        // Check Spiritual
        const spiritualStatus = await checkYouTubeLiveStatus(spiritualChannelId);

        if (spiritualStatus.isLive) {
            return res.json({ ...spiritualStatus, channelId: spiritualChannelId });
        }

        // Neither is live
        res.json({ isLive: false, channelId: mainChannelId });

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

/**
 * Get combined status for multiple channels
 */
exports.getMultiLiveStatus = async (req, res) => {
    try {
        const mainChannelId = process.env.YOUTUBE_CHANNEL_ID || 'UCvK6pJUKU2pvoX7bQ3PN2aA';
        const spiritualChannelId = process.env.YOUTUBE_SPIRITUAL_CHANNEL_ID || 'UCQXFCGSNdQ1y8GOmqbvRefg';

        const force = req.query.force === 'true';

        const [mainStatus, spiritualStatus] = await Promise.all([
            checkYouTubeLiveStatus(mainChannelId, force),
            checkYouTubeLiveStatus(spiritualChannelId, force)
        ]);

        res.json({
            main: { ...mainStatus, channelId: mainChannelId },
            spiritual: { ...spiritualStatus, channelId: spiritualChannelId }
        });
    } catch (error) {
        console.error('Error in getMultiLiveStatus:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch multi-channel live status'
        });
    }
};
