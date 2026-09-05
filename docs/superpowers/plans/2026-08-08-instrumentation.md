# Instrumentation: Engagement Events & Error Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make member engagement measurable and production failures visible, by adding role-tagged custom events to the existing Umami analytics, Sentry error tracking on both ends with tested PII scrubbing, and a `members.last_seen_at` column for return-visit measurement.

**Architecture:** Umami analytics already exists, is live in production, and is not rebuilt — `frontend/src/utils/analytics.ts` gains a `role_group` parameter and gets called from two new places. Sentry is added as two small modules (`frontend/src/lib/errorTracking.ts`, `backend/src/utils/telemetry.js`), each of which scrubs before sending: the frontend reuses `stripIdentifiers()` from `analytics.ts`, the backend reuses the redaction helpers in `backend/src/utils/logger.js`. Return visits are recorded by a throttled, fire-and-forget write in the auth middleware.

**Tech Stack:** React 19 + TypeScript 4.9 (CRA `react-scripts` 5.0.1, no eject/CRACO), Jest + React Testing Library, Express 4 + Sequelize 6 + PostgreSQL, `@sentry/react` and `@sentry/node`, self-hosted Umami.

**Spec:** `docs/superpowers/specs/2026-08-08-instrumentation-design.md`

## Global Constraints

- **Member PII must never leave the building.** No member id, name, phone, email, address, or financial amount may reach Umami or Sentry. Every scrubber has a test asserting this; those tests are the point of the work, not decoration.
- **Everything ships dark.** No new behaviour without its env var set. A build with no Sentry DSN must behave exactly as it does today.
- **Never break the product to report on it.** Every telemetry call is wrapped so its failure cannot fail a render or a request.
- **Do Not Track is honoured**, matching `initAnalytics()` in `frontend/src/utils/analytics.ts:40`.
- **`role_group` is one of exactly three literals:** `'staff' | 'member' | 'visitor'`. Never a role name, never an id.
- **No eject, no CRACO.** Library code and env vars only.
- **Do not commit or push without asking** — the maintainer tests locally before any deploy. Each task's commit step means "stage and commit locally"; do not `git push`.
- **Add both `en` and `ti` entries** for any new UI string (no new UI strings are expected in this plan).

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `frontend/src/utils/roleGroup.ts` | create | Pure function mapping roles → `'staff' \| 'member' \| 'visitor'`. |
| `frontend/src/utils/__tests__/roleGroup.test.ts` | create | Proves all twelve roles classify correctly. |
| `frontend/src/utils/analytics.ts` | modify | Accepts and attaches `role_group`. |
| `frontend/src/components/AnalyticsTracker.tsx` | modify | Computes `role_group` from auth, publishes it to the analytics module. |
| `frontend/src/hooks/useServiceWorker.ts` | modify | Fires the two `pwa_*` events. |
| `frontend/src/components/ParishAnnouncements.tsx` | modify | Fires `announcement_block_rendered`. |
| `frontend/src/lib/errorTracking.ts` | create | Sentry browser init + `beforeSend` scrubbing. |
| `frontend/src/lib/__tests__/errorTracking.test.ts` | create | Proves PII does not survive `beforeSend`. |
| `frontend/src/components/ErrorBoundary.tsx` | modify | Reports caught errors. |
| `frontend/src/index.tsx` | modify | Initializes Sentry + global `unhandledrejection`. |
| `frontend/.env.example` | modify | Documents the two Umami vars (currently undocumented) and the new Sentry DSN. |
| `backend/src/utils/logger.js` | modify | Export `redactSensitive` (currently module-private). |
| `backend/src/utils/telemetry.js` | create | Sentry Node init + `beforeSend` through the redacting logger. |
| `backend/src/__tests__/telemetry.test.js` | create | Proves PII does not survive the backend scrubber. |
| `backend/src/server.js` | modify | Initializes telemetry; reports from the global error handler. |
| `backend/migrations/20260808000000-add-member-last-seen-at.js` | create | Adds `members.last_seen_at`. |
| `backend/src/models/Member.js` | modify | Declares `lastSeenAt`. |
| `backend/src/utils/recordLastSeen.js` | create | Throttled, fire-and-forget write. |
| `backend/src/__tests__/recordLastSeen.test.js` | create | Proves throttling and failure-swallowing. |
| `backend/src/middleware/auth.js` | modify | Calls `recordLastSeen`. |
| `backend/env.example` | modify | Documents `SENTRY_DSN`. |

Tasks are ordered so each leaves the tree working. Tasks 1–4 are frontend analytics, 5–6 are frontend errors, 7 is backend errors, 8 is return visits. Task 8 is independent of 1–7 and may be done in any order relative to them.

---

### Task 1: `roleGroup` — classify a member without a role list

**Files:**
- Create: `frontend/src/utils/roleGroup.ts`
- Test: `frontend/src/utils/__tests__/roleGroup.test.ts`

**Interfaces:**
- Consumes: `getMergedPermissions(roles: UserRole[]): RolePermissions` and `ROLE_PERMISSIONS` from `frontend/src/utils/roles.ts:719` and `:60`.
- Produces: `export type RoleGroup = 'staff' | 'member' | 'visitor'` and `export const resolveRoleGroup = (roles: UserRole[] | null | undefined): RoleGroup`.

**Context:** The naive approach — listing which role names count as staff — creates a second role registry that drifts from `roles.ts`. The review already found exactly that kind of drift (`deacon` and `priest` exist in the DB enum but not in the frontend `UserRole` type). Comparing permission *sets* against the member baseline has no list to maintain. Note that no single permission flag works as a discriminator: `canViewAllMembers` is `false` for `budget_committee` and `ap_team`, who are plainly staff.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/__tests__/roleGroup.test.ts`:

```typescript
import { resolveRoleGroup } from '../roleGroup';
import type { UserRole } from '../roles';

describe('resolveRoleGroup', () => {
  it('treats a signed-out visitor as visitor', () => {
    expect(resolveRoleGroup(null)).toBe('visitor');
    expect(resolveRoleGroup(undefined)).toBe('visitor');
    expect(resolveRoleGroup([])).toBe('visitor');
  });

  it('treats a plain member as member', () => {
    expect(resolveRoleGroup(['member'])).toBe('member');
  });

  it('treats guest as visitor-equivalent, not staff', () => {
    // guest has strictly fewer permissions than member, so it must not be
    // mistaken for "differs from baseline, therefore staff".
    expect(resolveRoleGroup(['guest'])).toBe('member');
  });

  it('classifies every staff role as staff', () => {
    const staffRoles: UserRole[] = [
      'admin', 'church_leadership', 'treasurer', 'bookkeeper',
      'budget_committee', 'auditor', 'ar_team', 'ap_team',
      'relationship', 'secretary',
    ];
    staffRoles.forEach((role) => {
      expect(resolveRoleGroup([role])).toBe('staff');
    });
  });

  it('classifies a multi-role member by the union of their permissions', () => {
    expect(resolveRoleGroup(['member', 'treasurer'])).toBe('staff');
    expect(resolveRoleGroup(['member', 'guest'])).toBe('member');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=roleGroup`
Expected: FAIL — `Cannot find module '../roleGroup'`

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/utils/roleGroup.ts`:

```typescript
import { getMergedPermissions, ROLE_PERMISSIONS, type UserRole, type RolePermissions } from './roles';

/**
 * Which bucket a visitor falls into for analytics. Three coarse groups, never a
 * role name and never an id — enough to keep ~10 staff visiting daily from
 * drowning out ~940 members visiting yearly, and not enough to single anybody out.
 */
export type RoleGroup = 'staff' | 'member' | 'visitor';

/**
 * Staff is defined as "has any permission an ordinary member does not", rather
 * than by a list of role names.
 *
 * A hardcoded staff list would be a second role registry that drifts from
 * roles.ts the moment a role is added — the codebase already has one such drift
 * (deacon and priest exist in the DB role enum but not in UserRole). And no
 * single permission flag is a correct discriminator: the obvious candidate,
 * canViewAllMembers, is false for budget_committee and ap_team, who are plainly
 * staff. Set comparison against the member baseline gets all twelve right with
 * nothing to maintain.
 */
export const resolveRoleGroup = (roles: UserRole[] | null | undefined): RoleGroup => {
  if (!roles || roles.length === 0) return 'visitor';

  const baseline = ROLE_PERMISSIONS.member;
  const merged = getMergedPermissions(roles);

  // Only *extra* permissions make someone staff. `guest` differs from the
  // baseline by having fewer, and must not be misread as elevated.
  const hasExtra = (Object.keys(baseline) as Array<keyof RolePermissions>)
    .some((key) => merged[key] === true && baseline[key] !== true);

  return hasExtra ? 'staff' : 'member';
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=roleGroup`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/roleGroup.ts frontend/src/utils/__tests__/roleGroup.test.ts
git commit -m "feat(analytics): classify visitors into staff/member/visitor without a role list"
```

---

### Task 2: Attach `role_group` to outgoing events

**Files:**
- Modify: `frontend/src/utils/analytics.ts`
- Modify: `frontend/src/components/AnalyticsTracker.tsx`
- Test: `frontend/src/utils/__tests__/analytics.test.ts` (extend)

**Interfaces:**
- Consumes: `resolveRoleGroup`, `RoleGroup` from Task 1.
- Produces: `export const setRoleGroup = (group: RoleGroup): void` and `export const buildEventData = (data?: Record<string, unknown>): Record<string, unknown>`. After this task, `trackPageView` and `trackEvent` both attach `role_group` automatically; no call site passes it explicitly.

**Context:** `analytics.ts` is a dumb transport with no React dependency, and it stays that way — `AnalyticsTracker` (already inside both `Router` and `AuthProvider` at `App.tsx:85`) computes the group and pushes it down via `setRoleGroup`. Module-level state is acceptable here because there is exactly one tracker mounted for the app's lifetime.

**Why `buildEventData` is exported.** The obvious test — call `trackEvent` and inspect `window.umami.track` — is worthless here: `isAnalyticsEnabled()` returns false unless `NODE_ENV === 'production'`, and Jest runs as `test`. `trackEvent` would return early, `track` would never be called, and any assertion over its calls would pass vacuously no matter what the code did. Extracting the payload construction gives the tests something real to assert against. Do not "simplify" it back inline.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/utils/__tests__/analytics.test.ts`:

```typescript
import { setRoleGroup, buildEventData } from '../analytics';

describe('role_group tagging', () => {
  afterEach(() => {
    // Module-level state; leaving it set would leak into later tests.
    setRoleGroup('visitor');
  });

  it('defaults to visitor before any auth state is published', () => {
    expect(buildEventData()).toEqual({ role_group: 'visitor' });
  });

  it('tags outgoing data with the current group', () => {
    setRoleGroup('staff');
    expect(buildEventData({ count: 3 })).toEqual({ count: 3, role_group: 'staff' });
  });

  it('lets the group change when a member signs in or out', () => {
    setRoleGroup('member');
    expect(buildEventData().role_group).toBe('member');
    setRoleGroup('visitor');
    expect(buildEventData().role_group).toBe('visitor');
  });

  it('carries a group, never an identity', () => {
    setRoleGroup('staff');
    const serialized = JSON.stringify(buildEventData({ count: 2 }));
    // The whole point of a coarse bucket: nothing here can single out a member.
    expect(serialized).not.toMatch(/treasurer|admin|memberId|member_id|phone|email/i);
    expect(Object.keys(buildEventData())).toEqual(['role_group']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=analytics`
Expected: FAIL — `setRoleGroup is not a function` / has no exported member

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/utils/analytics.ts`, add the import and module state near the top (after the `SCRIPT_ID` const at line 15):

```typescript
import type { RoleGroup } from './roleGroup';

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
```

Then change `trackPageView` and `trackEvent` (lines 58-70) to attach it:

```typescript
export function trackPageView(path: string): void {
  if (!isAnalyticsEnabled()) return;
  window.umami?.track('pageview', buildEventData({ url: stripIdentifiers(path) }));
}

export function trackEvent(name: string, data?: Record<string, unknown>): void {
  if (!isAnalyticsEnabled()) return;
  window.umami?.track(name, buildEventData(data));
}
```

- [ ] **Step 4: Wire it up in `AnalyticsTracker.tsx`**

Replace the body of `frontend/src/components/AnalyticsTracker.tsx`:

```typescript
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initAnalytics, trackPageView, setRoleGroup } from '../utils/analytics';
import { resolveRoleGroup } from '../utils/roleGroup';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../utils/roles';

/**
 * Loads the tracker once and records a page view on every route change.
 *
 * Lives inside the Router so useLocation works, and inside AuthProvider so it
 * can tag events with a role group. Renders nothing. Without this the app is a
 * single-page bundle and Umami would only ever see the first URL a visitor
 * landed on.
 */
const AnalyticsTracker: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    initAnalytics();
  }, []);

  // Runs before the pageview effect below on any change that affects both, so
  // a route change following a sign-in is tagged with the new group.
  useEffect(() => {
    const member = user?.data?.member || user;
    const roles: UserRole[] | null = member
      ? (member.roles || [member.role || 'member'])
      : null;
    setRoleGroup(resolveRoleGroup(roles));
  }, [user]);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search, user]);

  return null;
};

export default AnalyticsTracker;
```

**Verified:** `useAuth` is exported from `frontend/src/contexts/AuthContext.tsx:30`, and `Dashboard.tsx:38` reads member data as `user?.data?.member || user` with roles at `memberData?.roles || [memberData?.role || 'member']`. The code above matches that shape exactly — no adaptation needed.

- [ ] **Step 5: Run the full frontend test suite**

Run: `cd frontend && npx react-scripts test --watchAll=false`
Expected: PASS. `AnalyticsTracker` has no test of its own; confirm nothing else regressed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/analytics.ts frontend/src/components/AnalyticsTracker.tsx frontend/src/utils/__tests__/analytics.test.ts
git commit -m "feat(analytics): tag events with a coarse role group"
```

---

### Task 3: PWA install and standalone events

**Files:**
- Modify: `frontend/src/hooks/useServiceWorker.ts`
- Test: `frontend/src/hooks/__tests__/useServiceWorker.test.ts` (extend)

**Interfaces:**
- Consumes: `trackEvent` from `frontend/src/utils/analytics.ts`.
- Produces: no new exports. Fires `pwa_install_prompt` with `{ outcome: 'shown' | 'accepted' | 'dismissed' }` and `pwa_standalone_session`.

**Context:** `promptInstall` at line 155 currently calls `event.prompt()` and discards `event.userChoice`. Awaiting it is what makes accepted-vs-dismissed knowable. `pwa_standalone_session` is guarded by a `sessionStorage` flag so a member navigating ten pages counts once.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/hooks/__tests__/useServiceWorker.test.ts`:

```typescript
import { trackEvent } from '../../utils/analytics';

jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
}));

describe('PWA analytics events', () => {
  beforeEach(() => {
    (trackEvent as jest.Mock).mockClear();
    sessionStorage.clear();
  });

  it('reports a standalone session exactly once per session', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;

    const { unmount } = renderHook(() => useServiceWorker());
    unmount();
    renderHook(() => useServiceWorker());

    const standalone = (trackEvent as jest.Mock).mock.calls
      .filter(([name]) => name === 'pwa_standalone_session');
    expect(standalone).toHaveLength(1);
  });

  it('does not report a standalone session in a browser tab', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as any;

    renderHook(() => useServiceWorker());

    expect((trackEvent as jest.Mock).mock.calls
      .filter(([name]) => name === 'pwa_standalone_session')).toHaveLength(0);
  });

  it('reports the outcome when a member dismisses the install offer', () => {
    const { result } = renderHook(() => useServiceWorker());
    act(() => { result.current.dismissInstall(); });

    expect(trackEvent).toHaveBeenCalledWith('pwa_install_prompt', { outcome: 'dismissed' });
  });
});
```

**Note:** match the existing file's imports for `renderHook` / `act` — read the top of `useServiceWorker.test.ts` and reuse whatever it already imports rather than adding a second style.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=useServiceWorker`
Expected: FAIL — `expect(jest.fn()).toHaveBeenCalledWith(...)` received 0 calls

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/hooks/useServiceWorker.ts`, add the import:

```typescript
import { trackEvent } from '../utils/analytics';
```

Add the standalone-session constant next to `DISMISS_KEY` (line 4):

```typescript
const STANDALONE_REPORTED_KEY = 'pwa.standaloneReported';
```

Add a new effect after the `beforeinstallprompt` effect (after line 153):

```typescript
  // Reported once per session, not per page: a member navigating ten screens
  // inside the installed app is one standalone session, not ten.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia?.('(display-mode: standalone)')?.matches) return;
    try {
      if (sessionStorage.getItem(STANDALONE_REPORTED_KEY) === 'true') return;
      sessionStorage.setItem(STANDALONE_REPORTED_KEY, 'true');
    } catch {
      // Safari private mode throws on sessionStorage; reporting twice is a far
      // smaller problem than the hook throwing, so fall through and report.
    }
    trackEvent('pwa_standalone_session');
  }, []);
```

Report `shown` when the offer becomes available — add after the `setRawCanInstall(true)` line inside `onBeforeInstallPrompt` (line 148):

```typescript
      trackEvent('pwa_install_prompt', { outcome: 'shown' });
```

Replace `promptInstall` (lines 155-160) so the outcome is captured:

```typescript
  const promptInstall = useCallback(() => {
    const event = installEventRef.current;
    if (!event) return;
    event.prompt();
    setRawCanInstall(false);
    // userChoice is the only way to distinguish an install from a decline.
    // A rejection here means the browser dismissed the prompt without telling
    // us how, which is not worth surfacing to the member.
    event.userChoice
      .then(({ outcome }) => trackEvent('pwa_install_prompt', { outcome }))
      .catch(() => {});
  }, []);
```

Add the report to `dismissInstall` (lines 162-165):

```typescript
  const dismissInstall = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, 'true'); } catch { /* private mode */ }
    setDismissed(true);
    trackEvent('pwa_install_prompt', { outcome: 'dismissed' });
  }, []);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=useServiceWorker`
Expected: PASS, including the pre-existing tests in that file

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useServiceWorker.ts frontend/src/hooks/__tests__/useServiceWorker.test.ts
git commit -m "feat(analytics): report PWA install outcomes and standalone sessions"
```

---

### Task 4: Announcement reach event

**Files:**
- Modify: `frontend/src/components/ParishAnnouncements.tsx`
- Test: `frontend/src/components/__tests__/ParishAnnouncements.test.tsx` (extend)

**Interfaces:**
- Consumes: `trackEvent` from `frontend/src/utils/analytics.ts`.
- Produces: no new exports. Fires `announcement_block_rendered` with `{ count: number }`.

**Context:** The component returns `null` when it has nothing to show (line 91), so the event must fire only on the path where items actually render. It is named *rendered*, not *seen* — there is no IntersectionObserver and it makes no claim about the member's viewport. `announcement_click` is deliberately absent: announcements are not clickable (they render inline in a `<li>` with no link or expand), so there is no interaction to instrument.

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/components/__tests__/ParishAnnouncements.test.tsx`:

This reuses the file's existing helpers — `mockFetch(body, ok)`, `renderWithI18n(ui)`, and `announcement(overrides)` — which are already defined at the top of the file. Do not add a second mocking style.

Add the mock at the top of the file, alongside the existing imports:

```typescript
import { trackEvent } from '../../utils/analytics';

jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
}));
```

Then append this describe block:

```typescript
describe('announcement reach reporting', () => {
  beforeEach(() => { (trackEvent as jest.Mock).mockClear(); });

  it('reports how many announcements rendered', async () => {
    mockFetch({
      success: true,
      data: [
        announcement({ id: 'a1', title: 'Feast day liturgy at 6am' }),
        announcement({ id: 'a2', title: 'Sunday school resumes' }),
      ],
    });
    renderWithI18n(<ParishAnnouncements />);
    await screen.findByText('Feast day liturgy at 6am');

    expect(trackEvent).toHaveBeenCalledWith('announcement_block_rendered', { count: 2 });
  });

  it('reports nothing when the parish has no announcements', async () => {
    mockFetch({ success: true, data: [] });
    renderWithI18n(<ParishAnnouncements />);

    await waitFor(() => expect(trackEvent).not.toHaveBeenCalled());
  });

  it('reports nothing when the fetch fails', async () => {
    mockFetch({}, false);
    renderWithI18n(<ParishAnnouncements />);

    await waitFor(() => expect(trackEvent).not.toHaveBeenCalled());
  });
});
```

**Note:** the existing `afterEach` in this file calls `jest.restoreAllMocks()`, which does not reset `jest.mock` module factories — hence the explicit `mockClear()` in `beforeEach`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=ParishAnnouncements`
Expected: FAIL — 0 calls to `trackEvent`

- [ ] **Step 3: Write minimal implementation**

In `frontend/src/components/ParishAnnouncements.tsx`, add the import:

```typescript
import { trackEvent } from '../utils/analytics';
```

Add an effect after the fetch effect (after line 66):

```typescript
  // Fires only when items actually rendered — the early return below means a
  // failed fetch or an empty parish reports nothing at all.
  //
  // "rendered", not "seen": there is no IntersectionObserver here and this makes
  // no claim about the member's viewport. It answers reach, not readership;
  // readership needs an affordance announcements do not currently have.
  useEffect(() => {
    if (!loaded || failed || announcements.length === 0) return;
    trackEvent('announcement_block_rendered', { count: announcements.length });
  }, [loaded, failed, announcements.length]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=ParishAnnouncements`
Expected: PASS, including the pre-existing tests in that file

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ParishAnnouncements.tsx frontend/src/components/__tests__/ParishAnnouncements.test.tsx
git commit -m "feat(analytics): report how many announcements reach members"
```

---

### Task 5: Frontend error tracking module

**Files:**
- Create: `frontend/src/lib/errorTracking.ts`
- Test: `frontend/src/lib/__tests__/errorTracking.test.ts`
- Modify: `frontend/package.json` (add `@sentry/react`)

**Interfaces:**
- Consumes: `stripIdentifiers` from `frontend/src/utils/analytics.ts`.
- Produces: `export const initErrorTracking = (): void`, `export const reportError = (error: Error, context?: Record<string, unknown>): void`, and `export const scrubEvent = (event: SentryEvent): SentryEvent | null` (exported solely so it can be tested directly).

**Context:** `scrubEvent` is the whole point of this task and is exported for testing rather than buried in the init options. Three filters: `ChunkLoadError` dropped (every deploy produces a burst of them, and `lazyWithRecovery.ts` + `ErrorBoundary` already recover by design — reporting them buries real errors under known noise); URLs passed through `stripIdentifiers` so there is one identifier-stripping implementation rather than two that drift; and Do Not Track honoured, matching `initAnalytics()`.

- [ ] **Step 1: Add the dependency**

Run: `cd frontend && npm install --save @sentry/react`
Expected: `@sentry/react` appears in `frontend/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `frontend/src/lib/__tests__/errorTracking.test.ts`:

```typescript
import { scrubEvent, isErrorTrackingEnabled } from '../errorTracking';

describe('scrubEvent', () => {
  it('drops ChunkLoadError, which every deploy produces and the app self-heals', () => {
    const event = { exception: { values: [{ type: 'ChunkLoadError', value: 'Loading chunk 42 failed' }] } };
    expect(scrubEvent(event as any)).toBeNull();
  });

  it('strips query strings, which carry phone and email on some routes', () => {
    const event = {
      request: { url: 'https://example.org/dues?memberId=482&phone=%2B14695550111' },
    };
    const scrubbed = scrubEvent(event as any);
    expect(scrubbed!.request!.url).toBe('/dues');
  });

  it('replaces id path segments so member and department ids are not stored', () => {
    const event = { request: { url: 'https://example.org/departments/17/meetings/204' } };
    const scrubbed = scrubEvent(event as any);
    expect(scrubbed!.request!.url).toBe('/departments/:id/meetings/:id');
  });

  it('never lets a phone number or email survive in any field', () => {
    const event = {
      request: { url: 'https://example.org/profile', headers: { Cookie: 'session=abc' } },
      user: { email: 'someone@example.com', id: '482' },
      extra: { phone: '+14695550111' },
    };
    const serialized = JSON.stringify(scrubEvent(event as any) ?? {});
    expect(serialized).not.toMatch(/someone@example\.com/);
    expect(serialized).not.toMatch(/4695550111/);
    expect(serialized).not.toMatch(/session=abc/);
  });

  it('reports nothing when the member has asked not to be tracked', () => {
    const original = navigator.doNotTrack;
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    expect(isErrorTrackingEnabled()).toBe(false);
    Object.defineProperty(navigator, 'doNotTrack', { value: original, configurable: true });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=errorTracking`
Expected: FAIL — `Cannot find module '../errorTracking'`

- [ ] **Step 4: Write minimal implementation**

Create `frontend/src/lib/errorTracking.ts`:

```typescript
import * as Sentry from '@sentry/react';
import type { ErrorEvent as SentryEvent } from '@sentry/react';
import { stripIdentifiers } from '../utils/analytics';

/**
 * Error reporting, held to the same standard as analytics: inert without its
 * env var, silent in development, and it never sends anything that could
 * identify a member.
 */

const DSN = process.env.REACT_APP_SENTRY_DSN;

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
      // Reuses the analytics stripper so there is one implementation of "what
      // counts as an identifier", not two that drift apart.
      let path = event.request.url;
      try {
        path = new URL(event.request.url).pathname;
      } catch {
        // Already a bare path, or unparseable — strip it as-is.
      }
      event.request.url = stripIdentifiers(path);
    }
    // Headers carry session cookies and bearer tokens; the body carries dues
    // amounts and member records. Neither has diagnostic value worth the risk.
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.data;
  }

  delete event.extra;

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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx react-scripts test --watchAll=false --testPathPattern=errorTracking`
Expected: PASS, 5 tests

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/errorTracking.ts frontend/src/lib/__tests__/errorTracking.test.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(observability): add frontend error tracking with tested PII scrubbing"
```

---

### Task 6: Wire frontend error reporting to its capture points

**Files:**
- Modify: `frontend/src/index.tsx`
- Modify: `frontend/src/components/ErrorBoundary.tsx`
- Modify: `frontend/.env.example`

**Interfaces:**
- Consumes: `initErrorTracking`, `reportError` from Task 5.
- Produces: no new exports.

**Context:** Two capture points — the existing `ErrorBoundary.componentDidCatch` (line 61) and a global `unhandledrejection` listener. `ErrorBoundary` is the app's crash fallback and its own comments stress that it must never throw; `reportError` is already wrapped in a try/catch for exactly this reason, and the raw `console.error` calls stay so local debugging is unaffected. This task also documents the two `REACT_APP_UMAMI_*` vars, which exist in code and are live in production but were never added to `.env.example`.

- [ ] **Step 1: Initialize at app startup**

In `frontend/src/index.tsx`, add the import and call it before `ReactDOM.createRoot`:

```typescript
import { initErrorTracking, reportError } from './lib/errorTracking';

initErrorTracking();

// Promise rejections never reach an ErrorBoundary, so they would otherwise be
// invisible — and this app's data fetching is promise-based throughout.
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportError(reason instanceof Error ? reason : new Error(String(reason)), {
    source: 'unhandledrejection',
  });
});
```

- [ ] **Step 2: Report from the ErrorBoundary**

In `frontend/src/components/ErrorBoundary.tsx`, add the import:

```typescript
import { reportError } from '../lib/errorTracking';
```

Add the report inside `componentDidCatch` (line 61), keeping the existing `console.error` calls:

```typescript
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 ErrorBoundary componentDidCatch:', error, errorInfo);

    // reportError swallows its own failures: this component is the crash
    // fallback, and a throw inside error reporting would defeat the entire
    // point of the boundary.
    reportError(error, { source: 'errorBoundary' });

    // Check if this is the timeout error we're looking for
    if (error.message && (error.message.includes('Timeout') || error.message.includes('timeout'))) {
      console.error('🎯 Found the timeout error!', error);
    }
  }
```

- [ ] **Step 3: Document the env vars**

Append to `frontend/.env.example`:

```bash
# Analytics — self-hosted Umami. Both must be set for any tracking to happen.
# See docs/ANALYTICS_SETUP.md. Live in production; documented here because the
# app is inert without them and a new environment will look silently broken.
REACT_APP_UMAMI_SRC=
REACT_APP_UMAMI_WEBSITE_ID=

# Error tracking — Sentry. Inert when empty; production builds only.
REACT_APP_SENTRY_DSN=
```

- [ ] **Step 4: Run the full frontend suite**

Run: `cd frontend && npx react-scripts test --watchAll=false`
Expected: PASS. `ErrorBoundary` has existing tests; confirm they still pass with the new import.

- [ ] **Step 5: Verify the build still compiles**

Run: `cd frontend && npm run build:ci`
Expected: build succeeds. This is the real check that the new `@sentry/react` import does not break the CRA build.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.tsx frontend/src/components/ErrorBoundary.tsx frontend/.env.example
git commit -m "feat(observability): report crashes and unhandled rejections"
```

---

### Task 7: Backend error tracking

**Files:**
- Create: `backend/src/utils/telemetry.js`
- Test: `backend/src/__tests__/telemetry.test.js`
- Modify: `backend/src/server.js` (init + global error handler at line 290)
- Modify: `backend/env.example`
- Modify: `backend/package.json` (add `@sentry/node`)

**Interfaces:**
- Consumes: `redactSensitive` from `backend/src/utils/logger.js`. **This is not currently exported** — `logger.js:196` is `module.exports = logger`, and the `logger` object exposes only `debug`, `warn`, `error`, `success`, and `safeSummary`. Step 4a below adds the export.
- Produces: `module.exports = { initTelemetry, reportError, scrubEvent }`.

**Context:** This is the load-bearing reuse in the whole design. `logger.js` was written to redact emails, phones, and addresses, and the review found it used in only 5 files. Routing Sentry's `beforeSend` through it makes it a gate on what leaves the process.

**Know its limit.** `redactSensitive` delegates to `redactObject`, which *does* recurse into nested objects and arrays — but it matches only a **fixed list of key names** (`email`, `phone_number`, `streetLine1`, and roughly twenty more). It is blind to any key name outside that list, and to PII sitting in free text. A phone number at `event.request.data.phone_number` is caught, because `phone_number` is on the list; the same number inside an error message string, or under a key name a future Sentry version introduces, is not. So the redactor is a backstop, not the guard. The real guard is explicit deletion of the fields that carry PII, which is why `scrubEvent` below deletes `user`, `extra`, and the whole of `request.data` / `headers` / `cookies` rather than trusting the redactor to clean them. Do not weaken those deletions on the assumption that `redactSensitive` will catch what slips through.

- [ ] **Step 1: Add the dependency**

Run: `cd backend && npm install --save @sentry/node`
Expected: `@sentry/node` appears in `backend/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `backend/src/__tests__/telemetry.test.js`:

```javascript
const { scrubEvent } = require('../utils/telemetry');

describe('scrubEvent', () => {
  it('never lets an email or phone survive', () => {
    const event = {
      request: {
        url: 'https://api.example.org/api/members/profile/firebase/abc?email=someone@example.com',
        data: { phone_number: '+14695550111', amount_due: 250 },
        headers: { authorization: 'Bearer abc123' },
      },
      user: { email: 'someone@example.com', id: 482 },
    };
    const serialized = JSON.stringify(scrubEvent(event) ?? {});
    expect(serialized).not.toMatch(/someone@example\.com/);
    expect(serialized).not.toMatch(/4695550111/);
    expect(serialized).not.toMatch(/Bearer abc123/);
  });

  it('never attaches a request body, which carries dues and member records', () => {
    const event = { request: { data: { amount_due: 250, member_id: 482 } } };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.request.data).toBeUndefined();
  });

  it('strips query strings from the url', () => {
    const event = { request: { url: 'https://api.example.org/api/members?phone=%2B14695550111' } };
    expect(scrubEvent(event).request.url).not.toMatch(/phone|4695550111/);
  });

  it('keeps the diagnostic fields worth having', () => {
    const event = { request: { url: 'https://api.example.org/api/members', method: 'POST' } };
    const scrubbed = scrubEvent(event);
    expect(scrubbed.request.method).toBe('POST');
    expect(scrubbed.request.url).toContain('/api/members');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest src/__tests__/telemetry.test.js`
Expected: FAIL — `Cannot find module '../utils/telemetry'`

- [ ] **Step 4a: Export the redactor from `logger.js`**

`redactSensitive` is defined at `backend/src/utils/logger.js:86` but never exported. Change the final line (`logger.js:196`) from:

```javascript
module.exports = logger;
```

to:

```javascript
// redactSensitive is exported alongside the logger so telemetry.js can use the
// same redaction rules rather than growing a second, divergent copy. Note it is
// recursive, but keyed on a fixed list of key names — see telemetry.js.
module.exports = logger;
module.exports.redactSensitive = redactSensitive;
```

Attaching to the existing export rather than replacing it keeps every current `require('./logger')` call site working unchanged.

- [ ] **Step 4b: Write minimal implementation**

Create `backend/src/utils/telemetry.js`:

```javascript
'use strict';

/**
 * Error reporting for the API.
 *
 * Inert without SENTRY_DSN, so a deploy without it behaves exactly as before.
 *
 * Everything leaving this process goes through the redaction helpers in
 * logger.js. That module was written to redact member PII and was being used in
 * only a handful of places; this makes it the mandatory gate it was meant to be.
 */

const Sentry = require('@sentry/node');
const { redactSensitive } = require('./logger');

const DSN = process.env.SENTRY_DSN;

const isEnabled = () => Boolean(DSN);

/**
 * Strips a URL down to its path. Several routes carry ?email= and ?phone=
 * (the Firebase profile lookup among them).
 */
const stripUrl = (url) => {
  if (typeof url !== 'string') return url;
  try {
    return new URL(url).pathname;
  } catch (_) {
    return url.split('?')[0];
  }
};

/**
 * The only interesting part of this module: what refuses to leave the process.
 * Exported so it can be tested directly rather than through Sentry's client.
 */
const scrubEvent = (event) => {
  if (!event) return event;

  // No user identity, ever.
  delete event.user;
  delete event.extra;

  if (event.request) {
    event.request.url = stripUrl(event.request.url);
    // Bodies carry dues amounts, member records, and Zelle memos. Headers carry
    // bearer tokens. Neither has diagnostic value worth the risk.
    delete event.request.data;
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.query_string;
  }

  // Backstop, not the guard. redactSensitive recurses into nested objects, but
  // matches only a fixed list of key names — so it is blind to a key name it
  // does not know and to PII in free text (an error message, say). The explicit
  // deletions above are what actually keep PII out; this catches the keyed
  // remainder. Do not relax those deletions on the strength of this line.
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && npx jest src/__tests__/telemetry.test.js`
Expected: PASS, 4 tests

- [ ] **Step 6: Wire it into the server**

In `backend/src/server.js`, add near the other requires (top of file):

```javascript
const { initTelemetry, reportError } = require('./utils/telemetry');
```

Call it early in startup, before the app starts handling requests — immediately after `assertDemoModeNotEnabledInProduction();`:

```javascript
    initTelemetry();
```

Then report from the global error handler at line 290:

```javascript
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Best-effort; reportError swallows its own failures so a telemetry outage
  // cannot turn a 500 into a hang.
  reportError(error, { route: req.route?.path || 'unknown', method: req.method });

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});
```

- [ ] **Step 7: Document the env var**

Append to `backend/env.example`:

```bash
# Error tracking — Sentry. Inert when empty.
SENTRY_DSN=
```

- [ ] **Step 8: Run the backend suite**

Run: `cd backend && DATABASE_URL=sqlite::memory: npx jest`
Expected: PASS. Confirm the new require in `server.js` did not break server startup tests.

- [ ] **Step 9: Commit**

```bash
git add backend/src/utils/telemetry.js backend/src/utils/logger.js backend/src/__tests__/telemetry.test.js backend/src/server.js backend/env.example backend/package.json backend/package-lock.json
git commit -m "feat(observability): add backend error tracking gated on the redacting logger"
```

---

### Task 8: `members.last_seen_at` for return-visit measurement

**Files:**
- Create: `backend/migrations/20260808000000-add-member-last-seen-at.js`
- Create: `backend/src/utils/recordLastSeen.js`
- Test: `backend/src/__tests__/recordLastSeen.test.js`
- Modify: `backend/src/models/Member.js`
- Modify: `backend/src/middleware/auth.js`

**Interfaces:**
- Consumes: the `Member` model.
- Produces: `module.exports = { recordLastSeen, THROTTLE_MS }` where `recordLastSeen(member): void` returns nothing and never throws.

**Context:** Umami is deliberately anonymous and cannot answer "did *this member* come back" — that is why it needs no consent banner. This keeps the answer in our own Postgres, where the data already lives. Two properties matter: throttled to once per hour (a member clicking ten pages causes one write), and fire-and-forget (a telemetry write must never fail a member's request). This task is independent of Tasks 1–7.

- [ ] **Step 1: Write the migration**

Create `backend/migrations/20260808000000-add-member-last-seen-at.js`, following the pattern of `20260802230000-add-donor-name.js`:

```javascript
'use strict';

// Adds members.last_seen_at so the parish can answer "do members come back?" —
// a question the anonymous analytics deliberately cannot answer.
//
// Nullable with no default and no backfill: existing rows keep NULL, which reads
// correctly as "not seen since this shipped" rather than inventing a visit.

async function hasColumn(queryInterface, table, column) {
  try {
    const desc = await queryInterface.describeTable(table);
    return Object.prototype.hasOwnProperty.call(desc, column);
  } catch (_) {
    // Table missing (e.g. a fresh DB mid-bootstrap) — nothing to alter.
    return true;
  }
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    if (await hasColumn(queryInterface, 'members', 'last_seen_at')) return;
    await queryInterface.addColumn('members', 'last_seen_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Last authenticated request from this member, throttled to hourly.'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('members', 'last_seen_at').catch(() => {});
  }
};
```

- [ ] **Step 2: Declare it on the model**

In `backend/src/models/Member.js`, add to the attribute definitions (the model uses `underscored: true`, so `lastSeenAt` maps to `last_seen_at`):

```javascript
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
```

- [ ] **Step 3: Write the failing test**

Create `backend/src/__tests__/recordLastSeen.test.js`:

```javascript
const { recordLastSeen, THROTTLE_MS } = require('../utils/recordLastSeen');

const makeMember = (lastSeenAt) => ({
  id: 1,
  lastSeenAt,
  update: jest.fn().mockResolvedValue(undefined),
});

describe('recordLastSeen', () => {
  it('writes when the member has never been seen', () => {
    const member = makeMember(null);
    recordLastSeen(member);
    expect(member.update).toHaveBeenCalledTimes(1);
  });

  it('does not write again inside the throttle window', () => {
    const member = makeMember(new Date(Date.now() - 60 * 1000));
    recordLastSeen(member);
    expect(member.update).not.toHaveBeenCalled();
  });

  it('writes again once the window has passed', () => {
    const member = makeMember(new Date(Date.now() - THROTTLE_MS - 1000));
    recordLastSeen(member);
    expect(member.update).toHaveBeenCalledTimes(1);
  });

  it('never throws when the write fails, because a request must not fail over telemetry', async () => {
    const member = makeMember(null);
    member.update = jest.fn().mockRejectedValue(new Error('db down'));

    expect(() => recordLastSeen(member)).not.toThrow();
    // Let the rejected promise settle; an unhandled rejection would fail the suite.
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('tolerates a missing member without throwing', () => {
    expect(() => recordLastSeen(null)).not.toThrow();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && npx jest src/__tests__/recordLastSeen.test.js`
Expected: FAIL — `Cannot find module '../utils/recordLastSeen'`

- [ ] **Step 5: Write minimal implementation**

Create `backend/src/utils/recordLastSeen.js`:

```javascript
'use strict';

/**
 * Records that a member was active, so the parish can answer "do members come
 * back?" — a question the anonymous analytics deliberately cannot answer.
 *
 * Two properties matter, and both are about not harming the request:
 *
 *  - Throttled. The auth middleware runs on every authenticated request, so an
 *    unthrottled write would mean ten writes for a member browsing ten screens.
 *  - Fire-and-forget. Never awaited, never throws. Instrumentation that can
 *    break the product is worse than no instrumentation.
 */

const THROTTLE_MS = 60 * 60 * 1000;

const recordLastSeen = (member) => {
  if (!member || typeof member.update !== 'function') return;

  const last = member.lastSeenAt ? new Date(member.lastSeenAt).getTime() : 0;
  if (Number.isFinite(last) && Date.now() - last < THROTTLE_MS) return;

  try {
    // Not awaited: the member's response does not wait on a telemetry write.
    // silent:true and no validation keep this from touching updatedAt or
    // running model hooks over an unrelated column.
    const result = member.update(
      { lastSeenAt: new Date() },
      { silent: true, validate: false, fields: ['lastSeenAt'] }
    );
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  } catch (_) {
    // A synchronous throw is as unacceptable as an async one.
  }
};

module.exports = { recordLastSeen, THROTTLE_MS };
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && npx jest src/__tests__/recordLastSeen.test.js`
Expected: PASS, 5 tests

- [ ] **Step 7: Call it from the auth middleware**

In `backend/src/middleware/auth.js`, add the require at the top:

```javascript
const { recordLastSeen } = require('../utils/recordLastSeen');
```

Call it once the member has been resolved — after the email-fallback block resolves `member` and before the request proceeds. Place it immediately after the point where a non-null `member` is confirmed:

```javascript
    // Fire-and-forget: throttled internally, never awaited, never throws.
    recordLastSeen(member);
```

**Note:** read the surrounding code to place this after the final `member` assignment (phone lookup at line ~221, email fallback below it) and before the middleware calls `next()`. Do not place it inside either lookup branch — it must run once, on whichever branch resolved the member.

- [ ] **Step 8: Run the backend suite**

Run: `cd backend && DATABASE_URL=sqlite::memory: npx jest`
Expected: PASS, including the existing `firebaseAuthLookup.test.js`.

- [ ] **Step 9: Run the migration locally**

Run: `cd backend && npx sequelize-cli db:migrate`
Expected: `20260808000000-add-member-last-seen-at` runs successfully. Verify the column exists, then confirm `npx sequelize-cli db:migrate:undo` removes it cleanly and re-run the migration.

- [ ] **Step 10: Commit**

```bash
git add backend/migrations/20260808000000-add-member-last-seen-at.js backend/src/utils/recordLastSeen.js backend/src/__tests__/recordLastSeen.test.js backend/src/models/Member.js backend/src/middleware/auth.js
git commit -m "feat(observability): record member last-seen for return-visit measurement"
```

---

## Before shipping

- [ ] **Capture the analytics baseline.** Umami is already live and has been collecting pageviews. Screenshot the current 30-day numbers before this or dashboard v1 deploys — that comparison cannot be reconstructed later, and it is the only before-picture the engagement work will ever have.
- [ ] **Run both suites clean:** `npm run test` from the repo root.
- [ ] **Confirm the dark-ship claim** by building without the Sentry vars set and verifying no Sentry request is attempted: `cd frontend && npm run build:ci`.
- [ ] **Do not push.** The maintainer tests locally before any deploy.

## Known gaps this plan does not close

- **Readership of announcements is still unmeasured.** `announcement_block_rendered` answers reach, not whether anyone read them. Announcements have no link, expand, or detail route, so there is no interaction to instrument. Closing this needs a product change to the announcements surface first.
- **Do Not Track undercounts.** Both analytics and error tracking honour DNT, so neither is a complete census. This is a deliberate trade and worth remembering when reading the numbers.
- **`last_seen_at` starts empty.** No backfill is possible, so return-visit data only becomes meaningful a few weeks after deploy.
