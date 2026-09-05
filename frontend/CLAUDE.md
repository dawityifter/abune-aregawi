# frontend/CLAUDE.md

React 19 + TypeScript 4.9 app built on Create React App (react-scripts 5). Tailwind CSS
(+ forms/typography plugins), react-router v6, axios (dev proxy to `http://localhost:5001`),
Firebase Auth (client SDK), Stripe React elements for giving, TipTap rich text,
react-markdown. Deployed to Firebase Hosting — project `abune-aregawi-church-app`
(see `frontend/.firebaserc`), served at abune-aregawi-church-app.web.app. The API
lives on a different host, https://api.abunearegawi.church.

## Folder map (src/)

- `components/` — bulk of UI, grouped by domain: `sections/`, `board/`, `auth/`, `admin/`, `common/`, `finance/`, `mobile/`
- `pages/` — route-level pages
- `contexts/` — React contexts (incl. `LanguageContext.tsx`, auth)
- `hooks/`, `utils/` (incl. `geezTransliteration.ts`), `types/`, `config/`, `data/`
- `i18n/` — see below
- `firebase.ts` — Firebase client init
- `__tests__/`, `testUtils/`, `setupTests.ts`

## i18n (EN / Tigrigna)

Custom implementation, not i18next:

- `src/i18n/dictionaries.ts` — typed dictionaries for langs `'en' | 'ti'`
- `src/i18n/I18nProvider.tsx` — context providing `t(key)` (dot-path lookup, falls back
  to English), persists lang choice in localStorage key `app.lang`
- `src/contexts/LanguageContext.tsx` — wrapper/compat layer over I18nProvider; also
  contains a legacy inline `translations` object with flat dotted keys

When adding UI strings, add both `en` and `ti` entries.

## Mobile shell + PWA (shipped Aug 2026)

- `components/mobile/` — `BottomNav.tsx` (four tabs, `tabs.ts` holds the definitions),
  `MoreSheet.tsx` (secondary menu, focus-trapped), `UpdateToast.tsx` (offers Refresh when
  a new build is waiting). All below the `md` breakpoint only; desktop nav is untouched.
- `service-worker.js` — CRA 5 picks this entry up automatically and builds it with Workbox
  (no config file in the repo). Paired with `hooks/useServiceWorker.ts` (registration,
  update detection, chunk-error recovery).
- `sw/cachePolicy.ts` — `isCacheableApiRequestSafe`, a pure tested module deciding what may
  be cached. **Member PII must never enter CacheStorage** — change this with care and re-run
  its tests.
- Reverting a PWA release does not remove a service worker already on a member's device.
  `docs/PWA_ROLLBACK.md` has the kill-switch worker; read it before rolling back.

## Commands (run from frontend/)

```
npm start                # dev server (CRA)
npm run build            # prod build (prebuild generates OG images via scripts/generate-og.mjs)
npm run build:ci         # CI=false build (ignores warnings-as-errors)
npm test / test:watch / test:coverage / test:ci   # react-scripts (Jest + Testing Library)
```

## Testing

- Unit/component: react-scripts test (Jest, @testing-library/react), tests in
  `src/__tests__/` and colocated `*.test.tsx`.
- E2E: `e2e/` currently holds only Playwright artifacts (auth-state fixtures,
  playwright-report, test-results) — no playwright.config or spec files are checked in.
  Run `npx playwright test` only after confirming a config exists; don't assume a
  working e2e suite.

## Notes

- Lint: CRA's built-in `react-app` eslintConfig only; no Prettier config.
- `FIREBASE_SETUP.md` and `docs/` in this folder cover Firebase/hosting setup.
- Firebase auth emulator: `npm run emulators` from repo root.
