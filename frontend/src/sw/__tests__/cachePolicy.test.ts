import { isCacheableApiRequest, isCacheableApiRequestSafe, CACHEABLE_API_PATH } from '../cachePolicy';

/**
 * These phones are frequently shared within a household, and CacheStorage
 * survives sign-out. The rule is an allowlist, never a denylist: if a new API
 * endpoint appears, it is uncacheable until someone deliberately adds it here.
 */

const req = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

describe('isCacheableApiRequest', () => {
  it('caches the public announcements feed', () => {
    expect(isCacheableApiRequest(req(`https://api.example.org${CACHEABLE_API_PATH}`))).toBe(true);
  });

  it('never caches a request carrying an Authorization header', () => {
    const authed = req(`https://api.example.org${CACHEABLE_API_PATH}`, {
      Authorization: 'Bearer some-firebase-id-token'
    });
    expect(isCacheableApiRequest(authed)).toBe(false);
  });

  it('never caches a request carrying an empty Authorization header', () => {
    // Several call sites in this codebase build auth headers as
    // `idToken ? `Bearer ${idToken}` : ''` (e.g. MemberList.tsx). Headers.get()
    // returns '' — not null — for a present-but-empty header, so a truthy check
    // would let this slip past the guard. The header being present at all,
    // regardless of value, must refuse the cache.
    const emptyAuth = req(`https://api.example.org${CACHEABLE_API_PATH}`, {
      Authorization: ''
    });
    expect(isCacheableApiRequest(emptyAuth)).toBe(false);
  });

  it.each([
    '/api/members/123',
    '/api/payments/stats',
    '/api/transactions',
    '/api/members/reports/household-directory',
    '/api/zelle/reconcile/create-transaction'
  ])('does not cache %s', (path) => {
    expect(isCacheableApiRequest(req(`https://api.example.org${path}`))).toBe(false);
  });

  it('does not cache a non-GET request to the allowlisted path', () => {
    const post = new Request(`https://api.example.org${CACHEABLE_API_PATH}`, { method: 'POST' });
    expect(isCacheableApiRequest(post)).toBe(false);
  });

  it('does not treat a path that merely starts with the allowlisted one as a match', () => {
    expect(isCacheableApiRequest(req('https://api.example.org/api/announcements/active-drafts'))).toBe(false);
  });
});

describe('isCacheableApiRequestSafe', () => {
  it('fails closed when isCacheableApiRequest throws', () => {
    // A malformed url reaching `new URL()` throws; the route matcher must treat
    // that as "not cacheable" rather than letting the exception escape and skip
    // the check entirely.
    const malformed = { headers: { get: () => null }, method: 'GET', url: 'not a valid url' } as unknown as Request;
    expect(() => isCacheableApiRequest(malformed)).toThrow();
    expect(isCacheableApiRequestSafe(malformed)).toBe(false);
  });

  it('agrees with isCacheableApiRequest on the happy path', () => {
    expect(isCacheableApiRequestSafe(req(`https://api.example.org${CACHEABLE_API_PATH}`))).toBe(true);
  });
});
