# Pledge Metric Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the pledge-drive aggregates correct and complete enough to build an executive dashboard on — household-based participation, anonymous-aware counts, per-status totals, and one central over-payment rule.

**Architecture:** All changes land in the two SQL views defined in `backend/src/database/pledgeViews.js` (the single source of that SQL, called by both migrations and `tests/setup.js`), plus one new view, their read-only Sequelize models, and one service function for the participation denominator. No table is altered; no data is written. A single migration at the end recreates the views in production.

**Tech Stack:** Node/Express, Sequelize, PostgreSQL (Supabase) in production, sqlite in-memory under Jest, sequelize-cli migrations.

**Spec:** `docs/PLEDGE_DASHBOARD_SPEC.md` — §3 (data constraints), §5 (participation), §7 (fulfillment breakdown), §12 (phasing). This is Plan 1 of 5.

## Global Constraints

- **View SQL must run on both PostgreSQL and SQLite.** Use `SUM(CASE WHEN ... END)`, never `FILTER (WHERE ...)`. Use `LEFT JOIN` + `GROUP BY`, never `LATERAL`. Never use `GREATEST`/`LEAST` (Postgres-only) or 2-argument `MAX`/`MIN` (SQLite-only). Guard every division with `CASE WHEN ... > 0` — Postgres raises on divide-by-zero where SQLite returns NULL silently.
- **All view SQL lives only in `backend/src/database/pledgeViews.js`.** Never inline view SQL in a migration — migrations call `createPledgeViews()`. Tests build their schema with `sequelize.sync()` and never run migrations, so SQL defined only in a migration would not exist under Jest.
- **`pledge_allocations` is append-only.** Never `UPDATE` or `DELETE` it. Not touched by this plan.
- **Never write real member PII or financial rows into tests or fixtures.** Use invented names and phone numbers in the `+1555...` range.
- **Tests use sqlite in memory.** Run with `DATABASE_URL=sqlite::memory: NODE_ENV=test`. Never point local work at a `DATABASE_URL` containing `supabase.com`.
- **A view-backed model must no-op its own `sync()`/`drop()`** — see the comments in `src/models/PledgeBalance.js`. Many test files call `sequelize.sync({force:true})` in their own `beforeAll`, and Sequelize's internal `DROP TABLE` fails against a SQL view on both dialects.
- **Existing columns keep their names and meanings.** `donor_count` and `outstanding` stay exactly as they are; this plan adds alongside them. Changing them would break `FundraisingCampaigns.tsx` and the public `PledgeTracker`, which Plan 3 and Plan 5 migrate deliberately.
- Money columns are `DECIMAL(10,2)` and arrive from Sequelize **as strings**. Always `parseFloat` before comparing in a test.

---

### Task 1: Central over-payment rule in `campaign_totals`

Over-payment already happens in production: a payment can land on a pledge in full even when it overshoots, driving `remaining_amount` negative. Today that is clamped ad hoc in one React file (`FundraisingCampaigns.tsx:232-241`), so every future consumer has to re-invent the rule. Define it once in SQL: `outstanding_positive` (money still owed, never negative) and `overpaid_amount` (the overshoot, as a positive number). `outstanding` is left untouched for existing callers.

**Files:**
- Modify: `backend/src/database/pledgeViews.js:60-76` (the `CAMPAIGN_TOTALS` template)
- Modify: `backend/src/models/CampaignTotal.js:22-33` (add the two fields)
- Test: `backend/tests/unit/campaignTotalsOverpayment.test.js`

**Interfaces:**
- Consumes: nothing — first task.
- Produces: `campaign_totals.outstanding_positive` and `campaign_totals.overpaid_amount`, both `DECIMAL(10,2)`, both `>= 0`, exposed as `CampaignTotal.outstanding_positive` / `CampaignTotal.overpaid_amount`. Later tasks and plans read these instead of clamping `outstanding` themselves.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/campaignTotalsOverpayment.test.js`:

```js
const {
  CampaignTotal, PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize
} = require('../../src/models');

describe('campaign_totals over-payment columns', () => {
  let campaign, member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01',
      goal_amount: 100000, status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  // `immediate` intent keeps the partial unique index off our back, so one
  // member can hold several pledges in a single drive.
  const pledgeFor = async (amount, memberId = member.id) => Pledge.create({
    amount, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: memberId, fulfillment_intent: 'immediate'
  });

  const pay = async (pledge, amount) => {
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: member.id
    });
  };

  const totals = async () => CampaignTotal.findOne({ where: { campaign_id: campaign.id } });

  it('never reports negative money still owed', async () => {
    const over = await pledgeFor(1000);
    await pay(over, 1200);          // overshoots by 200
    const under = await pledgeFor(5000);
    await pay(under, 1000);         // still owes 4000

    const t = await totals();
    // outstanding nets the overshoot against the shortfall: 3800
    expect(parseFloat(t.outstanding)).toBe(3800);
    // outstanding_positive counts only real shortfall: 4000
    expect(parseFloat(t.outstanding_positive)).toBe(4000);
    expect(parseFloat(t.overpaid_amount)).toBe(200);
  });

  it('reports zero over-payment when every pledge is short', async () => {
    const p = await pledgeFor(5000);
    await pay(p, 1000);

    const t = await totals();
    expect(parseFloat(t.outstanding_positive)).toBe(4000);
    expect(parseFloat(t.overpaid_amount)).toBe(0);
  });

  it('reports zero on both columns for a drive with no pledges', async () => {
    const t = await totals();
    expect(parseFloat(t.outstanding_positive)).toBe(0);
    expect(parseFloat(t.overpaid_amount)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/unit/campaignTotalsOverpayment.test.js`

Expected: FAIL. The first two cases fail because `t.outstanding_positive` is `undefined`, so `parseFloat` yields `NaN`.

- [ ] **Step 3: Add the columns to the view SQL**

In `backend/src/database/pledgeViews.js`, inside the `CAMPAIGN_TOTALS` template, add two lines immediately after the existing `outstanding` line:

```js
  COALESCE(SUM(b.remaining_amount), 0) AS outstanding,
  COALESCE(SUM(CASE WHEN b.remaining_amount > 0
                    THEN b.remaining_amount ELSE 0 END), 0) AS outstanding_positive,
  COALESCE(SUM(CASE WHEN b.remaining_amount < 0
                    THEN -b.remaining_amount ELSE 0 END), 0) AS overpaid_amount,
```

Add this comment directly above the `CAMPAIGN_TOTALS` constant:

```js
// outstanding vs outstanding_positive: a pledge can be over-fulfilled (a payment
// lands on it in full even when it overshoots), so remaining_amount goes negative
// and `outstanding` nets one member's overshoot against another's shortfall.
// outstanding_positive is money actually still owed; overpaid_amount is the
// overshoot as a positive number. UI surfaces read those two, never `outstanding`
// raw — this is the one definition of the rule.
```

- [ ] **Step 4: Add the fields to the model**

In `backend/src/models/CampaignTotal.js`, inside `CampaignTotal.init({...})`, after the existing `outstanding` line:

```js
    outstanding: DataTypes.DECIMAL(10, 2),
    outstanding_positive: DataTypes.DECIMAL(10, 2),
    overpaid_amount: DataTypes.DECIMAL(10, 2),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/unit/campaignTotalsOverpayment.test.js`

Expected: PASS, 3 tests.

- [ ] **Step 6: Run the existing pledge suite to confirm nothing regressed**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest --testPathPattern="pledge|campaign"`

Expected: PASS. Every pre-existing test must still pass — `outstanding` and `donor_count` were not modified.

- [ ] **Step 7: Commit**

```bash
cd /Users/dawit/development/church/abune-aregawi
git add backend/src/database/pledgeViews.js backend/src/models/CampaignTotal.js backend/tests/unit/campaignTotalsOverpayment.test.js
git commit -m "feat(pledges): define outstanding-owed and over-payment once in campaign_totals

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Household and anonymous counts in `campaign_totals`

Two confirmed defects, from spec §3. `donor_count` is `COUNT(DISTINCT b.member_id)`, and SQL `COUNT DISTINCT` skips NULLs — so every anonymous pledge (confirmed to carry `member_id IS NULL` in 2026) is counted in `pledge_count` and invisible in `donor_count`. Separately, `member_id` is a person: a spouse or promoted dependent pledges against their own member row, so distinct members is not distinct households. The household key is `COALESCE(family_id, id)`, already the established pattern at `src/controllers/statementController.js:20`.

**Files:**
- Modify: `backend/src/database/pledgeViews.js` (the `CAMPAIGN_TOTALS` template — add a join and three columns)
- Modify: `backend/src/models/CampaignTotal.js` (add three fields)
- Test: `backend/tests/unit/campaignTotalsHouseholds.test.js`

**Interfaces:**
- Consumes: Task 1's edits to the same template — add to it, do not replace it.
- Produces: `campaign_totals.household_count` (INTEGER, attributable households only), `campaign_totals.anonymous_pledge_count` (INTEGER), `campaign_totals.anonymous_collected` (DECIMAL(10,2)). The participation numerator is `household_count`; `anonymous_pledge_count` is reported beside the rate, never inside it.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/campaignTotalsHouseholds.test.js`:

```js
const {
  CampaignTotal, PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize
} = require('../../src/models');

describe('campaign_totals household and anonymous counts', () => {
  let campaign, head, spouse;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01',
      goal_amount: 100000, status: 'active'
    });
    // family_id NULL marks the implicit head of household — the same convention
    // statementController.js uses via `member.family_id || member.id`.
    head = await Member.create({
      first_name: 'Abraham', last_name: 'Tesfaye', phone_number: '+15550000011',
      email: 'abraham@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-abraham', family_id: null
    });
    spouse = await Member.create({
      first_name: 'Selam', last_name: 'Tesfaye', phone_number: '+15550000012',
      email: 'selam@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-selam', family_id: head.id
    });
  });

  const pledgeFor = async (memberId, amount) => Pledge.create({
    amount, first_name: 'X', last_name: 'Y', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: memberId, fulfillment_intent: 'immediate'
  });

  // An anonymous pledge has no member_id, and the model requires it to be both
  // immediate and identifiable by baptism name.
  const anonymousPledge = async (amount, baptismName) => Pledge.create({
    amount, first_name: 'Anonymous', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: null, is_anonymous: true,
    fulfillment_intent: 'immediate', baptism_name: baptismName
  });

  const payFor = async (pledge, amount) => {
    const txn = await Transaction.create({
      member_id: head.id, collected_by: head.id, payment_date: '2026-02-01',
      amount, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: head.id
    });
  };

  const totals = async () => CampaignTotal.findOne({ where: { campaign_id: campaign.id } });

  it('counts two members of one family as a single household', async () => {
    await pledgeFor(head.id, 1000);
    await pledgeFor(spouse.id, 500);

    const t = await totals();
    expect(t.pledge_count).toBe(2);
    expect(t.donor_count).toBe(2);       // two member rows, unchanged behaviour
    expect(t.household_count).toBe(1);   // one family
  });

  it('counts a member with no family_id as their own household', async () => {
    const solo = await Member.create({
      first_name: 'Yonas', last_name: 'Gebre', phone_number: '+15550000013',
      email: 'yonas@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-yonas', family_id: null
    });
    await pledgeFor(head.id, 1000);
    await pledgeFor(solo.id, 1000);

    const t = await totals();
    expect(t.household_count).toBe(2);
  });

  it('reports anonymous pledges separately and keeps them out of household_count', async () => {
    await pledgeFor(head.id, 1000);
    const anon = await anonymousPledge(750, 'Gebre Mesqel');
    await payFor(anon, 750);

    const t = await totals();
    expect(t.pledge_count).toBe(2);
    expect(t.household_count).toBe(1);          // the anonymous gift is not a household
    expect(t.anonymous_pledge_count).toBe(1);
    expect(parseFloat(t.anonymous_collected)).toBe(750);
  });

  it('reports zeroes, not one, for a drive with no pledges at all', async () => {
    const t = await totals();
    expect(t.pledge_count).toBe(0);
    expect(t.household_count).toBe(0);
    // The LEFT JOIN yields one all-NULL row for an empty drive; a naive
    // SUM(CASE WHEN member_id IS NULL THEN 1 END) would report 1 here.
    expect(t.anonymous_pledge_count).toBe(0);
    expect(parseFloat(t.anonymous_collected)).toBe(0);
  });

  it('excludes cancelled pledges from household_count', async () => {
    await pledgeFor(head.id, 1000);
    const doomed = await pledgeFor(spouse.id, 500);
    await doomed.update({ lifecycle: 'cancelled' });

    const t = await totals();
    expect(t.pledge_count).toBe(1);
    expect(t.household_count).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/unit/campaignTotalsHouseholds.test.js`

Expected: FAIL — `household_count` and `anonymous_pledge_count` are `undefined`.

- [ ] **Step 3: Add the join and the three columns**

In `backend/src/database/pledgeViews.js`, in the `CAMPAIGN_TOTALS` template:

First add the members join, directly below the existing `pledge_balances` join:

```sql
FROM pledge_campaigns c
LEFT JOIN pledge_balances b
  ON b.campaign_id = c.id AND b.derived_status <> 'cancelled'
LEFT JOIN members m ON m.id = b.member_id
```

Then add three columns after `donor_count`:

```sql
  COUNT(DISTINCT b.member_id) AS donor_count,
  COUNT(DISTINCT CASE WHEN b.member_id IS NOT NULL
                      THEN COALESCE(m.family_id, m.id) END) AS household_count,
  SUM(CASE WHEN b.pledge_id IS NOT NULL AND b.member_id IS NULL
           THEN 1 ELSE 0 END) AS anonymous_pledge_count,
  COALESCE(SUM(CASE WHEN b.member_id IS NULL
                    THEN b.paid_amount ELSE 0 END), 0) AS anonymous_collected,
```

Add this comment above the `CAMPAIGN_TOTALS` constant:

```js
// Three counts, three different questions:
//   donor_count      - distinct member rows. KEPT AS-IS for existing callers, but
//                      it silently skips anonymous pledges, because SQL
//                      COUNT(DISTINCT x) ignores NULLs and an anonymous pledge has
//                      no member_id. Do not build a participation rate on it.
//   household_count  - distinct families. A spouse or promoted dependent pledges
//                      against their OWN member row, so distinct members is not
//                      distinct households. COALESCE(family_id, id) is the house
//                      pattern (statementController.js) where family_id IS NULL
//                      means implicit head.
//   anonymous_*      - anonymous gifts are not attributable to a household, so they
//                      are reported BESIDE the participation rate, never inside it.
//                      The `b.pledge_id IS NOT NULL` guard matters: an empty drive
//                      still yields one all-NULL row from the LEFT JOIN, which
//                      would otherwise count as one anonymous pledge.
```

- [ ] **Step 4: Add the fields to the model**

In `backend/src/models/CampaignTotal.js`, after `donor_count`:

```js
    donor_count: DataTypes.INTEGER,
    household_count: DataTypes.INTEGER,
    anonymous_pledge_count: DataTypes.INTEGER,
    anonymous_collected: DataTypes.DECIMAL(10, 2),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/unit/campaignTotalsHouseholds.test.js`

Expected: PASS, 5 tests.

- [ ] **Step 6: Run the full pledge suite**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest --testPathPattern="pledge|campaign"`

Expected: PASS, including Task 1's file.

- [ ] **Step 7: Commit**

```bash
cd /Users/dawit/development/church/abune-aregawi
git add backend/src/database/pledgeViews.js backend/src/models/CampaignTotal.js backend/tests/unit/campaignTotalsHouseholds.test.js
git commit -m "feat(pledges): count households and anonymous gifts correctly in campaign_totals

donor_count skipped anonymous pledges (COUNT DISTINCT ignores NULL member_id)
and counted members rather than families. Both are now reported explicitly
alongside it; donor_count itself is unchanged for existing callers.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: New `campaign_status_totals` view

The dashboard's fulfillment breakdown (spec §7) needs, per status, both a count and a dollar sum — that is what makes the paired-bar insight possible ("40% of donors, 24% of dollars"). `pledge_balances` has `derived_status` per row and the API already groups by it in JS, then the client throws the counts away. Aggregate it in SQL instead, as its own view so the shape stays one row per (campaign, status).

**Files:**
- Modify: `backend/src/database/pledgeViews.js` (new template + wire into create/drop)
- Create: `backend/src/models/CampaignStatusTotal.js`
- Modify: `backend/src/models/index.js:98-99` and `:139-140` (register the model)
- Test: `backend/tests/unit/campaignStatusTotals.test.js`

**Interfaces:**
- Consumes: nothing from Tasks 1–2 — a separate view over `pledge_balances`.
- Produces: model `CampaignStatusTotal`, table `campaign_status_totals`, one row per `(campaign_id, status)` where status is one of `fulfilled` / `partially_fulfilled` / `not_started` / `cancelled`. Columns: `campaign_id` BIGINT, `status` STRING (composite PK with campaign_id), `pledge_count` INTEGER, `household_count` INTEGER, `total_pledged` / `total_collected` / `outstanding` DECIMAL(10,2). **Cancelled is included as its own row** — admins need to see it, matching what `getPledgeStats` already does.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/campaignStatusTotals.test.js`:

```js
const {
  CampaignStatusTotal, PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize
} = require('../../src/models');

describe('campaign_status_totals view', () => {
  let campaign, member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01',
      goal_amount: 100000, status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  const pledgeFor = async (amount) => Pledge.create({
    amount, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: member.id, fulfillment_intent: 'immediate'
  });

  const pay = async (pledge, amount) => {
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: member.id
    });
  };

  const byStatus = async () => {
    const rows = await CampaignStatusTotal.findAll({ where: { campaign_id: campaign.id } });
    return Object.fromEntries(rows.map((r) => [r.status, r]));
  };

  it('splits counts and dollars across the three live statuses', async () => {
    const paid = await pledgeFor(1000);
    await pay(paid, 1000);
    const partial = await pledgeFor(5000);
    await pay(partial, 2000);
    await pledgeFor(800);                 // untouched

    const s = await byStatus();

    expect(s.fulfilled.pledge_count).toBe(1);
    expect(parseFloat(s.fulfilled.total_pledged)).toBe(1000);
    expect(parseFloat(s.fulfilled.total_collected)).toBe(1000);
    expect(parseFloat(s.fulfilled.outstanding)).toBe(0);

    expect(s.partially_fulfilled.pledge_count).toBe(1);
    expect(parseFloat(s.partially_fulfilled.total_pledged)).toBe(5000);
    expect(parseFloat(s.partially_fulfilled.total_collected)).toBe(2000);
    expect(parseFloat(s.partially_fulfilled.outstanding)).toBe(3000);

    expect(s.not_started.pledge_count).toBe(1);
    expect(parseFloat(s.not_started.total_collected)).toBe(0);
    expect(parseFloat(s.not_started.outstanding)).toBe(800);
  });

  it('reports cancelled pledges as their own row', async () => {
    const doomed = await pledgeFor(1000);
    await doomed.update({ lifecycle: 'cancelled' });

    const s = await byStatus();
    expect(s.cancelled.pledge_count).toBe(1);
    expect(parseFloat(s.cancelled.total_pledged)).toBe(1000);
  });

  it('emits no rows for a campaign with no pledges', async () => {
    const rows = await CampaignStatusTotal.findAll({ where: { campaign_id: campaign.id } });
    expect(rows).toHaveLength(0);
  });

  it('never reports negative outstanding on an over-paid status bucket', async () => {
    const over = await pledgeFor(1000);
    await pay(over, 1200);

    const s = await byStatus();
    expect(parseFloat(s.fulfilled.outstanding)).toBe(0);
  });

  it('counts a family once per status bucket', async () => {
    const spouse = await Member.create({
      first_name: 'Selam', last_name: 'Giver', phone_number: '+15550000012',
      email: 'selam@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-selam2', family_id: member.id
    });
    await pledgeFor(500);
    await Pledge.create({
      amount: 700, first_name: 'Selam', last_name: 'Giver', pledge_type: 'fundraising',
      campaign_id: campaign.id, member_id: spouse.id, fulfillment_intent: 'immediate'
    });

    const s = await byStatus();
    expect(s.not_started.pledge_count).toBe(2);
    expect(s.not_started.household_count).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/unit/campaignStatusTotals.test.js`

Expected: FAIL with a `TypeError` — `CampaignStatusTotal` is `undefined`, so `.findAll` cannot be called.

- [ ] **Step 3: Add the view template and wire it in**

In `backend/src/database/pledgeViews.js`, add this template after `CAMPAIGN_TOTALS`:

```js
// One row per (campaign, derived status), carrying BOTH a count and a dollar sum.
// The dashboard's fulfillment breakdown needs both to show that e.g. 40% of donors
// account for 24% of dollars — a single figure cannot express that.
//
// `cancelled` gets its own row rather than being filtered out: campaign_totals
// deliberately excludes cancelled pledges from headline money, but admins still
// need to see them, which is what getPledgeStats already does in JS today.
const CAMPAIGN_STATUS_TOTALS = (securityInvoker) => `
CREATE VIEW campaign_status_totals ${securityInvoker ? 'WITH (security_invoker = true) ' : ''}AS
SELECT
  b.campaign_id       AS campaign_id,
  b.derived_status    AS status,
  COUNT(b.pledge_id)  AS pledge_count,
  COUNT(DISTINCT CASE WHEN b.member_id IS NOT NULL
                      THEN COALESCE(m.family_id, m.id) END) AS household_count,
  COALESCE(SUM(b.pledged_amount), 0) AS total_pledged,
  COALESCE(SUM(b.paid_amount), 0)    AS total_collected,
  COALESCE(SUM(CASE WHEN b.remaining_amount > 0
                    THEN b.remaining_amount ELSE 0 END), 0) AS outstanding
FROM pledge_balances b
LEFT JOIN members m ON m.id = b.member_id
GROUP BY b.campaign_id, b.derived_status
`;
```

Then update both helpers. `createPledgeViews` — the new view depends on `pledge_balances`, so it must be created after it:

```js
async function createPledgeViews(queryInterface) {
  const securityInvoker = await shouldUseSecurityInvoker(queryInterface);
  await dropPledgeViews(queryInterface);
  // security_invoker matters: in PG15 a view runs as its OWNER by default, which
  // would bypass the RLS we enabled on pledges. SQLite has no such concept.
  await queryInterface.sequelize.query(PLEDGE_BALANCES(securityInvoker));
  await queryInterface.sequelize.query(CAMPAIGN_TOTALS(securityInvoker));
  await queryInterface.sequelize.query(CAMPAIGN_STATUS_TOTALS(securityInvoker));
}
```

`dropPledgeViews` — drop dependents before `pledge_balances`:

```js
async function dropPledgeViews(queryInterface) {
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS campaign_status_totals;');
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS campaign_totals;');
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS pledge_balances;');
}
```

- [ ] **Step 4: Create the model**

Create `backend/src/models/CampaignStatusTotal.js`:

```js
'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // Backed by a VIEW. Read-only: never call create/update/destroy on this model.
  class CampaignStatusTotal extends Model {
    static associate(models) {
      CampaignStatusTotal.belongsTo(models.PledgeCampaign, {
        foreignKey: 'campaign_id', as: 'campaign'
      });
    }
  }

  CampaignStatusTotal.init({
    // Composite key: one row per campaign per derived status. Sequelize needs a
    // primary key to hydrate instances, and neither column is unique alone.
    campaign_id: { type: DataTypes.BIGINT, primaryKey: true },
    status: { type: DataTypes.STRING(24), primaryKey: true },
    pledge_count: DataTypes.INTEGER,
    household_count: DataTypes.INTEGER,
    total_pledged: DataTypes.DECIMAL(10, 2),
    total_collected: DataTypes.DECIMAL(10, 2),
    outstanding: DataTypes.DECIMAL(10, 2)
  }, {
    sequelize,
    modelName: 'CampaignStatusTotal',
    tableName: 'campaign_status_totals',
    timestamps: false,
    underscored: true
  });

  // Backed by a VIEW, not a table — see the matching comment in PledgeBalance.js
  // for why sync()/drop() must be no-ops here.
  CampaignStatusTotal.sync = async () => CampaignStatusTotal;
  CampaignStatusTotal.drop = async () => true;

  return CampaignStatusTotal;
};
```

- [ ] **Step 5: Register the model**

In `backend/src/models/index.js`, add after the `CampaignTotal` require at line 99:

```js
  const CampaignTotal = require('./CampaignTotal')(sequelize);
  const CampaignStatusTotal = require('./CampaignStatusTotal')(sequelize);
```

and add it to the returned object after `CampaignTotal` at line 140:

```js
    CampaignTotal,
    CampaignStatusTotal,
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/unit/campaignStatusTotals.test.js`

Expected: PASS, 5 tests.

- [ ] **Step 7: Run the whole backend suite**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest`

Expected: PASS. This step is broader than the earlier tasks on purpose — registering a new model touches `models/index.js`, which every test file loads, and the drop order in `dropPledgeViews` now matters for the ~30 files that call `recreatePledgeViews()`.

- [ ] **Step 8: Commit**

```bash
cd /Users/dawit/development/church/abune-aregawi
git add backend/src/database/pledgeViews.js backend/src/models/CampaignStatusTotal.js backend/src/models/index.js backend/tests/unit/campaignStatusTotals.test.js
git commit -m "feat(pledges): add campaign_status_totals view for fulfillment breakdown

Counts and dollars per derived status, aggregated in SQL instead of grouped in
JS and discarded by the client.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Active-household denominator

`household_count` from Task 2 is the participation numerator. The denominator is a members-table figure, not campaign-scoped, so it does not belong in a campaign view.

**The denominator must use the same household key as the numerator: `COALESCE(family_id, id)`.** A head of household is `family_id IS NULL` **or** `family_id = id` — both forms exist, per `memberReportController`'s `isHead = (m) => !m.family_id || String(m.family_id) === String(m.id)`. Counting only `family_id IS NULL` would drop every self-pointing head from the denominator while Task 2's `COALESCE` still counts it in the numerator, pushing the participation rate above 100%.

For the same reason `familyIdPopulated` must test `family_id IS NOT NULL AND family_id <> id` — a self-pointing head is not a linked dependent, and counting it as one would mask exactly the empty-column case this flag exists to detect.

This task also ships the diagnostic the spec flags as unverified — if `family_id` is barely populated in production, nearly every member reads as an implicit head and "households" silently collapses to "members". The function returns both counts so a caller can detect that and relabel.

**Files:**
- Modify: `backend/src/services/pledgeCampaignService.js:59` (add export)
- Test: `backend/tests/unit/activeHouseholdCount.test.js`

**Interfaces:**
- Consumes: nothing from Tasks 1–3.
- Produces: `countActiveHouseholds()` exported from `src/services/pledgeCampaignService.js`, returning `Promise<{ households: number, activeMembers: number, familyIdPopulated: boolean }>`. `familyIdPopulated` is false when no active member has a non-null `family_id`, which is the signal that the UI must say "members" rather than "households". Plan 2's endpoint consumes this.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/activeHouseholdCount.test.js`:

```js
const { Member, sequelize } = require('../../src/models');
const { countActiveHouseholds } = require('../../src/services/pledgeCampaignService');

describe('countActiveHouseholds', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Member.destroy({ where: {} });
  });

  const member = async (overrides) => Member.create({
    first_name: 'A', last_name: 'B', is_active: true, role: 'member',
    ...overrides
  });

  it('counts heads of household, not people', async () => {
    const head = await member({
      phone_number: '+15550000021', email: 'h1@example.com',
      firebase_uid: 'uid-h1', family_id: null
    });
    await member({
      phone_number: '+15550000022', email: 's1@example.com',
      firebase_uid: 'uid-s1', family_id: head.id
    });
    await member({
      phone_number: '+15550000023', email: 'h2@example.com',
      firebase_uid: 'uid-h2', family_id: null
    });

    const result = await countActiveHouseholds();
    expect(result.households).toBe(2);
    expect(result.activeMembers).toBe(3);
    expect(result.familyIdPopulated).toBe(true);
  });

  it('counts a self-pointing head once, not zero times', async () => {
    // Both forms of "head" exist in this data: family_id IS NULL, and
    // family_id = own id. memberReportController treats them identically.
    const selfHead = await member({
      phone_number: '+15550000031', email: 'self@example.com',
      firebase_uid: 'uid-self', family_id: null
    });
    await selfHead.update({ family_id: selfHead.id });
    await member({
      phone_number: '+15550000032', email: 'dep@example.com',
      firebase_uid: 'uid-dep', family_id: selfHead.id
    });

    const result = await countActiveHouseholds();
    expect(result.households).toBe(1);
    expect(result.activeMembers).toBe(2);
    // The dependent is genuinely linked; the self-pointing head is not.
    expect(result.familyIdPopulated).toBe(true);
  });

  it('does not treat a self-pointing head as a populated family_id', async () => {
    const solo = await member({
      phone_number: '+15550000033', email: 'solo@example.com',
      firebase_uid: 'uid-solo', family_id: null
    });
    await solo.update({ family_id: solo.id });

    const result = await countActiveHouseholds();
    expect(result.households).toBe(1);
    // family_id is non-null but points at itself — nobody is linked to anybody.
    expect(result.familyIdPopulated).toBe(false);
  });

  it('excludes inactive members from both counts', async () => {
    await member({
      phone_number: '+15550000024', email: 'a@example.com',
      firebase_uid: 'uid-a', family_id: null
    });
    await member({
      phone_number: '+15550000025', email: 'b@example.com',
      firebase_uid: 'uid-b', family_id: null, is_active: false
    });

    const result = await countActiveHouseholds();
    expect(result.households).toBe(1);
    expect(result.activeMembers).toBe(1);
  });

  it('flags an unpopulated family_id so callers can relabel the metric', async () => {
    await member({
      phone_number: '+15550000026', email: 'c@example.com',
      firebase_uid: 'uid-c', family_id: null
    });
    await member({
      phone_number: '+15550000027', email: 'd@example.com',
      firebase_uid: 'uid-d', family_id: null
    });

    const result = await countActiveHouseholds();
    // Every member is an implicit head, so "households" equals "members" and the
    // figure is not really a household count at all.
    expect(result.households).toBe(2);
    expect(result.familyIdPopulated).toBe(false);
  });

  it('returns zeroes on an empty members table', async () => {
    const result = await countActiveHouseholds();
    expect(result).toEqual({ households: 0, activeMembers: 0, familyIdPopulated: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/unit/activeHouseholdCount.test.js`

Expected: FAIL — `countActiveHouseholds is not a function`.

- [ ] **Step 3: Implement the function**

In `backend/src/services/pledgeCampaignService.js`, change the imports on lines 3-4 and add the function above `module.exports`:

```js
const { Op, fn, col, literal } = require('sequelize');
const { PledgeCampaign, Member } = require('../models');
```

`Op` was already imported on line 3 and is still used by `findOverlappingActive` — keep it.

```js
/**
 * The participation denominator for the pledge dashboard.
 *
 * The household key is COALESCE(family_id, id) — the SAME key campaign_totals
 * uses for the numerator. It has to be: a head of household is either
 * family_id IS NULL or family_id = own id (both forms exist; see
 * memberReportController's `isHead`), so counting only the NULL form would drop
 * every self-pointing head from the denominator while the numerator still
 * counts it, and push participation above 100%.
 *
 * familyIdPopulated is the honesty check. It requires family_id to be non-null
 * AND to point at someone else, because a self-pointing head links nobody. When
 * it is false, every member reads as their own household and this figure is a
 * member count wearing a household label — callers must relabel the metric
 * rather than publish a precise-looking number that is not what it says.
 *
 * One aggregate query, no GROUP BY, so it returns exactly one row even against
 * an empty members table (COUNT 0, SUM NULL).
 */
const countActiveHouseholds = async () => {
  const row = await Member.findOne({
    attributes: [
      [fn('COUNT', fn('DISTINCT', fn('COALESCE', col('family_id'), col('id')))), 'households'],
      [fn('COUNT', col('id')), 'active_members'],
      [fn('SUM', literal(
        'CASE WHEN family_id IS NOT NULL AND family_id <> id THEN 1 ELSE 0 END'
      )), 'linked']
    ],
    where: { is_active: true },
    raw: true
  });

  return {
    households: Number(row?.households) || 0,
    activeMembers: Number(row?.active_members) || 0,
    familyIdPopulated: (Number(row?.linked) || 0) > 0
  };
};

module.exports = {
  todayInChurchTz, isLive, findLiveCampaign, findOverlappingActive, countActiveHouseholds
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/unit/activeHouseholdCount.test.js`

Expected: PASS, 6 tests.

- [ ] **Step 5: Run the pledge suite**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest --testPathPattern="pledge|campaign"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/dawit/development/church/abune-aregawi
git add backend/src/services/pledgeCampaignService.js backend/tests/unit/activeHouseholdCount.test.js
git commit -m "feat(pledges): add active-household denominator with populated-family_id check

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Migration and production verification

Tests build their schema with `sequelize.sync()` plus `createPledgeViews()`, so Tasks 1–4 are already exercised. Production needs a migration to recreate the views. Because all the SQL lives in `pledgeViews.js`, one migration covers every view change in this plan — the same shape as `20260822130000-credit-legacy-fulfilled-pledges.js`.

**Files:**
- Create: `backend/migrations/20260921120000-pledge-dashboard-metric-views.js`
- Create: `docs/superpowers/plans/2026-09-21-pledge-metric-integrity-verification.md`

**Interfaces:**
- Consumes: `createPledgeViews` / `dropPledgeViews` from `src/database/pledgeViews.js`, as amended by Tasks 1–3.
- Produces: nothing consumed by later code. Ends the plan.

- [ ] **Step 1: Write the migration**

Create `backend/migrations/20260921120000-pledge-dashboard-metric-views.js`:

```js
'use strict';

// Recreates the pledge views so campaign_totals carries the dashboard's counts
// (household_count, anonymous_pledge_count, anonymous_collected) and its single
// definition of money-still-owed (outstanding_positive, overpaid_amount), and so
// the new campaign_status_totals view exists.
//
// Data-only in effect — no table is altered and no row is written.
// createPledgeViews() does DROP VIEW IF EXISTS before each CREATE, so this is
// safely re-runnable.
//
// down() drops all three views. Restoring the previous definitions requires
// checking out the earlier version of src/database/pledgeViews.js and re-running
// the create — the SQL lives only in that file, never inlined here.

const { createPledgeViews, dropPledgeViews } = require('../src/database/pledgeViews');

module.exports = {
  up: async (queryInterface) => { await createPledgeViews(queryInterface); },
  down: async (queryInterface) => { await dropPledgeViews(queryInterface); }
};
```

- [ ] **Step 2: Verify the migration runs against a throwaway sqlite file**

```bash
cd /Users/dawit/development/church/abune-aregawi/backend
rm -f /tmp/pledge-migration-check.sqlite
DATABASE_URL=sqlite:/tmp/pledge-migration-check.sqlite NODE_ENV=development npm run db:init
DATABASE_URL=sqlite:/tmp/pledge-migration-check.sqlite NODE_ENV=development npx sequelize-cli db:migrate
```

Expected: the migration is listed as executed with no error. If earlier migrations fail on sqlite (several are Postgres-specific), that is pre-existing and not caused by this plan — in that case skip to Step 3 and rely on the Jest suite, which exercises the same `createPledgeViews()` path on every run.

- [ ] **Step 3: Run the full suite one more time**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest`

Expected: PASS, all files.

- [ ] **Step 4: Write the verification runbook**

Create `docs/superpowers/plans/2026-09-21-pledge-metric-integrity-verification.md`:

```markdown
# Verification — pledge metric integrity

Run after the deploy pipeline has applied
`20260921120000-pledge-dashboard-metric-views.js`. All queries are READ-ONLY.
Do not run anything that writes against a DATABASE_URL containing supabase.com.

## 1. Is family_id actually populated?

The blocking question from the spec. If almost every active member has a NULL
family_id, then household_count equals the member count and the participation
card must say "members", not "households".

    SELECT
      COUNT(*) AS active_members,
      SUM(CASE WHEN family_id IS NULL THEN 1 ELSE 0 END) AS implicit_heads,
      SUM(CASE WHEN family_id IS NOT NULL THEN 1 ELSE 0 END) AS linked_members
    FROM members WHERE is_active = true;

Interpretation: linked_members near zero means family_id was never filled in.
Report the numbers back before Plan 3 builds the participation card.

## 2. Do the new counts diverge as expected?

    SELECT campaign_id, slug, pledge_count, donor_count, household_count,
           anonymous_pledge_count, anonymous_collected
    FROM campaign_totals ORDER BY campaign_id;

Expected for the 2026 drive: pledge_count > donor_count (anonymous pledges are
in the first and not the second), and household_count <= donor_count. If
household_count equals donor_count exactly, cross-check against query 1.

## 3. Is there real over-payment?

    SELECT slug, outstanding, outstanding_positive, overpaid_amount
    FROM campaign_totals ORDER BY campaign_id;

Any non-zero overpaid_amount confirms the clamp is load-bearing and belongs in
the attention panel (spec §10).

## 4. Does the status breakdown reconcile?

    SELECT campaign_id, status, pledge_count, household_count,
           total_pledged, total_collected, outstanding
    FROM campaign_status_totals ORDER BY campaign_id, status;

Summing total_pledged across every status EXCEPT 'cancelled' must equal
campaign_totals.total_pledged for that campaign. A mismatch means the cancelled
filter diverged between the two views.

Expected for the 2025 drive: no 'partially_fulfilled' row at all. Every 2025
pledge is is_historical and therefore binary (spec §3). Its absence is correct,
not a bug.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/dawit/development/church/abune-aregawi
git add backend/migrations/20260921120000-pledge-dashboard-metric-views.js docs/superpowers/plans/2026-09-21-pledge-metric-integrity-verification.md
git commit -m "feat(pledges): migration and verification runbook for dashboard metric views

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Stop and hand back**

Do **not** push and do **not** run anything against production. The user tests locally before any deploy and asks to be consulted before a push. Report: which tests pass, what the four verification queries need to be run against, and that `family_id` population is still unverified.

---

## Self-Review

**Spec coverage.** This plan implements the data prerequisites in spec §3, §5 and §7: the household rollup and anonymous separation (Tasks 2, 4), per-status counts and dollars for the paired bars (Task 3), and the central over-payment rule (Task 1). Deliberately out of scope and carried by later plans: the monthly series and year-over-year payload with capability flags (Plan 2, spec §6), access tiering and small-number suppression (Plan 2/5, spec §8), every UI element (Plans 3–5), and the table upgrades (Plan 4, spec §9).

**Placeholder scan.** No TBDs. Every code step carries the actual SQL, model fields, function body or test. No step says "add error handling" or "similar to Task N".

**Type consistency.** `outstanding_positive` / `overpaid_amount` / `household_count` / `anonymous_pledge_count` / `anonymous_collected` are spelled identically in the view SQL (Tasks 1–2), the `CampaignTotal` model, and the tests. `CampaignStatusTotal` uses `status`, not `derived_status`, consistently in the view alias, the model and the test. `countActiveHouseholds()` returns `{ households, activeMembers, familyIdPopulated }` in Task 4's interface block, implementation and all four assertions.

**Known gap carried forward:** `donor_count` remains in the view with its NULL-skipping behaviour, because `FundraisingCampaigns.tsx` and the public `PledgeTracker` read it today. Plan 3 migrates those callers to `household_count`; only then can `donor_count` be reconsidered. This is deliberate, and the comment added in Task 2 Step 3 warns the next reader not to build a participation rate on it.
