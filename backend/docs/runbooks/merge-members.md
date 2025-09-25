# Member Merge Runbook

This document provides step-by-step instructions for safely merging duplicate member records in the system.

## 5-Minute Merge Checklist

1. Confirm duplicates and designate Target vs Source
   - Prefer target with correct E.164 phone, current Firebase UID, and most complete data
2. Take a DB backup and plan to run the merge inside a single transaction
3. Update foreign keys from Source ➜ Target
   - Tables: `dependents`, `pledges`, `payments` (or `donations`), `attendance`, others as applicable
4. Merge data into Target
   - Fill only missing fields on Target; normalize phone to E.164
5. Authentication alignment
   - Keep Target’s Firebase UID if possible; ensure Target phone matches Firebase
6. Deactivate Source
   - Set `is_active = FALSE`, `merged_into = <target_id>`, `merged_at = NOW()`
7. Verify and document

> See also: [Member Phone Number Update Runbook](./update-member-phone-number.md)

## Overview

When duplicate member records are identified, they should be merged to maintain data integrity. This runbook outlines the process for merging a source member into a target member record.

## Pre-requisites

- Admin access to the database
- Access to Firebase Console for authentication records (if needed)
- Backup of the database before making changes (highly recommended)
- List of members to be merged with clear identification of source and target records

## Merge Process

### 1. Identify Duplicate Members

```sql
-- Example query to find potential duplicates
SELECT 
    m1.id as member1_id, 
    m1.first_name as member1_first_name,
    m1.middle_name as member1_middle_name,
    m1.last_name as member1_last_name,
    m1.email as member1_email,
    m1.phone as member1_phone,
    m2.id as member2_id,
    m2.first_name as member2_first_name,
    m2.middle_name as member2_middle_name,
    m2.last_name as member2_last_name,
    m2.email as member2_email,
    m2.phone as member2_phone
FROM 
    members m1
JOIN 
    members m2 ON 
    (
      (m1.email IS NOT NULL AND m2.email IS NOT NULL AND LOWER(m1.email) = LOWER(m2.email))
      OR (m1.phone IS NOT NULL AND m2.phone IS NOT NULL AND m1.phone = m2.phone)
    )
    AND m1.id < m2.id  -- Prevents duplicate pairs
;
```

### 2. Determine Source and Target Records

- Target Record: The record that will be kept and updated with information from the source record
- Source Record: The record that will be merged into the target and then deactivated

Suggested criteria for choosing the target:
- Has the correct/verified phone (E.164) and latest activity
- Has the Firebase UID that is currently used for login
- Has the most complete profile data

### 3. Merge Process

#### 3.1. Update Foreign Keys

Update all foreign key references from the source member to the target member:

```sql
-- Example: Update dependents
UPDATE dependents 
SET member_id = :target_member_id 
WHERE member_id = :source_member_id;

-- Example: Update pledges
UPDATE pledges 
SET member_id = :target_member_id 
WHERE member_id = :source_member_id;

-- Example: Update donations/payments (if applicable)
UPDATE payments 
SET member_id = :target_member_id 
WHERE member_id = :source_member_id;

-- Example: Update attendance (if applicable)
UPDATE attendance 
SET member_id = :target_member_id 
WHERE member_id = :source_member_id;

-- Repeat for any other tables with member_id foreign keys
```

Wrap the entire merge in a single DB transaction to ensure atomicity.

#### 3.2. Merge Member Data

Update the target record with any non-null data from the source record that is null in the target. Prefer the target’s known-good values if both are present.

```sql
UPDATE members target
SET 
    first_name = COALESCE(target.first_name, source.first_name),
    middle_name = COALESCE(target.middle_name, source.middle_name),
    last_name  = COALESCE(target.last_name,  source.last_name),
    email      = COALESCE(target.email,      source.email),
    phone      = COALESCE(target.phone,      source.phone),
    updated_at = NOW()
FROM (SELECT * FROM members WHERE id = :source_member_id) source
WHERE target.id = :target_member_id;
```

Note: Phones should be stored in E.164 format (e.g., +14695551234). Normalize before updating.

#### 3.3. Handle Authentication (if applicable)

If the source member has a Firebase UID that needs to be merged:

1. Prefer keeping the target record’s Firebase UID.
2. If you must move the UID, update the `members.firebase_uid` for the target and ensure frontend auth uses the correct UID post-merge.
3. Ensure the phone on the target record matches the Firebase auth phone for phone-only login.

#### 3.4. Deactivate Source Record

```sql
UPDATE members 
SET 
    is_active = FALSE,
    merged_into = :target_member_id,
    merged_at = NOW(),
    updated_at = NOW()
WHERE id = :source_member_id;
```

### 4. Verification

After merging:

1. Verify the target member record has all the correct information
2. Confirm all related records (dependents, pledges, donations/payments, attendance, etc.) are now associated with the target member
3. Verify the source member record is marked as inactive and references `merged_into`
4. Test sign-in for the target member (phone-based)
5. From the frontend, fetch profile via `GET /api/members/profile/firebase/:uid` and verify correct response structure in `data.member`

### 5. Cleanup (Optional)

After verifying the merge was successful, you may choose to:

1. Archive the source member record (if not already done in step 3.4)
2. Update any audit logs or history tables

## Rollback Procedure

If something goes wrong:

1. Restore from the backup taken before starting the merge
2. If using transactions, rollback any uncommitted changes
3. Verify all data is in its original state

## Best Practices

- Always take a backup before performing merges
- Perform merges during low-traffic periods
- Prefer phone for identity coherence (project policy is phone-only login)
- Document each merge (who, when, why, target/source IDs, fields reconciled)
- Consider implementing a merge history table to track all merges

## Common Issues & Troubleshooting

- Unique constraint conflicts on email/phone
  - Symptom: UPDATE fails with duplicate key violation on `email` or `phone`.
  - Resolution: Normalize phones to E.164 and ensure only one final phone/email remains on the target. If both records have the same phone/email, keep it on the target and set the source to NULL before deactivation.

- Firebase UID conflicts or wrong UID kept
  - Symptom: User cannot sign in after merge, or profile fetch returns 404.
  - Resolution: Ensure the target member’s `firebase_uid` matches the account the user actually uses. Update the target’s UID if necessary and verify `GET /api/members/profile/firebase/:uid` returns the merged member. Remember the app is phone-login only; phone in Firebase must match `members.phone`.

- Dependent records not re-linked
  - Symptom: A dependent still shows under the old (source) member or goes missing.
  - Resolution: Re-run FK updates for `dependents.member_id`. If your backend supports dependent login resolution, verify `linkedMemberId` now points to the target member.

- Orphaned pledges/donations/attendance
  - Symptom: History totals appear lower after merge.
  - Resolution: Confirm FK updates for `pledges`, `payments/donations`, and `attendance`. Recalculate summaries if your app caches aggregates.

- AuthContext/profile retrieval issues (400/404)
  - Symptom: Frontend errors when loading dashboard after merge.
  - Resolution: The frontend `getUserProfile(uid, email, phone)` must include email or phone. Ensure the member’s phone is normalized and matches Firebase. Clear local cache/state and re-fetch. The profile data structure should be read from `userProfile.data.member`.

- Admin role not showing after merge
  - Symptom: Admin UI disappears even though role is admin in DB.
  - Resolution: Ensure the frontend reads role from `userProfile.data.member.role`. Refresh the profile and verify role propagation after the merge.

- Transactionality and partial merges
  - Symptom: Some tables reflect the target while others still reference the source.
  - Resolution: Wrap all steps in a single DB transaction. If already partial, re-run the missing FK updates and verification.

- Phone normalization mismatches
  - Symptom: Login fails even though the user exists.
  - Resolution: Normalize `members.phone` to E.164. Ensure Firebase auth phone matches exactly. For test numbers, ensure they follow the exact predefined test formats.

- Soft delete vs hard delete
  - Symptom: Duplicate still appears in some admin lists.
  - Resolution: Ensure `is_active = FALSE` and `merged_into` set on source. Update queries to filter inactive records as needed.

- Dependent backfill/history
  - Note: A prior backfill normalized `dependents.phone` to E.164. When merging, confirm any dependent phone lookups or login resolution logic still function with the new target.

- API behavior with dependents
  - Note: The `GET /api/members/profile/firebase/:uid` endpoint can resolve dependents via email/phone and return a `role = 'dependent'` with a `linkedMember` summary. After merge, verify this behavior still works for dependents related to the target member. If a dependent was linked to the source, update to the target.

## Automation

For frequent merges, consider creating a stored procedure or API endpoint that handles the merge process transactionally. Include:
- Transaction boundaries
- FK updates across all related tables
- Merge history/audit entry
- Optional automatic deactivation of the source

## Related Documents

- Database Schema Documentation (link TBD)
- Member Management API Documentation (link TBD)
- Data Retention Policy (link TBD)
