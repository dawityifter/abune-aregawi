// Type-only import: erased at compile time, so it carries none of the
// ~29 kB gzip the real @sentry/react module costs. That module is loaded
// dynamically in initErrorTracking() below, only once a DSN is confirmed
// configured — see the comment there for why.
import type { Breadcrumb, ErrorEvent as SentryEvent } from '@sentry/react';
import { stripIdentifiers } from '../utils/analytics';

/**
 * Error reporting, held to the same standard as analytics: inert without its
 * env var, silent in development, and it never sends anything that could
 * identify a member.
 */

const DSN = process.env.REACT_APP_SENTRY_DSN;

/**
 * Set once initErrorTracking()'s dynamic import resolves. Module-level for
 * the same reason analytics.ts's roleGroup is: exactly one place calls
 * initErrorTracking (index.tsx, once, at startup), and reportError needs
 * somewhere to find the loaded module without threading it through every
 * call site.
 */
let sentryModule: typeof import('@sentry/react') | null = null;

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
    // Destructure out data AND message (mirrors backend/src/utils/telemetry.js's
    // http branch): spreading `...breadcrumb` alone would carry `message`
    // through untouched, and Sentry's fetch/xhr integrations can set it.
    const { data: rawData, message, ...safe } = breadcrumb;
    const data = rawData as HttpBreadcrumbData | undefined;
    const scrubbedData: HttpBreadcrumbData = {};
    if (data?.method) scrubbedData.method = data.method;
    if (typeof data?.status_code === 'number') scrubbedData.status_code = data.status_code;
    if (data?.url) scrubbedData.url = scrubUrlString(data.url);
    return { ...safe, data: scrubbedData };
  }

  if (category === 'navigation') {
    const { data: rawData, message, ...safe } = breadcrumb;
    const data = rawData as NavigationBreadcrumbData | undefined;
    const scrubbedData: NavigationBreadcrumbData = {};
    if (data?.from) scrubbedData.from = scrubUrlString(data.from);
    if (data?.to) scrubbedData.to = scrubUrlString(data.to);
    return { ...safe, data: scrubbedData };
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

/**
 * Global-flagged twins of EMAIL_PATTERN/PHONE_PATTERN above, needed because
 * String.replace has to find every occurrence, not just test for one.
 * Deliberately separate objects rather than adding /g to EMAIL_PATTERN and
 * reusing it here: a global regex is stateful (lastIndex), and sharing one
 * instance between a .test() call site and a .replace() call site is how
 * you get a regex that silently alternates true/false on repeated calls.
 * Two objects, two purposes, no shared state to reason about. Deliberately
 * the same pattern *source* as backend/src/utils/telemetry.js's
 * EMAIL_PATTERN/PHONE_PATTERN so the two runtimes don't quietly diverge on
 * what counts as PII — see the comment there.
 */
const EMAIL_PATTERN_GLOBAL = /\S+@\S+\.\S+/g;
const PHONE_PATTERN_GLOBAL = /\+?\d[\d\-\s().]{6,}\d/g;

/**
 * Redacts email/phone-shaped substrings out of a free-text string without
 * discarding the rest of it. Used only for fields whose *value* is
 * unstructured prose we still want the shape of (an exception message or
 * event.message) — everywhere else in this module we can and do delete the
 * field outright, which is the stronger guarantee. Mirrors
 * backend/src/utils/telemetry.js's redactPiiSubstrings.
 */
const redactPiiSubstrings = (text: string): string =>
  text.replace(EMAIL_PATTERN_GLOBAL, '[redacted-email]').replace(PHONE_PATTERN_GLOBAL, '[redacted-phone]');

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

  // Pattern-redact rather than delete: the exception value is the single
  // most useful field in the Sentry UI for triage, so gutting it entirely
  // would defeat the point of shipping this at all. globalHandlersIntegration
  // is on by default in @sentry/browser, so this runs over EVERY uncaught
  // error and unhandled rejection, not just explicit reportError calls —
  // e.g. `throw new Error(data.message)` where a backend error message
  // embeds a member phone number. Mirrors
  // backend/src/utils/telemetry.js's scrubEvent, which does the same to
  // exception.values and event.message.
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((value) =>
      value && typeof value.value === 'string'
        ? { ...value, value: redactPiiSubstrings(value.value) }
        : value
    );
  }

  if (typeof event.message === 'string') {
    event.message = redactPiiSubstrings(event.message);
  }

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

/**
 * A DSN-less build merges with error tracking dark-shipped — no DSN is
 * configured in production yet — and @sentry/react is ~29 kB gzip. This
 * congregation is overwhelmingly on phones (see the code-splitting comment
 * in App.tsx for the same reasoning applied to the admin/treasurer routes),
 * so a static `import * as Sentry` would tax every member's initial bundle
 * for a library guaranteed to do nothing. The gating condition for a
 * dynamic import (DSN present) is identical to the dark-ship condition
 * (DSN absent), so isErrorTrackingEnabled() below doubles as the fetch
 * gate: the chunk is only requested once a DSN is actually configured.
 *
 * scrubEvent above stays synchronous and independently testable either way
 * — it doesn't touch the Sentry module at all, it only shapes plain
 * objects.
 */
export const initErrorTracking = (): void => {
  if (!isErrorTrackingEnabled()) return;
  // webpackChunkName is load-bearing, not cosmetic: frontend/src/service-worker.js
  // filters the precache manifest by matching /(admin|treasurer|outreach|sms|sentry)/
  // against each chunk's URL, because webpack's default production chunk names
  // are hashed numeric ids with no relation to the source (e.g.
  // "172.fa105aaf.chunk.js"). An unnamed chunk here would match nothing, silently
  // re-enter the precache, and get downloaded onto every member's phone on
  // install — exactly the outcome this dynamic import exists to avoid. See the
  // App.tsx comment above the staff-only lazy() routes for the same reasoning.
  import(/* webpackChunkName: "sentry" */ '@sentry/react')
    .then((Sentry) => {
      sentryModule = Sentry;
      Sentry.init({
        dsn: DSN,
        environment: process.env.NODE_ENV,
        sendDefaultPii: false,
        // Errors only. Performance tracing would sample real navigations and is not
        // what this work is for.
        tracesSampleRate: 0,
        beforeSend: scrubEvent,
      });
    })
    .catch(() => {
      // Best-effort: if the chunk fails to load (offline, blocked by an
      // extension, CDN hiccup), error tracking silently stays off rather
      // than breaking app startup.
    });
};

/**
 * Report a caught error. Wrapped so a failure inside error *reporting* can
 * never break error *display* — ErrorBoundary is the app's crash fallback and
 * must not throw.
 *
 * Best-effort in a second sense now too: until initErrorTracking()'s dynamic
 * import resolves, sentryModule is null and this is a no-op. A crash in the
 * brief window before the chunk loads goes unreported rather than throwing
 * or queuing — consistent with the rest of this module's stance that error
 * *reporting* must never risk error *display*.
 */
export const reportError = (error: Error, context?: Record<string, unknown>): void => {
  if (!isErrorTrackingEnabled()) return;
  if (!sentryModule) return;
  try {
    sentryModule.captureException(error, context ? { tags: context as Record<string, string> } : undefined);
  } catch {
    // Reporting is best-effort by definition.
  }
};
