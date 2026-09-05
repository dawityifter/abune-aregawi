'use strict';

/**
 * How firebaseAuthMiddleware resolves a verified token to a member row.
 *
 * This is the highest-consequence path in the codebase: get it wrong and either
 * nobody can sign in, or somebody signs into the wrong person's account. It was
 * changed to look up by phone before email, because phone is what the user
 * actually authenticates with and members.phone_number is unique, whereas the
 * email unique constraint was deliberately dropped (migration 20260412000001)
 * so households can share an address.
 */

const TOKEN = { uid: 'firebase-uid-1', phone_number: '+14695550111', email: 'shared@family.example' };

let mockVerifyIdToken;
let mockGetUser;

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  apps: [],
  credential: { cert: jest.fn() },
  auth: () => ({
    verifyIdToken: (...a) => mockVerifyIdToken(...a),
    getUser: (...a) => mockGetUser(...a)
  })
}));

jest.mock('../models', () => ({
  Member: { findOne: jest.fn(), findAll: jest.fn() }
}));

// Env must be set before the middleware is required — it initializes Firebase
// Admin at module load and bails out entirely if neither a service account nor
// an emulator host is present.
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.NODE_ENV = 'test';
delete process.env.ENABLE_DEMO_MODE;

const { Member } = require('../models');
// Required once, deliberately: resetting modules per-test would give the
// middleware a fresh copy of the mocked models while the assertions below still
// pointed at the old one, and every lookup expectation would silently see zero
// calls.
const { firebaseAuthMiddleware } = require('../middleware/auth');

const member = (over = {}) => ({
  id: 1, email: TOKEN.email, phone_number: TOKEN.phone_number,
  role: 'member', roles: ['member'], is_active: true,
  firebase_uid: TOKEN.uid, update: jest.fn().mockResolvedValue(undefined),
  ...over
});

const mockRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};

const run = async (headers = { authorization: 'Bearer real-token' }) => {
  const req = { headers, query: {}, method: 'GET', originalUrl: '/api/x' };
  const res = mockRes();
  const next = jest.fn();
  await firebaseAuthMiddleware(req, res, next);
  return { req, res, next };
};

beforeEach(() => {
  mockVerifyIdToken = jest.fn().mockResolvedValue(TOKEN);
  mockGetUser = jest.fn().mockResolvedValue({ phoneNumber: TOKEN.phone_number });
  Member.findOne.mockReset();
  Member.findAll.mockReset();
});

describe('member resolution order', () => {
  it('resolves by phone number, and does not consult email at all', async () => {
    const m = member();
    Member.findOne.mockResolvedValue(m);

    const { res, next, req } = await run();

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
    expect(req.user.id).toBe(1);

    // Phone is the only lookup performed on the happy path.
    expect(Member.findOne).toHaveBeenCalledTimes(1);
    expect(Member.findOne).toHaveBeenCalledWith({
      where: { phone_number: TOKEN.phone_number }
    });
    expect(Member.findAll).not.toHaveBeenCalled();
  });

  it('normalizes a phone number that arrives without a leading +', async () => {
    mockVerifyIdToken.mockResolvedValue({ ...TOKEN, phone_number: '14695550111' });
    Member.findOne.mockResolvedValue(member());

    await run();

    expect(Member.findOne).toHaveBeenCalledWith({
      where: { phone_number: '+14695550111' }
    });
  });

  it('falls back to email only when no member matches the phone', async () => {
    Member.findOne.mockResolvedValue(null);
    Member.findAll.mockResolvedValue([member({ id: 7 })]);

    const { req, next } = await run();

    expect(Member.findAll).toHaveBeenCalledWith({
      where: { email: TOKEN.email },
      limit: 2
    });
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(7);
  });
});

describe('shared household email', () => {
  it('refuses to sign anyone in when an email matches two members', async () => {
    // The exact scenario the old email-first lookup silently mishandled:
    // a husband and wife sharing one address. findOne would have returned
    // whichever row the planner yielded first.
    Member.findOne.mockResolvedValue(null);
    Member.findAll.mockResolvedValue([member({ id: 7 }), member({ id: 8 })]);

    const { res, next } = await run();

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/more than one member/i);
  });

  it('still signs in the right person when phone matches, even on a shared email', async () => {
    // Same household, but the token carries a phone — the unique field wins and
    // no ambiguity arises.
    Member.findOne.mockResolvedValue(member({ id: 8 }));

    const { req, next } = await run();

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(8);
    expect(Member.findAll).not.toHaveBeenCalled();
  });
});

describe('rejections', () => {
  it('rejects a request with no bearer token', async () => {
    const { res, next } = await run({});
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects a token Firebase will not verify', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('bad signature'));
    const { res, next } = await run();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects when no member matches phone or email', async () => {
    Member.findOne.mockResolvedValue(null);
    Member.findAll.mockResolvedValue([]);
    const { res, next } = await run();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/complete your registration/i);
  });

  it('rejects a deactivated member', async () => {
    Member.findOne.mockResolvedValue(member({ is_active: false }));
    const { res, next } = await run();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/deactivated/i);
  });
});

describe('request identity', () => {
  it('exposes roles from the JSONB array, falling back to the single role', async () => {
    Member.findOne.mockResolvedValue(member({ roles: ['admin', 'treasurer'] }));
    const a = await run();
    expect(a.req.user.roles).toEqual(['admin', 'treasurer']);

    Member.findOne.mockResolvedValue(member({ roles: [], role: 'secretary' }));
    const b = await run();
    expect(b.req.user.roles).toEqual(['secretary']);
  });

  it('syncs a changed Firebase uid onto the member', async () => {
    const m = member({ firebase_uid: 'stale-uid' });
    Member.findOne.mockResolvedValue(m);
    await run();
    expect(m.update).toHaveBeenCalledWith({ firebase_uid: TOKEN.uid });
  });
});
