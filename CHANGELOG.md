# Changelog

All notable changes to this repository will be documented in this file.

## 2025-09-06

### Database

- Added migration `backend/migrations/20250907000000-create-outreach.js` to create `outreach` table.
  - Columns: `id (uuid, default gen_random_uuid())`, `member_id (FK→members.id, CASCADE)`, `welcomed_by (string)`, `welcomed_date (timestamp, default NOW)`, `note (text, 1–2000)`, `created_at`, `updated_at`.
  - Ensures `pgcrypto` extension for `gen_random_uuid()`.

### Backend

- New model: `backend/src/models/Outreach.js` with association `Outreach.belongsTo(Member)`.
- Wired associations in `backend/src/models/index.js` and `backend/src/models/Member.js` (`Member.hasMany(Outreach, as: 'outreach_notes')`).
- New controller: `backend/src/controllers/outreachController.js` with endpoints to create and list outreach notes.
- Routes updated in `backend/src/routes/memberRoutes.js`:
  - `POST /api/members/:id/outreach` (auth + role: `admin`, `relationship`).
  - `GET /api/members/:id/outreach` (auth + role: `admin`, `relationship`).
  - Allowed `relationship` role to read `GET /api/members/:id` to support outreach review in modal.
- Validation: added `validateOutreachCreate` in `backend/src/middleware/validation.js`.

### Frontend

- Added `frontend/src/components/admin/ModalWelcomeNote.tsx`:
  - Textarea with 2000-char limit and counter; improved pastoral placeholder guidance.
  - Shows Member Summary (Name, Phone, Email, Address, Yearly Pledge, Registration Status, Household Size).
  - Accepts `memberId`, `memberName`, `memberPhone`, `onClose` props and fetches profile on open.
- Updated `frontend/src/components/admin/OutreachDashboard.tsx`:
  - “Mark Welcomed” now opens the modal and, upon Save, calls:
    1) `POST /api/members/:id/outreach` with note,
    2) then `POST /api/members/:id/mark-welcomed`.
  - Removes member from Pending on success.
  - Added request timeout wrapper to avoid indefinite hangs; timeout errors are suppressed in UI to allow quick retry.
- Phone display uses `formatE164ToDisplay`.

### Tests

- Added `backend/tests/integration/outreach.test.js` covering successful note creation + mark-welcomed, and note validation.
- Adjusted test middlewares to mirror onboarding tests; all integration suites pass locally.

### Notes

- Frontend uses `REACT_APP_API_URL` to target backend (e.g., `http://localhost:5001`).
- Modal gracefully continues if profile summary fetch fails.
- Timeout handling for outreach-related requests is user-friendly: no disruptive error surfaced; user can retry immediately.

## 2025-08-31

### Database

- Added migration `backend/migrations/20250831152500-drop-name-day-from-dependents.js` to drop `name_day` from `dependents`.
  - Up: drop column if exists.
  - Down: restore nullable `STRING(100)` column.

### Backend

- Removed `nameDay` from Sequelize model `backend/src/models/Dependent.js`.
- Removed `nameDay` handling from validators `backend/src/middleware/validation.js` and controller mappings in `backend/src/controllers/memberController.js`.
- `GET /api/members/profile/firebase/:uid` continues to support dependent resolution and returns `DEPENDENT_NOT_LINKED` (404) for unlinked dependents.

### Frontend

- Removed `nameDay` from types and transformers:
  - `frontend/src/utils/relationshipTypes.ts`
  - `frontend/src/utils/dataTransformers.ts`
- Removed `Name Day` UI and state from:
  - `frontend/src/components/DependentsManagement.tsx`
  - `frontend/src/components/Profile.tsx`
- Registration/auth flows remain phone-first with E.164 normalization as documented in `formatPhoneNumber` usage and `AuthContext` profile checks.

### Notes

- Frontend profile lookups use `REACT_APP_API_URL` and include normalized `phone` (and `email` when present) to avoid 400s.
- Dependent login flow: if dependent exists and is linked, a profile with `role='dependent'` is returned; if unlinked, frontend receives `DEPENDENT_NOT_LINKED` and shows tailored messaging.

## 2025-08-23

### Frontend

- Auth: Improve resilience of backend profile fetch in `frontend/src/contexts/AuthContext.tsx`.
  - Increase attempts from 1 to 2 with short exponential backoff (500ms → 1s).
  - Treat `TypeError` from `fetch` as transient network error to allow retry.
  - Ensure timeout cleanup in a `finally` block to avoid dangling timers even if an exception occurs.
  - Goal: reduce intermittent `TIMEOUT` errors when visiting `/admin` and `/dashboard`, especially during backend cold starts.
  - Notes: Timeout is configurable via `REACT_APP_PROFILE_FETCH_TIMEOUT_MS`.

- Admin: Member Roles UI enhancements in `frontend/src/components/admin/RoleManagement.tsx`.
  - Added search input and role filter (by member name and current role).
  - Implemented sorting by Member Name and Current Role with clickable headers.
  - Added pagination controls and consistent filtering/sorting pipeline.

### Routing/Guards

- `frontend/src/components/auth/ProtectedRoute.tsx`: No functional change, but confirmed it renders a friendly error fallback when `authReady && !loading && error` (covers backend wake-up/timeout case).

