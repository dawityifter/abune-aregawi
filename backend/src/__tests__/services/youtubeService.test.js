// Quota is the whole point of this service: YouTube Data API v3 gives 10,000 units/day
// and search.list costs 100 units per call, while channels/playlistItems/videos.list
// cost 1 unit each. These tests pin the cheap detection path and the caching that
// keeps a live check from fanning out into repeated API calls.

jest.mock('googleapis', () => {
  const channelsList = jest.fn();
  const playlistItemsList = jest.fn();
  const videosList = jest.fn();
  const searchList = jest.fn();
  return {
    __mocks: { channelsList, playlistItemsList, videosList, searchList },
    google: {
      youtube: () => ({
        channels: { list: channelsList },
        playlistItems: { list: playlistItemsList },
        videos: { list: videosList },
        search: { list: searchList }
      })
    }
  };
});

const CHANNEL = 'UC_test_channel';
const UPLOADS = 'UU_test_channel';

const OLD_ENV = process.env;

// Re-requiring resets the service's module-level cache. googleapis is re-required too
// because jest.resetModules() re-runs the mock factory and produces fresh jest.fn()s.
function loadService() {
  jest.resetModules();
  const mocks = require('googleapis').__mocks;
  const service = require('../../services/youtubeService');
  return { service, mocks };
}

function uploadsPlaylistResponse(playlistId = UPLOADS) {
  return { data: { items: [{ contentDetails: { relatedPlaylists: { uploads: playlistId } } }] } };
}

function recentVideosResponse(...videoIds) {
  return { data: { items: videoIds.map((videoId) => ({ contentDetails: { videoId } })) } };
}

function video(id, { liveBroadcastContent = 'none', title = `Video ${id}`, actualEndTime } = {}) {
  return {
    id,
    snippet: {
      title,
      liveBroadcastContent,
      thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } }
    },
    liveStreamingDetails: actualEndTime ? { actualStartTime: '2026-08-08T13:00:00Z', actualEndTime } : undefined
  };
}

function videosResponse(...videos) {
  return { data: { items: videos } };
}

// The happy path every test starts from: playlist resolves, one recent upload, not live.
function stubIdle(mocks) {
  mocks.channelsList.mockResolvedValue(uploadsPlaylistResponse());
  mocks.playlistItemsList.mockResolvedValue(recentVideosResponse('vid_1'));
  mocks.videosList.mockResolvedValue(videosResponse(video('vid_1')));
}

beforeEach(() => {
  process.env = { ...OLD_ENV, YOUTUBE_API_KEY: 'test_key' };
  delete process.env.FORCE_YOUTUBE_CHECK;
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe('checkYouTubeLiveStatus - live detection', () => {
  it('reports live with the broadcast id, title and thumbnail', async () => {
    const { service, mocks } = loadService();
    mocks.channelsList.mockResolvedValue(uploadsPlaylistResponse());
    mocks.playlistItemsList.mockResolvedValue(recentVideosResponse('vid_old', 'vid_live'));
    mocks.videosList.mockResolvedValue(videosResponse(
      video('vid_old'),
      video('vid_live', { liveBroadcastContent: 'live', title: 'Sunday Divine Liturgy' })
    ));

    const status = await service.checkYouTubeLiveStatus(CHANNEL);

    expect(status.isLive).toBe(true);
    expect(status.videoId).toBe('vid_live');
    expect(status.title).toBe('Sunday Divine Liturgy');
    expect(status.thumbnail).toBe('https://i.ytimg.com/vi/vid_live/hqdefault.jpg');
  });

  it('reports not live when no recent upload is broadcasting', async () => {
    const { service, mocks } = loadService();
    stubIdle(mocks);

    const status = await service.checkYouTubeLiveStatus(CHANNEL);

    expect(status.isLive).toBe(false);
    expect(status.videoId).toBeNull();
  });

  it('treats an upcoming broadcast as not live', async () => {
    const { service, mocks } = loadService();
    mocks.channelsList.mockResolvedValue(uploadsPlaylistResponse());
    mocks.playlistItemsList.mockResolvedValue(recentVideosResponse('vid_soon'));
    mocks.videosList.mockResolvedValue(videosResponse(video('vid_soon', { liveBroadcastContent: 'upcoming' })));

    const status = await service.checkYouTubeLiveStatus(CHANNEL);

    expect(status.isLive).toBe(false);
  });

  it('treats a broadcast that has already ended as not live', async () => {
    const { service, mocks } = loadService();
    mocks.channelsList.mockResolvedValue(uploadsPlaylistResponse());
    mocks.playlistItemsList.mockResolvedValue(recentVideosResponse('vid_done'));
    // YouTube can still report liveBroadcastContent: 'live' briefly after a stream ends;
    // actualEndTime is the authoritative signal and prevents a dead embed on the homepage.
    mocks.videosList.mockResolvedValue(videosResponse(
      video('vid_done', { liveBroadcastContent: 'live', actualEndTime: '2026-08-08T14:30:00Z' })
    ));

    const status = await service.checkYouTubeLiveStatus(CHANNEL);

    expect(status.isLive).toBe(false);
  });

  it('never calls the 100-unit search.list endpoint', async () => {
    const { service, mocks } = loadService();
    stubIdle(mocks);

    await service.checkYouTubeLiveStatus(CHANNEL);

    expect(mocks.searchList).not.toHaveBeenCalled();
  });

  it('asks videos.list for every recent upload in one request', async () => {
    const { service, mocks } = loadService();
    mocks.channelsList.mockResolvedValue(uploadsPlaylistResponse());
    mocks.playlistItemsList.mockResolvedValue(recentVideosResponse('a', 'b', 'c'));
    mocks.videosList.mockResolvedValue(videosResponse(video('a'), video('b'), video('c')));

    await service.checkYouTubeLiveStatus(CHANNEL);

    expect(mocks.videosList).toHaveBeenCalledTimes(1);
    expect(mocks.videosList.mock.calls[0][0]).toMatchObject({ id: 'a,b,c' });
  });

  it('resolves the uploads playlist once and reuses it on later checks', async () => {
    jest.useFakeTimers();
    const { service, mocks } = loadService();
    stubIdle(mocks);

    await service.checkYouTubeLiveStatus(CHANNEL);
    jest.advanceTimersByTime(10 * 60 * 1000);
    await service.checkYouTubeLiveStatus(CHANNEL);

    // A channel's uploads playlist id never changes, so this costs 1 unit for the
    // process lifetime; steady-state cost is 2 units (playlistItems + videos) per check.
    expect(mocks.channelsList).toHaveBeenCalledTimes(1);
    expect(mocks.playlistItemsList).toHaveBeenCalledTimes(2);
    expect(mocks.videosList).toHaveBeenCalledTimes(2);
  });
});

describe('checkYouTubeLiveStatus - caching', () => {
  it('serves the cached result without hitting the API inside the TTL', async () => {
    jest.useFakeTimers();
    const { service, mocks } = loadService();
    stubIdle(mocks);

    await service.checkYouTubeLiveStatus(CHANNEL);
    jest.advanceTimersByTime(30 * 1000);
    const second = await service.checkYouTubeLiveStatus(CHANNEL);

    expect(second.isLive).toBe(false);
    expect(mocks.playlistItemsList).toHaveBeenCalledTimes(1);
  });

  it('refetches once the TTL has expired', async () => {
    jest.useFakeTimers();
    const { service, mocks } = loadService();
    stubIdle(mocks);

    await service.checkYouTubeLiveStatus(CHANNEL);
    jest.advanceTimersByTime(61 * 1000);
    await service.checkYouTubeLiveStatus(CHANNEL);

    expect(mocks.playlistItemsList).toHaveBeenCalledTimes(2);
  });

  it('honours a TTL override from YOUTUBE_CACHE_TTL_MS', async () => {
    jest.useFakeTimers();
    process.env.YOUTUBE_CACHE_TTL_MS = '600000';
    const { service, mocks } = loadService();
    stubIdle(mocks);

    await service.checkYouTubeLiveStatus(CHANNEL);
    jest.advanceTimersByTime(5 * 60 * 1000);
    await service.checkYouTubeLiveStatus(CHANNEL);

    expect(mocks.playlistItemsList).toHaveBeenCalledTimes(1);
  });

  it('caches per channel rather than globally', async () => {
    const { service, mocks } = loadService();
    mocks.channelsList
      .mockResolvedValueOnce(uploadsPlaylistResponse('UU_main'))
      .mockResolvedValueOnce(uploadsPlaylistResponse('UU_spiritual'));
    mocks.playlistItemsList.mockResolvedValue(recentVideosResponse('vid_1'));
    mocks.videosList
      .mockResolvedValueOnce(videosResponse(video('vid_1', { liveBroadcastContent: 'live' })))
      .mockResolvedValueOnce(videosResponse(video('vid_1')));

    const main = await service.checkYouTubeLiveStatus('UC_main');
    const spiritual = await service.checkYouTubeLiveStatus('UC_spiritual');

    expect(main.isLive).toBe(true);
    expect(spiritual.isLive).toBe(false);
  });

  it('collapses concurrent cache misses into a single API round trip', async () => {
    const { service, mocks } = loadService();
    stubIdle(mocks);

    // Two channels polled by many homepage visitors land together whenever the TTL
    // expires; without single-flight each request costs its own quota units.
    const results = await Promise.all([
      service.checkYouTubeLiveStatus(CHANNEL),
      service.checkYouTubeLiveStatus(CHANNEL),
      service.checkYouTubeLiveStatus(CHANNEL)
    ]);

    expect(results.every(r => r.isLive === false)).toBe(true);
    expect(mocks.playlistItemsList).toHaveBeenCalledTimes(1);
    expect(mocks.videosList).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh request after an in-flight one settles', async () => {
    jest.useFakeTimers();
    const { service, mocks } = loadService();
    stubIdle(mocks);

    await service.checkYouTubeLiveStatus(CHANNEL);
    jest.advanceTimersByTime(61 * 1000);
    await service.checkYouTubeLiveStatus(CHANNEL);

    expect(mocks.playlistItemsList).toHaveBeenCalledTimes(2);
  });

  it('stops reporting live once a stream ends', async () => {
    // Regression: a long cache TTL used to keep isLive: true after the broadcast
    // ended, and YouTube marks an ended stream private, so the homepage embedded a
    // "This video is private" player.
    jest.useFakeTimers();
    const { service, mocks } = loadService();
    mocks.channelsList.mockResolvedValue(uploadsPlaylistResponse());
    mocks.playlistItemsList.mockResolvedValue(recentVideosResponse('vid_live'));
    mocks.videosList.mockResolvedValue(videosResponse(video('vid_live', { liveBroadcastContent: 'live' })));

    expect((await service.checkYouTubeLiveStatus(CHANNEL)).isLive).toBe(true);

    mocks.videosList.mockResolvedValue(videosResponse(video('vid_live', { liveBroadcastContent: 'none' })));
    jest.advanceTimersByTime(61 * 1000);

    expect((await service.checkYouTubeLiveStatus(CHANNEL)).isLive).toBe(false);
  });

  it('bypasses the cache when a check is forced', async () => {
    const { service, mocks } = loadService();
    stubIdle(mocks);

    await service.checkYouTubeLiveStatus(CHANNEL);
    await service.checkYouTubeLiveStatus(CHANNEL, true);

    expect(mocks.playlistItemsList).toHaveBeenCalledTimes(2);
  });
});

describe('checkYouTubeLiveStatus - failure handling', () => {
  it('skips the check when no API key is configured', async () => {
    delete process.env.YOUTUBE_API_KEY;
    const { service, mocks } = loadService();
    stubIdle(mocks);

    const status = await service.checkYouTubeLiveStatus(CHANNEL);

    expect(status).toEqual({ isLive: false, skipped: 'configuration_missing' });
    expect(mocks.playlistItemsList).not.toHaveBeenCalled();
  });

  it('serves the last known status when the API fails', async () => {
    jest.useFakeTimers();
    const { service, mocks } = loadService();
    mocks.channelsList.mockResolvedValue(uploadsPlaylistResponse());
    mocks.playlistItemsList.mockResolvedValue(recentVideosResponse('vid_live'));
    mocks.videosList.mockResolvedValue(videosResponse(video('vid_live', { liveBroadcastContent: 'live' })));

    await service.checkYouTubeLiveStatus(CHANNEL);

    const quotaError = Object.assign(new Error('quota'), { errors: [{ reason: 'quotaExceeded' }] });
    mocks.playlistItemsList.mockRejectedValue(quotaError);
    jest.advanceTimersByTime(61 * 1000);
    const status = await service.checkYouTubeLiveStatus(CHANNEL);

    expect(status.isLive).toBe(true);
    expect(status.videoId).toBe('vid_live');
    expect(status.isStale).toBe(true);
  });

  it('rejects when the API fails and nothing was ever cached', async () => {
    const { service, mocks } = loadService();
    mocks.channelsList.mockRejectedValue(new Error('network down'));

    await expect(service.checkYouTubeLiveStatus(CHANNEL)).rejects.toThrow('network down');
  });

  it('recovers on the next check after a failure', async () => {
    const { service, mocks } = loadService();
    mocks.channelsList.mockRejectedValueOnce(new Error('network down'));

    await expect(service.checkYouTubeLiveStatus(CHANNEL)).rejects.toThrow('network down');

    stubIdle(mocks);
    const status = await service.checkYouTubeLiveStatus(CHANNEL);

    expect(status.isLive).toBe(false);
  });
});
