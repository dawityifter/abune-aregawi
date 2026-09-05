/**
 * Umami analytics, self-hosted.
 *
 * The parish holds member PII, so pageview data does not go to an ad network.
 * Umami runs on the church's own VM: no cookies, no cross-site identifiers,
 * nothing that needs a consent banner, and nobody outside the parish can see
 * which members looked at what.
 *
 * Inert until REACT_APP_UMAMI_SRC and REACT_APP_UMAMI_WEBSITE_ID are set, so a
 * build without them behaves exactly as before.
 */

import type { RoleGroup } from './roleGroup';

const SRC = process.env.REACT_APP_UMAMI_SRC;
const WEBSITE_ID = process.env.REACT_APP_UMAMI_WEBSITE_ID;
const SCRIPT_ID = 'umami-analytics';

/**
 * Set once by AnalyticsTracker whenever auth state changes. Module-level
 * because exactly one tracker is mounted for the app's lifetime, and because
 * this module deliberately has no React dependency.
 *
 * A group, never an identity: three coarse buckets cannot single out a member,
 * which keeps the Umami dataset as anonymous as it is today.
 */
let roleGroup: RoleGroup = 'visitor';

export const setRoleGroup = (group: RoleGroup): void => {
  roleGroup = group;
};

/**
 * Builds the payload for an outgoing event.
 *
 * Exported for testing, and worth keeping that way: isAnalyticsEnabled() is
 * false outside production, so a test that called trackEvent and inspected
 * window.umami.track would assert over an empty call list and pass no matter
 * what this code did. This is the part with actual behaviour in it.
 */
export const buildEventData = (data?: Record<string, unknown>): Record<string, unknown> => ({
  ...data,
  role_group: roleGroup,
});

declare global {
  interface Window {
    umami?: {
      // Two call shapes: a named custom event (`track('name', data)`), or a
      // callback that receives and returns the tracker's auto-collected
      // payload — the form trackPageView uses so a hit is stored as a
      // native page view rather than a same-named custom event.
      track: {
        (event: string, data?: Record<string, unknown>): void;
        (
          callback: (props: Record<string, unknown>) => Record<string, unknown>
        ): void;
      };
    };
  }
}

export const isAnalyticsEnabled = (): boolean =>
  Boolean(SRC && WEBSITE_ID) && process.env.NODE_ENV === 'production';

/**
 * Loads the tracker once. Safe to call repeatedly; does nothing when
 * unconfigured, in development, or when the visitor has asked not to be
 * tracked.
 */
export function initAnalytics(): void {
  if (!isAnalyticsEnabled()) return;
  if (typeof document === 'undefined') return;
  if (document.getElementById(SCRIPT_ID)) return;

  // Honouring Do Not Track costs one line and is the right default for a
  // church website.
  if (navigator.doNotTrack === '1') return;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = SRC as string;
  script.defer = true;
  script.setAttribute('data-website-id', WEBSITE_ID as string);
  // Router changes are tracked explicitly by trackPageView, so the script's own
  // history hooks would double-count.
  script.setAttribute('data-auto-track', 'false');
  document.head.appendChild(script);
}

/**
 * Records a page view. The path is passed through untouched apart from
 * stripping query strings, which can carry a member id or an email on the
 * registration and reconciliation flows.
 *
 * Deliberately NOT `window.umami.track('pageview', data)`. Passing a string
 * as the first argument makes Umami store the hit as a *custom event* named
 * "pageview" (event_type 2) rather than a native page view (event_type 1) —
 * it does not special-case the literal string "pageview". That mistake is
 * why the Umami dashboard's Views/Pages/Referrers/Sources panels stayed
 * empty even while real traffic was landing: every hit was filed as a
 * same-named custom event instead. The callback form below receives the
 * tracker's auto-collected payload (url, referrer, hostname, screen,
 * language, title — no `name` field), and returning it without adding a
 * `name` is what tells Umami this is a genuine page view. Overriding `url`
 * on that payload (rather than nesting it inside `data`, as the old code
 * did) is what makes the *stripped* path the one Umami stores and shows in
 * Pages/Referrers, instead of the raw unstripped URL the script would have
 * collected automatically.
 */
export function trackPageView(path: string): void {
  if (!isAnalyticsEnabled()) return;
  window.umami?.track((props) => ({
    ...props,
    url: stripIdentifiers(path),
    data: buildEventData(),
  }));
}

/**
 * Records a named thing a member did — "opened an announcement", "viewed dues".
 * Never pass member names, ids, phone numbers, or amounts.
 */
export function trackEvent(name: string, data?: Record<string, unknown>): void {
  if (!isAnalyticsEnabled()) return;
  window.umami?.track(name, buildEventData(data));
}

/**
 * Catches opaque high-entropy identifiers that are neither numeric nor
 * UUID-shaped — a Firebase UID (e.g. `Xk3mZq9LpR2sTuVwYz01AbCdEf23`) being
 * the motivating case: AuthContext hits
 * `/api/members/profile/firebase/<uid>` on every sign-in, and that uid is a
 * stable, unique per-member identifier that joins to both the parish DB and
 * Firebase Auth. Deliberately narrow — length >= 20, alphanumeric only, and
 * mixed case — so it can't fire on this app's real route slugs, which are
 * all lowercase-with-hyphens (e.g. `parish-pulse-sign-up`, `church-bylaw`):
 * hyphens fail the alphanumeric-only check, and single-case words fail the
 * mixed-case check. See frontend/src/App.tsx for the full route list this
 * was checked against.
 *
 * Mirrored in backend/src/utils/telemetry.js's stripUrl — keep the two in
 * sync; see the comment there.
 */
const HIGH_ENTROPY_SEGMENT = /^(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{20,}$/;

/**
 * Query strings and path segments in this app carry member ids
 * (/departments/:id, ?memberId=, ?phone=). Analytics has no use for them and
 * every reason not to store them.
 */
export function stripIdentifiers(path: string): string {
  const [pathname] = path.split('?');
  return pathname
    .split('/')
    .map((seg) =>
      /^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg) || HIGH_ENTROPY_SEGMENT.test(seg)
        ? ':id'
        : seg
    )
    .join('/');
}
