const { google } = require('googleapis');

const youtube = google.youtube('v3');

// Cache configuration
let cache = {
    data: null,
    lastComputed: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a channel is currently live
 * Uses caching to avoid YouTube API quota limits
 * @param {string} channelId 
 * @returns {Promise<Object>} Status object { isLive: boolean, videoId: string | null }
 */
const checkYouTubeLiveStatus = async (channelId) => {
    // Return cached data if valid
    const now = Date.now();
    if (cache.data && (now - cache.lastComputed < CACHE_TTL)) {
        return cache.data;
    }

    try {
        const apiKey = process.env.YOUTUBE_API_KEY;

        if (!apiKey) {
            console.warn('YOUTUBE_API_KEY is not set. Skipping live check.');
            return { isLive: false };
        }

        const response = await youtube.search.list({
            key: apiKey,
            channelId: channelId,
            part: 'snippet',
            type: 'video',
            eventType: 'live',
            maxResults: 1
        });

        const items = response.data.items || [];
        const isLive = items.length > 0;

        const result = {
            isLive,
            videoId: isLive ? items[0].id.videoId : null,
            title: isLive ? items[0].snippet.title : null,
            thumbnail: isLive ? items[0].snippet.thumbnails.high.url : null
        };

        // Update cache
        cache = {
            data: result,
            lastComputed: now
        };

        return result;
    } catch (error) {
        // If we have stale cache, return it rather than failing
        if (cache.data) {
            console.warn('YouTube API error, serving stale cache:', error.message);
            return cache.data;
        }

        // Log detailed error for debugging but don't crash
        console.error('Error checking YouTube live status:', error.message);
        if (error.response) {
            console.error('YouTube API Error Details:', error.response.data);
        }

        throw error;
    }
};

module.exports = {
    checkYouTubeLiveStatus
};
