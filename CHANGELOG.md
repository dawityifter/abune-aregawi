# Changelog

All notable changes to this repository will be documented in this file.

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

