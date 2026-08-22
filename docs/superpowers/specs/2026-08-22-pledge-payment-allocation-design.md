# Pledge Payment Allocation — Design

**Date:** 2026-08-22
**Status:** Approved for planning
**Builds on:** `2026-08-20-pledge-modernization-design.md`, `2026-08-22-fundraising-campaigns-design.md`

## 1. Goal

Let a pledge actually get fulfilled. Today a member can make a pledge and the
church can receive their money, but nothing connects the two: `pledge_balances`
credits a pledge only from `pledge_allocations`, and no user-facing flow ever
creates one. Members pay through the app; treasurers record cash and checks;
neither produces an allocation.

Two channels must work:

- **Online** — a member paying through the Donate page.
- **Treasurer** — a staff member recording a payment received in person.

## 2. What already exists

The allocation engine is built and careful. `pledgeAllocationService` provides:

- `allocate({ pledgeId, transactionId, amount, source, allocatedBy, reason, idempotencyKey })`
  — locks the payment row (`LOCK.UPDATE`) so concurrent allocations serialise,
  refuses to allocate more than the payment is worth (`OVER_ALLOCATED`),
  refuses a payment belonging to another member unless given a reason
  (`MEMBER_MISMATCH`), refuses closed campaigns (`CAMPAIGN_CLOSED`), and
  returns the existing row when an `idempotencyKey` repeats.
- `reverse()` — append-only correction: a negative row pointing at the original,
  with a mandatory reason. A Postgres trigger blocks UPDATE/DELETE.
- `listUnallocated()` — succeeded payments with no allocation.

Endpoints exist for `POST /api/pledges/:id/allocations`,
`POST /api/pledges/:id/payments`, `GET /api/pledges/:id/allocations`, and
`GET /api/pledge-allocations/unallocated`.

`pledge_drive` is already a `Transaction.payment_type`, and
`validateAndResolveTransaction` maps payment type to an income category, so GL
coding follows automatically from the type.

**The gap is entirely in what calls this engine.** No screen does.

## 3. The core rule

One server-side rule, keyed on the payment rather than on the screen that
created it:

> When a transaction exists with `payment_type = 'pledge_drive'` and
> `status = 'succeeded'`, and its member has an active pledge in the live
> campaign, allocate the payment to that pledge — idempotent on the
> transaction id.

Keying on payment type rather than on the originating UI is what keeps the
channels from drifting apart: the rule is defined once, and a payment surface
adopts it by setting the right type and making one call (§4).

This is safe to state unambiguously because the schema guarantees the target:
the unique index `pledges_one_active_per_member_per_campaign` permits at most
one active, non-historical pledge per member per campaign, and
`pledgeCampaignService.findLiveCampaign()` yields at most one live campaign.
There is never a question of *which* pledge.

### 3.1 The helper

```js
// pledgeAllocationService.js
async function maybeAllocateToPledge(txn, { source, allocatedBy = null }, { transaction } = {})
```

Returns the allocation, or `null` when the rule does not apply. Applies only
when all hold: `txn.payment_type === 'pledge_drive'`, `txn.status === 'succeeded'`,
`txn.member_id` is set, a live campaign exists, and that member has an active
pledge in it. Allocates the **full** `txn.amount` and passes
`idempotencyKey = "txn:" + txn.id`.

That key is the correctness guarantee for webhook redelivery: Stripe retries,
the second call finds the existing row via the unique index and returns it
rather than double-crediting.

### 3.2 Full amount, including overpayment

A $500 payment against a $300 remaining balance allocates all $500. This is a
deliberate decision: the donor gave $500 to the drive and the record should say
so, rather than splitting one payment across two purposes.

Consequence, which the UI must handle rather than leak: a pledge can exceed
100% and `remaining_amount` can go negative. Display rules in §6.4.

## 4. Where the rule is invoked

There are **five** distinct places a `Transaction` is created. The helper is
shared code, but each path opts in explicitly with one call. This spec wires
two:

| Path | File | This spec | Source |
|---|---|---|---|
| Treasurer payment | `transactionService.createTransactionRecord` | **yes** | `treasurer_manual` |
| Stripe/ACH donation | `donationController` | **yes** | `stripe_auto` |
| Square | `squarePaymentService` | no — follow-up | — |
| Bank reconciliation | `reconciliationService` | no — follow-up | — |
| Zelle | `zelleTransactionService` | no — follow-up | — |

The three deferred paths each need a `source` value that does not yet exist.
`pledge_allocations.source` is constrained both in the model and by a Postgres
CHECK constraint to `('stripe_auto','treasurer_manual','migration','stripe_refund')`,
so covering them requires a migration to widen it. Deferring them keeps this
change free of any schema migration.

`donationController` creates its transaction directly rather than through
`createTransactionRecord`. It stays that way: refactoring live payment code is
a larger, riskier change than adding one call, and the shared helper already
gives us the single definition of the rule.

### 4.1 `allowedTypes` must admit `pledge_drive`

`donationController` maps the Stripe metadata `purpose` onto a payment type
through a whitelist:

```js
const allowedTypes = ['membership_due', 'tithe', 'donation', 'event',
                      'tigray_hunger_fundraiser', 'other'];
const payment_type = allowedTypes.includes(purpose) ? purpose : 'donation';
```

`pledge_drive` is absent, and the fallback is **silent**. Without adding it, a
donation made through the new "apply to my pledge" option would be recorded as
a plain `donation`: the rule would never fire, the money would miss the
campaign's GL code, and nothing would report an error. `pledge_drive` must be
added to this list, and a test must assert that a pledge-purpose donation comes
out typed `pledge_drive` rather than silently downgraded.

## 5. API changes

### 5.1 `GET /api/pledges/balance`

One endpoint serves both the member and the treasurer.

- No `member_id` — returns the authenticated caller's own pledge. Requires
  auth but **no role**: it is the caller's own record. The member is resolved
  from the Firebase token by `phone_number` (E.164), consistent with the rest
  of the app.
- `?member_id=X` — returns that member's pledge. Requires a `viewRoles` role.

Response:

```json
{ "success": true,
  "pledge": { "id": 12, "campaign_id": 2, "campaign_name": "2026 Pledge Drive",
              "pledged_amount": 500, "paid_amount": 200, "remaining_amount": 300 } }
```

`pledge` is `null` when the member has no active pledge in the live campaign,
or when no campaign is live. Amounts come from `pledge_balances`, never from
`legacy_status`.

Splitting this into two endpoints was considered and rejected: both callers
want the identical payload, and one endpoint means one place where the
"which pledge" rule lives.

## 6. Frontend changes

### 6.1 Donate page

`DonatePage` is a public route that already reads `useAuth()`. When the user is
signed in and `GET /api/pledges/balance` returns a pledge, show an option:

> **Apply to my pledge** — $300 of $500 remaining

Ticking it sets the donation purpose so the resulting transaction carries
`payment_type: 'pledge_drive'`. Signed out, or no live pledge, the page is
unchanged — no new empty states for visitors.

### 6.2 Dues page

A banner only: *"You have a pledge — $300 remaining"*, linking to `/donate`.
No payment logic. Dues are `membership_due` with their own GL code, and letting
a dues payment retype itself as `pledge_drive` would make the ledger and the
member's dues record disagree about what they paid.

### 6.3 Treasurer — Add Payment

`transactionPaymentTypes` in `AddPaymentModal` is a hardcoded list that omits
`pledge_drive` entirely, so a treasurer currently cannot record a drive payment
with the correct type at all. Add it:

```
{ value: 'pledge_drive', label: 'Pledge Drive / Fundraising' }
```

When a member is selected, fetch their balance and show it inline near the type
selector — *"Active pledge: $500, $300 remaining"* — so the treasurer can see
what the payment will land on. Selecting `pledge_drive` for a member with no
pledge remains valid: drive income, simply unallocated.

No confirm-or-skip control. The pledge is unambiguous by construction, and
`reverse()` already exists for corrections.

### 6.4 Over-fulfilment display

Wherever progress is shown (`PledgeTracker` goal bar, `FundraisingCampaigns`
rows, `CampaignDonors`):

- Clamp percentage bars at 100%.
- Never render a negative outstanding. Show `$0` plus "over by $200".

## 7. Invariants and error handling

**Recording money always wins.** If `maybeAllocateToPledge` throws, the error is
logged and the payment stands, unallocated. A payment must never be rejected or
rolled back because it could not be linked to a pledge — an unlinked payment is
recoverable, lost money is not.

This gives the two calls different transaction semantics, deliberately:

- **Treasurer path** — called inside the existing transaction, so the
  allocation and the payment commit together. A failure here is caught and
  swallowed after being logged, leaving the payment intact.
- **Webhook path** — same, within `donationController`'s existing transaction.

Errors that cannot occur in these flows, and why: `MEMBER_MISMATCH` (the
transaction's own member resolves the pledge), `OVER_ALLOCATED` (a fresh
transaction has nothing allocated against it yet). `CAMPAIGN_CLOSED` can occur
if a campaign closes between payment initiation and webhook arrival; it is
logged and left unallocated for a human.

## 8. Edge cases

| Case | Behaviour |
|---|---|
| Member pays, no live campaign | No allocation. Donate never offers the option. |
| Member has no pledge | No allocation; payment recorded as drive income. |
| Anonymous / signed-out donation | No `member_id`, so no allocation. |
| Non-member pledger (visitor at an event) | Treasurer records via the donor list; `member_id` is null so the automatic rule does not fire. |
| Webhook redelivered | Idempotency key returns the existing allocation. |
| Payment later refunded | Existing `reverse()` path; out of scope here. |
| Closed (2025) campaign | `requireOpenCampaign` and `allocate()`'s own check both refuse. |

## 9. Testing

**Backend**

- `maybeAllocateToPledge`: allocates on the happy path; returns `null` for each
  precondition (wrong type, not succeeded, no member, no live campaign, no
  pledge); allocates the full amount when it exceeds remaining.
- Idempotency: calling twice for one transaction yields one allocation row.
- Failure isolation: when `allocate()` throws, the transaction still exists and
  is committed.
- `GET /api/pledges/balance`: own pledge without a role; another member's
  pledge refused without `viewRoles` and allowed with it; `null` when no live
  campaign.
- Treasurer path end to end: `createTransactionRecord` with `pledge_drive`
  produces both a transaction and an allocation, and `pledge_balances` reflects it.
- Webhook path: a donation whose purpose is `pledge_drive` is typed
  `pledge_drive` and not silently downgraded to `donation` (§4.1), and produces
  an allocation.

**Frontend**

- Donate: option appears only when signed in with a live pledge; hidden
  otherwise; ticking it sets the pledge purpose.
- Dues: banner appears only with an outstanding balance.
- AddPaymentModal: `pledge_drive` is offered; balance shows for a member with a
  pledge and not for one without.
- Over-fulfilment: 150% of goal renders as a full bar and "over by", never a
  negative number.

All fixtures synthetic — no real member names or amounts.

## 10. Out of scope

- **Unallocated-payments queue UI.** The endpoint exists; the screen is a
  follow-up. Ship the rule first and build the queue against whatever actually
  accumulates.
- Square, bank-reconciliation and Zelle auto-allocation (§4) — each needs a new
  `source` value and a migration to widen the CHECK constraint.
- Refund-driven reversal UI.
- Recurring donations allocating across periods.
- Deleting the dead `PledgeManagement.tsx`.

## 11. Risks

- **Over-fulfilment leaks into totals.** `campaign_totals.total_collected` can
  exceed `total_pledged`. §6.4 covers the surfaces we know about; a missed one
  will show a negative number.
- **Type discipline.** The rule trusts `payment_type`. A treasurer who picks
  `donation` for drive money gets no allocation, and one who picks
  `pledge_drive` for non-drive money creates a wrong one. The inline balance is
  the mitigation.
- **Silent non-allocation.** Because allocation failure is swallowed, a
  systematic breakage would be invisible until someone reads the pledge totals.
  The deferred queue UI is what would surface it; until then, logs are the only
  signal.
