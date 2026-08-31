# Zelle Ingestion Guide

This document explains how Zelle payments are ingested from Gmail, matched to members, and
posted to the ledger via bank reconciliation.

- Audience: Treasurer/Admin
- Source: Gmail account receiving Chase/Zelle notifications, plus the Chase CSV uploaded to
  Bank Reconciliation
- Destination: `transactions` table (canonical ledger) — created only by bank reconciliation

## Overview

- **Match-only mode**: while `ZELLE_GMAIL_CREATE_ENABLED` is `false` (the default — see
  `backend/env.example`), the Gmail path never creates a Transaction. It only records every
  parsed email in `zelle_email_queue` and computes a suggested member match.
- **Bank reconciliation is the only path that posts money.** A Transaction (and its
  LedgerEntry) is created when a treasurer approves a matching row after the Chase CSV is
  uploaded — see "Bank reconciliation and Zelle credits" below.
- Preview: Safe, read-only list of parsed candidates (no DB writes).
- Sync: Upserts every parsed email into `zelle_email_queue` with a suggested member; creates
  no Transactions while the flag above is false.
- Match: Treasurer assigns/confirms the member for a queued email; this writes a learned
  payer→member key but still creates no Transaction.
- Idempotency: Enforced by `transactions.external_id` uniqueness, and by
  `zelle_email_queue.external_id` for queue rows.

## Security & Access

All Zelle API routes are protected by Firebase Auth and role checks (allowed roles: `treasurer`, `admin`).

Mounted under `/api/zelle` in the backend.

Example (pseudo):
```
router.use(firebaseAuthMiddleware);
router.use(roleMiddleware(['treasurer', 'admin']));

// Preview (read-only)
GET /api/zelle/preview/gmail?limit=10

// Manual sync (insert-only, queue rows only)
GET /api/zelle/sync/gmail?dryRun=true

// Review queue
GET /api/zelle/queue

// Assign a member to a queued payer (creates no Transaction)
POST /api/zelle/queue/:id/match

// Disabled by default — 403 while ZELLE_GMAIL_CREATE_ENABLED is false
POST /api/zelle/reconcile/create-transaction
```

## Gmail Parsing & Ingestion

Service: `backend/src/services/gmailZelleIngest.js`

- Parses Zelle notification messages and extracts amount, date, sender email, memo phone,
  payer name, Zelle transaction reference, and Gmail `messageId`.
- `external_id` prefers the payment-level Zelle reference (`zelle:<reference>`) and falls
  back to `gmail:<messageId>`, to guarantee idempotency across multiple emails about the
  same payment.
- Preview: Returns parsed items and whether a Transaction already exists for that payment,
  but makes no changes.
- Sync (`syncZelleFromGmail`): records every parsed email as a row in `zelle_email_queue`
  with a suggested member match (`matched_member_id`, `match_confidence`, `match_source`).
  It creates a Transaction only when `ZELLE_GMAIL_CREATE_ENABLED=true` **and** the match is
  high-confidence — this is off by default, so in normal operation sync creates nothing.
  Every other row is queued as `NEEDS_REVIEW`.
- Queue statuses: `NEEDS_REVIEW`, `MATCHED` (a treasurer associated a payer with a member —
  no Transaction exists yet), `AUTO_CREATED` / `CREATED` (a Transaction exists), `IGNORED`,
  `ERROR`.

## Reconciliation Workflow

1) Open Treasurer Dashboard → Zelle Review tab.
2) For each queued email, confirm or correct the suggested member. If the email's payer name
   could not be parsed, type the payer name exactly as it appears on the bank statement — the
   match cannot be used for bank reconciliation without one.
3) Submit the match (`POST /api/zelle/queue/:id/match`). This marks the row `MATCHED` and
   writes a learned payer→member key (`bank_memo_matches`, plus the legacy memo table). **No
   Transaction is created by this step.**
4) When the Chase bank CSV is uploaded to Bank Reconciliation, the matched payer's row
   surfaces as a PENDING credit with the member suggested. The treasurer reviews and approves
   it there — that approval is what creates the Transaction and LedgerEntry.

## Bank reconciliation and Zelle credits

Zelle credits always stay `PENDING` in Bank Reconciliation for treasurer approval — they are
never auto-created by the automatic reconciliation pass, regardless of match confidence. Two
exceptions to be aware of:

- **Tier 0 (exact reference match)** still runs automatically: if the bank CSV row's
  reference exactly matches an existing Transaction's `zelle:<reference>` external ID, the
  row is linked (not created) automatically. This exists to absorb the pre-existing backlog
  of Transactions the Gmail automation created before match-only mode, and to link legacy
  auto-created Zelle payments going forward if `ZELLE_GMAIL_CREATE_ENABLED` is ever turned
  back on. It never creates a new Transaction, only links to one that already exists.
- Everything else Zelle-shaped (heuristic name/amount linking, learned-payer creation) is
  skipped for Zelle credits and left `PENDING` with suggestions for the treasurer.

ACH and check credits, and expense debits, are unaffected by match-only mode — the automatic
reconciliation pass (`backend/src/services/autoReconcileService.js`) continues to
auto-link/auto-create/auto-expense those the same way it always has.

## Backfill Strategy

- After member data is fully populated, re-run ingestion over a larger window (e.g., by month) to capture older payments.
- Use preview for safety, then perform sync in batches to respect Gmail quotas.
- Replay is safe due to `external_id` uniqueness; existing rows are not modified.
- Optional: Import CSVs from the bank for older periods using synthetic external IDs (e.g., `chase:<file>:<row>`).

## Endpoints (Summary)

- `GET /api/zelle/preview/gmail?limit=10`
  - Auth: Firebase, roles `treasurer|admin`
  - Returns parsed candidates; no labels changed; no DB writes.

- `GET /api/zelle/sync/gmail?dryRun=true`
  - Auth: Firebase, roles `treasurer|admin`
  - Records every parsed email into `zelle_email_queue`. `dryRun=true` performs no writes.
    Creates a Transaction only if `ZELLE_GMAIL_CREATE_ENABLED=true` and the match is
    high-confidence; otherwise creates nothing.

- `GET /api/zelle/queue?status=NEEDS_REVIEW&search=<text>&page=1&limit=50`
  - Auth: Firebase, roles `treasurer|admin`
  - The treasurer's review list. `status` filters by queue status; `search` matches payer
    name, note, or subject (case-insensitive). Returns
    `{ success, count, items, pagination: { total, page, pages } }`.

- `POST /api/zelle/queue/:id/match`
  - Auth: Firebase, roles `treasurer|admin`
  - Body: `{ member_id, payer_name? }`
  - Associates the payer with a member and writes a learned payer→member key. Creates **no**
    Transaction.
  - 400 `PAYER_NAME_REQUIRED`: neither `payer_name` nor a previously-parsed payer name exists
    on the row — bank reconciliation would have nothing to match against.
  - 400: `member_id` missing, or `MEMBER_NOT_FOUND` if it doesn't resolve to a member.
  - 404: unknown queue row.
  - 409 `ALREADY_POSTED`: this queue row already has a Transaction; its member association is
    settled by that Transaction, not by matching.

- `POST /api/zelle/queue/:id/ignore`
  - Auth: Firebase, roles `treasurer|admin`
  - Marks the row `IGNORED`. 400 if the row already has a Transaction.

- `POST /api/zelle/reconcile/create-transaction`
- `POST /api/zelle/reconcile/batch-create`
  - Auth: Firebase, roles `treasurer|admin`
  - **Return 403 `CREATE_DISABLED` while `ZELLE_GMAIL_CREATE_ENABLED` is false (the
    default).** When the flag is enabled, these behave as insert-only creation endpoints
    (409 if `external_id` already exists). Use the match workflow above instead; these
    endpoints exist for the flag being re-enabled, not for day-to-day treasurer use.

## Known limitations

`extractPayerName` (in `backend/src/services/zelleTransactionService.js`) matches against
`subject + "\n" + body` after whitespace collapsing, with a left-anchored pattern. When the
subject is letters and spaces only, the subject text is captured as part of the payer name —
e.g. a subject of `You received money with Zelle` yields the payer
`You received money with Zelle SYNTHETIC PAYER`. Production is currently protected only by
accident: the `®` in Chase's real subject falls outside the pattern's character class and
breaks the match. This matters more under match-only mode than it did before, because the
payer name is now the `ZELLE:PAYER:<name>` key that carries a treasurer's match across to
bank reconciliation — it is the Gmail path's only output. A template change dropping the
`®`, or reusing this ingest for another bank's notifications, would silently corrupt every
learned key. Fix by anchoring the pattern to the body rather than the concatenated text. Not
fixed here: out of scope for the match-only change.

## Troubleshooting

- Auth errors: Ensure you are signed in and your role is Treasurer or Admin.
- 403/401: Firebase token missing/expired or insufficient role.
- 403 `CREATE_DISABLED` on `reconcile/create-transaction` or `reconcile/batch-create`: expected
  while `ZELLE_GMAIL_CREATE_ENABLED` is false — use the match workflow instead.
- 409 `ALREADY_POSTED` on `/queue/:id/match`: the queue row already has a Transaction; nothing
  to do.
- A matched payer isn't linking during bank reconciliation: confirm the payer name typed
  during matching matches the bank statement's payer text exactly (see Known limitations
  above for one way this can silently break).
- Parsing issues: Check Gmail template changes and `gmailZelleIngest.js` parsing logic.
- Timezone/amount: Verify `payment_date` format and amount parsing for older templates.
