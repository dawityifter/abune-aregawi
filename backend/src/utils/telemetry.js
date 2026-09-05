'use strict';

/**
 * Error reporting for the API.
 *
 * Inert without SENTRY_DSN, so a deploy without it behaves exactly as before.
 *
 * Everything leaving this process goes through the redaction helpers in
 * logger.js AND the explicit field-by-field scrubbing below. logger.js's
 * redactSensitive was written to redact emails/phones/addresses and was only
 * being used in a handful of places; routing Sentry through it makes it the
 * mandatory gate it was meant to be. But it is a backstop, not the guard —
 * see the comment above scrubEvent for why explicit deletion does the real
 * work.
 *
 * This module was written after the frontend equivalent
 * (frontend/src/lib/errorTracking.ts) shipped with two PII leaks that a
 * review caught: unscrubbed event.breadcrumbs and unscrubbed event.tags.
 * Both leaks existed because Sentry populates those fields from places that
 * never pass through event.request, so scrubbing request.* alone missed
 * them entirely. The same is true here — @sentry/node's default
 * integrations (Console, Http, RequestData) populate breadcrumbs and
 * event.request from sources this module has to scrub independently. See
 * the field-by-field comments in scrubEvent below.
 */

const Sentry = require('@sentry/node');
const { redactSensitive } = require('./logger');

const DSN = process.env.SENTRY_DSN;

const isEnabled = () => Boolean(DSN);

/**
 * Masks numeric ids, UUIDs, and opaque high-entropy segments (e.g. a
 * Firebase UID) out of a path so a scrubbed URL can't be joined back to a
 * specific member. Deliberately the same three rules, in the same order, as
 * frontend/src/utils/analytics.ts's stripIdentifiers — the two runtimes
 * can't share a module (separate packages, no shared lib in this monorepo),
 * so this is a mirror, not a reference; if you change the masking rules on
 * one side, change them here too or the two will quietly drift.
 */
const ID_SEGMENT_PATTERNS = [
  /^\d+$/,
  /^[0-9a-f]{8}-[0-9a-f]{4}/i,
  // Opaque high-entropy segment: length >= 20, alphanumeric only, mixed
  // case. Narrow on purpose so it can't fire on an ordinary lowercase route
  // segment like "members" or "profile".
  /^(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{20,}$/,
];
const maskIdSegments = (pathname) =>
  pathname
    .split('/')
    .map((seg) => (ID_SEGMENT_PATTERNS.some((re) => re.test(seg)) ? ':id' : seg))
    .join('/');

/**
 * Strips a URL down to its path, with id-shaped segments masked. Several
 * routes carry ?email= and ?phone= (the Firebase profile lookup among them)
 * — the query string is dropped entirely by new URL(...).pathname / the
 * split('?') fallback — and the Firebase profile route itself carries the
 * member's Firebase UID as a *path* segment
 * (/api/members/profile/firebase/<uid>), which maskIdSegments catches.
 */
const stripUrl = (url) => {
  if (typeof url !== 'string') return url;
  try {
    return maskIdSegments(new URL(url).pathname);
  } catch (_) {
    return maskIdSegments(url.split('?')[0]);
  }
};

// Used both to gate an allowlisted tag's value and to redact PII patterns
// out of free-text fields (an exception message) where dropping the whole
// field would gut the report's usefulness. Deliberately the same shape as
// frontend/src/lib/errorTracking.ts's EMAIL_PATTERN/PHONE_PATTERN so the two
// halves of this system don't quietly diverge on what counts as PII.
const EMAIL_PATTERN = /\S+@\S+\.\S+/g;
const PHONE_PATTERN = /\+?\d[\d\-\s().]{6,}\d/g;
const looksLikePii = (value) => {
  EMAIL_PATTERN.lastIndex = 0;
  PHONE_PATTERN.lastIndex = 0;
  return EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value);
};

/**
 * Redacts email/phone-shaped substrings out of a free-text string without
 * discarding the rest of it. Used only for fields whose *value* is
 * unstructured prose we still want the shape of (an exception message) —
 * everywhere else in this module we can and do delete the field outright,
 * which is the stronger guarantee. redactSensitive can't do this job: it
 * only recognizes known *field names* on an object (see the comment on its
 * export in logger.js); a bare string has no field name to key off of.
 */
const redactPiiSubstrings = (text) => {
  if (typeof text !== 'string') return text;
  return text.replace(EMAIL_PATTERN, '[redacted-email]').replace(PHONE_PATTERN, '[redacted-phone]');
};

/**
 * Breadcrumbs are a second, independent way PII reaches Sentry even though
 * event.request is scrubbed below. Confirmed by reading the installed
 * @sentry/node-core's default integration list
 * (node_modules/@sentry/node-core/build/cjs/sdk/index.js): the Console
 * integration is on by default and mirrors every console.log/console.error
 * call in the process as a breadcrumb — verbatim arguments included — and
 * this codebase logs raw member/payment objects that way in a number of
 * places. The Http integration is also on by default and records a
 * breadcrumb for every outgoing/incoming HTTP call with a
 * `data['http.query']` field carrying the RAW, unsanitized query string
 * (confirmed by reading @sentry/core's
 * integrations/http/add-outgoing-request-breadcrumb.js — only `data.url` is
 * pre-sanitized by the SDK, `http.query` and `http.fragment` are not).
 *
 * Only 'http' has a documented, stable `data` shape this module can scrub
 * field-by-field (status_code, url, http.method — see
 * @sentry/core's FetchBreadcrumbData-equivalent for Node). Every other
 * category — 'console' (arbitrary logged arguments), any future
 * integration's breadcrumbs, or a category this module has never seen — has
 * a shape it cannot vouch for. Per the rule for fields that can't be
 * scrubbed with confidence, those are dropped (data and message both)
 * rather than guessed at; category, level, and timestamp are harmless and
 * kept so the trail still shows *that* something happened, just not its
 * content.
 */
const scrubBreadcrumb = (breadcrumb) => {
  if (!breadcrumb || typeof breadcrumb !== 'object') return breadcrumb;
  const { category } = breadcrumb;

  if (category === 'http') {
    const { data, message, ...safe } = breadcrumb;
    const scrubbedData = {};
    if (typeof data?.status_code === 'number') scrubbedData.status_code = data.status_code;
    const method = data?.['http.method'] || data?.method;
    if (method) scrubbedData.method = method;
    if (data?.url) scrubbedData.url = stripUrl(data.url);
    // Deliberately NOT copied: http.query, http.fragment (raw, unsanitized —
    // see the module-level comment above) and anything else on `data` this
    // module doesn't explicitly recognize. `message` is dropped too (same
    // as every other category) since the SDK doesn't set one for 'http'.
    return { ...safe, data: scrubbedData };
  }

  const { data, message, ...safe } = breadcrumb;
  return safe;
};

/**
 * Tags a caller may usefully attach when reporting an error — never data
 * about a member. Kept as a closed allowlist rather than passing
 * reportError's `context` through to event.tags unfiltered, so a future
 * call site that adds `{ memberId, phone }` "for debugging context" is
 * caught here — the one place every event passes through before it leaves
 * the process — rather than depending on every call site remembering not to
 * do that. Mirrors the same reasoning in the frontend equivalent.
 *
 * Belt-and-suspenders: even an allowed key's value is dropped if it looks
 * like an email or phone number, so a key name alone can't smuggle PII
 * through.
 */
const ALLOWED_TAG_KEYS = new Set(['route', 'method']);

const scrubTags = (tags) => {
  const scrubbed = {};
  for (const [key, value] of Object.entries(tags)) {
    if (!ALLOWED_TAG_KEYS.has(key)) continue;
    if (typeof value !== 'string' || looksLikePii(value)) continue;
    scrubbed[key] = value;
  }
  return scrubbed;
};

/**
 * The only interesting part of this module: what refuses to leave the
 * process. Exported so it can be tested directly rather than through
 * Sentry's client.
 *
 * Field-by-field accounting of every part of a Sentry Node event that could
 * carry PII (member emails/phones/addresses, dues amounts, Zelle memos,
 * bearer tokens):
 *
 *   - user            deleted outright. No member identity, ever.
 *   - extra            deleted outright. Free-form bag callers could put
 *                      anything into; not used today but not trustworthy.
 *   - request.url      stripped to its path (query strings carry ?email=,
 *                      ?phone=; several routes use them, e.g. the Firebase
 *                      profile lookup).
 *   - request.data      deleted outright. Request bodies carry dues amounts,
 *                      member records, and Zelle memos.
 *   - request.headers   deleted outright. Carries the bearer token and
 *                      forwarded-for IPs.
 *   - request.cookies   deleted outright. Session identifiers.
 *   - request.query_string  deleted outright. Sentry's RequestData
 *                      integration populates this independently of
 *                      request.url, so stripping the URL's query string
 *                      does not cover this field.
 *   - request.env       deleted outright. Documented by Sentry as able to
 *                      carry REMOTE_ADDR (client IP) and other server env
 *                      vars, though the installed @sentry/node@10.69.0 does
 *                      not appear to populate it in practice — client IP
 *                      instead lands on event.user.ip_address, which is
 *                      deleted unconditionally above. The deletion here is
 *                      defensive insurance against a future SDK version (or
 *                      an integration this app adds later) starting to
 *                      populate it, not a fix for a live leak.
 *   - transaction      stripped through stripUrl(), same as request.url.
 *                      Sentry's http/express integration sets this
 *                      independently of request.url — confirmed live: an
 *                      "unreconcile" error's request.url correctly read
 *                      /api/bank/transactions/:id/unreconcile while, on the
 *                      very same event, transaction still read the raw
 *                      "POST /api/bank/transactions/17/unreconcile", the
 *                      real row id intact. It is the string shown as the
 *                      issue's subtitle in the Sentry UI, so a leak here is
 *                      not a buried field — it is front and center. The
 *                      same class of gap as breadcrumbs above (an
 *                      integration populating a field before beforeSend
 *                      ever runs), just never enumerated until now.
 *   - culprit          stripped the same way, for the same reason —
 *                      Sentry's older/legacy twin of transaction, not
 *                      guaranteed absent just because transaction is set.
 *   - breadcrumbs      scrubbed per-breadcrumb; see scrubBreadcrumb above.
 *   - tags             filtered through a closed allowlist; see scrubTags.
 *   - contexts         left alone deliberately, not by omission: this app
 *                      never calls Sentry.setContext with member data, so
 *                      everything here is Sentry's own runtime/OS/app
 *                      metadata (node version, memory, uptime). Revisit if
 *                      that ever changes.
 *   - exception.values[].value   pattern-redacted (not deleted — this is the
 *                      single most useful field in the Sentry UI for
 *                      triage). Nothing in this codebase currently
 *                      interpolates PII into an Error message, but nothing
 *                      stops that six months from now, and redactSensitive
 *                      cannot help with a bare string (see its export
 *                      comment in logger.js).
 *   - message          same pattern-redaction as exception values, in case
 *                      a future call site ever uses captureMessage.
 */
const scrubEvent = (event) => {
  if (!event) return event;

  // No user identity, ever.
  delete event.user;
  delete event.extra;

  if (event.request) {
    event.request.url = stripUrl(event.request.url);
    // Bodies carry dues amounts, member records, and Zelle memos. Headers
    // carry bearer tokens. Cookies carry session identifiers. query_string
    // and env are populated independently of request.url by Sentry's
    // RequestData integration. None of these has diagnostic value worth the
    // risk.
    delete event.request.data;
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.query_string;
    delete event.request.env;
  }

  // Populated by the http/express integration independently of request.url
  // (see the field-by-field comment above) — id-shaped path segments here
  // survive beforeSend untouched otherwise, in the one field the Sentry UI
  // shows most prominently.
  if (typeof event.transaction === 'string') {
    event.transaction = stripUrl(event.transaction);
  }
  if (typeof event.culprit === 'string') {
    event.culprit = stripUrl(event.culprit);
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }

  if (event.tags) {
    event.tags = scrubTags(event.tags);
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((value) =>
      value && typeof value.value === 'string' ? { ...value, value: redactPiiSubstrings(value.value) } : value
    );
  }

  if (typeof event.message === 'string') {
    event.message = redactPiiSubstrings(event.message);
  }

  // Backstop, not the guard. redactSensitive only recognizes a fixed list of
  // known *field names* (email, phone_number, ...) wherever they occur in
  // the object tree, but has no idea what a phone number looks like by
  // shape, does nothing for a field name it doesn't recognize (confirmed:
  // it leaves `headers.authorization` and a raw URL string untouched), and
  // does nothing for PII embedded inside free text. The explicit deletions
  // and pattern redaction above are what actually keep PII out; this only
  // catches the shallow remainder — e.g. a known field name surviving
  // inside a part of the event this function didn't already delete. Do not
  // relax those deletions on the strength of this line.
  return redactSensitive(event);
};

const initTelemetry = () => {
  if (!isEnabled()) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV || 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
};

/**
 * Best-effort by definition: a failure to report must never fail a request.
 */
const reportError = (error, context) => {
  if (!isEnabled()) return;
  try {
    Sentry.captureException(error, context ? { tags: context } : undefined);
  } catch (_) {
    // Swallowed deliberately.
  }
};

module.exports = { initTelemetry, reportError, scrubEvent };
