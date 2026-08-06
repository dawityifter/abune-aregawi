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

const SRC = process.env.REACT_APP_UMAMI_SRC;
const WEBSITE_ID = process.env.REACT_APP_UMAMI_WEBSITE_ID;
const SCRIPT_ID = 'umami-analytics';

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
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
 */
export function trackPageView(path: string): void {
  if (!isAnalyticsEnabled()) return;
  window.umami?.track('pageview', { url: stripIdentifiers(path) });
}

/**
 * Records a named thing a member did — "opened an announcement", "viewed dues".
 * Never pass member names, ids, phone numbers, or amounts.
 */
export function trackEvent(name: string, data?: Record<string, unknown>): void {
  if (!isAnalyticsEnabled()) return;
  window.umami?.track(name, data);
}

/**
 * Query strings and path segments in this app carry member ids
 * (/departments/:id, ?memberId=, ?phone=). Analytics has no use for them and
 * every reason not to store them.
 */
export function stripIdentifiers(path: string): string {
  const [pathname] = path.split('?');
  return pathname
    .split('/')
    .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg) ? ':id' : seg))
    .join('/');
}
