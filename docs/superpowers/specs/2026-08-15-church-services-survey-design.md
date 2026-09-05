# Church Services Assessment Survey — Design

Date: 2026-08-15
Status: Approved

## Goal

Put the parish's "Church Services & Congregational Spiritual Life Assessment Survey" —
currently two paper-style PDFs (English and Tigrigna) in `frontend/public/docs/` — online
as a mobile-friendly, bilingual, anonymous survey reachable from the homepage without
signing in. Capture responses in a new table so a report can be generated later, and ship
a first, basic version of that report now.

Source content: `frontend/public/docs/Church Services Assesment Survey_English.pdf` and
`..._Tigrigna.pdf` — 56 questions across 11 sections (About You & Spiritual Journey;
Divine Liturgy, Chanting & Spiritual Services; Language, Translation & Understanding;
Holy Sacraments & Pastoral Care; Youth, Children & Young Adult Ministry; Church
Environment, Facilities & Equipment; Communication, Fellowship & Community Support;
Service, Volunteering & Stewardship; Church Leadership, Administration & Financial
Accountability; New Church Building, Growth & Evangelical Mission; Overall Spiritual
Reflection & Prayerful Recommendations). Question types are single-select, multi-select,
and free-text. Both language versions carry the same 56 questions in the same order.

Explicitly **not** in scope: CSV export, question authoring UI (questions are hardcoded,
not admin-editable), CAPTCHA/honeypot (rate limiting is the only abuse control for this
pass), and support for multiple concurrent survey instances beyond the `survey_slug`
field that makes that possible later without a schema change.

## Why this, why now

The paper/PDF survey has no distribution or collection mechanism today beyond someone
printing it or emailing the PDF — there's no way to submit a filled-out copy back to the
church electronically, and no way to tabulate results without manual data entry. The
congregation is overwhelmingly phone-first (see `docs/superpowers/specs/2026-08-07-mobile-shell-and-pwa-design.md`),
so the online form must work as a phone-first flow, not a scanned-form facsimile.

Anonymity is a hard requirement from the source document itself: page 1 of both PDFs
states responses are "Anonymous & confidential. Do not write your name or phone" — the
online version must not collect or require identity, and must not require login.

## Architecture

| Unit | Location | Responsibility |
|---|---|---|
| `survey_responses` table | `backend/migrations/`, `backend/src/models/SurveyResponse.js` | Stores one row per completed submission. |
| Survey question config (backend) | `backend/src/config/surveyDefinitions/churchServicesAssessment2026.js` | Question ids, types, and valid option keys — used to validate incoming answers and to compute report tallies. |
| `surveyController.js` / `surveyRoutes.js` | `backend/src/controllers/`, `backend/src/routes/` | `POST /api/survey/responses` (public, rate-limited), `GET /api/survey/report` (admin/secretary/board). |
| Survey question config (frontend) | `frontend/src/components/survey/surveyDefinitions.ts` | Mirrors the backend config: ids, types, and option keys. Label *text* lives in i18n, not here. |
| `survey` i18n block | `frontend/src/i18n/dictionaries.ts` | All question/section/option/instruction text, `en` and `ti`, transcribed from the two PDFs. |
| Survey wizard | `frontend/src/components/survey/{SurveyPage,SurveyWizard,SurveyQuestion,SurveyThankYou}.tsx` | Public `/survey` route: multi-step form, one PDF section per step. |
| Homepage entry point | `frontend/src/components/QuickLinks.tsx` | New card linking to `/survey`. |
| Admin report page | `frontend/src/components/admin/SurveyReportPage.tsx`, route `/admin/survey-report` | Tallies + free-text lists, admin/secretary/board only. |

Data flow: wizard collects answers keyed by question id into local component state,
mirrored into `localStorage` after every change → on final Submit, POSTs the whole
`answers` object plus `locale` and `member_status` to the backend → backend validates
keys/shapes against the server-side question config, hashes the requester's IP, and
inserts one row → frontend shows `SurveyThankYou` and clears the `localStorage` draft.

## Data model

New table `survey_responses`:

| column | type | notes |
|---|---|---|
| `id` | UUID, PK | `uuidv4()` |
| `survey_slug` | STRING(100), not null | `'church-services-assessment-2026'` for this survey; lets a future survey reuse this table |
| `locale` | STRING(5), not null | `'en'` or `'ti'`, whichever was active at submit time |
| `member_status` | STRING(30), nullable | `first_time_guest` / `new_member` / `existing_member` — from the PDF's top-of-form banner, independent of Q3's more granular tenure question |
| `answers` | JSONB, not null | `{ "q1": "18-28", "q4": ["family_friend", "moved_area"], "q7": "free text..." }` — keyed by the question ids defined in the shared config |
| `ip_hash` | STRING(64), nullable | SHA-256 of requester IP + a server-side salt; used only for the rate limiter's audit trail, never displayed, never joined to anything identifying |
| `submitted_at` | DATE, not null | client-perceived submit time, defaults to `NOW()` |
| `created_at` | DATE, not null | row insert time |

No `member_id`, no name, no phone, no email column exists on this table — there is
nothing to link a response back to a person. Indexes: `(survey_slug)` and
`(survey_slug, submitted_at)` to support the report query.

This is a JSONB-per-response design rather than a fully normalized
question/answer schema: the question set is fixed (mirrored in code on both sides, not
admin-editable per the out-of-scope note above), and expected volume is one
congregation's worth of responses, not a dataset that needs relational joins to query
efficiently. The report endpoint tallies in JS after fetching rows for the slug, rather
than via JSONB SQL aggregation — simpler to write and to test, and fast enough at this
scale.

## Backend API

`backend/src/routes/surveyRoutes.js`, mounted at `/api/survey` in `server.js`:

- `POST /api/survey/responses` — **public, no auth middleware** (same convention as
  `donationRoutes.js`). express-validator checks: `survey_slug` matches a known slug,
  `locale` is `en`/`ti`, `answers` is a plain object whose keys are all valid question ids
  for that slug and whose values match the expected shape for that question's type
  (string for single-select/text, string array for multi-select), and the serialized
  `answers` payload is capped (e.g. 20KB) to block abuse. A dedicated
  `express-rate-limit` instance caps this route at 5 requests / 15 minutes per IP —
  layered on top of the existing global `/api/` limiter in `server.js`, not a replacement
  for it. Returns `{ success: true }` with no response body data (nothing worth echoing
  back to an anonymous caller).
- `GET /api/survey/report?survey_slug=...` — `protect, authorize('admin', 'secretary',
  'board')`, matching the exact convention already used in `volunteerRoutes.js`.
  Loads all rows for the slug, then in JS: total response count, and for each
  choice-type question a `{ optionKey: count }` map (percentages computed on the
  frontend from count/total); for each free-text question, the list of non-empty
  answers as-is. No pagination in this pass — response volume for a single-parish survey
  is not expected to be large enough to need it; revisit if it is.

`backend/src/config/surveyDefinitions/churchServicesAssessment2026.js` exports the
56-question structure: `[{ id: 'q1', section: 1, type: 'single'|'multi'|'text',
optionKeys: [...] }, ...]`. This is the validation source of truth server-side.

## Frontend

- New route `<Route path="/survey" element={<SurveyPage />} />` in `App.tsx`, outside
  any `ProtectedRoute` wrapper, alongside the other public routes (`/donate`, `/pledge`,
  `/church-bylaw`).
- `components/survey/surveyDefinitions.ts` mirrors the backend config (ids, types,
  option keys, grouped by section) — no label text here, just structure. Keeping this in
  a separate file from the components makes the 56-question structure reviewable on its
  own and keeps `SurveyWizard.tsx` free of a giant inline array.
- `components/survey/SurveyPage.tsx` — owns wizard state: current section index (0–10),
  `answers: Record<string, string | string[]>`. On mount, hydrates from
  `localStorage['survey.church-services-assessment-2026']` if present; on every answer
  change, writes back. Renders `SurveyWizard` until submitted, then `SurveyThankYou`.
- `components/survey/SurveyWizard.tsx` — renders the current section's questions via
  `SurveyQuestion`, a progress bar ("Section 3 of 11"), Back/Next buttons, and a Submit
  button in place of Next on the last section. Next/Submit are always enabled — per the
  PDF's own instructions ("skip any question that does not apply to you"), no question is
  mandatory.
- `components/survey/SurveyQuestion.tsx` — renders one question by `type`: `single`
  (radio group), `multi` (checkbox group), `text` (textarea). Labels and option text come
  from `t('survey.q{n}.label')` / `t('survey.q{n}.options.{key}')`.
- `components/survey/SurveyThankYou.tsx` — confirmation screen (mirrors the PDF's closing
  blessing text, bilingual), clears the `localStorage` draft key on mount.
- Mobile-friendliness: one section per screen (never more than ~6 questions visible at
  once), full-width touch targets and buttons below the `md` breakpoint, reusing the same
  Tailwind form input classes already used in `MemberRegistration`/`ParishPulseSignUp`
  for visual consistency.
- `QuickLinks.tsx` gets one new `Card` (icon + bilingual title/description) linking to
  `/survey`, positioned alongside the existing Donate/Pledge/Volunteer cards so it's
  visible without scrolling on the homepage.

## i18n content

A new `survey` block is added to both the `en` and `ti` objects in
`src/i18n/dictionaries.ts`, transcribed from the two PDFs: section titles and
instructions, all 56 question labels, and every checkbox option label — following the
same dot-path convention as the rest of the dictionary (`survey.section1.title`,
`survey.q1.label`, `survey.q1.options.under18`, etc.). This is the only place question
wording lives; `surveyDefinitions.ts` only carries ids/types/option keys, never display
text, so a wording fix is a dictionary edit, not a structural change.

## Admin report page

- Route `/admin/survey-report`, wrapped in `ProtectedRoute` restricted to
  admin/secretary/board, matching the access level already used for
  `volunteerRoutes.js`'s aggregate views.
- `SurveyReportPage.tsx` fetches `GET /api/survey/report`, shows total response count,
  then per-question breakdowns as simple labeled bars (count + percentage, plain
  divs/width%, no new charting dependency) for choice questions, and a scrollable list of
  submitted free-text answers for each open-ended question. No filtering, no export in
  this pass — the on-page view is the full first-pass deliverable, per the earlier scope
  decision.

## Abuse protection

IP-based rate limiting only, per the earlier decision (no honeypot, no client-side
duplicate flag): a dedicated `express-rate-limit` window (5 requests / 15 minutes per
IP) on `POST /api/survey/responses`, chosen loose enough that multiple family members on
the same church wifi can each submit without being blocked, while still stopping a
scripted flood.

## Testing

- Backend: `surveyController` tests for — valid submission accepted; unknown
  `survey_slug` rejected; answer keys/types validated against the config; oversized
  payload rejected; rate limiter triggers after the threshold; report aggregation
  produces correct counts/percentages from seeded rows.
- Frontend: wizard navigation (Back/Next moves between sections, Submit only appears on
  the last section), `localStorage` draft save-and-restore across a simulated reload,
  and the submit call firing with the accumulated `answers` object — following the
  existing patterns in `frontend/src/__tests__/`.

## Open questions for the implementation plan

None outstanding — all major decisions (wizard format, JSONB storage, report scope,
rate-limit-only abuse protection, hardcoded i18n questions, admin/secretary/board report
access) were confirmed before writing this spec.
