# Production DB Migration Notes — 2025-08-22

## Summary
Applied two pending Sequelize migrations to the production database and made one migration idempotent to avoid failures when columns already exist.

## Migrations Applied
- 20250817090000-add-onboarding-and-relationship-role.js
  - Adds enum value `relationship` to `enum_members_role`
  - Adds onboarding fields to `members`:
    - `is_welcomed` (BOOLEAN, default false)
    - `welcomed_at` (DATE, nullable)
    - `welcomed_by` (BIGINT, nullable, FK → `members.id`)
  - Updated to be idempotent by checking column existence via `describeTable('members')` before `addColumn()`
- 20250820010000-add-linked-member-id-to-dependents.js
  - Adds nullable `linked_member_id` (BIGINT, FK → `members.id`) to `dependents`
  - Adds index `idx_dependents_linked_member_id`

## Why
- Enable Relationship Department workflows (onboarding status, welcomed-by tracking)
- Support linking a dependent record to a full member profile when that dependent later registers as a member

## Pre-Checks
- Confirmed `backend/.env` points to production `DATABASE_URL`
- Took full DB backup (pg_dump/managed snapshot)
- Verified current state with `node check-migration-state.js` and `npx sequelize-cli db:migrate:status`

## Execution
- Installed `sequelize-cli` locally in `backend/`
- Ran `npx sequelize-cli db:migrate`
- First run failed due to existing columns; updated `20250817090000-...` migration to be idempotent
- Re-ran `db:migrate` successfully

## Post-Checks
- Verified applied migrations with `db:migrate:status` and `check-migration-state.js`
- Confirmed core tables present: `members`, `dependents`, `transactions`

## Rollback Plan
- Use pre-migration backup to restore database if necessary
- The enum addition is not trivially reversible; avoid removing enum values to prevent breaking rows

## Notes
- Ensure local development switches `backend/.env` back to the local DB to avoid accidental writes to production.
