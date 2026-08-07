/**
 * Decides whether a request may be written to CacheStorage.
 *
 * Deliberately an allowlist. A denylist would mean every future endpoint is
 * cacheable until somebody remembers to exclude it, and the cost of forgetting
 * is a member's financial record sitting on a shared family phone after they
 * signed out.
 *
 * Kept free of service-worker globals so it can be unit tested directly.
 */

/** The only API response that may be cached. Public, projected to public fields. */
export const CACHEABLE_API_PATH = '/api/announcements/active';

export const isCacheableApiRequest = (request: Request): boolean => {
  // Checked first, before any path matching: an authenticated response is never
  // cacheable no matter what it is a response to.
  if (request.headers.get('Authorization')) return false;

  if (request.method !== 'GET') return false;

  return new URL(request.url).pathname === CACHEABLE_API_PATH;
};
