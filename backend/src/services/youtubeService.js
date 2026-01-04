const { google } = require('googleapis');

const youtube = google.youtube('v3');

// Cache configuration
const cache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes (Very responsive during active hours)
const LONG_CACHE_TTL = 60 * 60 * 1000; // 1 hour (Low frequency check outside core hours)

/**
 * Check if the current time is within core broadcasting hours (CST)
 * Thursday: 7PM - 10PM (19 - 22)
 * Friday: 7PM - 10PM (19 - 22)
 * Sunday: 4AM - 2PM (4 - 14) // Extended until 2PM
 */
const isCoreHour = () => {
    const now = new Date();
    // Use America/Chicago for CST/CDT
    const options = { timeZone: 'America/Chicago', hour12: false, weekday: 'long', hour: 'numeric' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);

    const day = parts.find(p => p.type === 'weekday').value;
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);

    let result = false;
    if (day === 'Thursday' && hour >= 18 && hour < 22) result = true; // Start an hour earlier
    if (day === 'Friday' && hour >= 18 && hour < 22) result = true;   // Start an hour earlier
    if (day === 'Saturday' && hour >= 17 && hour < 21) result = true; // Added Saturday
    if (day === 'Sunday' && hour >= 4 && hour < 16) result = true;    // Extended until 4PM

    console.log(`[YouTube] Core Hour Check: ${day} at ${hour}:00 CST/CDT -> ${result ? 'YES' : 'NO'}`);
    return result;
};

/**
 * Check if a channel is currently live
 * Uses caching to avoid YouTube API quota limits
 * @param {string} channelId 
 * @param {boolean} forceCheck
 * @returns {Promise<Object>} Status object { isLive: boolean, videoId: string | null }
 */
const checkYouTubeLiveStatus = async (channelId, forceCheck = false) => {
    // Check if check is forced or if we have an API key (regardless of NODE_ENV)
    const canCheck = !!process.env.YOUTUBE_API_KEY || process.env.FORCE_YOUTUBE_CHECK === 'true';

    if (!canCheck) {
        return { isLive: false, skipped: 'configuration_missing' };
    }

    const isCore = isCoreHour();
    const bypassCore = process.env.FORCE_YOUTUBE_CHECK === 'true' || process.env.NODE_ENV === 'development' || forceCheck;

    // Return cached data if valid
    const now = Date.now();
    const cachedItem = cache.get(channelId);

    // If outside core hours AND not bypassing, only check if cache is older than LONG_CACHE_TTL
    if (!isCore && !bypassCore) {
        if (cachedItem && (now - cachedItem.lastComputed < LONG_CACHE_TTL)) {
            console.log(`[YouTube] Outside core hours: Serving cached status for ${channelId} (Last checked ${Math.round((now - cachedItem.lastComputed) / 60000)}m ago)`);
            return cachedItem.data;
        }
        console.log(`[YouTube] Outside core hours, but cache is stale. Fetching fresh status for ${channelId}...`);
    } else {
        // Within core hours or bypassing: use standard CACHE_TTL
        if (cachedItem && (now - cachedItem.lastComputed < CACHE_TTL)) {
            console.log(`[YouTube] Within core/bypass hours: Serving cached status for ${channelId}`);
            return cachedItem.data;
        }
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
