# Changelog

All notable changes to this repository will be documented in this file.

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

