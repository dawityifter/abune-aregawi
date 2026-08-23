# Pledge Intent & Anonymous Giving — Design

**Date:** 2026-08-23
**Status:** Approved for planning
**Builds on:** `2026-08-20-pledge-modernization-design.md`,
`2026-08-22-fundraising-campaigns-design.md`,
`2026-08-22-pledge-payment-allocation-design.md`

## 1. Goal

Make the choice between *promising* money and *giving* money explicit, and make
both completable in one sitting.

Today a pledge and its fulfillment are two unconnected acts separated by a page
navigation, a sign-in, and a checkbox. A member who arrives at `/pledge` ready
to give cannot give. And "anonymous" is not a thing a donor can choose — it is
an accident of who is looking at the report.

Two requirements drive this design:

1. The pledge page must ask, explicitly, whether the person is pledging for
   later or pledging and paying now.
2. A pledge for future fulfillment may never be anonymous. Anonymity is
   available only when the money arrives with the pledge — and even then the
   church retains an internal identifier for reconciliation.

## 2. What exists today

### 2.1 The workflow

| Step | Where | Behaviour |
|---|---|---|
| Pledge | `PledgePage` → `PledgeForm` → `POST /api/pledges` | **Public, unauthenticated.** Writes a `pledges` row bound to the live campaign. Links a member by exact email or phone match. |
| Confirmation | `PledgePage` success panel | Claims "You will receive a confirmation email shortly with payment instructions." **No such email exists** — `emailService` exports only `sendEmail` and nothing calls it for pledges. |
| Payment | `DonatePage` | A later, separate visit. A signed-in member ticks "Apply to my pledge", which sets the Stripe purpose to `pledge_drive`. |
| Fulfillment | `pledgeAllocationService.maybeAllocateToPledge` | Succeeded + `pledge_drive` + `member_id` + live campaign + active pledge → one `pledge_allocations` row. |
| Reporting | `pledge_balances`, `campaign_totals` views | Fulfillment is derived from allocations, never stored. |

### 2.2 The data model

- `pledge_campaigns` — at most one live campaign (`findLiveCampaign`).
- `pledges` — `member_id` **nullable**, a contact snapshot (name / email / phone
  / address / zip), `lifecycle` (`active` | `cancelled`), `is_historical`, and
  a frozen `legacy_status` for the 2025 drive. Partial unique index
  `pledges_one_active_per_member_per_campaign` covers one active pledge per
  member per campaign, **only where `member_id IS NOT NULL`**.
- `pledge_allocations` — append-only. Corrections are negative reversing rows
  with a mandatory reason; a Postgres trigger blocks UPDATE and DELETE.
- `transactions` — `member_id` nullable, `donor_name`, and an
  `[Anonymous Donor]` block prepended to `note` by `utils/donorNote.js`, which
  `TransactionList.parseDonorInfo` reads back.
- `members.baptism_name` already exists.

### 2.3 What the treasurer already has

Verified present and working; none of it is rebuilt here:

- `POST /api/pledges/:id/payments` (`createPledgePayment`) creates a transaction
  **and** its allocation inside one DB transaction, with receipt-number
  validation and GL mapping, and deliberately opts out of automatic allocation
  so the payment lands on the pledge named in the URL rather than an inferred one.
- `AddPaymentModal` has an "Anonymous / Non-Member Payment" toggle with
  `donor_type` and `donor_name`, offers the `pledge_drive` payment type, and
  shows a selected member's pledge balance inline.
- `POST /api/pledges/:id/allocations`, `reverse()`, and
  `GET /api/pledge-allocations/unallocated` all exist.

## 3. Flaws this design fixes

1. **No fulfillment path from the pledge page.** The page advertises "Pay when
   you're ready." The only route to paying requires being a registered member,
   returning later, finding `/donate`, and ticking a checkbox.

2. **`member_id` is the hinge everything hangs on, and it is set by a guess.**
   It is populated only when the pledge form's email or phone exactly matches an
   existing member. When it is null: automatic allocation never fires,
   `GET /api/pledges/balance` returns nothing, the Donate "apply to my pledge"
   option never appears, the Dues banner never shows, and a treasurer can credit
   the pledge only by overriding a `MEMBER_MISMATCH` error with a written
   reason. No backfill exists when that person later registers.

3. **An admin's explicit member selection is silently discarded.**
   `PledgeForm` sends `member_id` from its admin member picker, but
   `pledgeController.createPledge` never reads it — it re-derives the member from
   email and phone. The picker is decorative.

4. **Every pledge is already anonymous, in the worst sense.**
   `POST /api/pledges` is public and unverified, so anyone can pledge under any
   name. Meanwhile donor-chosen anonymity does not exist: `PledgeTracker` shows
   "Anonymous" based on the *viewer's* role, not the giver's wish.

5. **Anonymous online money never reaches the books.**
   `donationController.handlePaymentSucceeded` returns early when no member
   resolves, before creating the `Transaction`. No transaction means no
   `LedgerEntry` and no GL coding. A `Donation` row is written and the money sits
   in Stripe, invisible to the ledger. This affects every non-member online gift,
   not just pledge ones.

6. **Non-member pledges can be duplicated freely** — the uniqueness index
   excludes null `member_id`.

7. **Nothing creates a pledge and a payment together.** An anonymous
   `pledge_drive` payment recorded by a treasurer produces drive income with no
   pledge row, so the gift is absent from `total_pledged`, `pledge_count`, and
   `CampaignDonors`.

8. `pledge_type` (`general` / `event` / `fundraising` / `tithe`) is vestigial now
   that campaigns exist; the form hardcodes `'fundraising'` behind a
   `// Temporarily` comment. Left alone here, noted in §12.

## 4. Decisions

| # | Decision |
|---|---|
| D1 | Pledging for later **requires a signed-in member**. `member_id` comes from the Firebase token, never from an email or phone guess. |
| D2 | Anonymity is available to **both** a signed-in member (display-only) and a walk-up giver with no account. |
| D3 | A walk-up anonymous giver's identity lives **on the pledge and the transaction only**. No member row, no new identity table. `members` keeps meaning "registered parishioner". |
| D4 | "Pay now" always means **pay in full**. Anyone wanting to split chooses "pledge for later" and pays in installments. |
| D5 | **Payment-first ordering.** No pledge row exists until money succeeds. |
| D6 | The false confirmation-email promise is **removed** from the pledge page. No email is sent. |
| D7 | `transactions.collected_by` becomes **nullable**, fixing flaw 5 for all donations rather than only pledge ones. |

### 4.1 Why payment-first (D5)

The alternative — write the pledge, then take payment, then allocate on the
webhook — matches the existing code shape but has two failure modes. An
abandoned checkout leaves an orphan pledge inflating `total_pledged`, and for
the anonymous case it creates precisely the record this design forbids: an
unpaid anonymous pledge.

Payment-first carries the intent (amount, anonymity, baptism name) in Stripe
metadata, and `handlePaymentSucceeded` creates the transaction, the pledge, and
the allocation inside one DB transaction. Campaign totals can never be inflated
by abandoned checkouts, and the "anonymous implies paid" rule holds by
construction rather than by a cleanup job. `handlePaymentSucceeded` already runs
from `confirmPayment` as well as from the webhook, so the user-visible latency
is small.

Stripe metadata is chosen over a staging table because the payload is about
seven keys — well inside Stripe's 50-key, 500-character-per-value limits — and
because `memberId`, `purpose`, and `firebaseUid` already travel that way. A
staging table is the fallback if the payload grows.

### 4.2 Why `collected_by` becomes nullable (D7)

Deleting the early return in `handlePaymentSucceeded` is not sufficient.
`transactions.collected_by` is `allowNull: false` with an FK to `members`, and
the webhook currently sets it to `memberId`. With no member there is no value to
write and the insert fails.

**This blocker is unavoidable for the pledge feature regardless of scope** — an
anonymous pledge payment creates a transaction with `member_id IS NULL` and hits
the identical wall. Since the hard part is shared, covering all donations costs
little more than letting one code path run instead of returning early.

Nullable is also the semantically correct answer: nobody collected an online
self-service gift. The codebase already set this precedent —
`ledger_entries.collected_by` is `allowNull: true, // Can be null for
system-generated entries`, and `ledger_entries.donor_name` exists for non-member
income.

Rejected alternative: a designated "Online Giving" system member. It pollutes
`members` in exactly the way D3 avoids, and it falsely attributes collection to
a person.

Verified before choosing: no `as: 'collector'` include anywhere sets
`required: true`, and the frontend already types `collector?` as optional.

## 5. UX flows

### 5.1 The intent chooser

`/pledge` presents an explicit choice rather than a single form.

**Signed out** — campaign hero, progress tracker, and two calls to action:
*Sign in to pledge* and *Give anonymously now*.

**Signed in, no active pledge in this campaign** — a three-way chooser:
*Pledge for later*, *Pledge and pay now*, *Give anonymously now*.

**Signed in, already holding an active `later` pledge in this campaign** — the
page does **not** offer a new pledge. It shows the balance and a *Pay now* call
to action.

That last rule is load-bearing. Without it a returning member creates a second
pledge and the campaign double-counts the promise. It also fixes the
discoverability half of flaw 1 for everyone who pledged before this change.

### 5.2 Flow 1 — Pledge now, fulfill later

Sign-in required. Amount plus an optional note →
`POST /api/pledges` with `fulfillment_intent: 'later'`. `member_id` is resolved
from the token. Fulfillment happens afterwards through `/donate`'s existing
"apply to my pledge" option or a treasurer-recorded payment, in one payment or
several.

### 5.3 Flow 2 — Pledge and fulfill immediately

Sign-in required, paid in full (D4). Amount → Stripe card or ACH inline on the
same page. On success the server creates pledge (`fulfillment_intent:
'immediate'`), transaction, and allocation atomically. The member lands on a
receipt showing a fully fulfilled pledge.

A signed-in member may additionally tick "show as anonymous". `member_id` is
still set, so the church knows exactly who it is; only the anonymity flag
changes what is displayed.

### 5.4 Flow 3 — Anonymous contribution

Available signed out, always pledge plus payment in full. Requires a
**baptism / church name** and one contact detail (phone or email), plus an
explicit acknowledgement that the gift will be displayed as anonymous. The same
atomic write runs with `member_id = NULL` and `is_anonymous = true`.

The contact detail is a **form-level** requirement, deliberately stricter than
the database CHECK of §6.1, which demands only a baptism name. The constraint
guards the invariant that matters for reconciliation; the form asks for more
because a reachable donor is worth having. Keeping the stricter rule out of the
schema means the treasurer path (§5.5) can still record a gift from someone who
left no contact detail at all.

### 5.5 Flow 4 — Treasurer records an anonymous pledge at an event

Extends what already exists rather than replacing it. In `AddPaymentModal`, when
`payment_type = 'pledge_drive'` and the payment is not landing on an existing
pledge, offer "also record this as a pledge". When the anonymous toggle is on,
label the donor-name field as the baptism / church name.

This path also makes an anonymous *member* pledge possible: the treasurer can
select a member and still mark the gift anonymous.

D4 applies here too: when the pledge being created is anonymous, the payment
amount must equal the pledge amount. The endpoint rejects a partial payment
against a new anonymous pledge, because the alternative is an anonymous pledge
carrying an outstanding balance — the state §1 forbids. A partial payment
against a *named* new pledge is allowed and simply leaves a balance.

## 6. Schema changes

### 6.1 `pledges` — three columns

All defaulted, so every existing row is correct without a backfill script.

| Column | Type | Meaning |
|---|---|---|
| `fulfillment_intent` | `VARCHAR(16) NOT NULL DEFAULT 'later'` | `'later'` or `'immediate'`. The recorded choice, **not** a fulfillment state. |
| `is_anonymous` | `BOOLEAN NOT NULL DEFAULT false` | The donor's recorded wish. |
| `baptism_name` | `VARCHAR(255) NULL` | Internal identifier for an anonymous giver with no account. |

`fulfillment_intent` is stored rather than derived. It could almost be inferred
from whether an allocation exists at creation time, but that inference is
fragile and it is a recorded human choice — exactly the kind of thing that
should not be re-derived later.

Two CHECK constraints, both trivially satisfied by every existing row:

```sql
CHECK (is_anonymous = false OR fulfillment_intent = 'immediate')
CHECK (is_anonymous = false OR member_id IS NOT NULL OR baptism_name IS NOT NULL)
```

The first is the "no anonymous pledge for later" rule. The second guarantees
that an anonymous gift is always internally identifiable — by member link or by
baptism name.

Both are mirrored as model-level `validate` blocks so the SQLite test suite
enforces them too.

### 6.2 The index change

`pledges_one_active_per_member_per_campaign` exists so `maybeAllocateToPledge`
can choose a target deterministically. A fully paid immediate pledge must never
be an allocation target, and a member must be able to give again. The index
narrows by one clause:

```
WHERE member_id IS NOT NULL
  AND lifecycle = 'active'
  AND is_historical = false
  AND fulfillment_intent = 'later'      -- new
```

Narrowing a partial index's `WHERE` can only remove rows from it, so the
migration cannot fail on existing data.

Consequence: a member may now hold one outstanding `later` pledge plus any
number of paid `immediate` gifts. Every query that relied on "exactly one
pledge" must add the same `fulfillment_intent = 'later'` filter — see §7.

### 6.3 `transactions.collected_by` becomes nullable

Per D7. One `changeColumn` to `allowNull: true`. The FK, its `onDelete:
RESTRICT`, and the existing index are unchanged.

### 6.4 What does not change

`pledge_allocations`, `pledge_balances`, and `campaign_totals` are untouched. No
view is rewritten, `legacy_status` is not read or written, and the 2025 drive is
not exposed to any of this.

## 7. Backend changes

1. **Migration** `add-pledge-intent-and-anonymity` — the three columns, both
   CHECK constraints, and the index swap. Reversible.

2. **Migration** `make-transaction-collected-by-nullable` — §6.3.

3. **`Pledge` model** — new fields plus `validate` blocks mirroring both CHECKs.

4. **`POST /api/pledges`** — now behind `firebaseAuthMiddleware`. Resolves
   `member_id` from the token and drops the email/phone guessing entirely.
   Accepts `fulfillment_intent: 'later'` only, and rejects `is_anonymous`.
   Privileged callers (`admin`, `treasurer`) may pass an explicit `member_id` to
   pledge on someone's behalf — which is flaw 3's fix, and the first time that
   parameter has ever been honored.

5. **Pledge-intent validation guard inside `createPaymentIntent`** — when the
   incoming `metadata.purpose === 'pledge_drive'` and
   `metadata.pledgeIntent === 'immediate'`, validate the live campaign, the
   amount, and, when anonymous, the baptism name, and reject with 400 **before**
   any Stripe call. The intent then carries
   `{ purpose: 'pledge_drive', campaignId, pledgeIntent: 'immediate', isAnonymous, baptismName, donorName, donorPhone, memberId? }`
   through the existing `...metadata` passthrough.

   A separate `POST /api/pledges/checkout-intent` was considered and rejected:
   it would duplicate Stripe intent creation and skip the `Donation` row that
   `handlePaymentSucceeded` looks up, for no gain. Guarding the one existing
   path keeps a single place where payment intents are born, and validation
   still happens before money moves.

6. **`donationController.handlePaymentSucceeded`** —
   - wrap the transaction upsert in `sequelize.transaction`;
   - remove the `if (!memberId) return;` early return, writing `member_id: null`,
     `collected_by: null`, `donor_name`, and `buildDonorNote(...)` for the
     non-member case, and a `LedgerEntry` with `member_id: null`;
   - when `md.pledgeIntent === 'immediate'`, create the pledge and its
     allocation in the same DB transaction.

   Wrapping all three writes in one DB transaction is what makes the flow
   crash-safe. The handler currently early-returns when a transaction with the
   same `external_id` already exists; without the wrapper, a crash between
   creating the transaction and creating the pledge would leave a paid pledge
   that no retry could ever create.

7. **`pledgeFulfillmentService.createPledgeWithPayment()`** (new) — the single
   place a pledge and its allocation are born together, shared by the webhook
   and the treasurer endpoint. It calls the existing `allocate()` with
   `source: 'stripe_auto'` (or `'treasurer_manual'`) and
   `reason: 'Pledge created and paid in one transaction'`. That reason satisfies
   `MEMBER_MISMATCH` for the `member_id IS NULL` case, so **no change is needed
   to the `pledge_allocations.source` CHECK constraint**.

8. **`POST /api/pledges/with-payment`** (new, roles `admin`, `treasurer`,
   `bookkeeper`, `ar_team`) — creates the pledge, then delegates to the existing
   `createPledgePayment` body. No new transaction, allocation, receipt, or GL
   logic. The campaign is resolved via `findLiveCampaign()` because there is no
   pledge id yet.

9. **`maybeAllocateToPledge` and `getPledgeBalance`** — both add
   `fulfillment_intent: 'later'` to their pledge lookup, restoring determinism
   now that a member may hold more than one pledge (§6.2).

10. **`getPledgeStats`** — returns `is_anonymous`, and masks `name` to
    "Anonymous" unless the caller holds `admin` or `treasurer` (§11, A2).

## 8. Frontend changes

`PledgeForm.tsx` is 556 lines and mixes an admin member dropdown into a public
form. It is split rather than extended:

- `PledgeIntentSelector` — the three-way choice of §5.1.
- `PledgeLaterForm` — flow 1. Amount and an optional note only; identity comes
  from the token.
- `PledgeCheckoutForm` — flows 2 **and** 3, embedding the existing
  `StripePayment`. One component rather than two, because the anonymous variant
  differs in exactly two ways: no signed-in member, and a required baptism name.
  Splitting them would duplicate the amount field, the Stripe wiring, and the
  pay-in-full rule for the sake of one conditional block.

`PledgeForm.tsx` is deleted once `PledgePage` stops importing it — it is that
component's only consumer, and it still posts to the old unauthenticated
contract.

`PledgePage` becomes the router between them, including the
already-has-a-pledge state.

Other changes:

- Remove the confirmation-email claim from `PledgePage` and its dictionary
  entries (D6).
- `AddPaymentModal` — the conditional "also record this as a pledge" block of
  §5.5, and the baptism-name relabelling.
- `dataTransformers.ts` — `collectedBy: number` becomes `number | null`, with an
  "Online" fallback wherever a collector name renders.
- `DonatePage` is unchanged. Its "apply to my pledge" option remains the
  installment path for flow 1.
- New i18n keys in `dictionaries.ts` for `en` and `ti`, with Tigrigna drafts
  flagged in `tigrigna-translation-review.md` per the existing convention.

## 9. Existing data and migration

- All three new columns default to the semantically correct value for every
  current row. Every existing pledge **was** a promise to pay
  (`fulfillment_intent = 'later'`), and none was donor-anonymous
  (`is_anonymous = false`). No backfill script is needed or written.
- 2025 rows (`is_historical = true`, frozen `legacy_status`) are not read or
  written by anything in this design.
- The index migration narrows a partial index, which can only remove rows from
  it. No existing row can violate the result.
- Both CHECK constraints are satisfied by `is_anonymous = false` alone, which is
  every existing row.
- **Pledges currently holding `member_id IS NULL`** (walk-ups from today's
  public form) are left exactly as they are and keep behaving as they do now. A
  treasurer "link to member" action on the pledge detail lets them be reconciled
  deliberately. Never auto-guessed.
- Making `POST /api/pledges` auth-required is a breaking API change.
  `PledgeForm` is its only caller, and it is being replaced.
- The `collected_by` migration widens a constraint; no existing row is affected.

**One consequence to state plainly:** fixing flaw 5 starts writing ledger
entries for anonymous online donations that previously vanished. That is the
correct behaviour, but it changes income totals going forward relative to how
the books have read to date. Nothing is created retroactively — past lost
donations stay lost unless separately reconstructed from Stripe.

## 10. Partial fulfillment, multiple payments, reconciliation

Nothing to build. The append-only allocation engine already handles N payments
against one pledge and the view sums them.

Because "pay now" means pay in full (D4), partial fulfillment arises only from
flow 1 paying in installments through `/donate` or a treasurer — paths that
already exist and are unchanged.

Anonymous reconciliation runs through the `[Anonymous Donor]` note block that
the treasurer dashboard already parses, with the baptism name in `donor_name`.

## 11. Assumptions

- **A1.** Anonymous and immediate pledges deliberately sit outside the
  one-pledge-per-member rule. A member may hold one outstanding `later` pledge
  plus any number of paid `immediate` gifts.
- **A2.** An anonymous giver's real identity — baptism name or member link — is
  visible to `admin` and `treasurer` only. The other seven view roles see
  "Anonymous".
- **A3.** Anonymous givers are never auto-linked to an existing member even when
  the phone number matches. That would defeat the purpose.

## 12. Edge cases and business rules

| Case | Handling |
|---|---|
| Member with an active `later` pledge revisits `/pledge` | Shown their balance and a *Pay now* action, never a second pledge form (§5.1). |
| Checkout abandoned mid-payment | Payment-first ordering means no pledge row was ever written. Nothing to clean up. |
| Anonymous giver wants a tax receipt | Email captured optionally and a receipt issued from the transaction. The gift is still **not** attached to any member record or giving statement. |
| Anonymous immediate pledge is refunded | The reversal zeroes the allocation, leaving an anonymous pledge with $0 paid. The CHECK is on *intent*, so nothing breaks; the treasurer should cancel the pledge. Documented rule, not enforced code. |
| Campaign closes between page load and payment | The money is already taken. `campaignId` is pinned in the Stripe metadata and honored at webhook time with a warning log, rather than dropping the allocation. |
| Duplicate submission | `transactions.external_id` UNIQUE plus pledge creation inside the same DB transaction. |
| Member pays more than pledged | Existing over-fulfilment handling; unchanged. |
| Anonymous cash or Zelle at an event | Flow 4 (§5.5) covers cash and check. Zelle and bank reconciliation still land unallocated — a pre-existing gap, out of scope. |
| `pledge_type` is vestigial | Left as-is. Removing it is a separate cleanup with its own migration. |

## 13. Testing

**Backend**

- Both CHECK constraints reject the states they forbid, at the model layer and
  in Postgres: anonymous plus `later`, and anonymous with neither `member_id`
  nor `baptism_name`.
- `POST /api/pledges` rejects an unauthenticated caller; resolves `member_id`
  from the token; honors an explicit `member_id` for `admin` and `treasurer` and
  ignores it for everyone else; rejects `is_anonymous`.
- `createPledgeWithPayment` writes pledge, transaction, and allocation, and
  `pledge_balances` reports the pledge fully fulfilled.
- The same call with `member_id: null` and a baptism name succeeds — the
  `reason` argument clears `MEMBER_MISMATCH`.
- A simulated failure partway through rolls back all three writes, leaving no
  orphan pledge and no orphan transaction.
- `handlePaymentSucceeded` with no resolvable member creates a transaction with
  `member_id: null`, `collected_by: null`, a `donor_name`, and a ledger entry —
  the regression test for flaw 5.
- `maybeAllocateToPledge` ignores an `immediate` pledge and targets the `later`
  one when a member holds both.
- `getPledgeBalance` returns the `later` pledge when a member holds both.
- The migration applies to a fixture containing 2025 historical rows, 2026 rows,
  and a `member_id IS NULL` row without error, and `pledge_balances` figures are
  byte-identical before and after.

**Frontend**

- The intent chooser offers three options signed in and two signed out.
- A member with an existing `later` pledge sees the balance and *Pay now*, not a
  new pledge form.
- The anonymous form refuses to submit without a baptism name.
- `AddPaymentModal` offers "also record this as a pledge" only for
  `pledge_drive`, and relabels the donor-name field when anonymous.
- A null `collectedBy` renders as "Online" rather than blank or `NaN`.

All fixtures synthetic. No real member names, phone numbers, or amounts.

## 14. Out of scope

- Pledge confirmation and reminder emails. The false claim is removed (D6);
  actually sending mail is separate work.
- Zelle, bank-reconciliation, and Square automatic allocation — each needs a new
  `pledge_allocations.source` value and a migration to widen that CHECK.
- Retroactive reconstruction of anonymous donations lost to flaw 5.
- Removing the vestigial `pledge_type` enum.
- Recurring or scheduled pledge installments.
- A public donor wall.

## 15. Risks

- **`collected_by` nullability has a wide surface.** 47 backend references and
  the frontend transformer. The include sites were checked and none are
  `required: true`, but a missed display path renders blank instead of "Online".
- **Stripe metadata as the intent carrier.** If the payload outgrows Stripe's
  limits, or a field is silently truncated, a pledge is created with wrong data.
  Mitigated by validating every metadata field at webhook time and refusing to
  create a pledge from an incomplete payload — the payment still stands.
- **Anonymity is nearly free today.** There is no public donor wall, and
  `getPledgeStats` already withholds names from unprivileged callers. The flag's
  real effect is narrowing visibility from nine view roles to two, and honoring
  the wish in printed and exported donor lists.
- **Requiring sign-in will reduce pledge volume at events.** That is the
  deliberate cost of D1, chosen so that `member_id` is never a guess.
