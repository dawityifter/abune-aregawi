const { checkYouTubeLiveStatus } = require('../services/youtubeService');

// Short enough that a stream going live still surfaces quickly, long enough that
// repeat polls from the same browser never reach the origin.
const PUBLIC_CACHE_SECONDS = 30;

const mainChannel = () => process.env.YOUTUBE_CHANNEL_ID || 'UCvK6pJUKU2pvoX7bQ3PN2aA';
const spiritualChannel = () => process.env.YOUTUBE_SPIRITUAL_CHANNEL_ID || 'UCQXFCGSNdQ1y8GOmqbvRefg';

const idle = (channelId) => ({ isLive: false, videoId: null, title: null, thumbnail: null, channelId });

/**
 * Resolve both channels without letting one failure blank out the other.
 * `force` is never derived from the request query: forcing bypasses the cache and
 * costs quota, so it is reserved for the authenticated refresh endpoint.
 */
const resolveChannels = async (force = false) => {
    const main = mainChannel();
    const spiritual = spiritualChannel();

    const [mainResult, spiritualResult] = await Promise.allSettled([
        checkYouTubeLiveStatus(main, force),
        checkYouTubeLiveStatus(spiritual, force)
    ]);

    const unwrap = (settled, channelId) => {
        if (settled.status === 'fulfilled') {
            return { ...settled.value, channelId };
        }
        console.error(`[YouTube] Live check failed for ${channelId}:`, settled.reason?.message);
        return idle(channelId);
    };

    return {
        main: unwrap(mainResult, main),
        spiritual: unwrap(spiritualResult, spiritual)
    };
};

/**
 * Get YouTube live stream status for the church channel (first channel that is live)
 */
exports.getLiveStatus = async (req, res) => {
    try {
        if (process.env.OVERRIDE_YOUTUBE_LIVE_FLAG === 'true') {
            return res.json({
                isLive: true,
                videoId: 'test_video_id',
                title: 'Test Live Stream (Override)',
                channelId: mainChannel()
            });
        }

        res.set('Cache-Control', `public, max-age=${PUBLIC_CACHE_SECONDS}`);

        if (req.query.channelId) {
            const liveStatus = await checkYouTubeLiveStatus(req.query.channelId);
            return res.json({ ...liveStatus, channelId: req.query.channelId });
        }

        const { main, spiritual } = await resolveChannels();
        if (main.isLive) return res.json(main);
        if (spiritual.isLive) return res.json(spiritual);
        return res.json(idle(main.channelId));
    } catch (error) {
        console.error('Error in getLiveStatus:', error);
        res.status(500).json({ isLive: false, error: 'Failed to check live status' });
    }
};

/**
 * Get YouTube configuration (Channel IDs)
 */
exports.getConfig = (req, res) => {
    res.json({
        mainChannelId: mainChannel(),
        spiritualChannelId: spiritualChannel()
    });
};

/**
 * Get combined status for both channels — this is what the homepage banner polls.
 */
exports.getMultiLiveStatus = async (req, res) => {
    try {
        res.set('Cache-Control', `public, max-age=${PUBLIC_CACHE_SECONDS}`);
        res.json(await resolveChannels());
    } catch (error) {
        console.error('Error in getMultiLiveStatus:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch multi-channel live status' });
    }
};

/**
 * Admin-only cache bypass, for confirming a stream is detected without waiting a TTL.
 */
exports.refreshLiveStatus = async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');
        res.json(await resolveChannels(true));
    } catch (error) {
        console.error('Error in refreshLiveStatus:', error);
        res.status(500).json({ success: false, error: 'Failed to refresh live status' });
    }
};
