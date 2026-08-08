const request = require('supertest');
const express = require('express');

jest.mock('../../services/youtubeService', () => ({
  checkYouTubeLiveStatus: jest.fn()
}));

// The refresh route is admin-only; stub the auth stack so these tests exercise wiring
// rather than firebase. roleMiddleware is a factory returning the actual middleware.
// Plain functions, not jest.fn(): the suite runs with resetMocks, which would strip
// these implementations and leave the middleware hanging without calling next().
jest.mock('../../middleware/auth', () => ({
  firebaseAuthMiddleware: (req, res, next) => {
    if (!req.headers.authorization) return res.status(401).json({ error: 'unauthorized' });
    req.user = { role: req.headers['x-test-role'] || 'member' };
    next();
  },
  authMiddleware: (req, res, next) => next()
}));

jest.mock('../../middleware/role', () => (allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user?.role)) return res.status(403).json({ error: 'forbidden' });
  next();
});

const { checkYouTubeLiveStatus } = require('../../services/youtubeService');

const MAIN = 'UC_main_channel';
const SPIRITUAL = 'UC_spiritual_channel';

const OLD_ENV = process.env;

// No jest.resetModules() here: re-running the service mock factory would hand the
// controller a different jest.fn() than the one these tests configure.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/youtube', require('../../routes/youtubeRoutes'));
  return app;
}

function idleStatus() {
  return { isLive: false, videoId: null, title: null, thumbnail: null };
}

beforeEach(() => {
  process.env = { ...OLD_ENV, YOUTUBE_CHANNEL_ID: MAIN, YOUTUBE_SPIRITUAL_CHANNEL_ID: SPIRITUAL };
  delete process.env.OVERRIDE_YOUTUBE_LIVE_FLAG;
  checkYouTubeLiveStatus.mockResolvedValue(idleStatus());
});

afterAll(() => { process.env = OLD_ENV; });

describe('GET /api/youtube/multi-live-status', () => {
  it('returns status for both channels', async () => {
    checkYouTubeLiveStatus.mockImplementation(async (channelId) =>
      channelId === MAIN
        ? { isLive: true, videoId: 'vid_live', title: 'Divine Liturgy', thumbnail: null }
        : idleStatus()
    );

    const res = await request(buildApp()).get('/api/youtube/multi-live-status').expect(200);

    expect(res.body.main).toMatchObject({ isLive: true, videoId: 'vid_live', channelId: MAIN });
    expect(res.body.spiritual).toMatchObject({ isLive: false, channelId: SPIRITUAL });
  });

  it('ignores ?force=true from unauthenticated callers', async () => {
    // Forcing costs quota on every request; a public force parameter lets anyone
    // drain the daily allowance and take the live banner down for everybody.
    await request(buildApp()).get('/api/youtube/multi-live-status?force=true').expect(200);

    expect(checkYouTubeLiveStatus).toHaveBeenCalledTimes(2);
    for (const call of checkYouTubeLiveStatus.mock.calls) {
      expect(call[1]).toBeFalsy();
    }
  });

  it('lets clients and proxies cache the response briefly', async () => {
    const res = await request(buildApp()).get('/api/youtube/multi-live-status').expect(200);

    expect(res.headers['cache-control']).toMatch(/max-age=\d+/);
  });

  it('still answers when one channel check fails', async () => {
    checkYouTubeLiveStatus.mockImplementation(async (channelId) => {
      if (channelId === SPIRITUAL) throw new Error('network down');
      return { isLive: true, videoId: 'vid_live', title: 'Divine Liturgy', thumbnail: null };
    });

    const res = await request(buildApp()).get('/api/youtube/multi-live-status').expect(200);

    expect(res.body.main).toMatchObject({ isLive: true });
    expect(res.body.spiritual).toMatchObject({ isLive: false });
  });
});

describe('POST /api/youtube/refresh', () => {
  it('rejects unauthenticated callers', async () => {
    await request(buildApp()).post('/api/youtube/refresh').expect(401);

    expect(checkYouTubeLiveStatus).not.toHaveBeenCalled();
  });

  it('rejects non-admin members', async () => {
    await request(buildApp())
      .post('/api/youtube/refresh')
      .set('authorization', 'Bearer token')
      .set('x-test-role', 'member')
      .expect(403);

    expect(checkYouTubeLiveStatus).not.toHaveBeenCalled();
  });

  it('forces a fresh check for an admin', async () => {
    const res = await request(buildApp())
      .post('/api/youtube/refresh')
      .set('authorization', 'Bearer token')
      .set('x-test-role', 'admin')
      .expect(200);

    expect(res.body.main).toMatchObject({ channelId: MAIN });
    for (const call of checkYouTubeLiveStatus.mock.calls) {
      expect(call[1]).toBe(true);
    }
  });
});
