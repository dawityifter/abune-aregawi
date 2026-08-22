# Pledge Payment Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a pledge fulfillable — connect real payments to pledges so `pledge_balances` reflects money actually received, through both the online Donate page and the treasurer's Add Payment flow.

**Architecture:** One server-side rule keyed on the payment rather than on the screen that created it: a succeeded transaction typed `pledge_drive`, whose member has an active pledge in the live campaign, is allocated to that pledge, idempotent on the transaction id. The rule lives in a single helper, `maybeAllocateToPledge()`, which two transaction-creation paths call. No schema migration.

**Tech Stack:** Node/Express, Sequelize, PostgreSQL (tests on `sqlite::memory:`); React 19 + TypeScript, CRA, Tailwind, Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-22-pledge-payment-allocation-design.md`

## Global Constraints

- **No real member data** in any test, fixture, doc, or commit. All fixtures synthetic. (CLAUDE.md)
- **No schema migration.** `pledge_allocations.source` is constrained in the model AND by a Postgres CHECK constraint to `('stripe_auto','treasurer_manual','migration','stripe_refund')`. Use only those four values. Anything needing a new source is out of scope.
- **Recording money always wins.** If allocation fails, log it and leave the payment standing and unallocated. Never reject or roll back a payment because it could not be linked to a pledge.
- **Every new UI string gets both `en` and `ti`** entries in `frontend/src/i18n/dictionaries.ts`. Flag Tigrigna drafts in `tigrigna-translation-review.md` (Task 10).
- **Role vocabulary is fixed** — reuse `viewRoles` / `editRoles` exactly as `backend/src/routes/pledgeRoutes.js` defines them. Do not invent role names.
- **Backend test command:** from `backend/`: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest <path>`
- **Frontend test command:** from `frontend/`: `CI=true npx react-scripts test --testPathPattern="<pattern>" --watchAll=false`
- **Work happens on the `feat/fundraising-campaigns` branch.** A pre-commit hook runs the full backend and frontend suites plus a PII scan on every commit; a red suite blocks the commit.
- **`user-event` is v13** in this repo. Call `userEvent.click(...)` / `userEvent.type(...)` directly. There is **no** `userEvent.setup()`.
- **Never call `sequelize.close()` in a backend test's `afterAll`** — the models module shares one connection; closing it fails the suite with `SQLITE_MISUSE`.
- **`pledge_balances` and `campaign_totals` are VIEWS that `sequelize.sync()` does not create.** Any test reading a balance must call `createPledgeViews(sequelize.getQueryInterface())` from `backend/src/database/pledgeViews.js` **after** `sync({ force: true })`.
- **`req.user.member_id`** is already the resolved member id — the auth middleware does the phone lookup. Do not re-resolve by phone.
- Amounts from Postgres `DECIMAL` arrive as **strings**. Always `parseFloat` before arithmetic.

---

## File Structure

**Backend — modify:**
- `backend/src/services/pledgeAllocationService.js` — add `maybeAllocateToPledge()` beside `allocate()`. It belongs here: it is allocation policy, and it needs `allocate()` and `AllocationError`.
- `backend/src/services/transactionService.js` — call the helper from `createTransactionRecord()`
- `backend/src/controllers/donationController.js` — add `pledge_drive` to `allowedTypes`; call the helper after the succeeded `Transaction.create`
- `backend/src/controllers/pledgeController.js` — add `getPledgeBalance`
- `backend/src/routes/pledgeRoutes.js` — register `GET /balance`

**Backend — create:**
- `backend/src/__tests__/services/maybeAllocateToPledge.test.js`
- `backend/src/__tests__/controllers/pledgeBalance.test.js`

**Frontend — create:**
- `frontend/src/utils/pledgeBalanceApi.ts` — typed client for `GET /api/pledges/balance`
- `frontend/src/hooks/usePledgeBalance.ts` — the member's own balance, for Donate and Dues
- Tests alongside each.

**Frontend — modify:**
- `frontend/src/components/StripePayment.tsx` — widen the `purpose` union
- `frontend/src/components/DonatePage.tsx` — "apply to my pledge" option
- `frontend/src/components/DuesPage.tsx` — banner
- `frontend/src/components/admin/AddPaymentModal.tsx` — `pledge_drive` type + inline balance
- `frontend/src/components/PledgeTracker.tsx`, `frontend/src/components/admin/FundraisingCampaigns.tsx`, `frontend/src/components/admin/CampaignDonors.tsx` — over-fulfilment display
- `frontend/src/i18n/dictionaries.ts`

---

### Task 1: The `maybeAllocateToPledge` rule

**Files:**
- Modify: `backend/src/services/pledgeAllocationService.js`
- Test: `backend/src/__tests__/services/maybeAllocateToPledge.test.js`

**Interfaces:**
- Consumes: `allocate()` and `AllocationError` (same file); `findLiveCampaign()` from `backend/src/services/pledgeCampaignService.js`
- Produces: `maybeAllocateToPledge(txn, { source, allocatedBy }, { transaction }) -> Promise<PledgeAllocation|null>`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/services/maybeAllocateToPledge.test.js`:

```js
'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const {
  sequelize, PledgeCampaign, Pledge, Member, Transaction, PledgeAllocation
} = require('../../models');
const { createPledgeViews } = require('../../database/pledgeViews');
const { maybeAllocateToPledge } = require('../../services/pledgeAllocationService');
const { todayInChurchTz } = require('../../services/pledgeCampaignService');

let campaign;
let member;
let pledge;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await createPledgeViews(sequelize.getQueryInterface());
});

beforeEach(async () => {
  await PledgeAllocation.destroy({ where: {}, truncate: true, cascade: true });
  await Transaction.destroy({ where: {}, truncate: true, cascade: true });
  await Pledge.destroy({ where: {}, truncate: true, cascade: true });
  await PledgeCampaign.destroy({ where: {}, truncate: true, cascade: true });
  await Member.destroy({ where: {}, truncate: true, cascade: true });

  campaign = await PledgeCampaign.create({
    slug: 'live-drive', name: 'Live Drive', status: 'active',
    start_date: todayInChurchTz(), end_date: null
  });
  // Synthetic member — never a real one.
  member = await Member.create({
    first_name: 'Test',
    last_name: 'Pledger',
    phone_number: '+15550000101'
  });
  pledge = await Pledge.create({
    campaign_id: campaign.id, member_id: member.id, amount: 500,
    first_name: 'Test', last_name: 'Pledger'
  });
});
// Deliberately no sequelize.close() here — see Global Constraints.

const makeTxn = (overrides = {}) => Transaction.create({
  member_id: member.id,
  amount: 200,
  payment_type: 'pledge_drive',
  payment_method: 'cash',
  status: 'succeeded',
  payment_date: new Date(),
  ...overrides
});

describe('maybeAllocateToPledge', () => {
  it('allocates a pledge_drive payment to the live-campaign pledge', async () => {
    const txn = await makeTxn();

    const allocation = await maybeAllocateToPledge(txn, { source: 'treasurer_manual', allocatedBy: 1 });

    expect(allocation).not.toBeNull();
    expect(String(allocation.pledge_id)).toBe(String(pledge.id));
    expect(parseFloat(allocation.amount)).toBe(200);
    expect(allocation.source).toBe('treasurer_manual');
  });

  it('allocates the full amount even when it exceeds the remaining balance', async () => {
    // Decided in the spec: the donor gave this much to the drive and the
    // record should say so, rather than splitting one payment in two.
    const txn = await makeTxn({ amount: 900 });

    const allocation = await maybeAllocateToPledge(txn, { source: 'stripe_auto' });

    expect(parseFloat(allocation.amount)).toBe(900);
  });

  it('is idempotent for one transaction', async () => {
    const txn = await makeTxn();

    const first = await maybeAllocateToPledge(txn, { source: 'stripe_auto' });
    const second = await maybeAllocateToPledge(txn, { source: 'stripe_auto' });

    expect(String(second.id)).toBe(String(first.id));
    expect(await PledgeAllocation.count()).toBe(1);
  });

  it('does nothing for a payment of another type', async () => {
    const txn = await makeTxn({ payment_type: 'membership_due' });

    expect(await maybeAllocateToPledge(txn, { source: 'treasurer_manual', allocatedBy: 1 })).toBeNull();
    expect(await PledgeAllocation.count()).toBe(0);
  });

  it('does nothing for a payment that has not succeeded', async () => {
    const txn = await makeTxn({ status: 'pending' });

    expect(await maybeAllocateToPledge(txn, { source: 'stripe_auto' })).toBeNull();
  });

  it('does nothing for an anonymous payment', async () => {
    const txn = await makeTxn({ member_id: null });

    expect(await maybeAllocateToPledge(txn, { source: 'stripe_auto' })).toBeNull();
  });

  it('does nothing when the member has no pledge in the live campaign', async () => {
    await pledge.destroy();
    const txn = await makeTxn();

    expect(await maybeAllocateToPledge(txn, { source: 'stripe_auto' })).toBeNull();
  });

  it('does nothing when no campaign is live', async () => {
    await campaign.update({ status: 'draft' });
    const txn = await makeTxn();

    expect(await maybeAllocateToPledge(txn, { source: 'stripe_auto' })).toBeNull();
  });

  it('ignores a cancelled pledge', async () => {
    await pledge.update({ lifecycle: 'cancelled' });
    const txn = await makeTxn();

    expect(await maybeAllocateToPledge(txn, { source: 'stripe_auto' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/services/maybeAllocateToPledge.test.js`
Expected: FAIL — `maybeAllocateToPledge is not a function`.

- [ ] **Step 3: Write the implementation**

In `backend/src/services/pledgeAllocationService.js`, add near the top with the other requires:

```js
const { findLiveCampaign } = require('./pledgeCampaignService');
```

Add this function after `reverse()` and before `listUnallocated()`:

```js
/**
 * The single rule tying payments to pledges, keyed on the payment rather than
 * on the screen that created it: a succeeded pledge_drive payment whose member
 * has an active pledge in the live campaign is allocated to that pledge.
 *
 * Returns the allocation, or null when the rule does not apply. Callers treat
 * null as ordinary — a pledge_drive payment from someone with no pledge is
 * simply drive income.
 *
 * The idempotency key is the transaction id, which is what makes webhook
 * redelivery safe: the second call returns the existing row rather than
 * crediting the pledge twice.
 */
async function maybeAllocateToPledge(txn, { source, allocatedBy = null }, { transaction } = {}) {
  if (!txn) return null;
  if (txn.payment_type !== 'pledge_drive') return null;
  if (txn.status !== 'succeeded') return null;
  if (!txn.member_id) return null;

  const options = transaction ? { transaction } : {};

  const campaign = await findLiveCampaign();
  if (!campaign) return null;

  // At most one row can match: a unique index permits one active,
  // non-historical pledge per member per campaign, so there is never a
  // question of which pledge is meant.
  const pledge = await Pledge.findOne({
    where: {
      campaign_id: campaign.id,
      member_id: txn.member_id,
      lifecycle: 'active',
      is_historical: false
    },
    ...options
  });
  if (!pledge) return null;

  return allocate({
    pledgeId: pledge.id,
    transactionId: txn.id,
    // Full amount by design — see the spec on overpayment.
    amount: parseFloat(txn.amount),
    source,
    allocatedBy,
    idempotencyKey: `txn:${txn.id}`
  }, { transaction });
}
```

Extend the exports at the bottom of the file:

```js
module.exports = { allocate, reverse, listUnallocated, maybeAllocateToPledge, AllocationError };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/services/maybeAllocateToPledge.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/pledgeAllocationService.js backend/src/__tests__/services/maybeAllocateToPledge.test.js
git commit -m "feat: add the shared rule tying pledge_drive payments to pledges"
```

---

### Task 2: Treasurer payments allocate automatically

**Files:**
- Modify: `backend/src/services/transactionService.js` (`createTransactionRecord`, around lines 204–246)
- Test: `backend/src/__tests__/services/maybeAllocateToPledge.test.js` (append a new describe block)

**Interfaces:**
- Consumes: `maybeAllocateToPledge()` from Task 1
- Produces: no signature change to `createTransactionRecord(payload, options)`

- [ ] **Step 1: Write the failing test**

Append to `backend/src/__tests__/services/maybeAllocateToPledge.test.js`:

```js
const { createTransactionRecord } = require('../../services/transactionService');

describe('createTransactionRecord allocating to a pledge', () => {
  it('creates the allocation alongside the payment', async () => {
    const txn = await createTransactionRecord({
      member_id: member.id,
      collected_by: member.id,
      amount: 150,
      payment_type: 'pledge_drive',
      payment_method: 'cash',
      payment_date: '2026-08-22'
    });

    const allocations = await PledgeAllocation.findAll({ where: { transaction_id: txn.id } });
    expect(allocations).toHaveLength(1);
    expect(parseFloat(allocations[0].amount)).toBe(150);
    expect(allocations[0].source).toBe('treasurer_manual');
  });

  it('records the payment even when allocation is impossible', async () => {
    // Recording money always wins: no live campaign means no allocation, but
    // the payment must still exist.
    await campaign.update({ status: 'closed' });

    const txn = await createTransactionRecord({
      member_id: member.id,
      collected_by: member.id,
      amount: 150,
      payment_type: 'pledge_drive',
      payment_method: 'cash',
      payment_date: '2026-08-22'
    });

    expect(txn.id).toBeDefined();
    expect(await Transaction.findByPk(txn.id)).not.toBeNull();
    expect(await PledgeAllocation.count({ where: { transaction_id: txn.id } })).toBe(0);
  });

  it('leaves other payment types alone', async () => {
    const txn = await createTransactionRecord({
      member_id: member.id,
      collected_by: member.id,
      amount: 150,
      payment_type: 'membership_due',
      payment_method: 'cash',
      payment_date: '2026-08-22'
    });

    expect(await PledgeAllocation.count({ where: { transaction_id: txn.id } })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/services/maybeAllocateToPledge.test.js -t "createTransactionRecord"`
Expected: FAIL — the first case finds 0 allocations, because nothing calls the helper yet.

- [ ] **Step 3: Write the implementation**

In `backend/src/services/transactionService.js`, add to the requires at the top:

```js
const { maybeAllocateToPledge } = require('./pledgeAllocationService');
```

In `createTransactionRecord`, after `createLedgerEntryForTransaction(...)` and before `return created;`:

```js
  // A pledge_drive payment for a member with a live pledge is allocated to it.
  // Wrapped because recording money always wins: an allocation that cannot be
  // made is logged and leaves the payment standing and unallocated, never
  // rolled back. The treasurer's unallocated queue is how those get found.
  try {
    await maybeAllocateToPledge(
      created,
      { source: 'treasurer_manual', allocatedBy: collected_by || null },
      { transaction }
    );
  } catch (err) {
    console.error('⚠️ Pledge allocation failed for transaction', created.id, err.message);
  }

  return created;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/services/maybeAllocateToPledge.test.js`
Expected: PASS — 12 tests.

- [ ] **Step 5: Run the whole backend suite for regressions**

Run: `cd backend && npm test`
Expected: PASS. `createTransactionRecord` is widely used; nothing should change for non-`pledge_drive` types.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/transactionService.js backend/src/__tests__/services/maybeAllocateToPledge.test.js
git commit -m "feat: allocate treasurer-recorded pledge drive payments"
```

---

### Task 3: Online donations carry and allocate the pledge type

**Files:**
- Modify: `backend/src/controllers/donationController.js` (`allowedTypes` around line 434; the succeeded `Transaction.create` around line 495)
- Test: `backend/src/__tests__/controllers/donationPledgeType.test.js`

**Interfaces:**
- Consumes: `maybeAllocateToPledge()` from Task 1
- Produces: donations with `purpose: 'pledge_drive'` are stored as `payment_type: 'pledge_drive'`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/controllers/donationPledgeType.test.js`:

```js
'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

// The whitelist is a plain array in the controller module. Reading it directly
// is the smallest honest test of the silent-downgrade hazard: a purpose that
// is not on the list becomes 'donation' with no error anywhere.
const fs = require('fs');
const path = require('path');

describe('donation purpose whitelist', () => {
  it('admits pledge_drive so a pledge donation is not silently downgraded', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../controllers/donationController.js'), 'utf8'
    );
    const match = source.match(/const allowedTypes = \[([^\]]+)\]/);
    expect(match).not.toBeNull();

    const types = match[1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
    expect(types).toContain('pledge_drive');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/donationPledgeType.test.js`
Expected: FAIL — `pledge_drive` is not in the array.

- [ ] **Step 3: Write the implementation**

In `backend/src/controllers/donationController.js`, add to the requires at the top:

```js
const { maybeAllocateToPledge } = require('../services/pledgeAllocationService');
```

Replace the whitelist:

```js
    const allowedTypes = ['membership_due', 'tithe', 'donation', 'event',
      'tigray_hunger_fundraiser', 'other', 'pledge_drive'];
```

Then, immediately after the succeeded `const transaction = await Transaction.create({ ... });` block (around line 495), add:

```js
    // Same rule as the treasurer path — see pledgeAllocationService. Errors are
    // swallowed on purpose: a webhook must acknowledge the payment even if the
    // pledge link fails, or Stripe retries forever against money we already hold.
    try {
      await maybeAllocateToPledge(transaction, { source: 'stripe_auto' });
    } catch (err) {
      console.error('⚠️ Pledge allocation failed for transaction', transaction.id, err.message);
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/donationPledgeType.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/donationController.js backend/src/__tests__/controllers/donationPledgeType.test.js
git commit -m "feat: let online donations carry the pledge drive type and allocate"
```

---

### Task 4: `GET /api/pledges/balance`

**Files:**
- Modify: `backend/src/controllers/pledgeController.js` (add `getPledgeBalance`, export it)
- Modify: `backend/src/routes/pledgeRoutes.js` (register before `/:id`)
- Test: `backend/src/__tests__/controllers/pledgeBalance.test.js`

**Interfaces:**
- Consumes: `findLiveCampaign()` from `pledgeCampaignService`
- Produces: `GET /api/pledges/balance[?member_id=X]` → `{ success: true, pledge: {...}|null }`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/controllers/pledgeBalance.test.js`:

```js
'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign, Pledge, Member } = require('../../models');
const { createPledgeViews } = require('../../database/pledgeViews');
const { getPledgeBalance } = require('../../controllers/pledgeController');
const { todayInChurchTz } = require('../../services/pledgeCampaignService');

function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

let campaign;
let member;
let other;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await createPledgeViews(sequelize.getQueryInterface());
});

beforeEach(async () => {
  await Pledge.destroy({ where: {}, truncate: true, cascade: true });
  await PledgeCampaign.destroy({ where: {}, truncate: true, cascade: true });
  await Member.destroy({ where: {}, truncate: true, cascade: true });

  campaign = await PledgeCampaign.create({
    slug: 'live-drive', name: 'Live Drive', status: 'active',
    start_date: todayInChurchTz(), end_date: null
  });
  // Synthetic members only.
  member = await Member.create({
    first_name: 'Test',
    last_name: 'Pledger',
    phone_number: '+15550000201'
  });
  other = await Member.create({
    first_name: 'Test',
    last_name: 'Other',
    phone_number: '+15550000202'
  });
  await Pledge.create({
    campaign_id: campaign.id, member_id: member.id, amount: 500,
    first_name: 'Test', last_name: 'Pledger'
  });
});
// Deliberately no sequelize.close() here — see Global Constraints.

describe('GET /api/pledges/balance', () => {
  it('returns the caller\'s own pledge without needing a role', async () => {
    const res = mockRes();
    await getPledgeBalance({ query: {}, user: { member_id: member.id, roles: ['member'] } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.pledge.pledged_amount).toBe(500);
    expect(res.payload.pledge.paid_amount).toBe(0);
    expect(res.payload.pledge.remaining_amount).toBe(500);
    expect(res.payload.pledge.campaign_name).toBe('Live Drive');
  });

  it('returns null when the caller has no pledge', async () => {
    const res = mockRes();
    await getPledgeBalance({ query: {}, user: { member_id: other.id, roles: ['member'] } }, res);

    expect(res.payload.pledge).toBeNull();
  });

  it('returns null when no campaign is live', async () => {
    await campaign.update({ status: 'draft' });

    const res = mockRes();
    await getPledgeBalance({ query: {}, user: { member_id: member.id, roles: ['member'] } }, res);

    expect(res.payload.pledge).toBeNull();
  });

  it('refuses another member\'s pledge without a view role', async () => {
    const res = mockRes();
    await getPledgeBalance(
      { query: { member_id: String(member.id) }, user: { member_id: other.id, roles: ['member'] } },
      res
    );

    expect(res.statusCode).toBe(403);
  });

  it('allows a treasurer to read another member\'s pledge', async () => {
    const res = mockRes();
    await getPledgeBalance(
      { query: { member_id: String(member.id) }, user: { member_id: other.id, roles: ['treasurer'] } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.payload.pledge.remaining_amount).toBe(500);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/pledgeBalance.test.js`
Expected: FAIL — `getPledgeBalance is not a function`.

- [ ] **Step 3: Write the implementation**

In `backend/src/controllers/pledgeController.js`, confirm these are already required at the top (`Pledge`, `PledgeBalance` are; add the service):

```js
const { findLiveCampaign } = require('../services/pledgeCampaignService');
```

(`findLiveCampaign` is already imported by this file from earlier work — do not add a duplicate require.)

Add this function, and export it in `module.exports`:

```js
// Same vocabulary as pledgeRoutes.js — do not invent role names.
const BALANCE_VIEW_ROLES = ['admin', 'treasurer', 'church_leadership', 'secretary',
  'bookkeeper', 'auditor', 'budget_committee', 'ar_team', 'ap_team'];

/**
 * The member's pledge in the live campaign, with balances from
 * pledge_balances. Serves two callers with one payload: a member reading their
 * own (no role needed — it is their own record), and staff reading someone
 * else's via ?member_id, which does require a view role.
 */
const getPledgeBalance = async (req, res) => {
  try {
    const requestedId = req.query.member_id;
    const callerId = req.user.member_id;

    const targetId = requestedId ? String(requestedId) : String(callerId);
    const isSelf = targetId === String(callerId);

    if (!isSelf) {
      const roles = req.user.roles || [];
      if (!roles.some((r) => BALANCE_VIEW_ROLES.includes(r))) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view another member\'s pledge'
        });
      }
    }

    const campaign = await findLiveCampaign();
    if (!campaign) return res.status(200).json({ success: true, pledge: null });

    const pledge = await Pledge.findOne({
      where: {
        campaign_id: campaign.id,
        member_id: targetId,
        lifecycle: 'active',
        is_historical: false
      }
    });
    if (!pledge) return res.status(200).json({ success: true, pledge: null });

    // Balances come from the view (real payments), never from legacy_status.
    const balance = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });

    const pledged = parseFloat(balance?.pledged_amount ?? pledge.amount) || 0;
    const paid = parseFloat(balance?.paid_amount ?? 0) || 0;

    return res.status(200).json({
      success: true,
      pledge: {
        id: pledge.id,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        pledged_amount: pledged,
        paid_amount: paid,
        remaining_amount: pledged - paid
      }
    });
  } catch (error) {
    console.error('Error loading pledge balance:', error);
    return res.status(500).json({ success: false, message: 'Failed to load pledge balance' });
  }
};
```

In `backend/src/routes/pledgeRoutes.js`, add this **before** the `router.get('/:id', ...)` line, or `balance` is captured as an id:

```js
// Before /:id — otherwise "balance" is parsed as a pledge id.
// Authenticated but unrestricted: the controller allows a member their own
// record and requires a view role for anyone else's.
router.get('/balance', firebaseAuthMiddleware, pledgeController.getPledgeBalance);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/pledgeBalance.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/pledgeController.js backend/src/routes/pledgeRoutes.js backend/src/__tests__/controllers/pledgeBalance.test.js
git commit -m "feat: add a pledge balance endpoint for members and treasurers"
```

---

### Task 5: Frontend balance client and hook

**Files:**
- Create: `frontend/src/utils/pledgeBalanceApi.ts`
- Create: `frontend/src/hooks/usePledgeBalance.ts`
- Test: `frontend/src/hooks/__tests__/usePledgeBalance.test.tsx`

**Interfaces:**
- Produces:
  - `interface PledgeBalance { id: number; campaign_id: number; campaign_name: string; pledged_amount: number; paid_amount: number; remaining_amount: number; }`
  - `fetchPledgeBalance(memberId?: number): Promise<PledgeBalance | null>`
  - `usePledgeBalance(): { balance: PledgeBalance | null; loading: boolean; error: string | null }`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/__tests__/usePledgeBalance.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { usePledgeBalance } from '../usePledgeBalance';

const mockFetchBalance = jest.fn();
jest.mock('../../utils/pledgeBalanceApi', () => ({
  fetchPledgeBalance: (id?: number) => mockFetchBalance(id)
}));

const Probe: React.FC = () => {
  const { balance, loading, error } = usePledgeBalance();
  if (loading) return <div>loading</div>;
  if (error) return <div>error</div>;
  return <div>balance:{balance ? balance.remaining_amount : 'none'}</div>;
};

beforeEach(() => { jest.clearAllMocks(); });

describe('usePledgeBalance', () => {
  it('exposes the remaining balance', async () => {
    mockFetchBalance.mockResolvedValue({
      id: 1, campaign_id: 2, campaign_name: 'Live Drive',
      pledged_amount: 500, paid_amount: 200, remaining_amount: 300
    });

    render(<Probe />);
    expect(await screen.findByText('balance:300')).toBeInTheDocument();
  });

  it('reports none when the member has no pledge', async () => {
    mockFetchBalance.mockResolvedValue(null);

    render(<Probe />);
    expect(await screen.findByText('balance:none')).toBeInTheDocument();
  });

  it('fails quietly so a payment page never breaks', async () => {
    mockFetchBalance.mockRejectedValue(new Error('offline'));

    render(<Probe />);
    await waitFor(() => expect(screen.getByText('error')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="usePledgeBalance" --watchAll=false`
Expected: FAIL — `Cannot find module '../usePledgeBalance'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/utils/pledgeBalanceApi.ts`:

```ts
import { auth } from '../firebase';

/** A member's position in the live campaign, from pledge_balances. */
export interface PledgeBalance {
  id: number;
  campaign_id: number;
  campaign_name: string;
  pledged_amount: number;
  paid_amount: number;
  remaining_amount: number;
}

/**
 * The caller's own pledge, or another member's when memberId is given — the
 * latter requires a finance/leadership role at the API. Returns null when the
 * member has no active pledge or no campaign is live.
 */
export async function fetchPledgeBalance(memberId?: number): Promise<PledgeBalance | null> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  const token = await user.getIdToken();

  const query = memberId ? `?member_id=${memberId}` : '';
  const response = await fetch(
    `${process.env.REACT_APP_API_URL}/api/pledges/balance${query}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error('Failed to load pledge balance');

  const data = await response.json();
  return data.pledge ?? null;
}
```

Create `frontend/src/hooks/usePledgeBalance.ts`:

```ts
import { useState, useEffect } from 'react';
import { fetchPledgeBalance, PledgeBalance } from '../utils/pledgeBalanceApi';

interface PledgeBalanceState {
  balance: PledgeBalance | null;
  loading: boolean;
  error: string | null;
}

/**
 * The signed-in member's own pledge balance. Used by the Donate page to offer
 * "apply to my pledge" and by the Dues page for its banner. Both treat an
 * error as "no pledge": a payment page must never break because this lookup
 * failed.
 */
export function usePledgeBalance(): PledgeBalanceState {
  const [state, setState] = useState<PledgeBalanceState>({
    balance: null, loading: true, error: null
  });

  useEffect(() => {
    let cancelled = false;

    fetchPledgeBalance()
      .then((balance) => {
        if (!cancelled) setState({ balance, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ balance: null, loading: false, error: err.message || 'Failed to load' });
        }
      });

    return () => { cancelled = true; };
  }, []);

  return state;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="usePledgeBalance" --watchAll=false`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/pledgeBalanceApi.ts frontend/src/hooks/usePledgeBalance.ts frontend/src/hooks/__tests__/usePledgeBalance.test.tsx
git commit -m "feat: add pledge balance client and hook"
```

---

### Task 6: "Apply to my pledge" on the Donate page

**Files:**
- Modify: `frontend/src/components/StripePayment.tsx` (the `purpose` prop union, line ~28)
- Modify: `frontend/src/components/DonatePage.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`
- Test: `frontend/src/components/__tests__/DonatePagePledge.test.tsx`

**Interfaces:**
- Consumes: `usePledgeBalance()` from Task 5
- Produces: donations submitted with `purpose="pledge_drive"` when the option is ticked

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/__tests__/DonatePagePledge.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import DonatePage from '../DonatePage';

const mockUsePledgeBalance = jest.fn();
jest.mock('../../hooks/usePledgeBalance', () => ({
  usePledgeBalance: () => mockUsePledgeBalance()
}));

const mockAuth = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => mockAuth()
}));

// Capture what the payment components are told to charge for.
const mockStripeProps = jest.fn();
jest.mock('../StripePayment', () => (props: any) => {
  mockStripeProps(props);
  return <div>stripe</div>;
});
jest.mock('../ACHPayment', () => () => <div>ach</div>);

const BALANCE = {
  id: 1, campaign_id: 2, campaign_name: 'Live Drive',
  pledged_amount: 500, paid_amount: 200, remaining_amount: 300
};

const renderPage = () => render(
  <MemoryRouter><I18nProvider><LanguageProvider><DonatePage /></LanguageProvider></I18nProvider></MemoryRouter>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ user: { uid: 'test-uid' }, currentUser: { uid: 'test-uid' } });
  mockUsePledgeBalance.mockReturnValue({ balance: BALANCE, loading: false, error: null });
});

describe('DonatePage pledge option', () => {
  it('offers to apply the gift to an outstanding pledge', () => {
    renderPage();

    expect(screen.getByText(/apply to my pledge/i)).toBeInTheDocument();
    expect(screen.getByText(/\$300/)).toBeInTheDocument();
  });

  it('sends the pledge purpose once the option is ticked', async () => {
    renderPage();

    await userEvent.click(screen.getByLabelText(/apply to my pledge/i));

    // Without this the webhook types the payment 'donation' and the rule
    // never fires.
    const lastCall = mockStripeProps.mock.calls[mockStripeProps.mock.calls.length - 1][0];
    expect(lastCall.purpose).toBe('pledge_drive');
  });

  it('says nothing about pledges to a visitor who is not signed in', () => {
    mockAuth.mockReturnValue({ user: null, currentUser: null });
    mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false, error: null });

    renderPage();

    expect(screen.queryByText(/apply to my pledge/i)).not.toBeInTheDocument();
  });

  it('says nothing when the member has no outstanding pledge', () => {
    mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false, error: null });

    renderPage();

    expect(screen.queryByText(/apply to my pledge/i)).not.toBeInTheDocument();
  });

  it('says nothing when the pledge is already fully paid', () => {
    mockUsePledgeBalance.mockReturnValue({
      balance: { ...BALANCE, paid_amount: 500, remaining_amount: 0 }, loading: false, error: null
    });

    renderPage();

    expect(screen.queryByText(/apply to my pledge/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="DonatePagePledge" --watchAll=false`
Expected: FAIL — no such option renders.

- [ ] **Step 3: Add the strings**

In `frontend/src/i18n/dictionaries.ts`, add to the `donatePage` block in **both** `en` and `ti`, and to the `Dictionaries` interface's `donatePage` block.

`en`:

```ts
    applyToPledge: "Apply to my pledge",
    pledgeRemaining: "{amount} still outstanding on your {campaign} pledge",
```

`ti` (draft, flagged in Task 10):

```ts
    applyToPledge: "ናብ መብጽዓይ የውዕሎ",
    pledgeRemaining: "ካብ መብጽዓኹም ናይ {campaign} {amount} ተሪፉ ኣሎ",
```

Interface:

```ts
    applyToPledge: string;
    pledgeRemaining: string;
```

- [ ] **Step 4: Write the implementation**

In `frontend/src/components/StripePayment.tsx`, widen the `purpose` union on line ~28 so the pledge type can be passed at all:

```tsx
  // Optional payment purpose coming from Add Payment Screen dropdown
  purpose?: 'membership_due' | 'tithe' | 'donation' | 'event' | 'other' | 'pledge_drive';
```

In `frontend/src/components/DonatePage.tsx`, add the imports:

```tsx
import { usePledgeBalance } from '../hooks/usePledgeBalance';
```

Inside the component, alongside the existing state:

```tsx
  const { balance: pledgeBalance } = usePledgeBalance();
  const [applyToPledge, setApplyToPledge] = useState(false);

  // Only worth offering while money is actually owed on a pledge. An errored
  // lookup leaves balance null, so the option simply does not appear — a
  // payment page must never break because of this.
  const canApplyToPledge = Boolean(user && pledgeBalance && pledgeBalance.remaining_amount > 0);
```

Render the option above the payment method selector (before the `value="card"` block):

```tsx
        {canApplyToPledge && pledgeBalance && (
          <div className="mb-6 rounded-lg border border-primary-200 bg-primary-50 p-4">
            <label htmlFor="applyToPledge" className="flex items-start gap-3 cursor-pointer">
              <input
                id="applyToPledge"
                type="checkbox"
                checked={applyToPledge}
                onChange={(e) => setApplyToPledge(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-accent-900">
                  {t('donatePage.applyToPledge')}
                </span>
                <span className="block text-sm text-accent-700">
                  {t('donatePage.pledgeRemaining', {
                    amount: `$${pledgeBalance.remaining_amount.toLocaleString()}`,
                    campaign: pledgeBalance.campaign_name
                  })}
                </span>
              </span>
            </label>
          </div>
        )}
```

Then pass the purpose to **both** payment components, replacing each existing `<StripePayment ... />` and `<ACHPayment ... />` usage by adding this prop:

```tsx
          purpose={applyToPledge ? 'pledge_drive' : 'donation'}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="DonatePagePledge" --watchAll=false`
Expected: PASS — 5 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DonatePage.tsx frontend/src/components/StripePayment.tsx frontend/src/components/__tests__/DonatePagePledge.test.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat: let a member put an online gift toward their pledge"
```

---

### Task 7: Dues page pledge banner

**Files:**
- Modify: `frontend/src/components/DuesPage.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`
- Test: `frontend/src/components/__tests__/DuesPagePledge.test.tsx`

**Interfaces:**
- Consumes: `usePledgeBalance()` from Task 5
- Produces: a link to `/donate`; **no** payment behaviour

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/__tests__/DuesPagePledge.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import DuesPage from '../DuesPage';

const mockUsePledgeBalance = jest.fn();
jest.mock('../../hooks/usePledgeBalance', () => ({
  usePledgeBalance: () => mockUsePledgeBalance()
}));

jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => ({ user: { uid: 'test-uid' }, currentUser: { uid: 'test-uid' } })
}));

const renderPage = () => render(
  <MemoryRouter><I18nProvider><LanguageProvider><DuesPage /></LanguageProvider></I18nProvider></MemoryRouter>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePledgeBalance.mockReturnValue({
    balance: {
      id: 1, campaign_id: 2, campaign_name: 'Live Drive',
      pledged_amount: 500, paid_amount: 200, remaining_amount: 300
    },
    loading: false, error: null
  });
});

describe('DuesPage pledge banner', () => {
  it('points a member with an outstanding pledge at the donate page', () => {
    renderPage();

    expect(screen.getByText(/\$300/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /pledge/i });
    expect(link).toHaveAttribute('href', '/donate');
  });

  it('shows nothing when there is no outstanding pledge', () => {
    mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false, error: null });

    renderPage();

    expect(screen.queryByText(/pledge/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="DuesPagePledge" --watchAll=false`
Expected: FAIL — no banner renders.

- [ ] **Step 3: Add the strings**

In `frontend/src/i18n/dictionaries.ts`, add to the `duesPage` block in **both** `en` and `ti`, and to the `Dictionaries` interface's `duesPage` block.

`en`:

```ts
    pledgeBannerTitle: "You have an open pledge",
    pledgeBannerBody: "{amount} still outstanding on your {campaign} pledge.",
    pledgeBannerCta: "Pay toward my pledge",
```

`ti` (draft, flagged in Task 10):

```ts
    pledgeBannerTitle: "ክፉት መብጽዓ ኣለኩም",
    pledgeBannerBody: "ካብ መብጽዓኹም ናይ {campaign} {amount} ተሪፉ ኣሎ።",
    pledgeBannerCta: "ናብ መብጽዓይ ክኸፍል",
```

Interface:

```ts
    pledgeBannerTitle: string;
    pledgeBannerBody: string;
    pledgeBannerCta: string;
```

- [ ] **Step 4: Write the implementation**

In `frontend/src/components/DuesPage.tsx`, add the imports:

```tsx
import { Link } from 'react-router-dom';
import { usePledgeBalance } from '../hooks/usePledgeBalance';
```

(If `Link` is already imported, do not add it twice.)

Inside the component, above the return:

```tsx
  const { balance: pledgeBalance } = usePledgeBalance();
```

Render near the top of the page body, before the dues content:

```tsx
      {/* A banner only. Dues are membership_due with their own GL code; letting
          a dues payment retype itself as pledge_drive would make the ledger and
          the member's dues record disagree about what they paid. */}
      {pledgeBalance && pledgeBalance.remaining_amount > 0 && (
        <div className="mb-6 rounded-lg border border-primary-200 bg-primary-50 p-4">
          <div className="font-semibold text-accent-900">{t('duesPage.pledgeBannerTitle')}</div>
          <p className="mt-1 text-sm text-accent-700">
            {t('duesPage.pledgeBannerBody', {
              amount: `$${pledgeBalance.remaining_amount.toLocaleString()}`,
              campaign: pledgeBalance.campaign_name
            })}
          </p>
          <Link to="/donate" className="mt-2 inline-block text-primary-700 font-medium hover:underline">
            {t('duesPage.pledgeBannerCta')}
          </Link>
        </div>
      )}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="DuesPagePledge" --watchAll=false`
Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DuesPage.tsx frontend/src/components/__tests__/DuesPagePledge.test.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat: point members with an open pledge from dues to donate"
```

---

### Task 8: Treasurer Add Payment — pledge type and inline balance

**Files:**
- Modify: `frontend/src/components/admin/AddPaymentModal.tsx` (`transactionPaymentTypes` at line ~411; the Payment Type select at line ~675)
- Modify: `frontend/src/i18n/dictionaries.ts`
- Test: `frontend/src/components/admin/__tests__/AddPaymentModalPledge.test.tsx`

**Interfaces:**
- Consumes: `fetchPledgeBalance(memberId)` from Task 5
- Produces: `pledge_drive` selectable; balance shown for a member who has a pledge

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/__tests__/AddPaymentModalPledge.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import AddPaymentModal from '../AddPaymentModal';

const mockFetchBalance = jest.fn();
jest.mock('../../../utils/pledgeBalanceApi', () => ({
  fetchPledgeBalance: (id?: number) => mockFetchBalance(id)
}));

jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => ({
    user: { uid: 'test-uid' },
    currentUser: { uid: 'test-uid', getIdToken: async () => 'test-token' },
    firebaseUser: { getIdToken: async () => 'test-token' }
  })
}));

// Synthetic member — never a real one.
const MEMBER = {
  id: 42,
  first_name: 'Test',
  last_name: 'Pledger',
  phone_number: '+15550000301'
};

const renderModal = () => render(
  <I18nProvider>
    <LanguageProvider>
      <AddPaymentModal isOpen={true} onClose={() => {}} onSuccess={() => {}} member={MEMBER as any} />
    </LanguageProvider>
  </I18nProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, json: async () => ({ success: true, categories: [], incomeCategories: [] })
  }) as unknown as typeof fetch;
  mockFetchBalance.mockResolvedValue({
    id: 1, campaign_id: 2, campaign_name: 'Live Drive',
    pledged_amount: 500, paid_amount: 200, remaining_amount: 300
  });
});

describe('AddPaymentModal pledge support', () => {
  it('offers the pledge drive payment type', async () => {
    renderModal();

    // Without this option a treasurer cannot record drive money with the
    // correct type at all, so it never reaches a pledge.
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /pledge drive/i })).toBeInTheDocument();
    });
  });

  it('shows the selected member\'s outstanding pledge', async () => {
    renderModal();

    expect(await screen.findByText(/\$300/)).toBeInTheDocument();
    await waitFor(() => expect(mockFetchBalance).toHaveBeenCalledWith(42));
  });

  it('shows no pledge line for a member without one', async () => {
    mockFetchBalance.mockResolvedValue(null);
    renderModal();

    await waitFor(() => expect(mockFetchBalance).toHaveBeenCalled());
    expect(screen.queryByText(/active pledge/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="AddPaymentModalPledge" --watchAll=false`
Expected: FAIL — no `pledge_drive` option exists.

- [ ] **Step 3: Add the strings**

In `frontend/src/i18n/dictionaries.ts`, add to the `fundraising` block in **both** `en` and `ti`, and to the interface:

`en`:

```ts
    activePledge: "Active pledge: {pledged} — {remaining} remaining",
```

`ti` (draft, flagged in Task 10):

```ts
    activePledge: "ንጡፍ መብጽዓ፦ {pledged} — {remaining} ተሪፉ",
```

Interface:

```ts
    activePledge: string;
```

- [ ] **Step 4: Write the implementation**

In `frontend/src/components/admin/AddPaymentModal.tsx`, add to the imports:

```tsx
import { fetchPledgeBalance, PledgeBalance } from '../../utils/pledgeBalanceApi';
```

Add state alongside the existing state declarations:

```tsx
  const [pledgeBalance, setPledgeBalance] = useState<PledgeBalance | null>(null);
```

Add this effect after the existing effects:

```tsx
  // The treasurer needs to see what a pledge_drive payment will land on. A
  // failed lookup is not worth blocking payment entry, so it just clears.
  useEffect(() => {
    let cancelled = false;
    if (!member?.id) { setPledgeBalance(null); return; }

    fetchPledgeBalance(member.id)
      .then((balance) => { if (!cancelled) setPledgeBalance(balance); })
      .catch(() => { if (!cancelled) setPledgeBalance(null); });

    return () => { cancelled = true; };
  }, [member?.id]);
```

Add `pledge_drive` to `transactionPaymentTypes` (line ~411), after the `building_fund` entry:

```tsx
      { value: 'pledge_drive', label: 'Pledge Drive / Fundraising (ወፈያ)' },
```

Directly below the Payment Type `<select>` closing tag (line ~692), add the inline balance:

```tsx
                {pledgeBalance && (
                  <p className="mt-2 text-sm text-primary-700">
                    {t('fundraising.activePledge', {
                      pledged: `$${pledgeBalance.pledged_amount.toLocaleString()}`,
                      remaining: `$${pledgeBalance.remaining_amount.toLocaleString()}`
                    })}
                  </p>
                )}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="AddPaymentModalPledge" --watchAll=false`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/AddPaymentModal.tsx frontend/src/components/admin/__tests__/AddPaymentModalPledge.test.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat: let a treasurer record a pledge drive payment against a balance"
```

---

### Task 9: Over-fulfilment never renders as a negative

**Files:**
- Modify: `frontend/src/components/PledgeTracker.tsx` (goal bar)
- Modify: `frontend/src/components/admin/FundraisingCampaigns.tsx` (row totals)
- Modify: `frontend/src/components/admin/CampaignDonors.tsx` (outstanding column)
- Modify: `frontend/src/i18n/dictionaries.ts`
- Test: existing `PledgeTracker.test.tsx`, `FundraisingCampaigns.test.tsx`, `CampaignDonors.test.tsx` (append)

**Interfaces:**
- Consumes: nothing new
- Produces: no signature changes

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/components/__tests__/PledgeTracker.test.tsx`, inside the existing `describe('PledgeTracker', ...)`:

```tsx
  it('caps the goal bar at 100% when a drive is over-subscribed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        stats: {
          total_pledged: 15000, total_fulfilled: 0, total_remaining: 15000,
          fulfillment_rate: '0.0', status_breakdown: []
        }
      })
    }) as unknown as typeof fetch;

    renderTracker();

    // $15,000 against a $10,000 goal is 150%; showing that reads as a bug.
    expect(await screen.findByText(/100% of goal pledged/i)).toBeInTheDocument();
    expect(screen.queryByText(/150%/)).not.toBeInTheDocument();
  });
```

Append to `frontend/src/components/admin/__tests__/CampaignDonors.test.tsx`:

```tsx
describe('over-fulfilled donors', () => {
  it('shows an over-payment as zero outstanding plus an over-by note', async () => {
    mockFetchDonors.mockResolvedValue([
      { id: 5, name: 'Test Generous', amount: 300, paid_amount: 500, remaining_amount: -200, status: 'fulfilled', is_historical: false, pledge_type: 'one_time', created_at: '2026-02-05T00:00:00Z' }
    ]);
    renderDonors();

    await screen.findByText('Test Generous');
    expect(screen.getByText(/over by/i)).toBeInTheDocument();
    expect(screen.queryByText(/-\$200/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="PledgeTracker|CampaignDonors" --watchAll=false`
Expected: FAIL — the tracker prints `150%`, and the donor row prints `-$200`.

- [ ] **Step 3: Add the strings**

In `frontend/src/i18n/dictionaries.ts`, add to the `fundraising` block in **both** `en` and `ti`, and to the interface:

`en`:

```ts
    overBy: "over by {amount}",
```

`ti` (draft, flagged in Task 10):

```ts
    overBy: "ብ{amount} ኣሕሊፉ",
```

Interface:

```ts
    overBy: string;
```

- [ ] **Step 4: Write the implementation**

In `frontend/src/components/PledgeTracker.tsx`, the goal percentage is computed twice — for the bar width and for the label. Clamp both by introducing one value above the `return`:

```tsx
  // A drive can exceed its goal (a payment lands in full on a pledge even when
  // it overshoots), so clamp: >100% reads as a rendering bug, not generosity.
  const goalPercent = goalAmount
    ? Math.min(100, (stats.total_pledged / goalAmount) * 100)
    : 0;
```

Then replace the bar's inline width expression with `${goalPercent}%` and the label expression with `{goalPercent.toFixed(0)}%`.

In `frontend/src/components/admin/CampaignDonors.tsx`, replace the outstanding cell:

```tsx
                  <td className="py-2 pr-4 text-right">
                    {donor.remaining_amount < 0 ? (
                      <span>
                        {money(0)}{' '}
                        <span className="text-xs text-gray-500">
                          {t('fundraising.overBy', { amount: money(-donor.remaining_amount) })}
                        </span>
                      </span>
                    ) : money(donor.remaining_amount)}
                  </td>
```

In `frontend/src/components/admin/FundraisingCampaigns.tsx`, apply the same treatment to the campaign row's outstanding figure, replacing that `<span>`:

```tsx
                    <span>{t('fundraising.outstanding')}: <strong>
                      {parseFloat(campaign.totals.outstanding || '0') < 0
                        ? money('0')
                        : money(campaign.totals.outstanding) ?? '$0'}
                    </strong></span>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="PledgeTracker|CampaignDonors|FundraisingCampaigns" --watchAll=false`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PledgeTracker.tsx frontend/src/components/admin/CampaignDonors.tsx frontend/src/components/admin/FundraisingCampaigns.tsx frontend/src/components/__tests__/PledgeTracker.test.tsx frontend/src/components/admin/__tests__/CampaignDonors.test.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat: render over-fulfilled pledges without negative outstanding"
```

---

### Task 10: Flag the Tigrigna drafts and verify the whole feature

**Files:**
- Modify: `tigrigna-translation-review.md`

- [ ] **Step 1: Append the review entry**

Add to the end of `tigrigna-translation-review.md`:

```markdown
## Pledge payment allocation (Aug 2026)

New `donatePage.applyToPledge` / `pledgeRemaining`, `duesPage.pledgeBanner*`,
and `fundraising.activePledge` / `overBy` keys. All are seen by members paying
online, except `activePledge`, which is treasurer-facing. Drafts by a
non-native speaker.

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| donatePage.applyToPledge | Apply to my pledge | ናብ መብጽዓይ የውዕሎ | ⚠️ confirm this reads as an instruction the donor is giving, not a statement |
| donatePage.pledgeRemaining | {amount} still outstanding on your {campaign} pledge | ካብ መብጽዓኹም ናይ {campaign} {amount} ተሪፉ ኣሎ | ⚠️ confirm the placeholder order still reads naturally in Tigrigna |
| duesPage.pledgeBannerTitle | You have an open pledge | ክፉት መብጽዓ ኣለኩም | ⚠️ confirm "ክፉት" is right for an unpaid obligation rather than an open door |
| duesPage.pledgeBannerCta | Pay toward my pledge | ናብ መብጽዓይ ክኸፍል | ⚠️ confirm this works as a button label |
| fundraising.activePledge | Active pledge: {pledged} — {remaining} remaining | ንጡፍ መብጽዓ፦ {pledged} — {remaining} ተሪፉ | ⚠️ treasurer-facing; confirm the dash construction is idiomatic |
| fundraising.overBy | over by {amount} | ብ{amount} ኣሕሊፉ | ⚠️ confirm this conveys "paid more than pledged" and not "overdue" |
```

- [ ] **Step 2: Run the full backend suite**

Run: `cd backend && npm test`
Expected: PASS, 0 failures.

- [ ] **Step 3: Run the full frontend suite**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false`
Expected: PASS, 0 failures.

- [ ] **Step 4: Typecheck the frontend**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors in any file this plan touched. Pre-existing errors in `AuthContext.test.tsx`, `errorTracking.test.ts`, `analytics.test.ts` and `RegistrationSteps.test.tsx` are unrelated and were there before — do not fix them here.

- [ ] **Step 5: Verify end to end against a running stack**

With the backend and frontend running locally (`npm run dev` from the repo root — confirm nothing stale already holds port 5001, or the new process will not bind and you will be testing old code):

```bash
# A member with an active pledge in the live campaign:
curl -s "localhost:5001/api/pledges/stats?campaign_id=<live id>"
```

Note `total_fulfilled`. Then, in the admin dashboard, open Add Payment for that
member, choose **Pledge Drive / Fundraising**, confirm the inline balance shows,
and record a cash payment. Re-run the curl: `total_fulfilled` must increase by
the payment amount, and the member's row in the campaign donor list must move
from `not_started` to `partially_fulfilled` or `fulfilled`.

Then sign in as that member, visit `/dues` and confirm the banner appears, follow
it to `/donate`, and confirm the "Apply to my pledge" option shows the right
remaining amount.

- [ ] **Step 6: Commit**

```bash
git add tigrigna-translation-review.md
git commit -m "docs: flag pledge payment Tigrigna drafts for review"
```

---

## Self-Review Notes

**Spec coverage:** §3 the core rule → Task 1. §3.1 helper signature → Task 1. §3.2 full-amount overpayment → Task 1 (behaviour) and Task 9 (display). §4 invocation points → Tasks 2 and 3. §4.1 `allowedTypes` silent downgrade → Task 3. §5.1 balance endpoint → Task 4. §6.1 Donate → Task 6. §6.2 Dues → Task 7. §6.3 Add Payment → Task 8. §6.4 over-fulfilment display → Task 9. §7 recording-money-always-wins → Tasks 2 and 3, each with an explicit test. §8 edge cases → Task 1's precondition tests plus Task 6's signed-out and fully-paid cases. §9 testing → distributed. Bilingual requirement → Tasks 6, 7, 8, 9; review flagging → Task 10.

**Not covered by any task, by design:** everything in spec §10 — the unallocated-queue UI, Square/Zelle/bank auto-allocation, refund-driven reversal UI, recurring donations, and deleting `PledgeManagement.tsx`.

**Type consistency:** `maybeAllocateToPledge(txn, { source, allocatedBy }, { transaction })` is used with that exact shape in Tasks 1, 2 and 3. `PledgeBalance` (Task 5) uses `pledged_amount` / `paid_amount` / `remaining_amount` / `campaign_name`, matching the endpoint's payload in Task 4 and every consumer in Tasks 6, 7 and 8. `fetchPledgeBalance(memberId?)` takes an optional number in Task 5 and is called with `member.id` in Task 8 and no argument in Task 5's hook.
