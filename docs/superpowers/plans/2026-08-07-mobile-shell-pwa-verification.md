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

### 3. Update flow — waits for Refresh rather than silently taking over

This matters because members fill in payment forms on this site; a build that
swapped out from under someone mid-form would be actively harmful. Verified
end to end, in two separate `npm run build:ci` builds served from the same
`serve -s build -l 3100`, with a real Playwright tab kept open across both:

1. Built and served v1. Loaded `/`, waited for the service worker to install
   and take control: `swInfo.controlled: true`,
   `swInfo.activeState: "activated"`, `swInfo.scriptURL:
   "http://localhost:3100/service-worker.js"`.
2. Made a visible one-line change (a marker string appended to the footer's
   copyright text in `Footer.tsx`, reverted immediately after this test —
   `git diff -- frontend/src/components/sections/Footer.tsx` is empty) and
   ran `npm run build:ci` again into the same `build/` directory, changing
   the JS bundle hash and, downstream, the service worker's own content
   (confirmed the marker string landed in the new `main.*.js`:
   `grep -c "UPDATE-FLOW-TEST-V2" build/static/js/main.*.js` → `1`).
3. Reloaded the **already-open tab** once (`page.reload()`), same origin,
   same tab — not a fresh navigation. Immediately after that reload:

   ```
   footerTextRightAfterReload:
     "© 2026 ... All rights reserved."          <- OLD text, no marker
   swState: { activeState: "activated", waitingState: "installed", hasWaiting: true }
   bodySample: "... A new version is available.\nRefresh ..."
   ```

   **The page kept showing the old build and the new worker sat in
   `installed`/waiting — it did not take over on its own.** The toast ("A new
   version is available." + a "Refresh" button) was present in the DOM,
   confirmed both via `page.evaluate` text search and an accessibility
   snapshot showing `status: { generic: "A new version is available.",
   button: "Refresh" }`.

4. Clicked the "Refresh" button (`page.getByRole('button', { name: 'Refresh'
   }).click()`) and waited ~2.5s:

   ```
   footerTextAfterRefresh:
     "© 2026 ... All rights reserved. [UPDATE-FLOW-TEST-V2]"   <- NEW text
   swState: { activeState: "activated", hasWaiting: false,
              controllerScriptURL: "http://localhost:3100/service-worker.js" }
   ```

   The new version actually loaded — footer shows the marker, the new worker
   is `activated` and controlling, no worker left waiting.

**Result: PASS.** The update toast appears and waits for an explicit tap
rather than silently swapping the build under the member; tapping Refresh
reliably activates and loads the new version.

### 4. Dashboard card density at 390px

Brief step 3: `Dashboard.tsx`'s card grid (`src/components/Dashboard.tsx:254`)
changed from a flat `gap-6` to `gap-3 sm:gap-6`, so phones get a tighter
12px gap between cards instead of desktop's 24px, while `sm:` (≥640px) and
up — which covers `md:`/`lg:`'s column-count breakpoints — keeps the original
24px untouched.

Confirmed compiled correctly rather than just trusting the source edit:

```
$ grep -o "\.gap-3{[^}]*}" build/static/css/main.*.css
.gap-3{gap:.75rem}
$ grep -o "sm\\:gap-6[^}]*}" build/static/css/main.*.css
sm\:gap-6{gap:1.5rem}
```

`.75rem` = 12px below the `sm` breakpoint, `1.5rem` = 24px (the original
value) at and above it — so tablet/desktop are unaffected and only phones get
the tighter grid, matching the brief's intent.

**Not independently re-verified with a live signed-in screenshot**: `/dashboard`
requires Firebase phone-OTP with no bypass in this environment (see item 6
below), so the actual card list at 390px was confirmed via the compiled CSS
rule, not a rendered screenshot of the real dashboard. This is a narrower
verification than the other items in this document — flagging it rather than
presenting it as equivalent.

### 5. Bottom bar never covers content at 390px width

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

### 6. `/profile` and `/dashboard` are unreachable

**Confirmed, not skipped.** Both routes redirect to `/login` (phone-number SMS
form). There is no Firebase phone-OTP test bypass in this environment, so a
signed-in pass on `/profile`/`/dashboard` could not be exercised here — see the
human section below.

### 7. Lighthouse PWA/installability audit

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
