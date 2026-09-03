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
- **Turning `ZELLE_GMAIL_CREATE_ENABLED` on has a cost**: it restores the pre-match-only
  behavior where the Gmail sync creates transactions directly, which reopens the
  cross-path duplicate this queue exists to prevent. If a treasurer approves the bank CSV
  row for a payment before the Gmail sync next runs for that same payment, the sync's
  idempotency check only looks up `zelle:<reference>` and `gmail:<messageId>` — it cannot
  see the bank-created transaction (keyed by its own hash) — and on a high-confidence payer
  match it creates a second transaction for the same payment. Only enable the flag
  temporarily and with this tradeoff in mind (e.g. a backlog catch-up window), and prefer
  reconciling any pending bank rows for the affected period first.
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
- A `MATCHED` row stays `MATCHED` indefinitely, even after the payment is later posted
  through bank reconciliation: nothing writes back to `zelle_email_queue` from the bank
  reconciliation or auto-reconcile services, so `transaction_id` stays `null` and the status
  never becomes `CREATED`. The Zelle Review screen does not reflect whether a matched
  payment was subsequently approved elsewhere.

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
  Backlog transactions whose `external_id` fell back to `gmail:<messageId>` (no Zelle
  reference was ever extracted from the email) are invisible to this exact-reference
  lookup, and Tier 1 no longer acts on Zelle credits — so those specific rows will not
  auto-drain. A treasurer needs to link them manually from the `potential_matches` panel
  on the PENDING bank row.
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
  - Auth: Firebase, roles `treasurer|admin`
  - **Returns 403 `CREATE_DISABLED` while `ZELLE_GMAIL_CREATE_ENABLED` is false (the
    default).** When the flag is enabled, this is an insert-only creation endpoint: it
    returns HTTP **409** (with `code: 'EXISTS'`) if `external_id` already exists. Use the
    match workflow above instead; this endpoint exists for the flag being re-enabled, not
    for day-to-day treasurer use.

- `POST /api/zelle/reconcile/batch-create`
  - Auth: Firebase, roles `treasurer|admin`
  - **Returns 403 `CREATE_DISABLED` while `ZELLE_GMAIL_CREATE_ENABLED` is false (the
    default).** When the flag is enabled, this **always returns HTTP 200** with
    `{ success: true, results: [...] }` — unlike the single-item endpoint, a duplicate
    `external_id` does **not** produce a top-level 409. Each item's outcome is embedded in
    the `results` array instead: a duplicate comes back as `{ success: false, code: 'EXISTS',
    external_id }` alongside otherwise-successful entries in the same response. Callers that
    check only the HTTP status will treat duplicate-skipped items as successes — read each
    item's `success`/`code`.

## Payer name parsing

The payer name is the Gmail path's only output — it becomes the `ZELLE:PAYER:<name>` key
that carries a treasurer's match across to bank reconciliation — so `extractPayerName` (in
`backend/src/services/zelleTransactionService.js`) is worth understanding before changing.

Chase's current notification puts the payer on its own line and the amount further down in a
details table, so the two are **not** adjacent:

```
Zelle® payment
JANE DOE sent you money

Here are the details:

Amount              $50.00
Transaction number  30598898951
```

Two properties of the matcher follow from that shape, and both are load-bearing:

- It looks for `sent you money` as well as `sent you $`. An earlier version required the
  amount immediately after `sent you`, which matched none of the real notifications — every
  queued email parsed an amount and a transaction number but no payer name, leaving the
  treasurer to type one for every row.
- It preserves newlines and anchors to a line start. Without the anchor the match runs
  leftward across the collapsed text and swallows whatever preceded it — the subject line, or
  the `Zelle® payment` header — into the captured name. A letters-and-spaces-only subject
  would then yield a payer like `You received money with Zelle JANE DOE`, silently corrupting
  every learned key built from it.

If Chase changes the template again, the safe failure mode is a `null` payer name: the row
lands in the review queue with no name, the Zelle Review screen requires the treasurer to
supply one before matching, and nothing is learned under a wrong key. If you see rows arriving
with no payer name, compare a real body against the patterns before assuming the data is bad.

## Repeated identical charges

`generateTransactionHash` is `Posting Date | Description | Amount`, deliberately
excluding Balance so a transaction seen first as pending and later as posted does not
import twice.

That exclusion made a statement's *second* copy of a genuinely repeated charge — same
merchant, same amount, same day, differing only in the running balance — hash identically
to the first, and the upload discarded it as a duplicate. Real spending vanished from the
ledger with no visible sign: the row was counted in `skipped`, which reads as normal.

Byte-identical rows are now numbered as they are read, and the hash of occurrence *n > 0*
carries a `|#n` suffix. Consequences worth knowing:

- **Occurrence 0 hashes exactly as before**, so every already-ingested row keeps its hash
  and is never re-imported.
- **Re-uploading a statement stays idempotent**: the same file yields the same ordinals.
  An overlapping statement matches occurrence 0 to the stored row and creates only what is
  new.
- **A truly duplicated export line now creates two rows** rather than one. That is the
  deliberate trade: a spurious extra row is visible in the pending queue and can be marked
  IGNORED, whereas the old behaviour silently dropped real money. Balance is still not
  hashed, so the pending-to-posted case it protected keeps working.

## Returned deposited items

A check the church deposited can bounce. Chase reports it as a debit whose
description carries the bounced check's own serial:

```
DEPOSITED ITEM RETURNED RETURN ITEM REF# 99007994 CHK SER# 1397
DEP REF: 5380734149 CHARGEBACK RTN REASON: UnableTo Locate
```

That serial belongs to the **donor**, not the church checkbook, which makes these
rows dangerous to treat as ordinary check debits: matching `CHK SER# 1397` against the
church's own check 1397 would link two unrelated payments. So:

- The parser captures the serial into `check_number` and flags the row via
  `isReturnedItem()`; the ordinary `CHECK` description pattern is skipped for it.
- `autoReconcileDebit` returns early on a returned item, so it is never matched
  against a church expense.
- The bank list annotates it as `returned_item`, resolving the serial against **income**
  entries to name the receipt it reverses.

Recording the payer's serial at entry time is what makes that lookup possible:
`createLedgerEntryForTransaction` stores `check_number` for check payments. Unlike the
church's outgoing checks these carry **no uniqueness rule** — two donors may each write
their own check 1397.

**A returned item is not reversed automatically.** The ledger still counts the gift as
received; the treasurer must correct it. Deciding whether that means marking the original
`refunded`, posting a contra-entry, or both is an accounting policy question that has not
been settled here.

## Troubleshooting

- Auth errors: Ensure you are signed in and your role is Treasurer or Admin.
- 403/401: Firebase token missing/expired or insufficient role.
- 403 `CREATE_DISABLED` on `reconcile/create-transaction` or `reconcile/batch-create`: expected
  while `ZELLE_GMAIL_CREATE_ENABLED` is false — use the match workflow instead.
- 409 `ALREADY_POSTED` on `/queue/:id/match`: the queue row already has a Transaction; nothing
  to do.
- A matched payer isn't linking during bank reconciliation: confirm the payer name typed
  during matching matches the bank statement's payer text exactly (see Payer name parsing
  above for how the name is extracted, and how it fails safely when it cannot be).
- Parsing issues: Check Gmail template changes and `gmailZelleIngest.js` parsing logic.
- Timezone/amount: Verify `payment_date` format and amount parsing for older templates.
