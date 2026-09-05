const { google } = require('googleapis');

const youtube = google.youtube('v3');

// YouTube Data API v3 quota: 10,000 units/day by default.
//   search.list        = 100 units   <- avoid; 100 checks/day exhausts the quota
//   channels.list      =   1 unit    <- once per channel, uploads playlist id never changes
//   playlistItems.list =   1 unit
//   videos.list        =   1 unit
// Steady-state cost is 2 units per channel per check, so two channels polled every
// 60s costs 2 * 2 * 1440 = 5,760 units/day and stays inside the quota around the clock.
// That is why there is no "core broadcasting hours" throttle here: the cheap path is
// affordable all week, and time-window throttling only ever delayed detection.
const DEFAULT_CACHE_TTL = 60 * 1000;

// How many recent uploads to inspect. A live broadcast appears at the head of the
// uploads playlist, but a few scheduled/premiere entries can sit above it.
const RECENT_UPLOADS_TO_INSPECT = 5;

const cache = new Map();          // channelId -> { data, lastComputed }
const inFlight = new Map();       // channelId -> Promise, single-flight guard
const uploadsPlaylists = new Map(); // channelId -> uploads playlist id

const cacheTtl = () => {
    const configured = parseInt(process.env.YOUTUBE_CACHE_TTL_MS, 10);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_CACHE_TTL;
};

// The API key is referrer-restricted in Google Cloud Console, so requests must carry a
// Referer the key accepts.
const requestOptions = () => ({
    headers: {
        Referer: (process.env.FRONTEND_URL || 'https://abunearegawi.church').split(',')[0].trim()
    }
});

const getUploadsPlaylistId = async (channelId, apiKey) => {
    if (uploadsPlaylists.has(channelId)) {
        return uploadsPlaylists.get(channelId);
    }

    const response = await youtube.channels.list({
        key: apiKey,
        id: channelId,
        part: 'contentDetails'
    }, requestOptions());

    const playlistId = response.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
    if (playlistId) {
        uploadsPlaylists.set(channelId, playlistId);
    }
    return playlistId;
};

const findLiveBroadcast = async (channelId, apiKey) => {
    const playlistId = await getUploadsPlaylistId(channelId, apiKey);
    if (!playlistId) {
        console.warn(`[YouTube] No uploads playlist for channel ${channelId}`);
        return null;
    }

    const playlistResponse = await youtube.playlistItems.list({
        key: apiKey,
        playlistId,
        part: 'contentDetails',
        maxResults: RECENT_UPLOADS_TO_INSPECT
    }, requestOptions());

    const videoIds = (playlistResponse.data.items || [])
        .map(item => item.contentDetails?.videoId)
        .filter(Boolean);

    if (videoIds.length === 0) {
        return null;
    }

    const videosResponse = await youtube.videos.list({
        key: apiKey,
        id: videoIds.join(','),
        part: 'snippet,liveStreamingDetails'
    }, requestOptions());

    // liveBroadcastContent can still read 'live' for a short window after a stream ends,
    // which is what made ended streams show as a private/dead embed on the homepage.
    // actualEndTime is authoritative.
    return (videosResponse.data.items || []).find(item =>
        item.snippet?.liveBroadcastContent === 'live' && !item.liveStreamingDetails?.actualEndTime
    ) || null;
};

const fetchLiveStatus = async (channelId, apiKey) => {
    console.log(`[YouTube] Fetching fresh live status for ${channelId}...`);
    const live = await findLiveBroadcast(channelId, apiKey);

    return {
        isLive: !!live,
        videoId: live ? live.id : null,
        title: live ? live.snippet.title : null,
        thumbnail: live ? live.snippet.thumbnails?.high?.url || null : null,
        lastChecked: new Date().toISOString()
    };
};

/**
 * Check if a channel is currently live.
 * Results are cached per channel, and concurrent misses share one API round trip.
 * @param {string} channelId
 * @param {boolean} forceCheck bypass the cache (quota-expensive; keep admin-only)
 * @returns {Promise<Object>} { isLive, videoId, title, thumbnail, lastChecked }
 */
const checkYouTubeLiveStatus = async (channelId, forceCheck = false) => {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        return { isLive: false, skipped: 'configuration_missing' };
    }

    const now = Date.now();
    const cachedItem = cache.get(channelId);

    if (!forceCheck && cachedItem && (now - cachedItem.lastComputed < cacheTtl())) {
        return cachedItem.data;
    }

    // Single-flight: without this, every poll that lands after the TTL expires fires
    // its own set of API calls, so quota burn scales with visitors instead of time.
    const pending = inFlight.get(channelId);
    if (pending) {
        return pending;
    }

    const request = fetchLiveStatus(channelId, apiKey)
        .then((result) => {
            cache.set(channelId, { data: result, lastComputed: Date.now() });
            return result;
        })
        .catch((error) => {
            const isQuotaError = error.errors?.some(e => e.reason === 'quotaExceeded' || e.reason === 'rateLimitExceeded');
            if (isQuotaError) {
                console.error('[YouTube] CRITICAL: API quota exceeded or rate limited.');
            }

            // Stale data beats no data for a banner that is usually "not live".
            const staleItem = cache.get(channelId);
            if (staleItem) {
                console.warn('[YouTube] API error, serving stale cache:', error.message);
                return { ...staleItem.data, isStale: true, error: error.message };
            }

            console.error('[YouTube] API request failed:', error.message);
            throw error;
        })
        .finally(() => {
            inFlight.delete(channelId);
        });

    inFlight.set(channelId, request);
    return request;
};

module.exports = {
    checkYouTubeLiveStatus
};
