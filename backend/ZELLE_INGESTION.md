# Zelle Ingestion Guide

This document explains how Zelle payments are ingested from Gmail, matched to members,
posted to the ledger — from the Zelle Review screen or by bank reconciliation — and
confirmed against the bank without ever being posted twice.

- Audience: Treasurer/Admin
- Source: Gmail account receiving Chase/Zelle notifications, plus the Chase CSV uploaded to
  Bank Reconciliation
- Destination: `transactions` table (canonical ledger) — created by a treasurer on the Zelle
  Review screen, or by bank reconciliation when nobody created it from the email

## Overview

- **Two ways to post, one transaction per payment.** A treasurer can create the transaction
  straight from the Zelle Review screen (`POST /api/zelle/queue/:id/create-transaction`).
  When the Chase CSV later arrives, bank reconciliation recognizes that payment and links
  the existing transaction instead of creating another — see "Creating from the Zelle
  Review screen" below. A payment nobody created from its email is posted by bank
  reconciliation as before.
- **Automatic creation stays off**: while `ZELLE_GMAIL_CREATE_ENABLED` is `false` (the default — see
  `backend/env.example`), the Gmail *sync* never creates a Transaction. It only records every
  parsed email in `zelle_email_queue` and computes a suggested member match. The flag does
  not gate the treasurer's Create on Zelle Review, which is always available.
- **Turning `ZELLE_GMAIL_CREATE_ENABLED` on has a cost**: it restores the pre-match-only
  behavior where the Gmail sync creates transactions directly, which reopens the
  cross-path duplicate this queue exists to prevent. If a treasurer approves the bank CSV
  row for a payment before the Gmail sync next runs for that same payment, the sync's
  idempotency check only looks up `zelle:<reference>` and `gmail:<messageId>` — it cannot
  see the bank-created transaction (keyed by its own hash) — and on a high-confidence payer
  match it creates a second transaction for the same payment. Only enable the flag
  temporarily and with this tradeoff in mind (e.g. a backlog catch-up window), and prefer
  reconciling any pending bank rows for the affected period first.
- **Nothing posts money without a treasurer.** The sync never creates transactions (flag
  off). A transaction comes from a treasurer's Create on Zelle Review, or a treasurer's
  approval in Bank Reconciliation.
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

// Record the transaction for a queued email (duplicate-guarded)
POST /api/zelle/queue/:id/create-transaction

// Attach a queued email to a transaction that already records its payment
POST /api/zelle/queue/:id/attach

// Legacy, disabled by default — 403 while ZELLE_GMAIL_CREATE_ENABLED is false
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
  no Transaction exists yet), `CREATED` (a treasurer created the Transaction from the email,
  or attached the email to an existing one), `BANK_POSTED` (bank reconciliation created the
  Transaction first; the email was linked to it), `AUTO_CREATED` (legacy automatic
  creation), `IGNORED`, `ERROR`.
- `bank_transaction_id` records the bank row that confirmed the payment (unique: one bank
  row can confirm only one email). A `CREATED` row with no `bank_transaction_id` is
  "awaiting bank"; the screen flags it once it is more than 10 days old, since the Zelle may
  have been reversed or never posted.
- `email_received_at` is Gmail's `internalDate` — when the email arrived. `payment_date` is
  the same instant cut to a Chicago date. The queue lists newest first by `payment_date`,
  then `email_received_at`; rows recorded before the column existed can be filled with
  `node scripts/backfill-zelle-email-received-at.js` (dry run by default, `--apply` to
  write).

## Creating from the Zelle Review screen

`POST /api/zelle/queue/:id/create-transaction` with `{ member_id, payment_type, for_year?,
receipt_number?, payer_name?, force?, pledge_amount? }`. Amount, date and the Zelle key come from the queue
row — the client never sends them. The payer name is required (it is what bank
reconciliation matches on). Loan payment types are refused; loans are entered from the
Loans screen.

Before writing anything it asks whether this payment is already recorded:

| Finding | Response |
|---|---|
| The row already has a transaction | 409 `ALREADY_POSTED` |
| The bank already posted this exact payment | 409 `POSTED_BY_BANK`; the email is linked to that transaction (`BANK_POSTED`). Not overridable. |
| A plausible but uncertain existing transaction — a bank row that might be this payment, or the member's Zelle payment of the same amount within 5 days | 409 `POSSIBLE_DUPLICATE` with `candidates`. The treasurer attaches the email to one (`POST /api/zelle/queue/:id/attach { transaction_id }`), or re-sends with `force: true` for a genuinely separate payment. |

Otherwise the Transaction and LedgerEntry are written in one database transaction under a
lock on the queue row (double clicks lose), and the payer→member key is learned.

A **Pledge Drive** payment is handled exactly as in Bank Reconciliation and Add Payment:
the screen shows the member's open pledge in the live drive and the payment is credited to
it; with no open pledge, the treasurer may tick "Also record this as a pledge" and send
`pledge_amount` (≥ $1, `pledge_drive` only — otherwise 400 `INVALID_PLEDGE`), which opens a
pledge credited with this payment (`createPledgeWithPayment`; a pledge larger than the
payment stays open for the balance). As there, the payment is recorded even if the pledge
side fails — the reason comes back as `pledge_error`. When the bank row later links, the
payment is not credited again: `processReconciliation` skips allocation for a linked
transaction that already has allocation rows. If the bank row is already uploaded and certainly this
payment, it is confirmed on the spot.

### How an email and a bank row are recognized as one payment

`backend/src/services/zelleBankCorrelationService.js`, used in both directions:

- **Exact reference** — the bank row's reference equals the email's Transaction number.
  Chase prints the same 11-digit number on both only when the sender banks with Chase;
  other senders get a 12-character network id on the statement that appears nowhere in
  the email (verified against 40 emails). So this covers a minority of payments.
- **Anchored** — same amount, the email's payer name equals the bank's payer name (both are
  Chase's rendering of the sender), and the bank posted between 1 day before and 5 days
  after the email date — **and** the pairing is unique in both directions. Two payments
  from one payer for one amount in the same week are never decided automatically.
- Anything else plausible is a **candidate** for the treasurer.

The payer name is compared, not the member's name, so a gift sent from a relative's account
still pairs with its email.

### Confirming against the bank

When the bank row arrives (or is already there), the email-created transaction is **updated
in place**, never duplicated: its `external_id` becomes the bank hash (the system-wide
"bank-confirmed" marker, with the email key kept in `reconciled_meta.prev_external_id` for
undo); member, payment type, year, receipt and `payment_date` stay as the treasurer set
them — `payment_date` is when the donor gave, which matters at year end; the ledger entry
gets the bank posting date as `statement_date`; the queue row gets `bank_transaction_id`.
Undoing that automatic link restores all of it.

## Reconciliation Workflow

1) Open Treasurer Dashboard → Zelle Review tab.
2) For each queued email, confirm or correct the suggested member. If the email's payer name
   could not be parsed, type the payer name exactly as it appears on the bank statement — the
   match cannot be used for bank reconciliation without one.
3) Submit the match (`POST /api/zelle/queue/:id/match`). This marks the row `MATCHED` and
   writes a learned payer→member key (`bank_memo_matches`, plus the legacy memo table). **No
   Transaction is created by this step.**
4) Optionally, choose the payment type (and receipt) and click **Create transaction** to
   post it now — see "Creating from the Zelle Review screen" above.
5) When the Chase bank CSV is uploaded to Bank Reconciliation: a payment already created
   from its email is linked automatically when certain (Tier 0.5), or shown under
   "Possible Existing Entry" with a **Link to this entry** button. A payment nobody created
   surfaces as a PENDING credit with the member suggested; approving it creates the
   Transaction and LedgerEntry, and marks the email `BANK_POSTED`.

## Bank reconciliation and Zelle credits

Zelle credits are never auto-*created* by the automatic reconciliation pass, regardless of
match confidence. They are auto-*linked* in two cases:

- **Tier 0.5 (email-created transaction)**: the treasurer already created this payment from
  its Zelle email and the pairing is certain (exact reference, or anchored — see above).
  The existing transaction is confirmed in place; nothing is created.

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
- **Approving a Zelle row that was already created from its email is refused** —
  `POST /api/bank/reconcile` returns 409 `LINK_EXISTING` with `candidates`. Link with
  `existing_transaction_id` instead, or send `force: true` if the bank row really is a
  separate payment. Bulk reconcile never forces; such rows come back in `errors` with
  `code: 'LINK_EXISTING'`.

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

- `POST /api/zelle/queue/:id/create-transaction`
  - Auth: Firebase, roles `treasurer|admin`
  - Body: `{ member_id, payment_type, for_year?, receipt_number?, payer_name?, force? }`
  - `pledge_amount` (Pledge Drive only): open a pledge credited with this payment.
  - 201 `{ success, data, bank_link, pledge_error }`. 409 `ALREADY_POSTED` /
    `POSTED_BY_BANK` / `POSSIBLE_DUPLICATE` (with `candidates`) / `DUPLICATE_RECEIPT` /
    `IGNORED`. 400 `PAYER_NAME_REQUIRED` / `MEMBER_REQUIRED` / `MEMBER_NOT_FOUND` /
    `INVALID_PAYMENT_TYPE` / `INVALID_PLEDGE` / `INVALID_RECEIPT` / `INCOMPLETE`. 404 unknown row.

- `POST /api/zelle/queue/:id/attach`
  - Auth: Firebase, roles `treasurer|admin`
  - Body: `{ transaction_id }`. 400 `AMOUNT_MISMATCH`; 409 `TRANSACTION_CLAIMED` (another
    email owns it) or `ALREADY_POSTED`; 404 unknown row or transaction.

- `POST /api/zelle/queue/:id/ignore`
  - Auth: Firebase, roles `treasurer|admin`
  - Marks the row `IGNORED`. 400 if the row already has a Transaction (including
    `BANK_POSTED`).

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

The payer name carries the email across to the bank: it becomes the `ZELLE:PAYER:<name>`
learned key, and it is what pairs an email-created transaction with its bank row when the
reference numbers differ — so `extractPayerName` (in
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
  while `ZELLE_GMAIL_CREATE_ENABLED` is false — use `queue/:id/create-transaction`.
- An email-created payment stays "awaiting bank": the bank row may not be uploaded yet, or
  the pairing was not certain (two same-amount payments from one payer that week, a payer
  name that differs between email and statement). Open the PENDING bank row and use **Link
  to this entry**.
- 409 `LINK_EXISTING` in Bank Reconciliation: working as intended — the payment was already
  recorded from its email. Link it rather than creating a second entry.
- 409 `ALREADY_POSTED` on `/queue/:id/match`: the queue row already has a Transaction; nothing
  to do.
- A matched payer isn't linking during bank reconciliation: confirm the payer name typed
  during matching matches the bank statement's payer text exactly (see Payer name parsing
  above for how the name is extracted, and how it fails safely when it cannot be).
- Parsing issues: Check Gmail template changes and `gmailZelleIngest.js` parsing logic.
- Timezone/amount: Verify `payment_date` format and amount parsing for older templates.
