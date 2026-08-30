# Zelle: match-only Gmail path, approval-gated bank reconciliation

**Date:** 2026-08-29
**Status:** Approved design, pending implementation plan

## Problem

Two independent paths can create a `transactions` row for the same Zelle payment:

1. **Gmail path** — `zelleSyncScheduler` → `gmailZelleIngest.syncZelleFromGmail` → parses a
   Chase Zelle email → `zelle_email_queue` (keyed `zelle:<reference>`, falling back to
   `gmail:<messageId>`) → creates a `transactions` row with that `external_id`.
2. **Bank path** — Chase CSV upload → `bank_transactions` (keyed on an md5
   `transaction_hash`) → `autoReconcileService.autoReconcilePending` → Tier 0/1 *link* an
   existing transaction, Tier 2 *creates* one from a learned payer association.

`transactions.external_id` is unique, but the two paths write into different key
namespaces (`zelle:…` vs a bare md5 hash), so the index cannot detect a cross-path
duplicate. `reconciliationService.processReconciliation` compounds this by *overwriting*
`donation.external_id` with the bank hash, destroying the payment's Zelle identity.

Concretely, when the CSV is processed before the email:

- Tier 2 creates a transaction keyed by the bank hash. The Gmail sync then looks for
  `zelle:<ref>` and `gmail:<id>`, finds neither, sees a high-confidence learned payer, and
  creates a **second** transaction.
- Or the email is already sitting at `NEEDS_REVIEW` (queue row exists, `transaction_id`
  still null) when the CSV lands. The treasurer clicks Create; the rename-immune guard in
  `zelleTransactionService` requires `transaction_id != null`, so it does not fire, and a
  **second** transaction is created.

Both duplicates carry `LedgerEntry` rows, so totals inflate silently. Nothing in the
system detects or reports this.

## Approach

Make bank reconciliation the only path that creates money, and demote the Gmail path to a
*matching* source: it teaches the system "this payer is this member" ahead of time, so
that when the CSV arrives the suggestion is already correct.

This removes the duplicate class by construction rather than by guard — with one creating
path, there is no second path to collide with.

The workflow also improves. Zelle emails arrive the day the payment is sent; the bank CSV
is uploaded days later. The treasurer can pre-match givers at leisure, and the CSV upload
then presents clean, already-correct suggestions.

### Why reuse `bank_memo_matches` rather than build a new mapping

`zelleTransactionService.learnZelleAssociation` already constructs a pseudo bank
transaction whose description is `Zelle payment from <payer> 0000000`, specifically so its
normalized key equals the one a real CSV row produces. Verified against
`bankMemoMatchService.getBankMatchKeys` / `normalizeDescriptionForKey`:

| Side | `payer_name` | `description` | Keys produced |
|---|---|---|---|
| Gmail (pseudo) | `JOHN DOE` | `Zelle payment from JOHN DOE 0000000` | `ZELLE:PAYER:JOHN DOE`, `ZELLE:DESCRIPTION:JOHN DOE` |
| Bank (real CSV) | `JOHN DOE` | `Zelle payment from JOHN DOE 27250625041` | `ZELLE:PAYER:JOHN DOE`, `ZELLE:DESCRIPTION:JOHN DOE` |

The `ZELLE` branch of `normalizeDescriptionForKey` strips the `Zelle payment from ` prefix
and a trailing `\s+\w{6,}` token, so both the seven-character `0000000` placeholder and a
real eleven-digit Zelle id are removed. The keys are identical. A match made on the email
screen will be found when the CSV row arrives.

Two alternatives were rejected:

- **Per-row link** (`zelle_email_queue.bank_transaction_id`): requires the bank row to
  exist at match time, but emails arrive days earlier. Defeats the workflow.
- **New `zelle_payer_members` table**: duplicates a table that already exists and works,
  and creates two sources of truth for suggestions.

## Design

### Tier policy for Zelle credits

`autoReconcileCredit` runs three tiers. They are split rather than switched off together,
because they carry very different risk:

| Tier | What it does | Zelle policy |
|---|---|---|
| Tier 0 | Exact `zelle:<reference>` match against `external_ref_id` | **Keep automatic.** Exact identifier match, creates no money, and is the mechanism that drains the existing Gmail-created backlog. |
| Tier 1 | Heuristic link: amount + method + ±5 days + payer name tokens | **Demote.** Do not act. Surface as `potential_matches` on the PENDING row for the treasurer to confirm. This is a guess, and the source of any silent wrong link. |

Tier 1's demotion has a detail worth stating: `getBankTransactions` already computes
`potential_matches` for PENDING rows, but calls `findPotentialMatches` with its default
`dayWindow` of 2, while Tier 1 used 5 for Zelle. The list endpoint must pass `dayWindow: 5`
for Zelle rows, or a payment posted three to five days after its email date will silently
show no candidate — exactly the case Tier 1's wider window existed to catch.
| Tier 2 | Create a transaction from a learned payer association | **Off.** Becomes the pre-filled member suggestion on the PENDING row. |

ACH and check credits keep today's behavior. Expense debits (Tier 3) are untouched.

### Existing Gmail-created backlog

Transactions already created by the Gmail path (`external_id` starting `zelle:` or
`gmail:`) are left in place. Tier 0 absorbs them as their CSV rows arrive, and the backlog
drains on its own. No data migration, no deletions.

`linkPendingBankRowsForTransaction` and its Tier 1.5 anchored linking become dead for new
Zelle work but stay in place for the backlog and for the flag-on case.

### Feature flag

`ZELLE_GMAIL_CREATE_ENABLED`, default `false`, added to `backend/env.example`.

When false, the Gmail path never creates a transaction. The code stays intact so the
behavior can be restored by flipping config, not by reverting a commit.

### Backend changes

**`backend/src/services/gmailZelleIngest.js`**

- Gate the `canAutoCreate` branch (currently line 240-241) on the flag. When off, every
  parsed email is queued instead of created.
- Everything else stays: dedupe on `zelle:<ref>`, the "transaction already exists" skip
  (so the historical backlog still displays correctly), and Gmail labelling.
- Queue status is `NEEDS_REVIEW`, or `MATCHED` once a treasurer assigns a member.

**`backend/src/controllers/zelleController.js`**

- `POST /api/zelle/reconcile/create-transaction` and `POST /api/zelle/reconcile/batch-create`
  return 403 with an explanatory message when the flag is off.

**New endpoint: `POST /api/zelle/queue/:id/match`**

Body: `{ member_id, payer_name? }`. Role-gated `treasurer|admin` like the rest of
`/api/zelle`.

1. Calls `learnZelleAssociation({ payerName, note, memberId })`, which writes both
   `bank_memo_matches` keys and the legacy `zelle_memo_matches` row.
2. Stamps the queue row: `matched_member_id`, `status: 'MATCHED'`, `matched_by`,
   `matched_at`.

Idempotent and re-runnable. Re-matching a row updates the learned key — this is how a
treasurer corrects a mistake.

Matching is allowed on any queue row whose `transaction_id` is null, whatever its status
(`NEEDS_REVIEW`, `MATCHED`, `ERROR`, `IGNORED`). Rows that already carry a
`transaction_id` — the historical `CREATED` and `AUTO_CREATED` backlog — are read-only and
the endpoint rejects them with 409; their member association is already settled by the
transaction itself.

`payer_name` override exists because `extractPayerName` can return null, in which case
`learnZelleAssociation` falls back to the memo text and silently learns a key no bank row
will ever hit. The override lets the treasurer supply the payer name the bank will show,
and the UI asks for it whenever parsing failed.

**`GET /api/zelle/queue`** — extend with pagination (`page`, `limit`) and a text filter
across `payer_name`, `note` and `subject`. It becomes the primary view rather than an
audit sidebar, so it must page rather than cap at 200.

**Migration** — two nullable columns on `zelle_email_queue`: `matched_by` (BIGINT) and
`matched_at` (DATE). `status` is already `STRING(20)`, so `MATCHED` needs no enum change.
Follow the `db-migrations` skill for the sequelize-cli folder.

**`backend/src/services/autoReconcileService.js`**

- In `autoReconcileCredit`, when `sourceTypeFor(plain) === 'ZELLE'`: run Tier 0, then
  return `null` without running Tier 1's action or Tier 2. The row stays PENDING.
- Auto-reconcile stats continue to report these as `needsReview`.

### Frontend changes

**`frontend/src/components/admin/ZelleReview.tsx`**

Data source moves from `GET /api/zelle/preview/gmail` (a live Gmail round trip capped at
50 messages and 30 days) to `GET /api/zelle/queue` — complete history, fast, already
populated by the sync.

Table columns: **Date/Time · Amount · Payer · Memo · Matched Member · Match**.

Amount and Payer are included because matching a giver from memo text alone is
impractical, and Payer is the field the learned key is built from — the treasurer should
see what they are teaching.

The Match column holds a member search plus Save, shows the current match with its
confidence and provenance (learned vs fuzzy), and allows re-matching. When the row has no
parsed payer name, it also prompts for one. Rows carrying a `transaction_id` render their
match as plain text with no editing control, mirroring the endpoint's 409.

The table lists rows of every status, defaulting to unmatched-first ordering, with a
status filter so the treasurer can work through `NEEDS_REVIEW` and still review what they
have already matched.

Removed from the screen: Create, batch Create, receipt-number entry, and the selection
checkbox column. The existing "already created" section stays as a read-only historical
record.

**`frontend/src/components/finance/BankTransactionList.tsx` and `BankTransactionDetail.tsx`**

- Zelle PENDING rows show the suggested member drawn from the learned key, with
  confidence and provenance.
- Approve opens the existing reconcile modal pre-filled with that member. The treasurer
  confirms payment type, `for_year` and receipt number, then posts through the existing
  `POST /api/bank/reconcile`.
- That path already calls `learnBankMemoMatch`, so a correction made at the bank step
  feeds back into the same table the Gmail screen writes.

## Testing

- **Key alignment** — a match made through `POST /api/zelle/queue/:id/match` produces
  learned keys that `findSuggestionCandidates` returns for a real parsed Chase CSV Zelle
  row. This is the assumption the whole design rests on.
- Sync with the flag off creates zero transactions and queues every parsed email.
- The match endpoint writes both `bank_memo_matches` keys and the legacy row, and is
  idempotent; re-matching to a different member updates rather than duplicates.
- `payer_name` override produces the same keys as a correctly parsed payer name.
- A Zelle bank row with a learned match stays PENDING and carries a suggestion, rather
  than auto-creating (regression test for Tier 2 being off).
- ACH and check credits still auto-reconcile unchanged.
- Tier 0 still links a backlog transaction keyed `zelle:<ref>`.
- `create-transaction` and `batch-create` return 403 when the flag is off.

## Out of scope

- **The `external_id` rename fix.** Adding a `bank_transaction_id` column to
  `transactions` so `processReconciliation` stops overwriting the payment's identity
  remains the right long-term fix, but this design makes it much less urgent, and mixing a
  data migration into a behavior change would make both harder to verify.
- ACH, check, and expense (Tier 3) reconciliation flows.
- Square payments, which are a third path into `transactions` on their own key namespace.

## Operational note

The table is only as complete as the sync. `ZELLE_SYNC_ENABLED` ships `false` in
`env.example` and is not set in the deploy workflow, so confirm what the OCI box actually
has. With creation disabled the sync is purely read-and-record, so enabling it is safe and
the feature depends on it.
