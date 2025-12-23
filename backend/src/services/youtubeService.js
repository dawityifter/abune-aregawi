const { google } = require('googleapis');

const youtube = google.youtube('v3');

// Cache configuration
const cache = new Map();
const CACHE_TTL = 35 * 60 * 1000; // 35 minutes (Strictly safe for 2 channels)

/**
 * Check if the current time is within core broadcasting hours (CST)
 * Thursday: 7PM - 10PM (19 - 22)
 * Friday: 7PM - 10PM (19 - 22)
 * Sunday: 4AM - 12PM (4 - 12)
 */
const isCoreHour = () => {
    const now = new Date();
    // Use America/Chicago for CST/CDT
    const options = { timeZone: 'America/Chicago', hour12: false, weekday: 'long', hour: 'numeric' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);

    const day = parts.find(p => p.type === 'weekday').value;
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);

    if (day === 'Thursday' && hour >= 19 && hour < 22) return true;
    if (day === 'Friday' && hour >= 19 && hour < 22) return true;
    if (day === 'Sunday' && hour >= 4 && hour < 12) return true;

    return false;
};

/**
 * Check if a channel is currently live
 * Uses caching to avoid YouTube API quota limits
 * @param {string} channelId 
 * @returns {Promise<Object>} Status object { isLive: boolean, videoId: string | null }
 */
const checkYouTubeLiveStatus = async (channelId) => {
    // Only check in production and during core hours
    const isProduction = process.env.NODE_ENV === 'production' || process.env.FORCE_YOUTUBE_CHECK === 'true';

    if (!isProduction) {
        // Skip in development unless forced
        return { isLive: false, skipped: 'development' };
    }

    if (!isCoreHour()) {
        console.log(`[YouTube] Skipping live check for ${channelId}: outside core hours`);
        return { isLive: false, skipped: 'outside_hours' };
    }

    // Return cached data if valid
    const now = Date.now();
    const cachedItem = cache.get(channelId);

    if (cachedItem && (now - cachedItem.lastComputed < CACHE_TTL)) {
        console.log(`[YouTube] Serving cached live status for ${channelId}`);
        return cachedItem.data;
    }

    try {
        const apiKey = process.env.YOUTUBE_API_KEY;

        if (!apiKey) {
            console.warn('[YouTube] API key not set. Skipping live check.');
            return { isLive: false };
        }

        console.log(`[YouTube] Fetching fresh live status for ${channelId} from API...`);
        const response = await youtube.search.list({
            key: apiKey,
            channelId: channelId,
            part: 'snippet',
            type: 'video',
            eventType: 'live',
            maxResults: 1,
            headers: {
                Referer: process.env.FRONTEND_URL || 'https://abunearegawi.church'
            }
        });

        const items = response.data.items || [];
        const isLive = items.length > 0;

        const result = {
            isLive,
            videoId: isLive ? items[0].id.videoId : null,
            title: isLive ? items[0].snippet.title : null,
            thumbnail: isLive ? items[0].snippet.thumbnails.high.url : null,
            lastChecked: new Date().toISOString()
        };

        // Update cache
        cache.set(channelId, {
            data: result,
            lastComputed: now
        });

        return result;
    } catch (error) {
        // Handle Quota errors specifically
        const isQuotaError = error.errors?.some(e => e.reason === 'quotaExceeded' || e.reason === 'rateLimitExceeded');

        if (isQuotaError) {
            console.error('[YouTube] CRITICAL: API Quota exceeded or rate limited.');
        }

        // If we have stale cache, return it rather than failing
        const staleItem = cache.get(channelId);
        if (staleItem) {
            console.warn('[YouTube] API error, serving stale cache:', error.message);
            return {
                ...staleItem.data,
                isStale: true,
                error: error.message
            };
        }

        console.error('[YouTube] API request failed:', error.message);
        throw error;
    }
};

module.exports = {
    checkYouTubeLiveStatus
};
