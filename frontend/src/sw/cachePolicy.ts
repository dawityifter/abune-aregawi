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
  // cacheable no matter what it is a response to. Explicit `!== null`, not a
  // truthy check: Headers.get() returns '' (not null) for a header that is
  // present but empty, and this codebase builds auth headers as
  // `idToken ? \`Bearer ${idToken}\` : ''` in several places (RoleManagement.tsx,
  // MemberEditModal.tsx, MemberList.tsx) — a truthy check would let that empty
  // string slip through.
  if (request.headers.get('Authorization') !== null) return false;

  if (request.method !== 'GET') return false;

  return new URL(request.url).pathname === CACHEABLE_API_PATH;
};

/**
 * The route matcher Workbox actually registers. Wraps isCacheableApiRequest so
 * a throw (a malformed `request.url` reaching `new URL()`, for instance) is
 * treated as "not cacheable" rather than escaping the matcher — an exception
 * here must never let a request skip this check and fall through to being
 * cached by accident.
 */
export const isCacheableApiRequestSafe = (request: Request): boolean => {
  try {
    return isCacheableApiRequest(request);
  } catch {
    return false;
  }
};
