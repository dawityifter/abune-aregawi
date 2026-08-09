import * as Sentry from '@sentry/react';
import type { Breadcrumb, ErrorEvent as SentryEvent } from '@sentry/react';
import { stripIdentifiers } from '../utils/analytics';

/**
 * Error reporting, held to the same standard as analytics: inert without its
 * env var, silent in development, and it never sends anything that could
 * identify a member.
 */

const DSN = process.env.REACT_APP_SENTRY_DSN;

/**
 * Runs a URL through the same "what counts as an identifier" logic used for
 * event.request.url, so request URLs and breadcrumb URLs can't drift into two
 * different scrubbing rules.
 */
const scrubUrlString = (url: string): string => {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // Already a bare path, or unparseable — strip it as-is.
  }
  return stripIdentifiers(path);
};

type HttpBreadcrumbData = { method?: string; url?: string; status_code?: number };
type NavigationBreadcrumbData = { from?: string; to?: string };

/**
 * Breadcrumbs are a second, independent way a phone number or email can reach
 * Sentry even though event.request.url is scrubbed below: Sentry's default
 * browser integrations auto-record every fetch/XHR call and every
 * client-side navigation as a breadcrumb, and those carry their own URLs
 * (FetchBreadcrumbData.url / XhrBreadcrumbData.url, or the from/to pair on a
 * navigation breadcrumb) that never pass through event.request at all. Any
 * error happening shortly after a call like
 * /api/members/profile/firebase/:uid?email=...&phone=... would otherwise
 * carry that full URL to Sentry via the breadcrumb trail regardless of what
 * this module does to event.request.
 *
 * Only 'xhr', 'fetch', and 'navigation' have a documented, stable `data`
 * shape this module can scrub field-by-field. Every other category —
 * 'console' (whatever a developer passed to console.log, verbatim — could be
 * a member object), 'ui.click'/'ui.input' (DOM element descriptions),
 * Sentry's own 'sentry.event'/'sentry.transaction' meta breadcrumbs, and
 * anything a future integration adds — has a shape this module cannot vouch
 * for. Per the rule for fields that can't be scrubbed with confidence, those
 * are dropped (data and message both) rather than guessed at; category,
 * level, and timestamp are harmless and kept so the trail still shows *that*
 * something happened, just not its content.
 */
const scrubBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb => {
  const { category } = breadcrumb;

  if (category === 'xhr' || category === 'fetch') {
    const data = breadcrumb.data as HttpBreadcrumbData | undefined;
    const scrubbedData: HttpBreadcrumbData = {};
    if (data?.method) scrubbedData.method = data.method;
    if (typeof data?.status_code === 'number') scrubbedData.status_code = data.status_code;
    if (data?.url) scrubbedData.url = scrubUrlString(data.url);
    return { ...breadcrumb, data: scrubbedData };
  }

  if (category === 'navigation') {
    const data = breadcrumb.data as NavigationBreadcrumbData | undefined;
    const scrubbedData: NavigationBreadcrumbData = {};
    if (data?.from) scrubbedData.from = scrubUrlString(data.from);
    if (data?.to) scrubbedData.to = scrubUrlString(data.to);
    return { ...breadcrumb, data: scrubbedData };
  }

  const { data, message, ...safe } = breadcrumb;
  return safe;
};

/**
 * Tags a caller may usefully attach when reporting an error — never data
 * about a member. Kept as a closed allowlist rather than passing
 * reportError's `context` through to event.tags unfiltered, so a future call
 * site that adds `{ memberId, phone }` "for debugging context" is caught
 * here — the one place every event passes through before it leaves the
 * browser — rather than depending on every call site remembering not to do
 * that. This is deliberately enforced in scrubEvent rather than by narrowing
 * reportError's parameter type: a TS type only stops mistakes made with an
 * inline object literal (excess-property checking doesn't apply to a value
 * that arrives via a variable), and it does nothing for tags a future
 * integration sets some other way. A runtime filter at the one choke point
 * every event passes through protects both cases.
 *
 * Belt-and-suspenders: even an allowed key's value is dropped if it looks
 * like an email or phone number, so a key name alone (e.g. someone later
 * reusing 'component' to hold a raw, query-string-bearing URL) can't
 * smuggle PII through.
 */
const ALLOWED_TAG_KEYS = new Set(['component', 'boundary', 'phase']);
const EMAIL_PATTERN = /\S+@\S+\.\S+/;
const PHONE_PATTERN = /\+?\d[\d\-\s().]{6,}\d/;
const looksLikePii = (value: string): boolean => EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value);

export const isErrorTrackingEnabled = (): boolean => {
  if (!DSN) return false;
  if (process.env.NODE_ENV !== 'production') return false;
  // Matches initAnalytics(): a member who asked not to be tracked is not
  // tracked by the error reporter either.
  if (typeof navigator !== 'undefined' && navigator.doNotTrack === '1') return false;
  return true;
};

/**
 * The only interesting part of this module: what refuses to leave the browser.
 * Exported so it can be tested directly rather than through Sentry's client.
 */
export const scrubEvent = (event: SentryEvent): SentryEvent | null => {
  // Every deploy produces a burst of these from clients holding a stale asset
  // manifest. lazyWithRecovery.ts and ErrorBoundary already detect and recover
  // from them by design, so reporting them would bury real errors under known,
  // self-healing noise.
  const type = event.exception?.values?.[0]?.type;
  if (type === 'ChunkLoadError') return null;

  // No user identity, ever.
  delete event.user;

  if (event.request) {
    if (event.request.url) {
      event.request.url = scrubUrlString(event.request.url);
    }
    // Headers carry session cookies and bearer tokens; the body carries dues
    // amounts and member records. Neither has diagnostic value worth the risk.
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
  }

  delete event.extra;

  // See scrubBreadcrumb above: this is a second, independent path PII can
  // take to Sentry, via auto-recorded fetch/XHR/navigation breadcrumbs that
  // never touch event.request.
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }

  // See ALLOWED_TAG_KEYS above: reportError's context lands here, and this is
  // the only place that keeps it honest regardless of what a call site passes.
  if (event.tags) {
    const scrubbedTags: Record<string, string> = {};
    for (const [key, value] of Object.entries(event.tags)) {
      if (!ALLOWED_TAG_KEYS.has(key)) continue;
      if (typeof value !== 'string' || looksLikePii(value)) continue;
      scrubbedTags[key] = value;
    }
    event.tags = scrubbedTags;
  }

  return event;
};

export const initErrorTracking = (): void => {
  if (!isErrorTrackingEnabled()) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
    // Errors only. Performance tracing would sample real navigations and is not
    // what this work is for.
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
};

/**
 * Report a caught error. Wrapped so a failure inside error *reporting* can
 * never break error *display* — ErrorBoundary is the app's crash fallback and
 * must not throw.
 */
export const reportError = (error: Error, context?: Record<string, unknown>): void => {
  if (!isErrorTrackingEnabled()) return;
  try {
    Sentry.captureException(error, context ? { tags: context as Record<string, string> } : undefined);
  } catch {
    // Reporting is best-effort by definition.
  }
};
