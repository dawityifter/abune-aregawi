# Dependent interestedInServing — Backend Support (2025-08-22)

## Summary
- Added full backend support for dependents' `interestedInServing`.
- Persisted via new DB column `dependents.interested_in_serving` (default `no`).
- Included in profile GET by Firebase UID responses for dependent logins.
- Accepted and persisted in profile PUT by Firebase UID for dependents, with normalization to lowercase and allowed values: `yes`, `no`, `maybe`.

## Files Changed
- `backend/src/controllers/memberController.js`
  - `getProfileByFirebaseUid()`: now returns `member.interestedInServing` for dependents.
  - `updateProfileByFirebaseUid()`: accepts, validates, persists `interestedInServing` for dependents and returns it.
- `backend/migrations/20250823000000-add-interested-in-serving-to-dependents.js` (new): adds `interested_in_serving` to `dependents` with default `no`.
- `backend/src/models/Dependent.js`: model includes `interestedInServing` with default `no`.
- `backend/config/config.js`: make SSL optional via `DB_SSL=true|false` to support local DBs without SSL.

## Migration
- Applied with `npx sequelize-cli db:migrate`.
- Confirmed applied successfully after setting the correct `DATABASE_URL`.

## API Behavior
- GET `/api/members/profile/firebase/:uid?email=<email>&phone=<phone>`
  - For dependent resolution, response includes `data.member.interestedInServing`.
- PUT `/api/members/profile/firebase/:uid?email=<email>|phone=<phone>`
  - Request body may include `interestedInServing` (one of `yes|no|maybe`).
  - Value is normalized to lowercase and stored in DB.

## Validation & Normalization
- `interestedInServing` lowercased and validated against [`yes`, `no`, `maybe`].
- Phone numbers normalized to E.164 throughout flows.
- Gender normalized to [`male`, `female`, `other`].

## Frontend Notes
- Ensure `getUserProfile(uid, email, phone)` always passes both `email` and `phone` to avoid 400.
- UI may now display and allow editing of the dependent’s `interestedInServing`.

## Testing Steps
1) Login as a dependent (or resolve via dependent email/phone).
2) GET profile and verify `member.interestedInServing` present.
3) PUT profile with `{ "interestedInServing": "yes" }` and verify persisted.
4) Repeat with `no` and `maybe`.
