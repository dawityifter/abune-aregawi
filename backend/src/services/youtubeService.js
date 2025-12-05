const axios = require('axios');

/**
 * Check if a YouTube channel is currently live streaming
 * @param {string} channelId - YouTube channel ID
 * @returns {Promise<{isLive: boolean, videoId?: string}>}
 */
async function checkYouTubeLiveStatus(channelId) {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        console.error('YOUTUBE_API_KEY not found in environment variables');
        return { isLive: false };
    }

    try {
        // Search for live broadcasts on the channel
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                channelId: channelId,
                eventType: 'live',
                type: 'video',
                key: apiKey,
            },
            headers: {
                'Referer': process.env.CLIENT_URL || 'http://localhost:3000'
            }
        });

        const liveVideos = response.data.items || [];

        if (liveVideos.length > 0) {
            return {
                isLive: true,
                videoId: liveVideos[0].id.videoId,
                title: liveVideos[0].snippet.title,
                thumbnail: liveVideos[0].snippet.thumbnails.medium.url,
            };
        }

        return { isLive: false };
    } catch (error) {
        console.error('Error checking YouTube live status:', error.response?.data || error.message);
        return { isLive: false };
    }
}

module.exports = { checkYouTubeLiveStatus };
