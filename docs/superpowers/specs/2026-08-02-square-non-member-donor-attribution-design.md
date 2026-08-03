# Square Review: Named Non-Member Donors + Bulk Attribution

**Date:** 2026-08-02
**Status:** Approved design — pending spec review

## Context & Problem

The Square review screen (`SquareReview.tsx`) lets a treasurer attribute each ingested Square
payment either to a member (search + select) or to an "Anonymous" donor via a checkbox
([lines 362-368](../../../frontend/src/components/admin/SquareReview.tsx#L362-L368)). Confirm is
gated on one of the two being set ([line 199](../../../frontend/src/components/admin/SquareReview.tsx#L199)).

Two gaps:

**1. The anonymous path silently discards the donor's name.** Checking the box sends
`member_id: null` ([line 97](../../../frontend/src/components/admin/SquareReview.tsx#L97)) and
nothing else. `buyer_name` *is* forwarded through `processReview`
([squareController.js:98](../../../backend/src/controllers/squareController.js#L98)) into
`createSquareTransaction` ([squarePaymentService.js:131](../../../backend/src/services/squarePaymentService.js#L131)),
but that function only uses it to feed the learning step — it is **never written to the
transaction**. `transactions` has no donor-name column at all; the record ends up with
`member_id: null` and no indication of who gave. The money is recorded, the giver is lost.

**2. Every payment must be confirmed one at a time.** A Sunday's worth of walk-up card gifts from
the same non-member (or a single named group like "Sunday plate") means repeating the same
attribution N times. A batch endpoint already exists —
`POST /api/square/reconcile/batch-create` ([squareController.js:173](../../../backend/src/controllers/squareController.js#L173)) —
but nothing in the UI uses it.

**On the "don't learn this" requirement:** the learning call is already gated on
`member_id && buyer_name` ([squarePaymentService.js:191](../../../backend/src/services/squarePaymentService.js#L191)),
so a non-member confirm (`member_id: null`) never reaches `learnBankMemoMatch` and never writes a
`bank_memo_matches` row. **No change is needed to satisfy this** — but the guarantee is currently
incidental rather than deliberate, so this design adds a regression test that locks it in.

## Goals

- Capture and store a donor name when a payment is attributed to a non-member.
- Let the treasurer select several payments and attribute them all to one donor name in a single
  confirm.
- Guarantee, by test, that non-member attribution never trains the auto-match engine.

## Non-goals

- Changing member-matched attribution, which continues to learn as it does today.
- Any auto-fill of the donor name from `buyer_name` on future payments (that would be the
  "learning" the user explicitly rejected).
- Bulk attribution to a *member* — bulk is for the non-member/named-donor case only.
- Editing the donor name after a transaction is created.
- Backfilling names onto already-created transactions.

## Decisions

- **Storage:** new nullable `donor_name` column on `transactions` and `ledger_entries`, via a
  sequelize-cli migration.
- **Bulk receipts:** bulk confirm sends no receipt number; receipts stay a per-payment concern.
- **Labelling:** the checkbox becomes **"Non-member donor"** with a required name field, matching
  what the data already means (`transactions.member_id` is documented as "null for
  anonymous/non-member donations").

---

## Backend

### B1. Migration — `backend/migrations/YYYYMMDDHHMMSS-add-donor-name.js`

New sequelize-cli migration (system 1 per the `db-migrations` skill; auto-runs on deploy via
`.github/workflows/deploy-backend.yml`).

- `transactions.donor_name` — `STRING(255)`, nullable.
- `ledger_entries.donor_name` — `STRING(255)`, nullable, so ledger exports and the Sheets backup
  can show the giver without joining back to `transactions`.
- Guarded with a `describeTable` column-existence check in both directions (matching the house
  pattern), and a working `down()` that removes both columns.

Nullable with no default and no backfill: existing rows keep `NULL`, which correctly reads as
"donor not recorded".

### B2. Models

Add `donor_name` to `Transaction.js` and `LedgerEntry.js` with a comment explaining it is only
populated for non-member gifts (`member_id IS NULL`).

### B3. `createSquareTransaction` — persist the name

Currently `buyer_name` is destructured and used only for learning. Add a `donor_name` parameter and:

- write it to `Transaction.create({ ..., donor_name })` and to the `LedgerEntry.create` call
  ([squarePaymentService.js:204](../../../backend/src/services/squarePaymentService.js#L204));
- normalize by trimming; store `null` for an empty string;
- **only persist it when `member_id` is null.** A member-attributed payment gets `donor_name: null`
  — the member link is the attribution, and storing both invites them to disagree.

The learning block stays exactly as-is. Its `member_id && buyer_name` guard already excludes the
non-member path; B7 adds the test that keeps it that way.

### B4. `processReview` — accept and validate `donor_name`

Destructure `donor_name` from the item alongside the existing fields
([squareController.js:96-99](../../../backend/src/controllers/squareController.js#L96-L99)) and pass
it through to `createSquareTransaction`.

Validation, server-side (the client validates too, but the API is reachable directly):

- If `member_id` is null/absent **and** `donor_name` is blank → 400,
  "A donor name is required when the payment is not attributed to a member."
- Trim and cap at 255 characters.

This makes the previously-permitted "no member, no name" confirm an error. That is the intended
behavior change; see Known Limitations for the effect on any existing client.

### B5. Batch endpoint

`createBatchTransactions` already loops `processReview` per item and collects per-item results
([squareController.js:173-193](../../../backend/src/controllers/squareController.js#L173-L193)). It
needs no signature change — each item simply carries its own `donor_name`, which the client sets to
the same value for every selected row.

One behavior worth stating: the loop is **not transactional**. A batch where item 3 fails still
commits items 1 and 2. That is the existing contract; the UI (F4) surfaces per-item outcomes rather
than pretending the batch is atomic.

### B6. Queue response

`getQueue` already returns `buyer_name`, which the UI uses to pre-fill the donor name field (F2).
No change.

### B7. Regression test — non-member attribution must not train the matcher

New test asserting `learnBankMemoMatch` is **not** called when `member_id` is null but
`buyer_name`/`donor_name` are present, and **is** still called on the member-matched path. This is
the guard for the explicit "don't learn this" requirement.

---

## Frontend (`SquareReview.tsx`)

### F1. Rename the control

The Square strings live in the typed `dictionaries.ts` (`square:` block, `en` at line ~2431, `ti` at
line ~4219), not the legacy flat map.

- `square.anonymous` ("Anonymous donor") → `square.nonMemberDonor` ("Non-member donor"), in both
  `en` and `ti`. Note there is an unrelated top-level `anonymous` key elsewhere in the same file —
  only the one inside the `square` block changes.
- `square.confirmHint` currently reads "Select a member or mark as anonymous first" and must be
  reworded to match, otherwise the disabled-Confirm tooltip contradicts the new label.

### F2. Donor name input

When "Non-member donor" is checked, a required text input appears next to it, pre-filled with the
row's `buyer_name` when Square supplied one (a convenience default the treasurer can overwrite —
not a learned association, and never applied without the box being checked).

`canConfirm` ([line 199](../../../frontend/src/components/admin/SquareReview.tsx#L199)) tightens to:

```
member selected/auto-matched  OR  (nonMemberDonor checked AND donorName.trim() !== '')
```

`confirmRow` sends `donor_name` when the box is checked.

### F3. Multi-select

- A checkbox on each card in the Review tab (not the Ignored tab).
- Header row gains a "select all visible" checkbox and a selection count.
- Selection is cleared on tab switch, after a sync, and after a successful bulk confirm.
- Selecting rows does not disturb per-row state; a treasurer can still confirm one row individually
  while others are selected.

### F4. Bulk action bar

Appears when ≥1 row is selected, pinned above the list:

```
4 selected · $850.00 total
Donor name: [ ......................... ]  Type: [ Donation ▾ ]   [ Confirm 4 ]  [ Clear ]
```

- **Donor name** — required; the bar's Confirm is disabled while blank.
- **Type** — one payment type applied to all selected. Defaults to Donation.
  `membership_due` is **excluded** from the bulk type list: it needs a `for_year` and is inherently
  member-scoped, so it has no meaning for a non-member donor.
- **No receipt field** — per the decision above, bulk sends no receipt number.
- Posts once to `/api/square/reconcile/batch-create` with one item per selected row, each carrying
  `member_id: null`, the shared `donor_name`, and the shared `payment_type`.
- Results: the endpoint returns per-item outcomes. The UI reports
  "N confirmed, M failed" and lists the failures with their messages, then refreshes the queue.
  A fully-successful batch shows the normal success notice.

Bulk is **non-member only** — there is no bulk "attribute to member", so the bar has no member
search. This keeps the risky operation (bulk-writing financial records) confined to the case where
no member ledger is affected.

### F5. i18n

New `en` + `ti` keys for: "Non-member donor", "Donor name", the required-name validation message,
"N selected", "Confirm N", "Clear selection", the bulk partial-failure summary, and the select-all
label. Tigrigna values are drafts, flagged in `tigrigna-translation-review.md`.

---

## Testing

**Backend**

| Case | Expectation |
|---|---|
| Confirm with `member_id: null` and a donor name | 200; transaction + ledger entry carry `donor_name` |
| Confirm with `member_id: null` and blank donor name | 400, nothing written |
| Confirm with a `member_id` | `donor_name` stored as null; member link is the attribution |
| Confirm with `member_id: null` + donor name | `learnBankMemoMatch` **not** called |
| Confirm with a `member_id` + buyer name | `learnBankMemoMatch` still called (no regression) |
| Donor name of only whitespace | treated as blank → 400 |
| Donor name > 255 chars | trimmed/rejected, no DB error |
| Batch: 3 items, 1 duplicate `square_payment_id` | 2 succeed, 1 reports EXISTS; response lists both outcomes |

**Frontend**

- Confirm stays disabled when "Non-member donor" is checked and the name is blank.
- The donor name pre-fills from `buyer_name` but only once the box is checked.
- Checking "Non-member donor" clears any selected member, and selecting a member clears the box
  (the existing mutual exclusion, extended to the name field).
- Bulk bar appears on selection, shows the correct count and total, and is disabled without a name.
- Bulk confirm posts a single `batch-create` request with one item per selected row, all sharing the
  donor name.
- A partial-failure response renders the per-item failures rather than a blanket success.
- Selection clears after a successful bulk confirm.

## Known Limitations

- **This is a breaking API change for the confirm endpoint.** A non-member confirm without a name
  now 400s where it previously succeeded. The only client is this screen, updated in the same
  change, so the exposure is a stale browser tab mid-session.
- **No backfill.** Transactions already created via the anonymous path keep `donor_name = NULL`;
  their donor names were never captured and cannot be recovered from the transaction record. The
  original `buyer_name` does survive on the `square_payments` row, so a backfill script is possible
  later if wanted — deliberately out of scope here.
- **Bulk is not atomic.** A partial failure leaves some payments confirmed. Surfaced in the UI
  rather than hidden; making it transactional would mean restructuring `createBatchTransactions`.
- **Donor names are free text.** "J. Smith" and "John Smith" are different donors as far as the
  system is concerned. Deliberate — deduplicating them would require exactly the learned-identity
  behavior that was explicitly ruled out.
- **No reporting surface yet.** The column is stored and exported but no screen groups or filters by
  donor name. Worth a follow-up if the treasurer wants non-member giving totals.

## Files Touched

| File | Change |
|---|---|
| `backend/migrations/<ts>-add-donor-name.js` | **new** — B1 |
| `backend/src/models/Transaction.js` | B2 |
| `backend/src/models/LedgerEntry.js` | B2 |
| `backend/src/services/squarePaymentService.js` | B3 |
| `backend/src/controllers/squareController.js` | B4 |
| `backend/src/__tests__/controllers/squareController.test.js` | extend — B7 + validation cases |
| `frontend/src/components/admin/SquareReview.tsx` | F1–F4 |
| `frontend/src/i18n/dictionaries.ts` | F1, F5 (`square:` block, `en` + `ti`) |
| `frontend/src/components/admin/__tests__/SquareReview.test.tsx` | extend — frontend tests |
| `tigrigna-translation-review.md` | log `ti` drafts |
