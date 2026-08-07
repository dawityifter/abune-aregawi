# Mobile Shell & PWA — Design

Date: 2026-08-07
Status: Approved

## Goal

Give the congregation — which is overwhelmingly phone-only — an app-shaped experience:
a persistent bottom navigation, a genuinely installable home-screen app, and a shell that
survives a dead signal. This is the fourth item from the Member Engagement Review's
mobile-first recommendation, and it is the prerequisite for push notifications later.

Explicitly **not** in scope: push notifications, an events system, a member directory.
Step 3 below creates the service worker that push will need, and leaves that seam clean.

## Why this, why now

The review found the app is not installable in any meaningful sense:

- No service worker is registered anywhere. `frontend/package.json` has no `workbox` dependency.
- `frontend/public/manifest.json` declares a `512x512` icon whose `src` is the 192px file.
  There is no `maskable` icon, no `id`, no `scope`, and no screenshots. Chrome refuses the
  rich install prompt on the icon defect alone.
- The only mobile chrome is a hamburger menu. There is no bottom navigation.
- `frontend/public/index.html` lacks `viewport-fit=cover` and the `apple-mobile-web-app-*`
  meta tags, so a bottom bar would sit under the iOS home indicator.
- `theme_color` is `#000000`, so the browser chrome does not match the parish's colors.

## Constraint: no eject, no CRACO

`react-scripts` 5.0.1 compiles `src/service-worker.js` with Workbox's `InjectManifest`
strategy automatically when that file exists. We add the `workbox-*` packages and the
source file; the existing build pipeline picks it up. Nothing about the CRA setup changes,
and `npm run build` / `build:ci` keep working as they do today.

## Architecture

Four units, each independently testable.

| Unit | Location | Responsibility |
|---|---|---|
| `BottomNav` | `frontend/src/components/mobile/BottomNav.tsx` | Renders four tabs; resolves the active tab from `useLocation()`. Hidden at `md:` and above. |
| `MoreSheet` | `frontend/src/components/mobile/MoreSheet.tsx` | Slide-up sheet. Builds its link list from `getMergedPermissions()` so admin/treasurer entries appear without a second navigation system. |
| `service-worker.js` | `frontend/src/service-worker.js` | Precaching and runtime caching. |
| `cachePolicy` | `frontend/src/sw/cachePolicy.ts` | The "is this request cacheable" decision, as a plain module so it is testable outside a service-worker environment. |
| `useServiceWorker` | `frontend/src/hooks/useServiceWorker.ts` | Registration, update detection, install-prompt capture. The only module the rest of the app talks to. |

`BottomNav` mounts as a sibling of `<Navigation>` in `frontend/src/App.tsx`. It does not
replace the hamburger: the desktop header is unchanged, and the hamburger's link list is
the source `MoreSheet` draws from.

### Tabs

A signed-out visitor gets a working bar too, which incidentally closes part of the
review's public-navigation gap on mobile.

| Tab | Signed in | Signed out |
|---|---|---|
| Today | `/dashboard` | `/` |
| Calendar | `/calendar` (new route) | `/calendar` |
| Give | `/donate` | `/donate` |
| More | opens sheet | opens sheet → Service Times, Watch, Bylaw, Privacy, Sign In |

`/donate`, `/church-bylaw`, and `/privacy` are already public routes. `/calendar` does not
exist yet — see step 1.

There is **no** `/about` route in this app, and the homepage sections carry no `id`
attributes, so "Service Times" and "Watch" cannot simply be links today. They resolve to
`/#service-times` (the `Hero`, which already carries times and a map) and `/#watch`
(`GrowSpirituallySection`). Step 1 adds those two `id` attributes and the hash-scroll
behavior that React Router v6 does not provide on its own.

### Active-tab resolution

`Today` is active on `/` and `/dashboard`. `Calendar` on `/calendar`. `Give` on `/donate`,
`/pledge`, `/dues`, and `/thank-you`. `More` is active whenever no other tab matches, so
every one of the app's 25 routes lights exactly one tab and none leaves the bar blank.

## Caching

### Precache filter

CRA's generated precache manifest lists **every** code-split chunk, including the admin,
treasurer, outreach, and SMS bundles that commit `f9cc6b5` deliberately split out of the
initial download. Precaching all of it would hand every member the treasurer's bundle
again, undoing that work. `service-worker.js` filters the manifest before precaching:

```js
precacheAndRoute(
  self.__WB_MANIFEST.filter(e => !/(admin|treasurer|outreach|sms)/.test(e.url))
);
```

Those chunks stay lazy and are runtime-cached only if a staff member actually opens them.

### API caching is an allowlist, never a denylist

Evaluated in this order:

1. Any request carrying an `Authorization` header → `NetworkOnly`. Checked first, before
   any path matching.
2. `GET /api/announcements/active` → `StaleWhileRevalidate`, 24-hour expiration, max 1
   entry. This endpoint is public and returns only public projected fields.
3. Every other `/api/*` path → `NetworkOnly`.

**No authenticated response is ever written to `CacheStorage`.** There is therefore no
member PII on the device, and nothing to purge at sign-out. This satisfies the sensitive-data
rules in `CLAUDE.md` by construction rather than by cleanup, which matters because these
phones are frequently shared within a household.

The Orthodox calendar needs no caching at all: `frontend/src/data/orthodoxEventRules.ts`
generates it client-side, so it works offline as soon as the shell is cached.

### Navigation requests

Precache `/index.html` and serve navigations from it via `createHandlerBoundToURL`, so a
cold offline launch renders the app shell rather than the browser's error page.

## Update flow

A new service worker installs and **waits** — it does not take over. `useServiceWorker`
exposes `updateAvailable`; a bilingual toast offers "Refresh". On tap:

```
postMessage({ type: 'SKIP_WAITING' }) → 'controllerchange' event → window.location.reload()
```

A member part-way through a payment form is never swapped out from under. A member who
leaves the app open for days is still told there is a newer build rather than sitting on
stale code indefinitely.

## Install prompt

- **Android / Chrome** — capture `beforeinstallprompt`, `preventDefault()`, stash the
  event. Surface a dismissible "Add to Home Screen" entry in `MoreSheet`, plus a one-time
  banner on the second visit. Dismissal is remembered in `localStorage`.
- **iOS / Safari** — there is no `beforeinstallprompt`. When the browser is iOS Safari and
  `display-mode: standalone` does not match, show a short instruction card in `MoreSheet`
  ("Share → Add to Home Screen") instead of a prompt.

## Error handling

- Registration failures are caught and logged. The app must behave identically with no
  service worker present — this is an enhancement, never a dependency.
- A failed announcements revalidation serves the stale cache entry. This matches how
  `frontend/src/components/ParishAnnouncements.tsx` already treats a fetch failure as not
  worth interrupting the page for.
- If the precached shell is somehow missing, the browser's own error surfaces rather than
  a half-rendered app.

## Testing

**Unit**

- Active-tab resolution across all 25 routes in `frontend/src/App.tsx`, including the
  "no match falls back to More" rule.
- `MoreSheet` contents for a plain member, a treasurer, an admin, and a multi-role member,
  driven by `getMergedPermissions()`.
- Update-toast state machine: waiting worker detected → toast shown → skip-waiting posted →
  reload triggered.
- Install-prompt state machine, including the dismissal-remembered path and the iOS branch.

**Cacheability predicate**

The "is this request cacheable" decision lives in its own plain module
(`frontend/src/sw/cachePolicy.ts`) so it is unit-testable without a service-worker
environment. Required cases:

- A request with an `Authorization` header is never cacheable, whatever its path.
- `/api/announcements/active` is cacheable.
- `/api/members/…`, `/api/payments/…`, `/api/transactions/…` are not cacheable.

**Manual gates before merge**

- Lighthouse PWA audit passes the installability criteria.
- Real iPhone: Safari → Add to Home Screen, launch, confirm the bottom bar clears the home
  indicator.
- Real Android: install prompt appears, app launches standalone.
- Airplane-mode cold launch renders the shell, the calendar, and cached announcements.
- DevTools → Application → Cache Storage contains no `/api/` entry other than the
  announcements feed.

## Implementation steps

| # | Step | Effort |
|---|---|---|
| 0 | Manifest and meta fixes | ½ day |
| 1 | Extract the `/calendar` route | ½ day |
| 2 | `BottomNav` + `MoreSheet` | 2–3 days |
| 3 | Service worker | 2–3 days |
| 4 | `useServiceWorker` + update toast | 1 day |
| 5 | Install prompt | 1 day |
| 6 | Mobile polish pass | 2–3 days |

Roughly 1.5–2 weeks for one developer familiar with the codebase.

### Step 0 — Manifest and meta

Generate a real 512×512 icon and a `maskable` variant from the existing church logo. Add
`id` and `scope` to `frontend/public/manifest.json`. Set `theme_color` to `#991b1b`
(`primary-700`), which is where the nav gradient in `frontend/src/components/Navigation.tsx`
starts, so the browser chrome matches the header. Add `viewport-fit=cover` and the
`apple-mobile-web-app-*` tags to `frontend/public/index.html`. Delete the stale
`frontend/public/Orthodox Calendar 2025.pdf`.

### Step 1 — `/calendar` route and homepage anchors

Add a `CalendarPage` that renders the existing `OrthodoxCalendar` component, and register
it as a lazy route in `frontend/src/App.tsx` alongside the other lazy pages. The homepage
keeps its `CalendarSection`. While in that file, fix the stale English fallback string
`'Orthodox Calendar 2025'` in `frontend/src/components/sections/CalendarSection.tsx`.

Add `id="service-times"` to `frontend/src/components/Hero.tsx` and `id="watch"` to
`frontend/src/components/sections/GrowSpirituallySection.tsx`, and add a small hash-scroll
effect so `/#service-times` and `/#watch` scroll to their sections on navigation. Without
this the signed-out `MoreSheet` has nothing to point at.

### Step 2 — Bottom navigation

Add a Tailwind spacing entry for `env(safe-area-inset-bottom)` (Tailwind 3.4 has no
built-in safe-area utility) and apply it as bottom padding on the bar. Add bottom padding
to the app's main content container so the bar never covers the last element of a page.
Add the new navigation strings to `frontend/src/i18n/dictionaries.ts` in both `en` and
`ti`, consumed through `useLanguage()`'s `t()` like the rest of the app. The bar is
`print:hidden`, matching the existing nav.

### Step 3 — Service worker

Add the `workbox-*` dependencies, `frontend/src/service-worker.js`, and
`frontend/src/sw/cachePolicy.ts`. Implement the precache filter and the allowlist runtime
routing described above.

### Step 4 — Registration and updates

Add `frontend/src/hooks/useServiceWorker.ts` and register from
`frontend/src/index.tsx`. Render the bilingual update toast from `App.tsx`.

### Step 5 — Install prompt

Extend `useServiceWorker` with the `beforeinstallprompt` capture and the iOS detection
branch; render the entry point inside `MoreSheet`.

### Step 6 — Polish

Audit tap targets to a 44px minimum, verify safe-area behavior on a notched device, and
tighten dashboard card density on small screens.

## Open questions

None. Tab set, offline scope, and update behavior were all decided during design.
