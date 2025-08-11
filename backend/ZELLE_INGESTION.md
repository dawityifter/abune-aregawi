# Zelle Ingestion Guide

This document explains how Zelle payments are ingested from Gmail, reconciled, and secured in the system.

- Audience: Treasurer/Admin
- Source: Gmail account receiving Chase/Zelle notifications
- Destination: `transactions` table (canonical ledger)

## Overview

- Preview: Safe, read-only list of parsed candidates (no DB writes).
- Sync: Insert-only upsert that writes new Transactions when a member match is found.
- Reconciliation: Manually assign a member and create a Transaction for unmatched items.
- Idempotency: Enforced by `transactions.external_id` uniqueness.

## Security & Access

All Zelle API routes are protected by Firebase Auth and role checks (allowed roles: `treasurer`, `admin`).

Mounted under `/api/zelle` in the backend.

Example (pseudo):
```
router.use(firebaseAuthMiddleware);
router.use(roleMiddleware(['treasurer', 'admin']));

// Preview (read-only)
GET /api/zelle/preview/gmail?limit=10

// Manual sync (insert-only)
GET /api/zelle/sync/gmail?dryRun=true

// Reconcile (create Transaction)
POST /api/zelle/reconcile/create-transaction
```

## Gmail Parsing & Ingestion

Service: `backend/src/services/gmailZelleIngest.js`

- Parses Zelle notification messages and extracts amount, date, sender email, memo phone, and Gmail `messageId`.
- `external_id` uses a stable value, e.g. `gmail:<messageId>`, to guarantee idempotency.
- Preview: Returns parsed items and whether a Transaction would be created, but makes no changes.
- Sync: Creates Transactions only if a member match is found (by email or phone).
- Status: Zelle Transactions are created with `status = 'succeeded'` and `payment_method = 'zelle'`.

## Reconciliation Workflow

1) Open Treasurer Dashboard → Zelle Review tab.
2) Review preview candidates. For unmatched items, enter the correct Member ID.
3) Select Payment Type (membership_due, tithe, donation, event, other).
4) Click “Create” to post `POST /api/zelle/reconcile/create-transaction`. The list refreshes automatically.

Behavior:
- Insert-only: if the same `external_id` already exists, API returns 409 (no change).

## Backfill Strategy

- After member data is fully populated, re-run ingestion over a larger window (e.g., by month) to capture older payments.
- Use preview for safety, then perform sync in batches to respect Gmail quotas.
- Replay is safe due to `external_id` uniqueness; existing Transactions are not modified.
- Optional: Import CSVs from the bank for older periods using synthetic external IDs (e.g., `chase:<file>:<row>`).

## Endpoints (Summary)

- `GET /api/zelle/preview/gmail?limit=10`
  - Auth: Firebase, roles `treasurer|admin`
  - Returns parsed candidates; no labels changed; no DB writes.

- `GET /api/zelle/sync/gmail?dryRun=true`
  - Auth: Firebase, roles `treasurer|admin`
  - `dryRun=true` returns what would be inserted; `dryRun=false` performs insert-only upserts when member is matched.

- `POST /api/zelle/reconcile/create-transaction`
  - Auth: Firebase, roles `treasurer|admin`
  - Body: `{ external_id, member_id, amount, payment_type, note?, payment_date? }`
  - Creates a `transactions` row; 409 if `external_id` already exists.

## Troubleshooting

- Auth errors: Ensure you are signed in and your role is Treasurer or Admin.
- 403/401: Firebase token missing/expired or insufficient role.
- 409 on reconcile: Duplicate `external_id` already exists; no action needed.
- Parsing issues: Check Gmail template changes and `gmailZelleIngest.js` parsing logic.
- Timezone/amount: Verify `payment_date` format and amount parsing for older templates.
