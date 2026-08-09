# Instrumentation: Engagement Events & Error Tracking — Design

Date: 2026-08-08
Status: Approved

## Goal

Make member engagement measurable, and make production failures visible.

Analytics *infrastructure* already exists and is not revisited here: `frontend/src/utils/analytics.ts`
loads a self-hosted Umami tracker, `AnalyticsTracker.tsx` records a pageview on every route
change, and `docs/ANALYTICS_SETUP.md` documents running it on the church's VM. That work
already reached the right conclusion — pageview data stays on parish infrastructure.

What is missing is everything above that foundation. `trackEvent()` is exported and has
**zero call sites**, so no custom event has ever fired. There is no error tracking of any
kind on either end. And nothing records whether a given member ever comes back.

After this ships the parish can answer:

1. Did anyone install the PWA we shipped in August?
2. Are announcements reaching anyone — i.e. how often does the block render, with how many
   items? (Not whether they are *read*; see the note under Events.)
3. Do members come back, and did that change when we improved the dashboard?
4. What is breaking in production, for whom, and how often?

Explicitly **not** in scope: the giving funnel (touches the Stripe flow), session replay,
structured request logging with correlation ids, and any per-member browsing history.

## Constraints that shaped this

- **This app holds real member PII and financial records.** Dues, pledges, loans, Zelle
  memos, phone numbers, addresses. The governing rule from `CLAUDE.md` is that none of it
  leaves the building. Every decision below bends to that.
- **Follow the precedent already set.** `analytics.ts` is inert without env vars, refuses
  to run outside production, honours Do Not Track, and strips identifiers before sending.
  The new pieces match that posture rather than inventing a second one.
- **Ships dark.** Merges before any Sentry account exists and no-ops until DSNs are set.
- **No eject, no CRACO.** Library code plus env vars; the CRA build is untouched.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Analytics vendor | Umami, self-hosted — **already chosen, unchanged** | Runs on the parish's own VM. No cookies, no consent banner, no third party can see which members looked at what. |
| Error tracking | Sentry, aggressively scrubbed | Mature Express + React support. Self-hosted GlitchTip is the consistent-with-Umami alternative; rejected for now as a third service to operate for a parish IT volunteer. Revisit if sending scrubbed stack traces off-VM proves unacceptable. |
| Return-visit measurement | `members.last_seen_at` in our own Postgres | Umami is deliberately anonymous and cannot answer "did *this member* come back." Keeping it in our DB answers it better and the data never moves. |
| Staff traffic | Tagged via `role_group`, not dropped | ~10 staff visiting daily against ~940 members visiting yearly would otherwise dominate every metric. Tagging preserves the admin signal too. |
| Event vocabulary | Four events, all on August's shipped surfaces | Each answers a question we currently guess at. More events can be added later against the same `trackEvent`. |

### The one place this design breaks consistency

Umami is self-hosted; Sentry is not. That is a real inconsistency and worth naming rather
than glossing. The justification: Umami receives a continuous stream of every member's
browsing, whereas Sentry receives only scrubbed exception payloads, and the scrubbing is
tested. If the parish would rather run GlitchTip, the `telemetry.js` seam below is the only
file that changes — it is a DSN and a client, not an architecture.

## Architecture

Four units. One extends existing code; three are new.

| Unit | Location | Status | Responsibility |
|---|---|---|---|
| `analytics` | `frontend/src/utils/analytics.ts` | **exists** — extend | Gains `role_group` on outgoing events. |
| Event call sites | `useServiceWorker.ts`, `ParishAnnouncements.tsx` | new | The four events below. |
| `errorTracking` | `frontend/src/lib/errorTracking.ts` | new | Sentry browser init + `beforeSend` scrubbing. |
| `telemetry` | `backend/src/utils/telemetry.js` | new | Sentry Node init + `beforeSend` through the existing redacting logger. |
| `last_seen_at` | migration + `backend/src/middleware/auth.js` | new | Throttled per-member timestamp. No vendor involved. |

### Role tagging

`role_group` is attached to every event as `staff` | `member` | `visitor`, decided by:

- Not signed in → `visitor`
- Signed in, and `getMergedPermissions(roles)` is identical to `ROLE_PERMISSIONS.member` → `member`
- Signed in, and it differs in any field → `staff`

Deriving it by *comparing permission sets* rather than listing role names is deliberate.
An explicit staff list would be a second role registry that drifts from
`frontend/src/utils/roles.ts` as roles are added — the review already found one such drift
(`deacon` and `priest` exist in the DB role enum but not in the frontend `UserRole` type).
It also avoids a subtler trap: no single permission flag is a correct discriminator. The
obvious candidate, `canViewAllMembers`, is `false` for `budget_committee` and `ap_team`,
both of which are plainly staff. Comparison against the member baseline classifies all
twelve roles correctly with no list to maintain.

`AnalyticsTracker` already sits inside both `Router` and `AuthProvider` in `App.tsx`, so it
can read auth state without any restructuring. The group is computed there and passed down,
so `analytics.ts` stays a dumb transport with no dependency on the auth context.

**`role_group` is a group, never an identity.** Three coarse buckets cannot single out a
member, which keeps the Umami dataset as anonymous as it is today. No member id, name, or
role name is ever attached to an event.

### Events

| Event | Fires when | Question it answers |
|---|---|---|
| `pwa_install_prompt` (prop: `shown` \| `accepted` \| `dismissed`) | Install card interaction in `useServiceWorker` | Is the install offer working? |
| `pwa_standalone_session` | First load of a session where `display-mode: standalone` matches, guarded by a `sessionStorage` flag so a member navigating ten pages counts once | How many members actually installed? |
| `announcement_block_rendered` (prop: `count`) | `ParishAnnouncements` mounts having rendered ≥1 item. Named *rendered*, not *seen* — there is no IntersectionObserver and it makes no claim about the member's viewport | Are announcements reaching anyone? |

**`announcement_click` was cut.** The spec originally listed it, on the assumption that a
member opens an announcement. They cannot: `ParishAnnouncements` renders title and body
inline in a `<li>` with no link, no expand, and no detail route. There is no interaction to
instrument.

This is worth stating plainly rather than quietly dropping, because it means **"are
announcements actually read?" is not answerable by this work.** We will learn that the block
rendered and how many items it held, which is the reach question, not the readership one.
Answering readership needs an affordance that does not exist yet — a collapsed card that
expands, or a permalink — and that is a product change belonging to the announcements
surface, not to instrumentation. Recorded as a follow-up.

### Frontend error tracking

Sentry with `sendDefaultPii: false` and a `beforeSend` that scrubs before anything leaves
the browser. Three deliberate filters:

- **`ChunkLoadError` is dropped entirely.** Every deploy produces a burst of these from
  clients holding a stale asset manifest. `lazyWithRecovery.ts` and `ErrorBoundary` already
  detect and recover from them by design. Reporting them would bury real errors under known,
  self-healing noise.
- **URLs pass through `stripIdentifiers()`** — the function `analytics.ts` already uses, so
  there is one identifier-stripping implementation, not two that drift. Query strings go
  entirely; numeric and UUID path segments become `:id`.
- **Do Not Track is honoured**, matching `initAnalytics()`. A member who has asked not to be
  tracked is not tracked by the error reporter either.

Capture points: `componentDidCatch` in the existing `ErrorBoundary` (replacing its four raw
`console.error` calls) and a global `unhandledrejection` listener.

`ErrorBoundary` is the app's crash fallback and must never itself throw — its own comments
make this point about i18n lookups. The Sentry call is therefore wrapped so that a failure
inside error *reporting* cannot break error *display*.

### Backend error tracking

Sentry for Express, initialized in `backend/src/server.js` and wired into the global error
handler at `server.js:290`, which today only `console.error`s the raw error.

The load-bearing decision: **`beforeSend` routes every event through the redaction helpers
already in `backend/src/utils/logger.js`.** That module was written to redact emails,
phones, and addresses, and the review found it used in only 5 files. This makes it the
mandatory gate on everything leaving the process — the job it was written for.

Request bodies are never attached; they carry dues amounts, member records, and Zelle memos.
Only method, scrubbed path, status code, and `role_group` are sent.

### Return visits

One migration adds `members.last_seen_at` (nullable timestamp, no default, no backfill — a
null honestly means "not seen since this shipped").

The auth middleware already loads the member row on every authenticated request, so the
write is cheap. Two properties matter:

- **Throttled to once per hour per member.** If `last_seen_at` is within the last hour, skip
  the write. A member clicking through ten pages causes one write, not ten.
- **Fire-and-forget.** Not awaited; failures caught and swallowed. A telemetry write must
  never fail a member's request. Instrumentation that can break the product is worse than
  no instrumentation.

## Testing

Following the precedent of `cachePolicy.ts` and the existing `analytics.test.ts` — the
interesting logic is pure and tested directly, with nothing tested against a live vendor.

| Test | Asserts |
|---|---|
| `analytics.test.ts` (extend) | `role_group` resolves correctly for staff, member, and visitor; no member id or role name appears in an event payload. |
| `errorTracking.test.ts` | A payload containing a phone number and an email does not survive `beforeSend`; a `ChunkLoadError` is dropped; URLs are stripped via `stripIdentifiers`; nothing sends under Do Not Track. |
| `telemetry.test.js` | Same PII assertion against the backend scrubber; request bodies are never attached. |
| `lastSeen.test.js` | A second call inside the throttle window issues no write; a DB failure does not reject the request. |

The PII assertions matter most. They are the executable form of the constraint this design
is built around, and must fail loudly if someone later relaxes a scrubber.

## Rollout

Two new env vars, plus documenting two that already exist but were never written down:

| Var | Status |
|---|---|
| `REACT_APP_UMAMI_SRC` | exists in code, **missing from `.env.example`** — add |
| `REACT_APP_UMAMI_WEBSITE_ID` | exists in code, **missing from `.env.example`** — add |
| `REACT_APP_SENTRY_DSN` | new |
| `SENTRY_DSN` | new (`backend/env.example`) |

Merged without the Sentry DSNs, nothing observable changes: no scripts load, no events send.
`last_seen_at` is the exception and starts collecting immediately, since it needs no vendor.

**Umami is already configured and live in production** (confirmed by the maintainer; the
repo cannot show this, since the vars are set at deploy time and were never added to
`.env.example`). Two consequences:

- The four events start reporting on the first deploy after this merges. No provisioning
  step stands between writing them and reading them.
- Pageview data is already accumulating today. Whatever baseline exists at merge time is the
  before-picture for dashboard v1 — worth screenshotting the current numbers before shipping
  any engagement change, because that comparison cannot be reconstructed later.

## Follow-ups, deliberately not in scope

- The giving funnel (Give → amount → submit → thank-you).
- An interaction affordance on announcements (expandable card or permalink) plus the
  `announcement_click` event it would make possible — the prerequisite for measuring
  readership rather than reach.
- Structured request logging with a correlation id — the review's third observability item.
- Retiring the 15 remaining raw `console.log` calls in `auth.js` in favour of the redacting
  logger. Related and worth doing, but cleanup rather than instrumentation.
- Self-hosting GlitchTip in place of Sentry, if sending scrubbed traces off-VM is judged
  unacceptable. `telemetry.js` is the only seam that changes.
