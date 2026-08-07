# Mobile Shell & PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the congregation a bottom-navigation, installable, offline-capable app shell on their phones.

**Architecture:** A `BottomNav` + `MoreSheet` pair mounts alongside the existing `Navigation` and is hidden at `md:` and above. A Workbox service worker, compiled by react-scripts 5's built-in `InjectManifest`, precaches a filtered build manifest and runtime-caches exactly one public API endpoint. A single `useServiceWorker` hook owns registration, update detection, and install-prompt capture; the rest of the app talks only to it.

**Tech Stack:** React 19, TypeScript 4.9, react-scripts 5.0.1 (CRA), Tailwind 3.4, react-router v6, Workbox 7, Jest + @testing-library/react.

## Global Constraints

- **No eject, no CRACO.** `react-scripts` 5.0.1 compiles `frontend/src/service-worker.js` automatically when that file exists. `npm run build` and `npm run build:ci` must keep working unchanged.
- **Every UI string is bilingual.** Add both `en` and `ti` entries to `frontend/src/i18n/dictionaries.ts`. Components read them via `useI18n()` from `frontend/src/i18n/I18nProvider`.
- **No member PII in `CacheStorage`.** Any request carrying an `Authorization` header is `NetworkOnly`. The only cacheable API path is `GET /api/announcements/active`.
- **Precache must not undo code splitting.** Filter the admin, treasurer, outreach, and SMS chunks out of `self.__WB_MANIFEST` before precaching. Commit `f9cc6b5` split those out deliberately.
- **`theme_color` is `#991b1b`** — `primary-700`, where the nav gradient in `frontend/src/components/Navigation.tsx:85` starts.
- **The bottom bar is `print:hidden`,** matching the existing nav.
- Tests live in `frontend/src/components/__tests__/` or colocated `*.test.tsx`, per `frontend/CLAUDE.md`.
- Run tests from `frontend/` with `npx react-scripts test --watchAll=false`.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `frontend/src/components/mobile/tabs.ts` | Tab definitions and the pure `resolveActiveTab()` function. |
| `frontend/src/components/mobile/BottomNav.tsx` | Renders the four tabs. Presentation only. |
| `frontend/src/components/mobile/MoreSheet.tsx` | Slide-up sheet; role-filtered link list. |
| `frontend/src/sw/cachePolicy.ts` | The pure "is this request cacheable" decision. |
| `frontend/src/service-worker.js` | Workbox precaching and runtime routing. |
| `frontend/src/hooks/useServiceWorker.ts` | Registration, update detection, install-prompt capture. |
| `frontend/src/components/mobile/UpdateToast.tsx` | "New version — Refresh" toast. |
| `frontend/src/pages/CalendarPage.tsx` | Route-level wrapper around `OrthodoxCalendar`. |
| `frontend/scripts/generate-icons.mjs` | Generates PWA icons with `sharp`. |

**Modify:** `frontend/public/manifest.json`, `frontend/public/index.html`, `frontend/src/App.tsx`, `frontend/src/index.tsx`, `frontend/src/i18n/dictionaries.ts`, `frontend/tailwind.config.js`, `frontend/package.json`, `frontend/src/components/Hero.tsx`, `frontend/src/components/sections/GrowSpirituallySection.tsx`, `frontend/src/components/sections/CalendarSection.tsx`.

**Delete:** `frontend/public/Orthodox Calendar 2025.pdf`.

---

## Icon source (resolved)

The icon is generated from `frontend/public/abune_aregawi.jpg` — a 1280×1457 photograph of a traditional icon painting of Abune Aregawi with the serpent of Debre Damo, supplied by Dawit.

The crop geometry below was chosen by rendering candidates at the size a launcher actually draws them (~96px) and comparing. **Do not change these numbers without repeating that check.** Two findings drove them:

- **The full scene is illegible small.** At 96px the whole painting reads as a dark rectangle. The "any purpose" icons therefore crop tightly to the saint's head — hat, white cross, face, beard — which stays readable.
- **Maskable needs bleed, not padding.** Android crops to a circle. Padding a photograph with flat red bars looks broken, so the maskable crop is the tight crop expanded by 1/0.8 about the same centre. The subject then lands inside the 80% safe circle and the mask cuts into background instead.

A modest `saturation: 1.15` / `linear(1.12, -10)` lift is applied because the source is a photograph of a dim wall painting.

| Output | Crop from source | Purpose |
|---|---|---|
| `icon-192.png`, `icon-512.png` | `left:155, top:95, 520×520` | `any` |
| `icon-512-maskable.png` | `left:90, top:30, 650×650` | `maskable` |

---

### Task 1: Manifest, icons, and meta tags

**Files:**
- Create: `frontend/scripts/generate-icons.mjs`
- Create: `frontend/src/__tests__/manifest.test.ts`
- Modify: `frontend/public/manifest.json`
- Modify: `frontend/public/index.html:8-9`
- Modify: `frontend/package.json` (prebuild script)
- Delete: `frontend/public/Orthodox Calendar 2025.pdf`

**Interfaces:**
- Consumes: nothing.
- Produces: `frontend/public/icon-512.png`, `frontend/public/icon-512-maskable.png`, `frontend/public/icon-192.png` — referenced by `manifest.json` and by Task 8's install prompt.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/__tests__/manifest.test.ts`. It reads the manifest from disk rather than importing it, matching the fs-reading pattern already used by `frontend/src/__tests__/lazyRoutes.test.ts`.

```ts
import * as fs from 'fs';
import * as path from 'path';

/**
 * The manifest used to declare a 512x512 icon whose src was the 192px file.
 * Chrome refuses the rich install prompt on that alone, and it fails silently —
 * nothing in the build or the typecheck notices. These assertions are the guard.
 */

const PUBLIC = path.join(__dirname, '..', '..', 'public');
const manifest = JSON.parse(
  fs.readFileSync(path.join(PUBLIC, 'manifest.json'), 'utf8')
);

const iconFor = (sizes: string) =>
  manifest.icons.find((i: any) => i.sizes === sizes);

describe('PWA manifest', () => {
  it('declares an id and a scope', () => {
    expect(manifest.id).toBe('/');
    expect(manifest.scope).toBe('/');
  });

  it('uses the parish red as the theme color', () => {
    // primary-700, where the nav gradient starts.
    expect(manifest.theme_color).toBe('#991b1b');
  });

  it('points the 512 icon at a genuinely 512px file', () => {
    const icon = iconFor('512x512');
    expect(icon).toBeDefined();
    expect(icon.src).not.toContain('192');
    expect(fs.existsSync(path.join(PUBLIC, icon.src))).toBe(true);
  });

  it('declares a maskable icon', () => {
    const maskable = manifest.icons.find((i: any) => i.purpose === 'maskable');
    expect(maskable).toBeDefined();
    expect(fs.existsSync(path.join(PUBLIC, maskable.src))).toBe(true);
  });

  it('every declared icon file exists', () => {
    manifest.icons.forEach((i: any) => {
      expect(fs.existsSync(path.join(PUBLIC, i.src))).toBe(true);
    });
  });

  it('is installable as a standalone app', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx react-scripts test src/__tests__/manifest.test.ts --watchAll=false`

Expected: FAIL. `manifest.id` is undefined, `theme_color` is `#000000`, and the `512x512` entry's `src` contains `192`.

- [ ] **Step 3: Write the icon generation script**

Create `frontend/scripts/generate-icons.mjs`. `sharp` is already a dependency (`frontend/package.json`), and this mirrors the existing `scripts/generate-og.mjs` prebuild step.

```js
// Generates the PWA icon set from the parish's icon painting of Abune Aregawi.
//
// The crops are not arbitrary. The source is a photograph of a whole painted
// scene, and a whole scene is unreadable at the ~48px a launcher draws. Both
// boxes were chosen by rendering candidates at that size and comparing; see the
// "Icon source" section of the plan before changing them.
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const SOURCE = path.join(PUBLIC, 'abune_aregawi.jpg');

// Tight on the saint's head: hat, white cross, face, beard. What survives small.
const SUBJECT = { left: 155, top: 95, width: 520, height: 520 };

// The same centre, widened by 1/0.8, so SUBJECT lands inside the maskable safe
// circle and Android's mask crops background rather than the face.
const SUBJECT_WITH_BLEED = { left: 90, top: 30, width: 650, height: 650 };

// The source is a photograph of a dim wall painting; this lifts it just enough.
const enhance = (pipeline) => pipeline.modulate({ saturation: 1.15 }).linear(1.12, -10);

const run = async () => {
  await enhance(sharp(SOURCE).extract(SUBJECT).resize(512, 512))
    .png().toFile(path.join(PUBLIC, 'icon-512.png'));

  await enhance(sharp(SOURCE).extract(SUBJECT).resize(192, 192))
    .png().toFile(path.join(PUBLIC, 'icon-192.png'));

  await enhance(sharp(SOURCE).extract(SUBJECT_WITH_BLEED).resize(512, 512))
    .png().toFile(path.join(PUBLIC, 'icon-512-maskable.png'));

  console.log('PWA icons written to public/');
};

run().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 4: Run the script and chain it into prebuild**

Run: `cd frontend && node ./scripts/generate-icons.mjs`

Expected: `PWA icons written to public/`, and three new files in `frontend/public/`.

Then in `frontend/package.json`, change the `prebuild` script so icons regenerate with every build:

```json
"prebuild": "node ./scripts/generate-og.mjs && node ./scripts/generate-icons.mjs",
```

- [ ] **Step 5: Rewrite the manifest**

Replace the entire contents of `frontend/public/manifest.json`:

```json
{
  "id": "/",
  "scope": "/",
  "short_name": "Abune Aregawi",
  "name": "Debre Tsehay Abune Aregawi - Orthodox Tewahedo Church Dallas",
  "icons": [
    { "src": "cropped-AbuneAregawi-32x32.png", "sizes": "32x32", "type": "image/png" },
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#991b1b",
  "background_color": "#ffffff"
}
```

- [ ] **Step 6: Add the mobile meta tags**

In `frontend/public/index.html`, replace lines 8–9:

```html
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#991b1b" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Abune Aregawi" />
  <link rel="apple-touch-icon" href="%PUBLIC_URL%/cropped-AbuneAregawi-180x180.png" />
```

`viewport-fit=cover` is what makes `env(safe-area-inset-bottom)` report a non-zero value in Task 4.

- [ ] **Step 7: Delete the stale calendar PDF**

```bash
cd frontend && git rm "public/Orthodox Calendar 2025.pdf"
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd frontend && npx react-scripts test src/__tests__/manifest.test.ts --watchAll=false`

Expected: PASS, 6 tests.

- [ ] **Step 9: Commit**

```bash
git add frontend/public/manifest.json frontend/public/index.html \
        frontend/scripts/generate-icons.mjs frontend/package.json \
        frontend/public/abune_aregawi.jpg \
        frontend/public/icon-192.png frontend/public/icon-512.png \
        frontend/public/icon-512-maskable.png \
        frontend/src/__tests__/manifest.test.ts
git commit -m "feat(pwa): fix the manifest and generate a real icon set

The 512x512 entry pointed at the 192px file, which is enough on its own
for Chrome to refuse the install prompt. Adds a maskable variant, an id
and scope, the parish red as theme_color, and viewport-fit=cover so the
safe-area insets report real values for the bottom bar."
```

---

### Task 2: `/calendar` route and homepage anchors

**Files:**
- Create: `frontend/src/pages/CalendarPage.tsx`
- Create: `frontend/src/pages/__tests__/CalendarPage.test.tsx`
- Modify: `frontend/src/App.tsx:53` (lazy imports), `frontend/src/App.tsx:131` (routes)
- Modify: `frontend/src/components/Hero.tsx:34`
- Modify: `frontend/src/components/sections/GrowSpirituallySection.tsx:10`
- Modify: `frontend/src/components/sections/CalendarSection.tsx:12`
- Modify: `frontend/src/components/HomePage.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: the `/calendar` route, and the DOM ids `service-times` and `watch` — Task 5's `MoreSheet` links to `/#service-times` and `/#watch`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/__tests__/CalendarPage.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import CalendarPage from '../CalendarPage';

// OrthodoxCalendar renders a large generated grid; this page's job is only to
// wrap it in a route-level heading, so the child is stubbed.
jest.mock('../../components/OrthodoxCalendar', () => () => (
  <div data-testid="orthodox-calendar" />
));

jest.mock('../../i18n/I18nProvider', () => ({
  useI18n: () => ({ lang: 'en', setLang: jest.fn(), t: (k: string) => k })
}));

describe('CalendarPage', () => {
  it('renders the calendar at its own route', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    expect(screen.getByTestId('orthodox-calendar')).toBeInTheDocument();
  });

  it('has a top-level heading so the route is not a bare grid', () => {
    render(<MemoryRouter><CalendarPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx react-scripts test src/pages/__tests__/CalendarPage.test.tsx --watchAll=false`

Expected: FAIL — `Cannot find module '../CalendarPage'`.

- [ ] **Step 3: Write the page**

Create `frontend/src/pages/CalendarPage.tsx`:

```tsx
import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import OrthodoxCalendar from '../components/OrthodoxCalendar';

/**
 * The calendar was only ever a section on the home page. The mobile bottom bar
 * needs a real route so the tab is deep-linkable and Back behaves correctly.
 * The home page keeps its section; both render the same component.
 */
const CalendarPage: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4">
        <h1 className="section-title text-center mb-12">{t('calendar.title')}</h1>
        <OrthodoxCalendar />
      </div>
    </div>
  );
};

export default CalendarPage;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx react-scripts test src/pages/__tests__/CalendarPage.test.tsx --watchAll=false`

Expected: PASS, 2 tests.

- [ ] **Step 5: Register the lazy route**

In `frontend/src/App.tsx`, add after line 53 (`const PrivacyPage = ...`):

```tsx
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
```

And add after the `/privacy` route on line 131:

```tsx
                <Route path="/calendar" element={<CalendarPage />} />
```

`src/__tests__/lazyRoutes.test.ts` discovers lazy imports by parsing `App.tsx`, so it picks this up with no edit — but it does assert the target has a default export, which Step 3 satisfies.

- [ ] **Step 6: Add the homepage anchor ids**

In `frontend/src/components/Hero.tsx`, add `id="service-times"` to the `<header>` at line 34:

```tsx
    <header
      id="service-times"
      className={`relative overflow-hidden hero-gradient text-white ${hasBg ? 'bg-cover bg-center' : 'bg-cross-lattice'
        }`}
```

In `frontend/src/components/sections/GrowSpirituallySection.tsx`, add `id="watch"` to the `<section>` at line 10:

```tsx
    <section id="watch" className="py-16">
```

- [ ] **Step 7: Add hash-scroll handling**

React Router v6 does not scroll to hash fragments. Without this, `/#service-times` from the More sheet lands at the top of the page and looks broken.

In `frontend/src/components/HomePage.tsx`, add the import and effect inside the component, before the `return`:

```tsx
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
```

```tsx
  const { hash } = useLocation();

  // React Router v6 does not scroll to hash fragments on its own.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);
```

- [ ] **Step 8: Fix the stale fallback string**

In `frontend/src/components/sections/CalendarSection.tsx` line 12, the English fallback still names 2025 even though the calendar is now generated:

```tsx
                    {t('calendar.title')}
```

- [ ] **Step 9: Verify the whole suite still passes**

Run: `cd frontend && npx react-scripts test --watchAll=false`

Expected: PASS. Pay attention to `lazyRoutes.test.ts` — it should now report one more lazy route.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/CalendarPage.tsx frontend/src/pages/__tests__/CalendarPage.test.tsx \
        frontend/src/App.tsx frontend/src/components/Hero.tsx \
        frontend/src/components/sections/GrowSpirituallySection.tsx \
        frontend/src/components/sections/CalendarSection.tsx \
        frontend/src/components/HomePage.tsx
git commit -m "feat(calendar): give the Orthodox calendar its own route

The bottom bar needs a deep-linkable Calendar tab, and the calendar only
existed as a home page section. Adds anchor ids and hash scrolling so the
More sheet can point signed-out visitors at service times and the stream."
```

---

### Task 3: The cacheability policy

**Files:**
- Create: `frontend/src/sw/cachePolicy.ts`
- Create: `frontend/src/sw/__tests__/cachePolicy.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isCacheableApiRequest(request: Request): boolean` and `CACHEABLE_API_PATH: string` — both imported by `frontend/src/service-worker.js` in Task 6.

This is a pure module on purpose. The decision that keeps member PII off the device is the one thing here that must be provably correct, and service-worker globals are painful to test.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/sw/__tests__/cachePolicy.test.ts`:

```ts
import { isCacheableApiRequest, CACHEABLE_API_PATH } from '../cachePolicy';

/**
 * These phones are frequently shared within a household, and CacheStorage
 * survives sign-out. The rule is an allowlist, never a denylist: if a new API
 * endpoint appears, it is uncacheable until someone deliberately adds it here.
 */

const req = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

describe('isCacheableApiRequest', () => {
  it('caches the public announcements feed', () => {
    expect(isCacheableApiRequest(req(`https://api.example.org${CACHEABLE_API_PATH}`))).toBe(true);
  });

  it('never caches a request carrying an Authorization header', () => {
    const authed = req(`https://api.example.org${CACHEABLE_API_PATH}`, {
      Authorization: 'Bearer some-firebase-id-token'
    });
    expect(isCacheableApiRequest(authed)).toBe(false);
  });

  it.each([
    '/api/members/123',
    '/api/payments/stats',
    '/api/transactions',
    '/api/members/reports/household-directory',
    '/api/zelle/reconcile/create-transaction'
  ])('does not cache %s', (path) => {
    expect(isCacheableApiRequest(req(`https://api.example.org${path}`))).toBe(false);
  });

  it('does not cache a non-GET request to the allowlisted path', () => {
    const post = new Request(`https://api.example.org${CACHEABLE_API_PATH}`, { method: 'POST' });
    expect(isCacheableApiRequest(post)).toBe(false);
  });

  it('does not treat a path that merely starts with the allowlisted one as a match', () => {
    expect(isCacheableApiRequest(req('https://api.example.org/api/announcements/active-drafts'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx react-scripts test src/sw/__tests__/cachePolicy.test.ts --watchAll=false`

Expected: FAIL — `Cannot find module '../cachePolicy'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/sw/cachePolicy.ts`:

```ts
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
  // cacheable no matter what it is a response to.
  if (request.headers.get('Authorization')) return false;

  if (request.method !== 'GET') return false;

  return new URL(request.url).pathname === CACHEABLE_API_PATH;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx react-scripts test src/sw/__tests__/cachePolicy.test.ts --watchAll=false`

Expected: PASS, 9 tests (the `it.each` contributes 5).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/sw/cachePolicy.ts frontend/src/sw/__tests__/cachePolicy.test.ts
git commit -m "feat(pwa): add the cacheability policy as a tested pure module

An allowlist, not a denylist: only the public announcements feed is
cacheable, and any request with an Authorization header is refused before
the path is even considered. No member PII reaches CacheStorage."
```

---

### Task 4: The bottom navigation bar

**Files:**
- Create: `frontend/src/components/mobile/tabs.ts`
- Create: `frontend/src/components/mobile/BottomNav.tsx`
- Create: `frontend/src/components/mobile/__tests__/tabs.test.ts`
- Create: `frontend/src/components/mobile/__tests__/BottomNav.test.tsx`
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/i18n/dictionaries.ts`
- Modify: `frontend/src/App.tsx:64`

**Interfaces:**
- Consumes: the `/calendar` route from Task 2.
- Produces: `TabId`, `TABS`, `resolveActiveTab(pathname: string): TabId`, and the `BottomNav` component. Task 5 imports `TabId` and passes an `onMoreClick` handler.

- [ ] **Step 1: Write the failing test for tab resolution**

Create `frontend/src/components/mobile/__tests__/tabs.test.ts`:

```ts
import { resolveActiveTab, TABS } from '../tabs';

/**
 * Every route in the app must light exactly one tab. A route that lights none
 * leaves the bar looking broken; a route that lights two is a bug that only
 * shows up on one screen.
 */

describe('resolveActiveTab', () => {
  it('lights Today on the home page and the dashboard', () => {
    expect(resolveActiveTab('/')).toBe('today');
    expect(resolveActiveTab('/dashboard')).toBe('today');
  });

  it('lights Calendar on the calendar route', () => {
    expect(resolveActiveTab('/calendar')).toBe('calendar');
  });

  it.each(['/donate', '/pledge', '/dues', '/thank-you'])(
    'lights Give on %s',
    (p) => expect(resolveActiveTab(p)).toBe('give')
  );

  it.each([
    '/profile', '/admin', '/treasurer', '/outreach', '/sms', '/gallery',
    '/departments', '/board-members', '/church-bylaw', '/credits', '/privacy',
    '/register', '/login', '/parish-pulse-sign-up', '/dependents'
  ])('falls back to More on %s', (p) => {
    expect(resolveActiveTab(p)).toBe('more');
  });

  it('falls back to More on nested routes', () => {
    expect(resolveActiveTab('/departments/12/meetings/3')).toBe('more');
    expect(resolveActiveTab('/gallery/abc123')).toBe('more');
  });

  it('exposes exactly four tabs', () => {
    expect(TABS.map((t) => t.id)).toEqual(['today', 'calendar', 'give', 'more']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx react-scripts test src/components/mobile/__tests__/tabs.test.ts --watchAll=false`

Expected: FAIL — `Cannot find module '../tabs'`.

- [ ] **Step 3: Write the tab definitions**

Create `frontend/src/components/mobile/tabs.ts`:

```ts
export type TabId = 'today' | 'calendar' | 'give' | 'more';

export interface TabDef {
  id: TabId;
  /** Dot-path key into the i18n dictionaries. */
  labelKey: string;
  /** Where the tab goes for a signed-in member. */
  authedPath: string;
  /** Where it goes for a signed-out visitor. */
  publicPath: string;
  /** Pathnames that light this tab. */
  matches: string[];
}

export const TABS: TabDef[] = [
  {
    id: 'today',
    labelKey: 'mobileNav.today',
    authedPath: '/dashboard',
    publicPath: '/',
    matches: ['/', '/dashboard']
  },
  {
    id: 'calendar',
    labelKey: 'mobileNav.calendar',
    authedPath: '/calendar',
    publicPath: '/calendar',
    matches: ['/calendar']
  },
  {
    id: 'give',
    labelKey: 'mobileNav.give',
    authedPath: '/donate',
    publicPath: '/donate',
    // Everything a member reaches while giving keeps the tab lit, so the bar
    // does not appear to lose its place mid-payment.
    matches: ['/donate', '/pledge', '/dues', '/thank-you']
  },
  {
    id: 'more',
    labelKey: 'mobileNav.more',
    authedPath: '',
    publicPath: '',
    matches: []
  }
];

/**
 * More is the catch-all: any route not explicitly claimed lights it, so the bar
 * is never blank on the app's twenty-odd remaining routes.
 */
export const resolveActiveTab = (pathname: string): TabId => {
  const hit = TABS.find((tab) => tab.matches.includes(pathname));
  return hit ? hit.id : 'more';
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx react-scripts test src/components/mobile/__tests__/tabs.test.ts --watchAll=false`

Expected: PASS.

- [ ] **Step 5: Add the safe-area spacing utility**

Tailwind 3.4 has no built-in safe-area utility. In `frontend/tailwind.config.js`, add inside `theme.extend`:

```js
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
        // Bar height (4rem) plus the home-indicator inset. Used as bottom
        // padding on page content so the bar never covers the last element.
        'bottom-nav': 'calc(4rem + env(safe-area-inset-bottom))',
      },
```

- [ ] **Step 6: Add the bilingual strings**

In `frontend/src/i18n/dictionaries.ts`, add a `mobileNav` block to both `export const en` (line 723) and `export const ti` (line 2549).

English:

```ts
  mobileNav: {
    today: 'Today',
    calendar: 'Calendar',
    give: 'Give',
    more: 'More',
    label: 'Main',
    closeMore: 'Close',
  },
```

Tigrigna:

```ts
  mobileNav: {
    today: 'ሎሚ',
    calendar: 'ዘመን መጽሓፍ',
    give: 'ወፈያ',
    more: 'ተወሳኺ',
    label: 'ቀንዲ',
    closeMore: 'ዕጸው',
  },
```

These are drafts and should go on the native-speaker review list in `tigrigna-translation-review.md` at the repo root, alongside the existing flagged strings.

- [ ] **Step 7: Write the failing component test**

Create `frontend/src/components/mobile/__tests__/BottomNav.test.tsx`. The i18n mock mirrors `frontend/src/components/__tests__/Navigation.test.tsx` so the assertions prove the labels are looked up rather than hardcoded.

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from '../BottomNav';
import { en, ti } from '../../../i18n/dictionaries';

let mockActiveLang: 'en' | 'ti' = 'en';
jest.mock('../../../i18n/I18nProvider', () => ({
  useI18n: () => {
    const dicts = jest.requireActual('../../../i18n/dictionaries');
    const dict = mockActiveLang === 'ti' ? dicts.ti : dicts.en;
    return {
      lang: mockActiveLang,
      setLang: jest.fn(),
      t: (key: string) => {
        const walk = (o: any) => key.split('.').reduce((acc: any, k) => acc?.[k], o);
        return dict[key] ?? walk(dict) ?? dicts.en[key] ?? walk(dicts.en) ?? key;
      }
    };
  }
}));

let mockCurrentUser: any = null;
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: mockCurrentUser })
}));

const renderBar = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <BottomNav onMoreClick={jest.fn()} />
    </MemoryRouter>
  );

afterEach(() => { mockActiveLang = 'en'; mockCurrentUser = null; });

describe('BottomNav', () => {
  it('renders all four tabs', () => {
    renderBar('/');
    ['today', 'calendar', 'give', 'more'].forEach((id) => {
      expect(screen.getByText((en as any).mobileNav[id])).toBeInTheDocument();
    });
  });

  it('marks the active tab for assistive technology', () => {
    renderBar('/calendar');
    const active = screen.getByRole('link', { current: 'page' });
    expect(active).toHaveTextContent((en as any).mobileNav.calendar);
  });

  it('points Today at the home page for a signed-out visitor', () => {
    renderBar('/');
    expect(screen.getByText((en as any).mobileNav.today).closest('a'))
      .toHaveAttribute('href', '/');
  });

  it('points Today at the dashboard for a signed-in member', () => {
    mockCurrentUser = { uid: 'abc' };
    renderBar('/dashboard');
    expect(screen.getByText((en as any).mobileNav.today).closest('a'))
      .toHaveAttribute('href', '/dashboard');
  });

  it('renders Tigrigna labels when the language is Tigrigna', () => {
    mockActiveLang = 'ti';
    renderBar('/');
    expect(screen.getByText((ti as any).mobileNav.give)).toBeInTheDocument();
    expect(screen.queryByText((en as any).mobileNav.give)).not.toBeInTheDocument();
  });

  it('renders More as a button, not a link', () => {
    renderBar('/');
    expect(screen.getByRole('button', { name: (en as any).mobileNav.more }))
      .toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `cd frontend && npx react-scripts test src/components/mobile/__tests__/BottomNav.test.tsx --watchAll=false`

Expected: FAIL — `Cannot find module '../BottomNav'`.

- [ ] **Step 9: Write the component**

Create `frontend/src/components/mobile/BottomNav.tsx`:

```tsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../../contexts/AuthContext';
import { TABS, resolveActiveTab, TabDef } from './tabs';

interface BottomNavProps {
  onMoreClick: () => void;
}

// React 19 removed the global JSX namespace, so JSX.Element does not resolve here.
const ICONS: Record<string, React.ReactElement> = {
  today: <path d="M12 3l2.09 6.26H21l-5.45 3.97L17.64 21 12 17.27 6.36 21l2.09-7.77L3 9.26h6.91z" />,
  calendar: <path d="M7 2v3M17 2v3M3.5 8h17M4 5h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />,
  give: <path d="M12 21s-7.5-4.6-9.3-9A5 5 0 0112 5.8 5 5 0 0121.3 12c-1.8 4.4-9.3 9-9.3 9z" />,
  more: <path d="M4 7h16M4 12h16M4 17h16" />,
};

const Icon: React.FC<{ id: string; active: boolean }> = ({ id, active }) => (
  <svg
    className="h-6 w-6"
    viewBox="0 0 24 24"
    fill={active && id === 'today' ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {ICONS[id]}
  </svg>
);

/**
 * Phone-only chrome. The congregation is overwhelmingly mobile, and the only
 * navigation they had was a hamburger. Hidden from md: up, where the existing
 * header already works.
 */
const BottomNav: React.FC<BottomNavProps> = ({ onMoreClick }) => {
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const { pathname } = useLocation();
  const active = resolveActiveTab(pathname);

  const pathFor = (tab: TabDef) => (currentUser ? tab.authedPath : tab.publicPath);

  const itemClass = (isActive: boolean) =>
    [
      'flex flex-col items-center justify-center gap-0.5 flex-1',
      // 44px minimum touch target.
      'min-h-[44px] py-1.5 text-[11px] font-medium transition-colors',
      isActive ? 'text-primary-700' : 'text-gray-500 hover:text-primary-600',
    ].join(' ');

  return (
    <nav
      aria-label={t('mobileNav.label')}
      className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-1px_3px_rgba(0,0,0,0.06)] pb-safe-b"
    >
      <div className="flex items-stretch">
        {TABS.map((tab) =>
          tab.id === 'more' ? (
            <button
              key={tab.id}
              type="button"
              onClick={onMoreClick}
              className={itemClass(active === tab.id)}
              aria-haspopup="dialog"
            >
              <Icon id={tab.id} active={active === tab.id} />
              <span>{t(tab.labelKey)}</span>
            </button>
          ) : (
            <Link
              key={tab.id}
              to={pathFor(tab)}
              aria-current={active === tab.id ? 'page' : undefined}
              className={itemClass(active === tab.id)}
            >
              <Icon id={tab.id} active={active === tab.id} />
              <span>{t(tab.labelKey)}</span>
            </Link>
          )
        )}
      </div>
    </nav>
  );
};

export default BottomNav;
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `cd frontend && npx react-scripts test src/components/mobile/__tests__/BottomNav.test.tsx --watchAll=false`

Expected: PASS, 6 tests.

- [ ] **Step 11: Mount it and give content room**

In `frontend/src/App.tsx`, import at the top with the other eager components:

```tsx
import BottomNav from './components/mobile/BottomNav';
```

Then after `<Navigation />` on line 64, add a piece of state and the bar. The `MoreSheet` arrives in Task 5; for now the handler is a no-op placeholder that Task 5 replaces.

```tsx
            <Navigation />
            <BottomNav onMoreClick={() => setMoreOpen(true)} />
```

Add to the top of `function App()`:

```tsx
  const [moreOpen, setMoreOpen] = React.useState(false);
```

Give the routed content bottom room so the bar never covers the last element — change the wrapper on line 60:

```tsx
          <div className="App pb-bottom-nav md:pb-0">
```

- [ ] **Step 12: Verify the whole suite passes**

Run: `cd frontend && npx react-scripts test --watchAll=false`

Expected: PASS. TypeScript will warn that `moreOpen` is unused until Task 5 — that is expected and resolves there. If `CI=true` turns that into an error, run with `CI=false`.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/components/mobile/ frontend/tailwind.config.js \
        frontend/src/i18n/dictionaries.ts frontend/src/App.tsx
git commit -m "feat(mobile): add the bottom navigation bar

Four tabs, phone-only, with More as the catch-all so none of the app's
routes leave the bar blank. Safe-area padding keeps it clear of the iOS
home indicator, and page content gets matching bottom room."
```

---

### Task 5: The More sheet

**Files:**
- Create: `frontend/src/components/mobile/MoreSheet.tsx`
- Create: `frontend/src/components/mobile/__tests__/MoreSheet.test.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `TabId` from Task 2's `tabs.ts`; the `service-times` and `watch` anchor ids from Task 2; `getMergedPermissions` and `UserRole` from `frontend/src/utils/roles.ts`.
- Produces: the `MoreSheet` component, `{ open: boolean; onClose: () => void }`. Task 8 renders the install prompt inside it.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/mobile/__tests__/MoreSheet.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import MoreSheet from '../MoreSheet';
import { en } from '../../../i18n/dictionaries';

jest.mock('../../../i18n/I18nProvider', () => ({
  useI18n: () => {
    const dicts = jest.requireActual('../../../i18n/dictionaries');
    return {
      lang: 'en',
      setLang: jest.fn(),
      t: (key: string) => {
        const walk = (o: any) => key.split('.').reduce((acc: any, k) => acc?.[k], o);
        return dicts.en[key] ?? walk(dicts.en) ?? key;
      }
    };
  }
}));

let mockCurrentUser: any = null;
let mockProfile: any = null;
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
    logout: jest.fn(),
    getUserProfile: jest.fn().mockResolvedValue(mockProfile)
  })
}));

const renderSheet = () =>
  render(<MemoryRouter><MoreSheet open onClose={jest.fn()} /></MemoryRouter>);

afterEach(() => { mockCurrentUser = null; mockProfile = null; });

describe('MoreSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <MemoryRouter><MoreSheet open={false} onClose={jest.fn()} /></MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('is a dialog when open', () => {
    renderSheet();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  describe('signed out', () => {
    it('offers service times and the stream as homepage anchors', () => {
      renderSheet();
      expect(screen.getByText((en as any).mobileNav.serviceTimes).closest('a'))
        .toHaveAttribute('href', '/#service-times');
      expect(screen.getByText((en as any).mobileNav.watch).closest('a'))
        .toHaveAttribute('href', '/#watch');
    });

    it('offers sign in and does not offer member-only links', () => {
      renderSheet();
      expect(screen.getByText(en['sign.in'])).toBeInTheDocument();
      expect(screen.queryByText((en as any).mobileNav.profile)).not.toBeInTheDocument();
    });
  });

  describe('signed in', () => {
    it('offers member links but no admin panel for a plain member', async () => {
      mockCurrentUser = { uid: 'abc' };
      mockProfile = { data: { member: { roles: ['member'] } } };
      renderSheet();
      expect(await screen.findByText((en as any).mobileNav.profile)).toBeInTheDocument();
      expect(screen.queryByText((en as any).mobileNav.admin)).not.toBeInTheDocument();
    });

    it('offers the admin panel to an admin', async () => {
      mockCurrentUser = { uid: 'abc' };
      mockProfile = { data: { member: { roles: ['admin'] } } };
      renderSheet();
      expect(await screen.findByText((en as any).mobileNav.admin)).toBeInTheDocument();
    });

    it('offers the treasurer dashboard to a treasurer but not the admin panel', async () => {
      mockCurrentUser = { uid: 'abc' };
      mockProfile = { data: { member: { roles: ['treasurer'] } } };
      renderSheet();
      expect(await screen.findByText((en as any).mobileNav.treasurer)).toBeInTheDocument();
      expect(screen.queryByText((en as any).mobileNav.admin)).not.toBeInTheDocument();
    });

    it('merges permissions for a multi-role member', async () => {
      mockCurrentUser = { uid: 'abc' };
      mockProfile = { data: { member: { roles: ['member', 'treasurer'] } } };
      renderSheet();
      expect(await screen.findByText((en as any).mobileNav.treasurer)).toBeInTheDocument();
      expect(screen.getByText((en as any).mobileNav.profile)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx react-scripts test src/components/mobile/__tests__/MoreSheet.test.tsx --watchAll=false`

Expected: FAIL — `Cannot find module '../MoreSheet'`.

- [ ] **Step 3: Add the bilingual strings**

Extend the `mobileNav` block in both `en` and `ti` in `frontend/src/i18n/dictionaries.ts` with:

English:

```ts
    serviceTimes: 'Service Times',
    watch: 'Watch Live',
    profile: 'My Profile',
    dependents: 'My Family',
    departments: 'Departments',
    gallery: 'Photo Gallery',
    board: 'Board Members',
    bylaw: 'Church Bylaw',
    privacy: 'Privacy',
    admin: 'Admin Panel',
    treasurer: 'Treasurer',
    outreach: 'Outreach',
    sms: 'SMS Broadcast',
    menuTitle: 'More',
```

Tigrigna:

```ts
    serviceTimes: 'ሰዓታት ኣገልግሎት',
    watch: 'ብቐጥታ ተኸታተል',
    profile: 'መለለዪየይ',
    dependents: 'ስድራይ',
    departments: 'ክፍልታት',
    gallery: 'ኣልበም ስእሊ',
    board: 'ኣባላት ቦርድ',
    bylaw: 'ሕገ ደንቢ ቤተ ክርስቲያን',
    privacy: 'ውልቃዊ ሓበሬታ',
    admin: 'መሐደሪ ክፍሊ',
    treasurer: 'ሓላዊ ገንዘብ',
    outreach: 'ምብጻሕ',
    sms: 'መልእኽቲ ምዝርጋሕ',
    menuTitle: 'ተወሳኺ',
```

Add these to the native-speaker review list in `tigrigna-translation-review.md`.

- [ ] **Step 4: Write the component**

Create `frontend/src/components/mobile/MoreSheet.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole, getMergedPermissions } from '../../utils/roles';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

interface SheetLink {
  to: string;
  labelKey: string;
}

/**
 * The overflow destination for the bottom bar. Draws its role-gated entries
 * from getMergedPermissions() rather than keeping a second list, so a
 * permission change in roles.ts reaches the phone without a second edit.
 */
const MoreSheet: React.FC<MoreSheetProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const { currentUser, logout, getUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (!currentUser || !open) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUserProfile(
          currentUser.uid || currentUser.id,
          currentUser.email,
          currentUser.phoneNumber
        );
        if (!cancelled) setUserProfile(profile);
      } catch {
        // A failed profile lookup degrades to the member-only link set rather
        // than blanking the sheet.
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser, open, getUserProfile]);

  // Escape closes, matching the dialog role.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const member = userProfile?.data?.member || userProfile;
  const roles: UserRole[] = member?.roles || [member?.role || 'member'];
  const perms = getMergedPermissions(roles);

  const links: SheetLink[] = currentUser
    ? [
        { to: '/profile', labelKey: 'mobileNav.profile' },
        { to: '/dependents', labelKey: 'mobileNav.dependents' },
        { to: '/departments', labelKey: 'mobileNav.departments' },
        { to: '/gallery', labelKey: 'mobileNav.gallery' },
        { to: '/board-members', labelKey: 'mobileNav.board' },
        { to: '/church-bylaw', labelKey: 'mobileNav.bylaw' },
      ]
    : [
        { to: '/#service-times', labelKey: 'mobileNav.serviceTimes' },
        { to: '/#watch', labelKey: 'mobileNav.watch' },
        { to: '/church-bylaw', labelKey: 'mobileNav.bylaw' },
        { to: '/privacy', labelKey: 'mobileNav.privacy' },
      ];

  const staffLinks: SheetLink[] = currentUser
    ? [
        perms.canAccessAdminPanel && { to: '/admin', labelKey: 'mobileNav.admin' },
        perms.canViewFinancialRecords && { to: '/treasurer', labelKey: 'mobileNav.treasurer' },
        perms.canAccessOutreachDashboard && { to: '/outreach', labelKey: 'mobileNav.outreach' },
        perms.canSendCommunications && { to: '/sms', labelKey: 'mobileNav.sms' },
      ].filter(Boolean) as SheetLink[]
    : [];

  const itemClass =
    'block w-full px-4 py-3 min-h-[44px] text-left text-gray-800 hover:bg-gray-50 rounded-lg';

  return (
    <div className="md:hidden print:hidden fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('mobileNav.menuTitle')}
        className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto pb-safe-b"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-gray-900">{t('mobileNav.menuTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 min-h-[44px] text-sm text-gray-500"
          >
            {t('mobileNav.closeMore')}
          </button>
        </div>

        <div className="px-2 pb-4">
          {links.map((l) => (
            <Link key={l.to} to={l.to} onClick={onClose} className={itemClass}>
              {t(l.labelKey)}
            </Link>
          ))}

          {staffLinks.length > 0 && (
            <>
              <hr className="my-2 border-gray-200" />
              {staffLinks.map((l) => (
                <Link key={l.to} to={l.to} onClick={onClose} className={itemClass}>
                  {t(l.labelKey)}
                </Link>
              ))}
            </>
          )}

          <hr className="my-2 border-gray-200" />
          {currentUser ? (
            <button
              type="button"
              onClick={() => { logout(); onClose(); }}
              className={`${itemClass} text-red-600`}
            >
              {t('sign.out')}
            </button>
          ) : (
            <Link to="/login" onClick={onClose} className={`${itemClass} text-primary-700 font-medium`}>
              {t('sign.in')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoreSheet;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx react-scripts test src/components/mobile/__tests__/MoreSheet.test.tsx --watchAll=false`

Expected: PASS, 8 tests.

- [ ] **Step 6: Wire it into App**

In `frontend/src/App.tsx`, import it and render it next to `BottomNav`, consuming the `moreOpen` state added in Task 4:

```tsx
import MoreSheet from './components/mobile/MoreSheet';
```

```tsx
            <BottomNav onMoreClick={() => setMoreOpen(true)} />
            <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
```

- [ ] **Step 7: Verify the whole suite passes**

Run: `cd frontend && npx react-scripts test --watchAll=false`

Expected: PASS. The unused-variable warning from Task 4 is gone.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/mobile/MoreSheet.tsx \
        frontend/src/components/mobile/__tests__/MoreSheet.test.tsx \
        frontend/src/i18n/dictionaries.ts frontend/src/App.tsx
git commit -m "feat(mobile): add the More sheet behind the bottom bar

Role-gated entries come from getMergedPermissions() rather than a second
hand-maintained list. Signed-out visitors get service times and the
stream, which is more than the header has ever offered them."
```

---

### Task 6: The service worker

**Files:**
- Create: `frontend/src/service-worker.js`
- Create: `frontend/src/hooks/useServiceWorker.ts`
- Create: `frontend/src/hooks/__tests__/useServiceWorker.test.ts`
- Modify: `frontend/package.json` (workbox dependencies)
- Modify: `frontend/src/App.tsx` (calls the hook; `index.tsx` is untouched — registration is driven from a component, not from the entry point)

**Interfaces:**
- Consumes: `isCacheableApiRequest`, `CACHEABLE_API_PATH` from Task 3.
- Produces: `useServiceWorker(): { updateAvailable: boolean; applyUpdate: () => void }`. Task 7 consumes both; Task 8 extends the hook's return with install-prompt fields.

- [ ] **Step 1: Install the Workbox packages**

```bash
cd frontend && npm install --save \
  workbox-core@^7.1.0 \
  workbox-precaching@^7.1.0 \
  workbox-routing@^7.1.0 \
  workbox-strategies@^7.1.0 \
  workbox-expiration@^7.1.0
```

These are runtime dependencies, not devDependencies — they are bundled into the compiled service worker.

- [ ] **Step 2: Write the failing hook test**

Create `frontend/src/hooks/__tests__/useServiceWorker.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { useServiceWorker } from '../useServiceWorker';

/**
 * The hook is the only thing the app talks to. Registration failing must never
 * break the app — the service worker is an enhancement, not a dependency.
 */

const makeRegistration = () => {
  const waiting = { postMessage: jest.fn() };
  return {
    waiting: null as any,
    installing: null as any,
    addEventListener: jest.fn(),
    _waiting: waiting
  };
};

describe('useServiceWorker', () => {
  const original = (global as any).navigator.serviceWorker;

  afterEach(() => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: original, configurable: true, writable: true
    });
    jest.restoreAllMocks();
  });

  it('reports no update available before anything registers', () => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { register: jest.fn().mockResolvedValue(makeRegistration()), addEventListener: jest.fn() },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    expect(result.current.updateAvailable).toBe(false);
  });

  it('does not throw when the browser has no service worker support', () => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: undefined, configurable: true, writable: true
    });
    expect(() => renderHook(() => useServiceWorker())).not.toThrow();
  });

  it('does not throw when registration rejects', async () => {
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { register: jest.fn().mockRejectedValue(new Error('nope')), addEventListener: jest.fn() },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.updateAvailable).toBe(false);
  });

  it('surfaces an update when a worker is already waiting', async () => {
    const waiting = { postMessage: jest.fn() };
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue({ waiting, addEventListener: jest.fn() }),
        addEventListener: jest.fn()
      },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.updateAvailable).toBe(true);
  });

  it('tells the waiting worker to take over when the update is applied', async () => {
    const waiting = { postMessage: jest.fn() };
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue({ waiting, addEventListener: jest.fn() }),
        addEventListener: jest.fn()
      },
      configurable: true, writable: true
    });
    const { result } = renderHook(() => useServiceWorker());
    await act(async () => { await Promise.resolve(); });
    act(() => { result.current.applyUpdate(); });
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npx react-scripts test src/hooks/__tests__/useServiceWorker.test.ts --watchAll=false`

Expected: FAIL — `Cannot find module '../useServiceWorker'`.

- [ ] **Step 4: Write the hook**

Create `frontend/src/hooks/useServiceWorker.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Owns the service worker lifecycle so no other module has to know about it.
 *
 * A new worker installs and *waits* rather than taking over. Members fill in
 * payment forms on this site; swapping the assets under them mid-form is worse
 * than a few extra minutes on an old build.
 */
export const useServiceWorker = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let cancelled = false;

    const track = (worker: ServiceWorker | null) => {
      if (!worker || cancelled) return;
      waitingRef.current = worker;
      setUpdateAvailable(true);
    };

    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL || ''}/service-worker.js`)
      .then((registration) => {
        if (cancelled) return;

        // A worker may already be waiting from a previous visit.
        track(registration.waiting);

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // 'installed' with an existing controller means an update, not a
            // first install.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              track(installing);
            }
          });
        });
      })
      .catch(() => {
        // The app must behave identically with no service worker.
      });

    return () => { cancelled = true; };
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = waitingRef.current;
    if (!waiting) return;

    // Reload once the new worker has actually taken control, not before.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });

    waiting.postMessage({ type: 'SKIP_WAITING' });
  }, []);

  return { updateAvailable, applyUpdate };
};
```

- [ ] **Step 5: Run the hook test**

Run: `cd frontend && npx react-scripts test src/hooks/__tests__/useServiceWorker.test.ts --watchAll=false`

Expected: PASS, 5 tests. Note the `NODE_ENV !== 'production'` guard: Jest sets `NODE_ENV=test`, so add this line at the top of the test file, before the import, to exercise the real path:

```ts
// The hook no-ops outside production; these tests exercise the real path.
(process.env as any).NODE_ENV = 'production';
```

Re-run and confirm PASS.

- [ ] **Step 6: Write the service worker**

Create `frontend/src/service-worker.js`. react-scripts 5 detects this path and compiles it with Workbox's `InjectManifest`; no build configuration changes.

```js
/* eslint-disable no-restricted-globals */

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { isCacheableApiRequest } from './sw/cachePolicy';

clientsClaim();

/**
 * CRA's generated manifest lists every code-split chunk, including the admin
 * and treasurer bundles that commit f9cc6b5 deliberately split out of the
 * initial download. Precaching all of it would hand every member the
 * treasurer's bundle again. Those chunks stay lazy and are fetched only if
 * somebody actually navigates to them.
 */
precacheAndRoute(
  self.__WB_MANIFEST.filter((entry) => !/(admin|treasurer|outreach|sms)/.test(entry.url))
);

// Navigations render from the precached shell, so a cold offline launch shows
// the app rather than the browser's error page.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(`${process.env.PUBLIC_URL || ''}/index.html`), {
    denylist: [/^\/api\//],
  })
);

// The single allowlisted API response. Everything else falls through to the
// NetworkOnly rule below.
registerRoute(
  ({ request }) => isCacheableApiRequest(request),
  new StaleWhileRevalidate({
    cacheName: 'parish-announcements',
    plugins: [new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 24 * 60 * 60 })],
  })
);

// Explicit: any other API request, including every authenticated one, never
// touches CacheStorage.
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

// The page asks for the takeover; the worker never forces it.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
```

- [ ] **Step 7: Register the worker**

Registration is driven from a component rather than the entry point, so `frontend/src/index.tsx` is not touched. Add the hook call in `frontend/src/App.tsx` inside `function App()` — Task 7 renders its toast:

```tsx
  const { updateAvailable, applyUpdate } = useServiceWorker();
```

with the import:

```tsx
import { useServiceWorker } from './hooks/useServiceWorker';
```

- [ ] **Step 8: Verify the build produces a service worker**

Run: `cd frontend && npm run build:ci`

Expected: the build succeeds and `frontend/build/service-worker.js` exists. Confirm the precache filter worked:

```bash
cd frontend && grep -c "admin" build/service-worker.js
```

Expected: the admin chunk filenames do not appear in the precache manifest inside that file.

- [ ] **Step 9: Run the whole suite**

Run: `cd frontend && npx react-scripts test --watchAll=false`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/service-worker.js frontend/src/hooks/ \
        frontend/package.json frontend/package-lock.json frontend/src/App.tsx
git commit -m "feat(pwa): add the service worker and registration hook

Precache is filtered so members do not re-download the treasurer bundle
that f9cc6b5 split out. Only the public announcements feed is runtime
cached; every other API path is NetworkOnly. A new worker waits rather
than taking over, so nobody is swapped out mid-payment."
```

---

### Task 7: The update toast

**Files:**
- Create: `frontend/src/components/mobile/UpdateToast.tsx`
- Create: `frontend/src/components/mobile/__tests__/UpdateToast.test.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `updateAvailable` and `applyUpdate` from Task 6's hook.
- Produces: the `UpdateToast` component, `{ show: boolean; onRefresh: () => void }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/mobile/__tests__/UpdateToast.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import UpdateToast from '../UpdateToast';
import { en, ti } from '../../../i18n/dictionaries';

let mockActiveLang: 'en' | 'ti' = 'en';
jest.mock('../../../i18n/I18nProvider', () => ({
  useI18n: () => {
    const dicts = jest.requireActual('../../../i18n/dictionaries');
    const dict = mockActiveLang === 'ti' ? dicts.ti : dicts.en;
    return {
      lang: mockActiveLang,
      setLang: jest.fn(),
      t: (key: string) => {
        const walk = (o: any) => key.split('.').reduce((acc: any, k) => acc?.[k], o);
        return dict[key] ?? walk(dict) ?? dicts.en[key] ?? walk(dicts.en) ?? key;
      }
    };
  }
}));

afterEach(() => { mockActiveLang = 'en'; });

describe('UpdateToast', () => {
  it('renders nothing when no update is available', () => {
    const { container } = render(<UpdateToast show={false} onRefresh={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces the update politely to assistive technology', () => {
    render(<UpdateToast show onRefresh={jest.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('calls onRefresh when the refresh button is pressed', () => {
    const onRefresh = jest.fn();
    render(<UpdateToast show onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: (en as any).pwa.refresh }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders in Tigrigna when the language is Tigrigna', () => {
    mockActiveLang = 'ti';
    render(<UpdateToast show onRefresh={jest.fn()} />);
    expect(screen.getByText((ti as any).pwa.updateAvailable)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx react-scripts test src/components/mobile/__tests__/UpdateToast.test.tsx --watchAll=false`

Expected: FAIL — `Cannot find module '../UpdateToast'`.

- [ ] **Step 3: Add the bilingual strings**

Add a `pwa` block to both `en` and `ti` in `frontend/src/i18n/dictionaries.ts`.

English:

```ts
  pwa: {
    updateAvailable: 'A new version is available.',
    refresh: 'Refresh',
    installTitle: 'Add to Home Screen',
    installBody: 'Install the parish app for faster access.',
    install: 'Install',
    installDismiss: 'Not now',
    iosInstallBody: 'Tap Share, then "Add to Home Screen".',
  },
```

Tigrigna:

```ts
  pwa: {
    updateAvailable: 'ሓድሽ ዝተመሓየሸ ወጺኡ ኣሎ።',
    refresh: 'ኣሐድስ',
    installTitle: 'ናብ መተግበሪ ገጽ ወስኽ',
    installBody: 'ቀልጢፍካ ንምእታው ናይ ቤተ ክርስቲያን መተግበሪ ኣውርድ።',
    install: 'ኣውርድ',
    installDismiss: 'ሕጂ ኣይኮነን',
    iosInstallBody: 'Share ጠውቕ፡ ደሓር "Add to Home Screen" ምረጽ።',
  },
```

Add these to `tigrigna-translation-review.md`.

- [ ] **Step 4: Write the component**

Create `frontend/src/components/mobile/UpdateToast.tsx`:

```tsx
import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';

interface UpdateToastProps {
  show: boolean;
  onRefresh: () => void;
}

/**
 * Sits above the bottom bar so it does not cover the tabs. The member chooses
 * when to take the new build; nothing reloads underneath them.
 *
 * The underscores in the bottom-[...] arbitrary value are Tailwind's escape for
 * the spaces calc() requires; calc(4rem+env(...)) without them is invalid CSS
 * and silently drops the rule.
 */
const UpdateToast: React.FC<UpdateToastProps> = ({ show, onRefresh }) => {
  const { t } = useI18n();

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="print:hidden fixed inset-x-0 bottom-[calc(4rem_+_env(safe-area-inset-bottom))] md:bottom-4 z-50 px-4"
    >
      <div className="mx-auto max-w-md flex items-center justify-between gap-3 rounded-lg bg-gray-900 text-white px-4 py-3 shadow-lg">
        <span className="text-sm">{t('pwa.updateAvailable')}</span>
        <button
          type="button"
          onClick={onRefresh}
          className="shrink-0 min-h-[44px] px-3 text-sm font-semibold text-secondary-400 hover:text-secondary-300"
        >
          {t('pwa.refresh')}
        </button>
      </div>
    </div>
  );
};

export default UpdateToast;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx react-scripts test src/components/mobile/__tests__/UpdateToast.test.tsx --watchAll=false`

Expected: PASS, 4 tests.

- [ ] **Step 6: Render it from App**

In `frontend/src/App.tsx`, add the import and render it beside `MoreSheet`, using the hook values already added in Task 6 Step 7:

```tsx
import UpdateToast from './components/mobile/UpdateToast';
```

```tsx
            <UpdateToast show={updateAvailable} onRefresh={applyUpdate} />
```

- [ ] **Step 7: Verify the whole suite passes**

Run: `cd frontend && npx react-scripts test --watchAll=false`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/mobile/UpdateToast.tsx \
        frontend/src/components/mobile/__tests__/UpdateToast.test.tsx \
        frontend/src/i18n/dictionaries.ts frontend/src/App.tsx
git commit -m "feat(pwa): offer a refresh when a new build is waiting

Sits above the bottom bar and waits for the member to choose, rather than
swapping assets under someone part-way through a payment form."
```

---

### Task 8: The install prompt

**Files:**
- Create: `frontend/src/hooks/__tests__/useInstallPrompt.test.ts`
- Modify: `frontend/src/hooks/useServiceWorker.ts`
- Modify: `frontend/src/components/mobile/MoreSheet.tsx`

**Interfaces:**
- Consumes: Task 5's `MoreSheet`, Task 6's hook.
- Produces: `useServiceWorker()` additionally returns `{ canInstall: boolean; isIos: boolean; promptInstall: () => void; dismissInstall: () => void }`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/__tests__/useInstallPrompt.test.ts`:

```ts
(process.env as any).NODE_ENV = 'production';

import { renderHook, act } from '@testing-library/react';
import { useServiceWorker } from '../useServiceWorker';

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const setUserAgent = (ua: string) =>
  Object.defineProperty(global.navigator, 'userAgent', {
    value: ua, configurable: true, writable: true
  });

beforeEach(() => {
  Object.defineProperty(global.navigator, 'serviceWorker', {
    value: { register: jest.fn().mockResolvedValue({ addEventListener: jest.fn() }), addEventListener: jest.fn() },
    configurable: true, writable: true
  });
  localStorage.clear();
  setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36');
  (window as any).matchMedia = jest.fn().mockReturnValue({ matches: false });
});

const fireBeforeInstallPrompt = () => {
  const event: any = new Event('beforeinstallprompt');
  event.prompt = jest.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(event);
  return event;
};

describe('install prompt', () => {
  it('cannot install until the browser offers the event', () => {
    const { result } = renderHook(() => useServiceWorker());
    expect(result.current.canInstall).toBe(false);
  });

  it('can install once beforeinstallprompt fires', () => {
    const { result } = renderHook(() => useServiceWorker());
    act(() => { fireBeforeInstallPrompt(); });
    expect(result.current.canInstall).toBe(true);
  });

  it('shows the browser prompt when asked', () => {
    const { result } = renderHook(() => useServiceWorker());
    let event: any;
    act(() => { event = fireBeforeInstallPrompt(); });
    act(() => { result.current.promptInstall(); });
    expect(event.prompt).toHaveBeenCalled();
  });

  it('remembers a dismissal across mounts', () => {
    const first = renderHook(() => useServiceWorker());
    act(() => { fireBeforeInstallPrompt(); });
    act(() => { first.result.current.dismissInstall(); });
    expect(first.result.current.canInstall).toBe(false);

    const second = renderHook(() => useServiceWorker());
    act(() => { fireBeforeInstallPrompt(); });
    expect(second.result.current.canInstall).toBe(false);
  });

  it('detects iOS, which never fires beforeinstallprompt', () => {
    setUserAgent(IOS_UA);
    const { result } = renderHook(() => useServiceWorker());
    expect(result.current.isIos).toBe(true);
  });

  it('does not flag iOS when already running standalone', () => {
    setUserAgent(IOS_UA);
    (window as any).matchMedia = jest.fn().mockReturnValue({ matches: true });
    const { result } = renderHook(() => useServiceWorker());
    expect(result.current.isIos).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx react-scripts test src/hooks/__tests__/useInstallPrompt.test.ts --watchAll=false`

Expected: FAIL — `result.current.canInstall` is undefined.

- [ ] **Step 3: Extend the hook**

In `frontend/src/hooks/useServiceWorker.ts`, add above the `useServiceWorker` declaration:

```ts
const DISMISS_KEY = 'pwa.installDismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const detectIos = (): boolean => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const isIosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // Already installed: nothing to prompt.
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
  return isIosDevice && !standalone;
};
```

Then inside the hook body, after the existing `updateAvailable` state:

```ts
  const [canInstall, setCanInstall] = useState(false);
  const [isIos] = useState(detectIos);
  const installEventRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onBeforeInstallPrompt = (e: Event) => {
      // Without this the browser shows its own mini-infobar and we lose the
      // ability to place the offer where it makes sense.
      e.preventDefault();
      installEventRef.current = e as BeforeInstallPromptEvent;
      if (localStorage.getItem(DISMISS_KEY) !== 'true') setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const promptInstall = useCallback(() => {
    const event = installEventRef.current;
    if (!event) return;
    event.prompt();
    setCanInstall(false);
  }, []);

  const dismissInstall = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, 'true'); } catch { /* private mode */ }
    setCanInstall(false);
  }, []);
```

And extend the return statement:

```ts
  return { updateAvailable, applyUpdate, canInstall, isIos, promptInstall, dismissInstall };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx react-scripts test src/hooks/__tests__/useInstallPrompt.test.ts --watchAll=false`

Expected: PASS, 6 tests.

- [ ] **Step 5: Surface it in the More sheet**

In `frontend/src/components/mobile/MoreSheet.tsx`, import the hook and render the offer above the link list. Add to the imports:

```tsx
import { useServiceWorker } from '../../hooks/useServiceWorker';
```

Inside the component, after the existing hooks:

```tsx
  const { canInstall, isIos, promptInstall, dismissInstall } = useServiceWorker();
```

And render just below the sheet's heading block, before `<div className="px-2 pb-4">`:

```tsx
        {(canInstall || isIos) && (
          <div className="mx-4 mb-2 rounded-lg bg-accent-50 border border-accent-200 p-3">
            <p className="text-sm font-semibold text-gray-900">{t('pwa.installTitle')}</p>
            <p className="mt-1 text-sm text-gray-600">
              {isIos ? t('pwa.iosInstallBody') : t('pwa.installBody')}
            </p>
            {!isIos && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={promptInstall}
                  className="min-h-[44px] px-3 rounded-md bg-primary-700 text-white text-sm font-medium"
                >
                  {t('pwa.install')}
                </button>
                <button
                  type="button"
                  onClick={dismissInstall}
                  className="min-h-[44px] px-3 text-sm text-gray-500"
                >
                  {t('pwa.installDismiss')}
                </button>
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 6: Verify the whole suite passes**

Run: `cd frontend && npx react-scripts test --watchAll=false`

Expected: PASS. `MoreSheet.test.tsx` mocks neither the hook nor `navigator.serviceWorker`; the hook no-ops outside production, so `canInstall` and `isIos` are both false and the existing assertions are unaffected.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useServiceWorker.ts \
        frontend/src/hooks/__tests__/useInstallPrompt.test.ts \
        frontend/src/components/mobile/MoreSheet.tsx
git commit -m "feat(pwa): offer installation from the More sheet

Captures beforeinstallprompt on Android so the offer appears where it
makes sense rather than as a browser infobar. iOS never fires that event,
so it gets the Share sheet instructions instead."
```

---

### Task 9: Mobile polish and manual verification

**Files:**
- Modify: `frontend/src/components/Dashboard.tsx` (card density)
- Create: `docs/superpowers/plans/2026-08-07-mobile-shell-pwa-verification.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a completed manual verification record.

- [ ] **Step 1: Audit tap targets**

Run: `cd frontend && grep -rn "py-1\b\|py-0.5\|h-6 w-6.*button" src/components/mobile/`

Every interactive element in `src/components/mobile/` must carry `min-h-[44px]`. Fix any that do not.

- [ ] **Step 2: Check the bottom bar never covers content**

Run: `cd frontend && npm start`, then in the browser's device toolbar at iPhone 14 Pro size, visit `/`, `/dashboard`, `/calendar`, `/donate`, and `/church-bylaw`. Scroll each to the very bottom.

Expected: the last element of every page is fully readable above the bar. If any page sets its own bottom padding that overrides the `pb-bottom-nav` on the `App` wrapper, add `pb-bottom-nav md:pb-0` to that page's own container.

- [ ] **Step 3: Tighten dashboard card density**

In `frontend/src/components/Dashboard.tsx` line 254, the card grid is desktop-derived — a flat `gap-6` at every width:

```tsx
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
```

Change it to lead with a tighter mobile value:

```tsx
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
```

Verify visually at 390px width that more of the card list is reachable without scrolling, and that nothing above `md:` changed.

- [ ] **Step 4: Run the production build and audit**

```bash
cd frontend && npm run build:ci && npx serve -s build -l 3000
```

In Chrome DevTools → Lighthouse, run an audit with the Progressive Web App category on `http://localhost:3000`.

Expected: the installability criteria pass. Record the score.

- [ ] **Step 5: Verify no member PII is cached**

With the production build served, sign in as a test member, visit `/dashboard` and `/dues`, then open DevTools → Application → Cache Storage.

Expected: the only API entry anywhere is `/api/announcements/active`. **If any other `/api/` entry appears, stop and fix `cachePolicy.ts` before continuing** — this is the constraint the whole caching design exists to satisfy.

- [ ] **Step 6: Verify the offline cold launch**

With the production build served and the page loaded once, tick DevTools → Network → Offline, then hard-reload.

Expected: the app shell renders, the calendar works, and cached announcements appear. Signed-in pages show their normal error state, not a crash.

- [ ] **Step 7: Verify the update flow**

Load the served build, then rebuild with a visible change (`npm run build:ci`), and reload the served copy once.

Expected: the update toast appears rather than the new build taking over silently. Tapping Refresh loads the new version.

- [ ] **Step 8: Verify on real devices**

On a real iPhone: Safari → Share → Add to Home Screen. Launch from the home screen and confirm the bottom bar sits clear of the home indicator.

On a real Android phone: confirm the install prompt appears and the app launches standalone with the correct icon (not the React logo, not a blurry upscale).

- [ ] **Step 9: Record the results**

Create `docs/superpowers/plans/2026-08-07-mobile-shell-pwa-verification.md` with the Lighthouse score, the Cache Storage contents, and a pass/fail line for each of steps 5 through 8, including device models tested.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/Dashboard.tsx \
        docs/superpowers/plans/2026-08-07-mobile-shell-pwa-verification.md
git commit -m "feat(mobile): polish tap targets and record PWA verification

Manual verification of the offline launch, the update flow, and the
absence of member PII in CacheStorage, on real hardware."
```

---

## Deployment note

Deploying is push-to-`main` via GitHub Actions. **Do not push without asking Dawit.** He tests locally before any production deploy.

One deploy-specific risk worth naming: the first deploy that carries a service worker changes caching behavior for every returning visitor permanently. If the worker ever needs to be withdrawn, an empty `service-worker.js` that calls `self.registration.unregister()` must be deployed — simply deleting the file leaves the old worker installed on every device that has it.
