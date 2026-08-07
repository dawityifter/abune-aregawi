import { isCacheableApiRequest, CACHEABLE_API_PATH } from '../cachePolicy';

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
