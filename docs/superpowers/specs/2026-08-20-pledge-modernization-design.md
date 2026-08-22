# Pledge Modernization — Design Spec

**Date:** 2026-08-20
**Status:** Approved for planning
**Scope:** Preserve the 2025 pledge drive as read-only history; rebuild pledge
tracking around campaigns and payment allocations so 2026 balances are derived,
automatic, and auditable.

---

## 1. Problem

The pledge drive that ran 2025-09-13 → 2026-01-12 recorded pledges but never
connected them to money. Fulfillment was a hand-flipped boolean. Treasurers
updated the database directly to reflect payments.

Production data confirms the cost:

| Fact | Value |
|---|---|
| Pledges | 148 (129 `fulfilled`, 19 `pending`) |
| Total pledged | $69,949 |
| Pledges with `member_id` | 129 (122 distinct members) |
| Pledges with `donation_id` | **0** |
| Members whose `building_fund` payments cover their pledge | **77** |
| Members with no matching payment at all | **39 (32%)** |

129 pledges are flagged `fulfilled`, but only 77 members can be shown to have
paid. The flag was never load-bearing.

**Goal.** `Pledge → Payment Allocations ← Payment`. Balances derive from
authoritative payment records. No legitimate financial operation requires
direct database modification.

---

## 2. Current implementation assessment

### What is wrong

1. **No partial-payment representation.** `pledges` has no `amount_paid`.
   Fulfillment is `status='fulfilled'` plus a single `donation_id`. Partial
   payments are structurally impossible to record.
2. **Stats report intent, not cash.** `getPledgeStats` computes
   `total_fulfilled = SUM(amount) WHERE status='fulfilled'` — the *pledged*
   amount of fulfilled pledges — and the public `PledgeTracker` labels it
   "Total Donated".
3. **No link to the money table.** `pledges` references `donations` (Stripe
   only), never `transactions`, where cash, check, and Zelle live. The
   `donation_id` FK was never populated on any row.
4. **Campaigns are free text.** `event_name` is a nullable string with no goal,
   dates, or status. All 148 rows have it blank.
5. **`pledgeRoutes.js` has no auth middleware.** `GET /api/pledges` (names,
   emails, phones, addresses), `GET /stats`, and `PUT /:id` are public.
   Anyone can enumerate pledger PII or flip any pledge to fulfilled.
6. **`pledges` has no RLS**, unlike the other sensitive tables, so it is
   auto-exposed via Supabase PostgREST.
7. **The admin UI is broken in production.** `PledgeManagement.tsx` fetches
   relative `/api/pledges` with no `REACT_APP_API_URL` and no auth header.
8. **SMS reminders target the wrong people.** `sendPendingPledges` queries
   `status='pending'`, so members who paid but were never flagged received
   "you still owe" messages.

### What is reused

| Asset | Role in the new design |
|---|---|
| `transactions` | Authoritative money record. Already has `status`, `payment_method`, `for_year`, `collected_by`, and a **UNIQUE `external_id`** giving Stripe idempotency. |
| `POST /api/transactions` | Treasurer offline entry, already role-guarded, already enforces receipt numbers for cash/check. |
| `handlePaymentSucceeded` | Signature verification, member resolution, idempotent transaction upsert, ledger entry + GL mapping. Extended, not replaced. |
| `ledger_entries` | GL layer, auto-created from transactions. |
| `activity_logs` | Audit trail for pledge edits and campaign transitions. No new audit table needed. |
| `statementController` | Existing PDF statement generation and email — receipts reuse it. |
| `roleMiddleware` / `firebaseAuthMiddleware` | Authorization, unchanged vocabulary. |
| RLS migration pattern | Enable RLS, add no policies, owner-exempt. |

**Assessment:** the money side of the system is sound. `pledges` is the piece
that was never wired into it. This is wiring, not a rewrite.

---

## 3. Data model

```
pledge_campaigns ──< pledges ──< pledge_allocations >── transactions
                                   (append-only)        (existing)
                          │                                  │
                          └──────── pledge_balances (view) ───┘
                                    campaign_totals (view)
```

### 3.1 `pledge_campaigns` (new)

`id`, `slug` (unique), `name`, `name_ti`, `description`, `description_ti`,
`start_date`, `end_date`, `goal_amount`, `currency`, `status`,
`default_payment_type`, `income_category_id` → `income_categories`.

- `status` ∈ `draft | active | closed`, as **VARCHAR + CHECK**, not a Postgres
  ENUM — following `LedgerEntry`'s own precedent of mapping enums as STRING to
  avoid enum mismatch, and avoiding the CREATE TYPE/swap/rename dance.
- `name_ti` / `description_ti` follow the existing bilingual convention
  (`add-tigrinya-to-announcements`, `add-tigrinya-to-meetings`).
- `default_payment_type` + `income_category_id` route campaign payments to a
  real GL code instead of the `INC999` fallback.
- **`total_pledged`, `total_collected`, and `outstanding` are NOT columns.**
  They come from `campaign_totals`. Storing them recreates the drift this
  project exists to remove.

Seeded rows:

| slug | name | dates | status |
|---|---|---|---|
| `2025-pledge-drive` | 2025 Pledge Drive | 2025-09-13 → 2026-01-12 | `draft` → `closed` after reconciliation |
| `2026-pledge-drive` | 2026 Pledge Drive | 2026-01-01 → 2026-12-31 | `draft` → `active` at Phase 4 |

### 3.2 `pledges` (changed)

| Change | Detail |
|---|---|
| `campaign_id` | → `pledge_campaigns`, `ON DELETE RESTRICT`. Backfilled unconditionally to 2025 (all 148 rows are one drive), then `NOT NULL`. |
| `status` → `legacy_status` | Renamed, made nullable. Holds the hand-flipped 2025 values verbatim. Renaming is deliberate: leaving it called `status` is how this bug returns. |
| `lifecycle` (new) | `active \| cancelled`, VARCHAR + CHECK. The **only** mutable state on a pledge. Fulfillment is never stored. |
| `is_historical` (new) | BOOLEAN NOT NULL DEFAULT false; true for all 2025 rows. Required — see below. |
| Partial unique index | `(campaign_id, member_id) WHERE member_id IS NOT NULL AND lifecycle='active' AND is_historical=false` |
| `CHECK (amount > 0)` | |

**Why `is_historical` is required:** production has 6 members with duplicate
pledges (max 3 rows for one member). Without excluding historical rows the
partial unique index fails to build. It also serves as a join-free frozen-row
check. A trigger-based uniqueness check was rejected as race-prone.

**One active pledge per member per campaign** makes "your pledge" unambiguous
and makes payment targeting deterministic — the basis of scenario 6's
guarantee. Increasing a pledge is an audited edit, not a second row.

**Ownership:** pledges belong to an individual `member_id`. Household views
roll up by the existing `members.family_id`. No new table, no dual-owner
columns, and a spouse can still hold a separate pledge.

### 3.3 `pledge_allocations` (new) — the core

| Column | Notes |
|---|---|
| `pledge_id` | → `pledges`, **ON DELETE RESTRICT** |
| `transaction_id` | → `transactions`, **ON DELETE RESTRICT** |
| `amount` | `CHECK (amount <> 0)`. Positive allocates, negative reverses. |
| `source` | `stripe_auto \| treasurer_manual \| migration \| stripe_refund` |
| `allocated_by` | → `members`. NULL only for automated sources. |
| `reason` | Required on reversals. |
| `reverses_allocation_id` | Self-FK. |
| `idempotency_key` | UNIQUE, nullable. `auto:<external_id>:<pledge_id>` |
| `created_at` | No `updated_at` — rows never change. |

- **Append-only, enforced by a `BEFORE UPDATE OR DELETE` trigger that raises**
  (Postgres only; returns early on other dialects). This is what makes
  "financial records cannot be corrupted" real rather than aspirational.
- `CHECK (reverses_allocation_id IS NULL OR (amount < 0 AND reason IS NOT NULL))`
- **Corrections are reversals, not edits.** The audit requirement — who, when,
  previous allocation, new allocation, reason — is satisfied by the table
  itself. No separate audit table.
- **Over-allocation guard:** allocating locks the parent `transactions` row
  (`SELECT … FOR UPDATE`) inside the same DB transaction and verifies
  `SUM(allocations) <= transaction.amount`. The row lock makes this correct
  under concurrency; a nightly integrity check is the backstop.
- **Consequence to handle:** `DELETE /api/transactions/:id` (admin only) will
  now fail for allocated transactions. Correct behavior, but it needs a
  friendly 409 rather than a 500.

### 3.4 Views

**`pledge_balances`** — per pledge: `pledged_amount`, `paid_amount`,
`remaining_amount`, `percent_fulfilled`, `derived_status`
(`not_started | partially_fulfilled | fulfilled | cancelled`), `last_payment_at`.

Two properties that matter:

- **`paid_amount` sums only allocations whose transaction is `status='succeeded'`.**
  Failed payments, cancellations, and refunds correct themselves with no extra
  logic. That single predicate does most of the work in scenario 7.
- `remaining_amount` is **unclamped**, so overpayment reads negative for the
  treasurer. The member UI renders it as "Fully paid".

**`campaign_totals`** — built on `pledge_balances`: `total_pledged` (active
pledges), `total_collected`, `outstanding`, `pledge_count`, `donor_count`,
`percent_to_goal`.

**Portability constraints (tests run on `sqlite::memory:`):**
`SUM(CASE WHEN … END)` not `FILTER (WHERE …)`; plain `LEFT JOIN … GROUP BY`
not `LATERAL`; every division guarded by `CASE WHEN amount > 0` because
Postgres raises on divide-by-zero where SQLite returns NULL.

Both views are exposed as read-only Sequelize models (`PledgeBalance`,
`CampaignTotal`) with `timestamps: false`.

### 3.5 Read-only enforcement

`requireOpenCampaign` middleware resolves the campaign from the request body or
the target pledge/allocation and returns **409** when `status='closed'`.
Applied to every pledge and allocation write route. The append-only trigger is
the second layer: even a bug cannot rewrite a 2025 allocation.

---

## 4. 2025 migration and reconciliation

### 4.1 Ordering

Read-only comes **last** — a frozen campaign cannot be reconciled.

```
1. Schema only        create campaigns / allocations / views / trigger
2. Seed campaigns     2025 (draft), 2026 (draft)
3. Backfill           every existing pledge → campaign_id = 2025
4. Rename + lifecycle status → legacy_status; lifecycle from it; is_historical = true
5. RECONCILE          read-only report, writes nothing
6. Treasurer confirms approved matches become allocations (source='migration')
7. Freeze            2025 campaign status = 'closed'
```

Steps 1–4 are migrations. Step 5 is a script. Step 6 is a one-time screen.
**Nothing deletes or overwrites a 2025 row.** `legacy_status` is a rename, so
the original values survive as the historical record of what was believed.

### 4.2 Matching tiers

`donation_id` is populated on **zero** rows, so the high-confidence FK tier
yields nothing. Every match is heuristic and every match is reviewed.

Evidence for the payment vehicle, restricted to the 122 members who pledged:

| payment_type | pledgers | txns | total | Read |
|---|---|---|---|---|
| `building_fund` | 83 | 88 | $45,463 | **The drive.** |
| `membership_due` | 47 | 180 | $24,745 | ~3.8 payments each — monthly dues. |
| `donation` | 38 | 49 | $20,126 | Ambiguous; see below. |
| `tithe` | 3 | 47 | $7,156 | Three people on recurring ACH. |
| `loan_received` | 3 | 3 | $45,000 | `member_loans` territory, not giving. |

`building_fund` + `donation` = $65,589 against $63,663 pledged — it
**overshoots**, proving both cannot be pledge money. There is no signal
separating ordinary donations from pledge payments, so the system does not try.

| Tier | Rule | Review screen |
|---|---|---|
| **2a** | `building_fund`, in window, member matches | **Pre-checked** |
| **2b** | `donation`, in window, member matches | Shown, **unchecked** |
| **3** | `member_id` NULL → resolve by email/phone, then 2a/2b | Always unchecked (19 pledges) |
| **4** | No candidates | Permanently `unreconciled` (~39 members) |

### 4.3 Discrepancy classes

- **A** — marked fulfilled, zero payments found.
- **B** — marked fulfilled, payments found but less than pledged.
- **C** — marked pending, payments found. *These members were receiving
  incorrect SMS payment reminders.*
- **D** — marked pending, nothing found. Consistent.
- **E** — payments exceed pledged.
- **F** — no `member_id`, no contact match. Structurally unreconcilable.

Output: CSV plus an on-screen table — pledge, member, pledged, `legacy_status`,
matched transactions, matched sum, tier, class.

### 4.4 Outcome

Roughly 83 of 148 pledges reconcile, ~19 need contact resolution, and **~40
remain permanently unreconciled**. That is not a migration defect — it is the
true information content of a binary flag. Unreconciled pledges display
pledged amount + `legacy_status` + an "unreconciled" badge, never a fabricated
paid figure.

Payments are per-member while allocations are per-pledge, so the 6
duplicate-pledge members require a manual split in the review screen.

**Out of scope:** `members.yearly_pledge` is membership dues feeding
`DuesPage`, not the pledge drive. Untouched, and kept visually distinct.

`down` for steps 1–4 drops the new tables and renames `legacy_status` back.

---

## 5. 2026 design

### 5.1 Campaign

`2026-pledge-drive`, `default_payment_type = 'pledge_drive'`, its own
`income_categories` row and GL code.

**A new `pledge_drive` payment_type is added** — campaign-agnostic, not
per-year. Campaign identity lives in `pledge_campaigns`; the type only marks
drive money. Without it, a future treasurer repeats the `building_fund`-vs-
`donation` archaeology documented in §4.2.

**`payment_type` is a default and a reporting label, never an allocation
requirement.** A treasurer must be able to allocate a payment of any type to a
pledge, or scenarios 3 and 4 break. The allocation layer is type-agnostic.

### 5.2 Payment scenarios

**S1 — Member pays toward their pledge (Stripe).** Portal → amount prefilled
with `remaining_amount`, editable → existing `create-payment-intent` with
metadata `{ memberId, campaignId, pledgeId, purpose: 'pledge_drive' }`.
`handlePaymentSucceeded` upserts the transaction as today, then calls
`autoAllocateFromStripe()`. Guards: pledge `active`, campaign `active`, and
`pledge.member_id` matches the transaction's member **or shares a `family_id`**.
Any guard failing means no allocation and a treasurer flag — never a guess.

Overpayment allocates in full rather than capping. Paying more than pledged is
generosity, not an error: `remaining_amount` goes negative, the member sees
"Fully paid", the treasurer gets an overpaid badge. Capping would add a second
code path and confuse the donor.

**S2 — Multiple partial payments.** Nothing to build. N rows, the view sums.

**S3 — Treasurer records offline cash/check.** New
`POST /api/pledges/:id/payments` creates the transaction *and* the allocation
in one DB transaction, so a payment cannot exist with a failed allocation.
Requires extracting `createTransactionRecord()` from `transactionController`
(1441 lines) so receipt validation, GL mapping, and ledger-entry creation are
not duplicated and cannot diverge.

**S4 — Payment with no pledge selected.** It stays unallocated — that is the
design, not a failure. The **Unallocated Payments** queue lists succeeded
transactions in the campaign window where `SUM(allocations) < amount`,
defaulted to `payment_type='pledge_drive'` with a show-all toggle. The queue
*suggests* the member's pledge (deterministic, per the unique index) but
requires a click. Partial allocation lives here: a $500 gift that is $300 dues
and $200 pledge gets a $200 allocation, and the $300 correctly stays
unallocated.

**S5 — Stripe auto-reconciliation.** S1 plus §6.

**S6 — No cross-campaign contamination.** Five layers:

| Layer | Guarantee |
|---|---|
| Partial unique index | member + campaign → exactly one pledge |
| Stripe metadata | Explicit `pledgeId`, never inferred |
| `requireOpenCampaign` | Closed campaigns reject all writes |
| Member/household check | Cross-member allocation needs an explicit reason |
| No-metadata default | No `pledgeId` → no allocation |

**S7 — Edge cases.**

| Case | Handling |
|---|---|
| Duplicate webhook | Two DB-enforced layers: `transactions.external_id` UNIQUE (exists) and `pledge_allocations.idempotency_key` UNIQUE. Not app logic. |
| Failed payment | Status `failed`; the view's `succeeded`-only filter drops it. |
| **Refund** | New `charge.refunded` handler. Always insert a reversing allocation (`source='stripe_refund'`, key `refund:<charge_id>:<pledge_id>`). On a *full* refund additionally set the transaction to `refunded`. Partials net correctly (+200 −50 = 150); full refunds zero out via both paths, harmlessly. |
| Dispute | `charge.dispute.created` → flag and notify. **No auto-reversal** — disputes get won, and reversing early corrupts the balance twice. |
| Deleting an allocated transaction | Blocked by `ON DELETE RESTRICT`; needs a friendly 409. |
| Out-of-order refund | No allocation to reverse → no-op. Idempotent. |
| Non-USD | Rejected against `campaign.currency`. |

---

## 6. Stripe / webhook reconciliation

One insertion point in `handlePaymentSucceeded`, after the transaction upsert:

```js
try   { await pledgeAllocations.autoAllocateFromStripe(txn, md); }
catch (e) { logAndFlagForTreasurer(e, txn); }   // never rethrow
```

The try/catch is load-bearing: an allocation failure must not 500 the webhook.
Stripe would retry, and the transaction is already correct — a retry storm over
an allocation hiccup is worse than an unallocated payment in a queue.

Because `handlePaymentSucceeded` is already called from **both** the webhook and
`confirmPayment`, both paths get allocation with no extra code, and the
idempotency key handles the race between them — the same reasoning the existing
`external_id` comment relies on.

New event cases: `charge.refunded`, `charge.dispute.created`.

---

## 7. Member and treasurer UX

### 7.1 Member — `/my-pledge`

Mirrors `DuesPage.tsx`, already the mobile-first financial page:

- `bg-primary-600` header banner; the year-pill selector repurposed as a
  campaign selector (2026 / 2025).
- `grid-cols-2 md:grid-cols-4` stat cards with `border-l-4` accents —
  **Pledged**, **Paid**, **Remaining**, **% Fulfilled**.
- Progress bar (liftable from `PledgeTracker`).
- Payment history: date, amount, method, receipt number.
- CTA: **Pay toward my pledge**, prefilled with `remaining_amount`.

`tabs.ts` gains `/my-pledge` in the `give` tab's `matches`.

**Honesty requirements:**

1. Viewing **2025** shows a "Historical — read only" badge, no payment CTA, and
   for unreconciled pledges the Paid card reads **"Payment records unavailable
   for this drive"**, *not* `$0.00`.
2. Household roll-up is display-level: members sharing a `family_id` see a
   "Household total" line. No schema involvement.

**Receipts** reuse `statementController`'s existing annual PDF, with
`receipt_number` shown inline per payment. Per-payment PDFs are deferred.

### 7.2 Treasurer — one new tab

`TreasurerDashboard.tsx` gains one `primaryTabs` entry (`pledges`,
`fas fa-hand-holding-heart`), with per-tab lazy fetching as the existing tabs do.

| Panel | Built from |
|---|---|
| ① Campaign overview | `campaign_totals`; `PaymentStats` card idiom |
| ② All pledges | Member, household, pledged, paid, remaining, %, status, last payment. Search/filter via `MemberSearch`. Filtering to *not fulfilled* **is** the outstanding-pledges view. |
| ③ Unallocated payments | Mirrors `ZelleReview.tsx`, the established review-queue component |
| ④ Reconciliation (2025) | The one-time §4 screen; disappears when the campaign closes |

**Offline payments** extend the existing `AddPaymentModal.tsx` with one optional
"Apply to pledge" selector — not a second payment modal, which would drift.

**Corrections:** each payment row gets `Reallocate`. The modal **requires a
reason**, then posts reversal + replacement atomically. The audit trail renders
directly from the allocation rows.

### 7.3 Forced fix

`sendPendingPledges` queries `status='pending'` and breaks on the rename — as it
should, since it is the code that texted reminders to people who had already
paid. Repointed at `pledge_balances.derived_status`. **No pledge SMS should be
sent until reconciliation is reviewed.**

### 7.4 Bilingual

All strings via `t()` into `dictionaries.ts` (`en` + `ti`). Campaign names come
from the DB (`name` / `name_ti`), so the drive is translatable without a code
change. New `ti` strings are flagged for native-speaker review.

---

## 8. API surface and migrations

### 8.1 Migrations

| # | File | Does |
|---|---|---|
| 1 | `create-pledge-campaigns` | Table + seeds 2025 and 2026 as `draft` |
| 2 | `add-campaign-to-pledges` | `campaign_id`, `is_historical`, `lifecycle`, rename `status`→`legacy_status`, indexes, partial unique index, `CHECK (amount > 0)` |
| 3 | `create-pledge-allocations` | Table, FKs, CHECKs, unique `idempotency_key`, append-only trigger |
| 4 | `create-pledge-views` | `pledge_balances`, `campaign_totals` (`security_invoker = true`) |
| 5 | `add-pledge-drive-payment-type` | `enum_transactions_payment_type` + `enum_ledger_entries_type` + income category row |
| 6 | `add-refunded-transaction-status` | `enum_transactions_status` |
| 7 | `enable-rls-pledge-tables` | RLS on `pledges`, `pledge_campaigns`, `pledge_allocations` |

**Gotchas:**

- `ALTER TYPE … ADD VALUE` **cannot be used in the transaction that adds it**.
  Migration 5 must not wrap in a transaction, and the `income_categories` row
  referencing `'pledge_drive'` must follow in a separate statement. The tigray
  migration already avoids the wrapper — same shape.
- Views must run on SQLite (see §3.4 portability constraints).
- Migration 2 is **order-sensitive**: `is_historical` must be set on the 148
  existing rows *before* the partial unique index is created, or it fails on the
  6 duplicate members.
- The append-only trigger is Postgres-only, returning early on other dialects.
  Tests then rely on the service layer never issuing UPDATE/DELETE — which is
  what the tests should assert anyway.
- `down` for 5 and 6 does not remove enum values, per existing precedent.

### 8.2 Endpoints

Role groups reused verbatim from `transactionRoutes.js`. No new role vocabulary.

**`/api/pledge-campaigns`**

| Method | Path | Access |
|---|---|---|
| GET | `/active` | **public** — powers the visitor pledge form |
| GET | `/` | viewRoles |
| GET | `/:id/totals` | viewRoles |
| POST | `/` | admin |
| PATCH | `/:id` | admin — `draft → active → closed` |

**`/api/pledges`**

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/` | **public**, rate-limited | `requireOpenCampaign`; defaults to active campaign |
| GET | `/mine` | authed member | Powers `/my-pledge` |
| GET | `/` | viewRoles | Filters: campaign, derived_status, member, search |
| GET | `/:id` | viewRoles **or owner** | |
| PATCH | `/:id` | editRoles | `requireOpenCampaign`; logs to `activity_logs` |
| GET | `/stats` | public (aggregate) / viewRoles (`?detail=true`) | Reimplemented on views |

**Allocations**

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/pledges/:id/allocations` | editRoles | Allocate an existing transaction |
| POST | `/api/pledges/:id/payments` | editRoles | Transaction + allocation, atomic |
| GET | `/api/pledges/:id/allocations` | viewRoles or owner | Audit trail |
| POST | `/api/pledge-allocations/:id/reverse` | editRoles | `reason` required |
| GET | `/api/pledge-allocations/unallocated` | viewRoles | Treasurer queue |

**Reconciliation** — `GET` / `POST /api/pledge-campaigns/:id/reconciliation[/apply]`, admin only.

**Stripe** — no new endpoint; `create-payment-intent` accepts and validates
`campaignId` / `pledgeId` in metadata.

### 8.3 Code structure

Two new services keep controllers thin:

- **`services/pledgeAllocationService.js`** — `allocate()`, `reverse()`,
  `autoAllocateFromStripe()`, `handleRefund()`. All row-locking and idempotency
  lives here, called from both controller and webhook, so there is exactly one
  implementation of "money moves onto a pledge".
- **`services/transactionService.js`** — `createTransactionRecord()`, extracted
  from `transactionController.js:189`.

New models: `PledgeCampaign`, `PledgeAllocation`, and read-only view models
`PledgeBalance`, `CampaignTotal`.

### 8.4 Existing files touched

| File | Change |
|---|---|
| `routes/pledgeRoutes.js` | Auth (Phase 0) + all new routes |
| `controllers/pledgeController.js` | Stats read the views; `updatePledge` loses its fulfillment path |
| `controllers/donationController.js` | `autoAllocateFromStripe()`; `charge.refunded`, `charge.dispute.created`; **add `pledge_drive` to the `allowedTypes` array** in `handlePaymentSucceeded`, or drive payments silently fall back to `donation` |
| `controllers/smsController.js` | `status='pending'` → `derived_status` |
| `controllers/transactionController.js` | Extract create logic; 409 on deleting an allocated transaction |
| `models/index.js`, `server.js` | Register models; mount two new route files |
| `frontend/src/components/PledgeForm.tsx` | Send `campaign_id` from `GET /api/pledge-campaigns/active`; retire the free-text `event_name` field |

Frontend: new `MyPledgePage`, `PledgesTab` (+ four panels),
`AllocatePaymentModal`, `ReallocateModal`; edits to `TreasurerDashboard`,
`AddPaymentModal`, `tabs.ts`, `dictionaries.ts`.

---

## 9. Security

**RLS.** `pledges` currently has none, unlike the other sensitive tables, so it
is auto-exposed via PostgREST with names, emails, phones, and addresses for 148
people. Migration 7 covers it alongside the two new tables.

**Views bypass RLS by default** in PG 15 (they run as owner). Both views get
`WITH (security_invoker = true)` so RLS applies through them.

**Authorization**

| Surface | Rule |
|---|---|
| `GET /api/pledges/:id` | viewRoles **or** `pledge.member_id === req.user.id` — explicit owner check, tested per route |
| `GET /api/pledges/stats` (public) | Aggregates only; never names, emails, or per-pledge rows |
| Write routes | `firebaseAuthMiddleware` → `roleMiddleware(editRoles)` → `requireOpenCampaign` |
| Campaign status | admin only |

**Public form abuse.** Unauthenticated by design (visitors pledge at events).
Proportionate mitigation: a tighter per-IP rate limit than the global `/api/`
limiter, a max-amount validation, and treasurer ability to cancel. Deliberately
**no** moderation state — the hole exists today unexploited, and a
pending-review lifecycle would complicate every query for a hypothetical.

**Financial integrity** = append-only trigger + `ON DELETE RESTRICT` +
row-locked over-allocation check. Together these are what allow the claim that
no legitimate operation requires direct DB modification.

**Audit.** Allocations self-audit. `activity_logs` covers pledge edits and
campaign status transitions.

No new secrets.

---

## 10. Testing

TDD. Backend on `sqlite::memory:`, frontend RTL. **All fixtures synthetic** —
CLAUDE.md forbids real member data in tests, and this is exactly the feature
where someone would be tempted to paste a production row.

| Layer | Pins down |
|---|---|
| **View correctness** (unit) | $5,000 + $1,000 + $1,500 → 2500 / 2500 / 50% / `partially_fulfilled`. Then zero, exact, overpaid, reversal netting, `failed` excluded, `refunded` excluded, cancelled. |
| **Allocation service** (unit) | Over-allocation rejected; closed campaign rejected; member mismatch rejected without reason; duplicate idempotency key no-ops; reversal requires negative amount + reason. |
| **Webhook** (integration) | Duplicate success → one transaction, one allocation. Refund → reversal. Refund-first → no-op. **Allocation failure still returns 200.** |
| **Read-only** (integration) | Parametrized over every write route × 2025 → 409. |
| **Authorization** (integration) | Parametrized: unauthenticated → 401, wrong role → 403, cross-member → 403. This suite would have caught the Phase 0 bug. |
| **Migration** | Up-then-down on a synthetic 148-row fixture including 6 duplicate members; zero data loss; index builds. |
| **Reconciliation** | Known 2a / 2b / no-match fixtures → classes A–F land correctly. |
| **Frontend** (RTL) | The four figures render; 2025 shows "records unavailable", not `$0.00`; allocate flow works. |

---

## 11. Phased plan

| Phase | Scope | Ships independently? |
|---|---|---|
| **0** | Auth on pledge routes, stats split, admin URL fix, **RLS on `pledges`** | Yes — live exposure |
| **1** | Migrations 1–7, models, view tests. No behavior change | Yes — dormant |
| **2** | `pledgeAllocationService`, `transactionService` extraction, allocation endpoints | Yes — backend only |
| **3** | Reconciliation report + review screen → treasurer applies → **flip 2025 to `closed`** | Gated on treasurer sign-off |
| **4** | Activate 2026, `MyPledgePage`, Stripe metadata + auto-allocation, refund/dispute | Yes |
| **5** | Treasurer pledges tab: overview, list, unallocated queue, reallocate | Yes |
| **6** | Repoint `smsController`, retire `PledgeManagement.tsx`, `PledgeTracker` on views, Tigrigna review | Yes |

**The ordering is deliberate: 2025 freezes in Phase 3 before 2026 goes live in
Phase 4.** There is never a window where both campaigns accept writes, so a
payment cannot land on the wrong drive during cutover.

Phase 1 migrations are rehearsed on a database copy first, following the
`db-migrations` skill for the production procedure.

---

## 12. Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Allocation join table, not `transactions.pledge_id` | A single FK cannot split a payment across pledges and leaves no correction trail |
| 2 | Campaign flag, not a `pledges_v2` table | Same isolation, no duplicated model or unioned queries |
| 3 | Individual ownership, household roll-up via `family_id` | No new table; spouses can pledge separately |
| 4 | App-layer read-only via `campaign.status` | Reversible by an admin if a data error surfaces; trigger is the second layer |
| 5 | Public pledge form retained for 2026 | Visitors pledge at events |
| 6 | Rename `status` → `legacy_status` | Leaving it named `status` is how this bug returns |
| 7 | One active pledge per member per campaign | Makes payment targeting deterministic |
| 8 | `is_historical` column added | Required: 6 members have duplicate 2025 pledges |
| 9 | Add `pledge_drive` payment_type | Ends the `building_fund`-vs-`donation` ambiguity permanently |
| 10 | Add `refunded` transaction status | Semantically distinct from `canceled`; keeps the view filter honest |
| 11 | Tier 1 dropped; no auto-apply in migration | `donation_id` is populated on zero rows |
| 12 | ~40 pledges stay unreconciled | The true information content of a binary flag; the UI says so |
| 13 | Receipts reuse the annual statement PDF | Per-payment PDFs are new work for marginal benefit; deferrable |
| 14 | Overpayment allocates in full | Generosity, not an error; capping adds a code path and confuses donors |
| 15 | No auto-reversal on disputes | Disputes get won; early reversal corrupts the balance twice |

## 13. Open items

- **Tigrigna translations** for campaign names and all new UI strings need
  native-speaker review before launch (per `tigrigna-translation-review.md`).
- **Communications hold:** no pledge SMS until §4 reconciliation is reviewed.
- **2026 goal amount** not yet chosen; needed before the campaign is activated.
- **Per-payment receipt PDFs** deferred; revisit if members ask.
