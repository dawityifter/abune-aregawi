// Where a member lands after signing in.
//
// Two places already record where the member was trying to go — ProtectedRoute
// bounces a signed-out visitor with `state={{ from: location }}`, and the
// pledge page's "sign in to pledge" card does the same — but nothing read it,
// so every sign-in ended on /dashboard regardless. This is that missing reader.

// Public pages where arriving signed-in means the sign-in was the point of the
// visit, so the member gets moved along. Anywhere else they stay put: a member
// who signed in halfway through a page should not be yanked off it.
const REDIRECT_AFTER_LOGIN_PATHS = new Set<string>([
  '/login',
  '/credits',
  '/church-bylaw',
  '/donate',
  '/parish-pulse-sign-up',
]);

const DEFAULT_DESTINATION = '/dashboard';

type RecordedFrom =
  | string
  | { pathname?: string; search?: string }
  | null
  | undefined;

// `from` arrives through router state, so it is caller-supplied data and cannot
// be handed to navigate() without checking it still points at this site.
function toInternalPath(from: RecordedFrom): string | null {
  if (!from) return null;

  const raw =
    typeof from === 'string'
      ? from
      : `${from.pathname || ''}${from.search || ''}`;

  // Anything that is not a single-slash absolute path is a way off this
  // origin: '//host' and '/\host' are protocol-relative, 'https://host' is
  // explicit.
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;

  // Returning to the login page after logging in is a loop.
  if (raw === '/login') return null;

  return raw;
}

/**
 * Decide where to send a member whose sign-in just completed.
 *
 * Returns null to mean "do not navigate" — they are already somewhere they
 * chose to be.
 */
export function resolvePostLoginPath(
  currentPath: string,
  from: RecordedFrom
): string | null {
  if (!REDIRECT_AFTER_LOGIN_PATHS.has(currentPath)) return null;
  return toInternalPath(from) || DEFAULT_DESTINATION;
}
