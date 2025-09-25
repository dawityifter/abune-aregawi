# Member Phone Number Update Runbook

This runbook guides admins and secretaries through safely updating a member's phone number. The project uses phone-only authentication, so take extra care to keep Firebase Authentication and the backend in sync.

## 5-Minute Phone Change Checklist

1. Verify identity and collect old/new numbers
2. Normalize the new phone to E.164 (e.g., +14695551234)
3. Check for duplicates; if conflict, resolve via `backend/docs/runbooks/merge-members.md`
4. If member still has old phone: have them sign in, update phone in-app, complete OTP on new phone
5. If member lost old phone: delete Firebase user, have them sign in with new phone, update `members.phone` and `members.firebase_uid`
6. Verify sign-in with new phone and profile fetch (`data.member`) works
7. Document the change (who/when/old/new/UID if changed)

> See also: [Member Merge Runbook](./merge-members.md)

## Overview

Members may need to change their phone number due to carrier changes or lost devices. Because phone is the login identifier, the update impacts authentication and profile retrieval.

Key systems impacted:
- Backend `members.phone` (stored in E.164)
- Firebase Authentication user’s phone number and UID mapping
- Frontend `AuthContext.getUserProfile(uid, email, phone)` which requires phone/email for lookups

## Pre-requisites

- Admin or Secretary access to the database
- Access to Firebase Console for the project
- Ability to contact and verify the member’s identity
- Database backup recommended prior to changes

## Policies and Notes

- Phone-only login: Email login is not supported.
- Phone numbers must be stored in E.164 format (e.g., `+14695551234`).
- Test numbers (e.g., `+1234567890`, `+15551234567`) have special handling and bypass reCAPTCHA in dev.
- Profile responses on the frontend are read from `userProfile.data.member`.
- The endpoint `GET /api/members/profile/firebase/:uid` supports dependent resolution by email/phone; ensure dependents still link correctly after changes.

## Preparation

1. Verify the member’s identity (full name, DOB or other on-file info, last 4 digits of old number).
2. Collect:
   - Old phone number (as stored)
   - New phone number (raw from member)
3. Normalize the new phone to E.164.
4. Check for conflicts:
   - Ensure no other active member uses the new phone.
   - If conflict exists, resolve via the Merge Members runbook before proceeding: `backend/docs/runbooks/merge-members.md`.

## Scenario A: Member can still sign in with old phone (Preferred)

This is the safest path as Firebase requires re-verifying the new phone.

Steps:
1. Ask the member to sign in to the app with their current (old) phone.
2. From Profile page, update the phone number field to the new number.
3. The app should trigger Firebase phone re-verification:
   - Member receives OTP on the new phone
   - Member enters OTP to complete verification
4. Backend saves the normalized E.164 new phone to `members.phone` and preserves `members.firebase_uid`.
5. Verify:
   - Member signs out and back in using the new phone number
   - Frontend fetches profile and shows correct data under `data.member`

## Scenario B: Member lost access to old phone

When the member cannot authenticate with the old number, an admin-assisted flow is needed.

Options (choose one):

- Option B1: Re-link by deleting Firebase user and re-registering
  1. Verify identity and confirm intent to change.
  2. In Firebase Console (Authentication > Users), locate the user by UID/phone and delete the account. Note the member’s `id` in the database.
  3. Have the member sign in with the new phone number in the app. This creates a new Firebase user with a new UID.
  4. In the backend database, update the existing member record to point to the new Firebase UID and phone:
     ```sql
     -- Normalize :new_phone to E.164 before this step
     UPDATE members
     SET phone = :new_phone, firebase_uid = :new_firebase_uid, updated_at = NOW()
     WHERE id = :member_id;
     ```
  5. Verify sign-in with the new phone works and profile returns under `data.member`.
  6. Check dependents/pledges/attendance still associate with this member (UID change should not affect FKs, but verify).

- Option B2: Temporarily create a pass-through update endpoint (engineering required)
  - If the product supports an admin-only endpoint to swap phones transactionally with Firebase Admin SDK, use it. This path is not available by default and must be implemented and audited.

Notes:
- Deleting the Firebase user does not affect backend records. The member keeps the same `id` and relationships; only `firebase_uid` and `phone` are updated.
- Ensure there are no other members with the new phone to avoid unique constraint conflicts.

## Database-Only Update (when Firebase is already updated by user)

If the member already re-verified in Firebase (Scenario A), but the backend phone was not updated due to a transient failure, run:
```sql
UPDATE members
SET phone = :new_phone, updated_at = NOW()
WHERE id = :member_id;
```
Ensure `:new_phone` is E.164 and matches the Firebase phone exactly.

## Post-Update Verification

- Member can sign in using the new phone.
- Frontend loads dashboard without 400/404 from profile fetch.
- `GET /api/members/profile/firebase/:uid` returns the correct member in `data.member`.
- Admin UI (if applicable) still shows correct role from `userProfile.data.member.role`.
- Dependents still linked; if dependent login resolution is used, verify it still works.

## Common Issues & Troubleshooting

- Duplicate phone conflict
  - Symptom: UPDATE fails on unique phone constraint.
  - Fix: Identify the conflicting member and merge records first (`merge-members.md`).

- Firebase phone not updated
  - Symptom: Member can’t sign in with new phone; old phone still tied to UID.
  - Fix: Use Scenario A flow to re-verify; or Option B1 to delete old Firebase user and re-register with new phone, then update `firebase_uid` and `phone` in DB.

- AuthContext/profile fetch errors (400/404)
  - Symptom: Frontend fails after change.
  - Fix: Ensure new phone equals Firebase phone (E.164). Frontend must call `getUserProfile(uid, email, phone)` passing phone. Refresh session and re-fetch.

- Test environment reCAPTCHA issues
  - Symptom: Phone verification failing locally.
  - Fix: Use `127.0.0.1` (not `localhost`). Test numbers `+1234567890` and `+15551234567` bypass reCAPTCHA with code `123456`.

- Dependent resolution regressions
  - Symptom: Dependent login/profile linking breaks.
  - Fix: Verify the member’s phone change didn’t orphan dependents. Re-link if necessary.

## Rollback

If the change must be undone:
1. Ensure you still have the old phone.
2. Update Firebase Authentication back to the old phone (member must re-verify).
3. Update backend:
   ```sql
   UPDATE members
   SET phone = :old_phone, updated_at = NOW()
   WHERE id = :member_id;
   ```
4. Verify sign-in and profile fetch.

## Audit and Documentation

- Record who requested, who approved, who executed, date/time, old/new phone, and the member `id`.
- If using Option B1, record the old and new Firebase UIDs.

## References

- Merge Members Runbook: `backend/docs/runbooks/merge-members.md`
- Profile Endpoint Behavior: `GET /api/members/profile/firebase/:uid`
- Frontend Auth Context: `frontend/src/contexts/AuthContext.tsx`
