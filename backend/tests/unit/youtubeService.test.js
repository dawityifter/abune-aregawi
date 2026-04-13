/**
 * Tests for youtubeService stale-cache bug.
 *
 * Bug: when a stream ends near/after a core-hours boundary, the 1-hour
 * LONG_CACHE_TTL returns `isLive: true` for up to an hour after the stream
 * ends.  YouTube marks the ended stream private, so users see
 * "This video is private" inside the LiveStreamBanner.
 *
 * Fix: `isLive: true` results must use a short TTL (5 min) even outside
 * core hours.  Only `isLive: false` results are safe to cache for 1 hour.
 */

jest.mock('googleapis', () => ({
    google: {
        youtube: jest.fn()
    }
}));

describe('youtubeService — stale isLive cache outside core hours', () => {
    const CHANNEL_ID = 'UC_test_channel_123';

    // Monday 15:00 CDT = 20:00 UTC — definitively NOT a core hour
    const MONDAY_3PM_CDT = new Date('2026-04-13T20:00:00Z');

    let checkYouTubeLiveStatus;
    let mockSearchList;

    const makeLiveResponse = (videoId = 'live-video-123') => ({
        data: {
            items: [{
                id: { videoId },
                snippet: {
                    title: 'Live Stream',
                    thumbnails: { high: { url: 'https://thumb.jpg' } }
                }
            }]
        }
    });

    const makeNotLiveResponse = () => ({ data: { items: [] } });

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        jest.setSystemTime(MONDAY_3PM_CDT);

        process.env.YOUTUBE_API_KEY = 'test-api-key';
        delete process.env.FORCE_YOUTUBE_CHECK;

        mockSearchList = jest.fn();
        const { google } = require('googleapis');
        google.youtube.mockReturnValue({ search: { list: mockSearchList } });

        ({ checkYouTubeLiveStatus } = require('../../src/services/youtubeService'));
    });

    afterEach(() => {
        jest.useRealTimers();
        delete process.env.YOUTUBE_API_KEY;
    });

    it('serves cached isLive: true within 5 minutes when outside core hours', async () => {
        mockSearchList.mockResolvedValue(makeLiveResponse());

        // First call: populates cache with isLive: true
        const first = await checkYouTubeLiveStatus(CHANNEL_ID);
        expect(first.isLive).toBe(true);

        // Advance 3 minutes — still within the 5-min live-result TTL
        jest.advanceTimersByTime(3 * 60 * 1000);

        // Second call: cache is fresh enough, no API call needed
        const second = await checkYouTubeLiveStatus(CHANNEL_ID);
        expect(second.isLive).toBe(true);
        expect(mockSearchList).toHaveBeenCalledTimes(1); // served from cache
    });

    it('rechecks and returns isLive: false when isLive: true cache is older than 5 minutes outside core hours', async () => {
        // First API call: stream is live; second API call: stream has ended
        mockSearchList
            .mockResolvedValueOnce(makeLiveResponse())
            .mockResolvedValueOnce(makeNotLiveResponse());

        // First call: cache populated with isLive: true
        const first = await checkYouTubeLiveStatus(CHANNEL_ID);
        expect(first.isLive).toBe(true);

        // Advance 6 minutes — past the 5-min live TTL, but inside the 1-hour long TTL
        // Without the fix the service returns the stale isLive: true from cache.
        jest.advanceTimersByTime(6 * 60 * 1000);

        // Second call: must recheck; stream ended, should return isLive: false
        const second = await checkYouTubeLiveStatus(CHANNEL_ID);
        expect(second.isLive).toBe(false);
        expect(mockSearchList).toHaveBeenCalledTimes(2); // forced a recheck
    });

    it('serves stale isLive: false for up to 1 hour outside core hours', async () => {
        mockSearchList.mockResolvedValue(makeNotLiveResponse());

        // First call: cache populated with isLive: false
        const first = await checkYouTubeLiveStatus(CHANNEL_ID);
        expect(first.isLive).toBe(false);

        // Advance 59 minutes — well within the 1-hour long TTL
        jest.advanceTimersByTime(59 * 60 * 1000);

        // Second call: isLive: false is safe to serve from cache
        const second = await checkYouTubeLiveStatus(CHANNEL_ID);
        expect(second.isLive).toBe(false);
        expect(mockSearchList).toHaveBeenCalledTimes(1); // no extra API call
    });
});
