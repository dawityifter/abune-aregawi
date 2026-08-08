# Mobile shell + PWA — Task 9 verification record

Branch: `feat/mobile-shell-pwa`. Verified against a `npm run build:ci` production
build served statically (`npx serve -s build -l 3100`), driven with Playwright,
plus the local dev backend on `:5001` for the announcements API.

## Automated verification (evidence below is from an actual run, not inferred)

### 1. CacheStorage contains no member PII — the critical check

After loading `/`, `/calendar`, `/donate`, `/dashboard` (redirected to `/login`,
see below) and `/profile` (also redirected), with the local backend reachable so
`/api/announcements/active` actually resolved:

```
caches.keys() => [
  "workbox-precache-v2-http://localhost:3100/",
  "parish-announcements"
]

workbox-precache-v2-...: [ index.html, main css, all js chunks, one static image ]
  — no /api/ entries.

parish-announcements: [
  "http://localhost:5001/api/announcements/active"
]
```

**Result: PASS.** The only `/api/` entry anywhere in CacheStorage, on any page
visited, is `/api/announcements/active`. No dashboard/dues/profile/member data
ever touched CacheStorage — confirmed by key, not by assumption.

Caveat: the local dev DB had zero announcement rows (`{"success":true,"data":[]}`),
so this proves the cache *key* is right, not that a populated announcement body
is scrubbed of anything sensitive — `cachePolicy.ts`'s allowlist is on the
request path, not the response body, so that's a design property, not something
this run could exercise further.

### 2. Cold offline reload

Loaded `/` once (letting the service worker precache), then set the browser
context offline (`page.context().setOffline(true)`) and hard-reloaded.

**Result: PASS.** The app shell, header nav, bottom nav, service times, the full
Ethiopian Orthodox calendar grid (August 2026, fast/feast data, "Today in the
Church" panel), and the announcements section all rendered from cache. Only
non-precached resources failed as expected (`net::ERR_INTERNET_DISCONNECTED` for
images, `manifest.json`, the YouTube live-status API, Chatbase's remote script)
— all handled gracefully (e.g. "Error checking live status: TypeError: Failed to
fetch" logged and swallowed, no crash, no error boundary triggered).

### 3. Bottom bar never covers content at 390px width

Scrolled each page to `document.body.scrollHeight` at a 390×844 viewport and
measured the gap between the last content element and the bottom nav's `top`:

| Page | Last visible element | Clearance above bar |
|---|---|---|
| `/` | "Follow Us:" + social icons | 113px |
| `/calendar` | Calendar attribution paragraph | 97.5px |
| `/donate` | Contact email link | 82.8px |
| `/church-bylaw` | "Garland, Texas" footer line | 24.5px |

**Result: PASS on all four.** `/church-bylaw` is the tightest but still fully
clear (screenshot confirms "Garland, Texas" fully readable above the bar, no
overlap).

### 4. `/profile` and `/dashboard` are unreachable

**Confirmed, not skipped.** Both routes redirect to `/login` (phone-number SMS
form). There is no Firebase phone-OTP test bypass in this environment, so a
signed-in pass on `/profile`/`/dashboard` could not be exercised here — see the
human section below.

### 5. Lighthouse PWA/installability audit

Ran `npx lighthouse http://localhost:3100/ --form-factor=mobile
--screenEmulation.mobile=true` at v13.4.1 (the version `npx` resolved).

**Lighthouse no longer has a PWA category to score.** Categories returned:
`performance` (0.59), `accessibility` (0.80), `best-practices` (0.73), `seo`
(1.0), `agentic-browsing` (0.33) — no `pwa` key exists, and passing
`--only-categories=pwa` errors with "unrecognized category". Grepping the full
audit list for `installable`/`manifest`/`service-worker`/`maskable` turns up
only two unrelated viewport audits — Lighthouse dropped the standalone PWA/
installability category around v10 and never brought it back. Reporting this
plainly rather than inventing a score.

In its place, the installability criteria were checked manually:
- `manifest.json` served correctly: `id`, `name`, `short_name`, `start_url: "/"`,
  `display: "standalone"`, `theme_color`, `background_color` all present.
- Icons declared: 192×192 `any`, 512×512 `any`, 512×512 `maskable`, all
  `image/png`, matching the regenerated files on disk (see task-9-report.md for
  the icon-compression numbers).
- Service worker registers and reaches `state: "activated"`
  (`navigator.serviceWorker.getRegistration()` confirmed in-browser).

These are the same facts Lighthouse's old PWA category checked; they pass.
Whether Chrome would actually surface an install prompt still depends on
engagement heuristics Lighthouse never fully modeled either way — see the human
section.

## Needs a human on real hardware

Not verifiable from this environment (no physical devices, no Firebase phone-OTP
bypass):

1. **Real iPhone install.** Safari → Share → Add to Home Screen, launch from the
   home screen, and confirm the bottom bar clears the home indicator (the safe-area
   inset classes are unit-tested but never rendered inside an actual standalone
   `display-mode` on iOS in this run).
2. **Real Android install.** Confirm the install prompt appears, and that the
   launcher icon reads correctly at launcher size (not blurry, not the CRA
   default) — the icon crop/compression was verified byte-for-byte lossless in
   this run, but not eyeballed at actual launcher size on a device.
3. **Signed-in `/profile` at phone width.** Everything above ran signed-out;
   nobody has exercised the profile page's mobile layout, tap targets, or
   session-aware caching behavior end-to-end on a phone.
4. **Chatbase bubble vs. the More tab — CONFIRMED overlapping in this run, needs
   a human decision.** This wasn't just a theoretical risk: measured directly at
   390×844 —

   ```
   #chatbase-bubble-button: top 773, left 319, right 374, bottom 828
   More tab (nav button):    top 789.5, left 292.5, right 390, bottom 844
   ```

   The bubble and the More tab overlap by ~38px vertically and ~55px
   horizontally — the bubble sits directly on top of the right edge of the More
   tab. On a real device this is very likely to intercept taps meant for More
   (or vice versa, block the chat bubble). This is a third-party widget injected
   by `ChatWidget.tsx`'s external script and is not stylable from this repo.
   The Chatbase dashboard exposes a bubble-offset/position setting — worth
   raising there rather than trying to fix from this codebase; screenshots taken
   during this run (`/church-bylaw` at 390px) show the same bubble sitting
   immediately above the More tab on every page.

## Commands used

```bash
cd frontend
npm run build:ci
npx serve -s build -l 3100 &
# backend already running locally on :5001 for the announcements fetch
```

Playwright drove `http://localhost:3100/` at a 390×844 viewport; offline mode
via `page.context().setOffline(true)`; CacheStorage inspected via
`page.evaluate(() => caches.keys() / cache.keys())`.
