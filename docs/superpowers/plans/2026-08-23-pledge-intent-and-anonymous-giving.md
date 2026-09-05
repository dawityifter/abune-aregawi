# Pledge Intent & Anonymous Giving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the pledge page ask explicitly whether the giver is pledging for later or pledging and paying now, and allow an anonymous contribution only when the money arrives with the pledge.

**Architecture:** Payment-first. No pledge row exists until money succeeds; intent travels in Stripe metadata and `handlePaymentSucceeded` writes transaction, pledge, and allocation in one DB transaction. Fulfillment stays derived from `pledge_allocations` through the existing `pledge_balances` view — no view is rewritten. Three new columns on `pledges` carry the recorded intent and the donor's anonymity wish.

**Tech Stack:** Node/Express, Sequelize, PostgreSQL (production) / SQLite in-memory (tests), Jest + supertest, React + TypeScript (CRA), Stripe, Firebase Auth.

**Spec:** `docs/superpowers/specs/2026-08-23-pledge-intent-and-anonymous-giving-design.md`

## Global Constraints

- **Never commit real member data.** All fixtures synthetic — invented names, `+1555…` phone numbers, invented amounts. This repo holds real church PII and financial records.
- **Tests run against SQLite in memory.** `tests/setup.js` sets `DATABASE_URL=sqlite::memory:` and builds the schema with `sequelize.sync({ force: true })` — **it does not run migrations**. Therefore every Postgres `CHECK` constraint MUST have a mirror in the model's `validate` block, or it is untested and unenforced in development.
- **Postgres-only DDL must be guarded.** Partial indexes and `ALTER TABLE … ADD CONSTRAINT … CHECK` do not exist on SQLite. Follow the existing pattern: `const isPg = queryInterface.sequelize.getDialect() === 'postgres';` and wrap those statements in `if (isPg) { … }`.
- **Migrations live in `backend/migrations/`** (sequelize-cli), named `YYYYMMDDHHMMSS-short-description.js`, wrapped in `queryInterface.sequelize.transaction`, with a working `down()`. They auto-run on deploy to `main`.
- **`pledge_allocations` is append-only.** Never issue UPDATE or DELETE against it. Corrections are negative reversing rows via `reverse()`. A Postgres trigger enforces this in production.
- **Recording money always wins.** If pledge linking fails, log it and let the payment stand. A payment must never be rejected or rolled back because it could not be tied to a pledge.
- **Do not commit or push without asking.** The repo owner tests locally before any deploy. Steps below say "Commit" — stage and commit locally only; never push.
- **Role vocabulary is fixed.** View: `admin`, `treasurer`, `church_leadership`, `secretary`, `bookkeeper`, `auditor`, `budget_committee`, `ar_team`, `ap_team`. Edit: `admin`, `treasurer`, `bookkeeper`, `ar_team`. Do not invent role names.
- **Backend tests:** `cd backend && npx jest <path>`. **Frontend tests:** `cd frontend && CI=true npx react-scripts test --watchAll=false <path>`.

## File Structure

**Backend — created**

| File | Responsibility |
|---|---|
| `backend/migrations/20260823100000-make-transaction-collected-by-nullable.js` | Widen `transactions.collected_by` to nullable |
| `backend/migrations/20260823110000-add-pledge-intent-and-anonymity.js` | Three `pledges` columns, two CHECKs, index swap |
| `backend/src/services/pledgeFulfillmentService.js` | The one place a pledge and its allocation are born together |
| `backend/tests/unit/anonymousDonationLedger.test.js` | Task 1 |
| `backend/tests/unit/pledgeIntentAnonymity.test.js` | Task 2 |
| `backend/tests/unit/pledgeIntentDeterminism.test.js` | Task 3 |
| `backend/tests/integration/pledgeCreateAuth.test.js` | Task 4 |
| `backend/tests/unit/pledgeFulfillmentService.test.js` | Task 5 |
| `backend/tests/integration/pledgeWithPayment.test.js` | Task 6 |
| `backend/tests/unit/pledgeCheckoutIntent.test.js` | Task 7 |
| `backend/tests/unit/pledgeStatsAnonymity.test.js` | Task 8 |

**Backend — modified**

| File | Change |
|---|---|
| `backend/src/models/Transaction.js` | `collected_by` → `allowNull: true` |
| `backend/src/models/Pledge.js` | Three fields, two `validate` blocks, index predicate |
| `backend/src/controllers/donationController.js` | Non-member transactions; pledge-intent guard; immediate-pledge creation; export `handlePaymentSucceeded` |
| `backend/src/controllers/pledgeController.js` | Auth-resolved `member_id`; `fulfillment_intent` filter; anonymity masking in stats |
| `backend/src/controllers/pledgeAllocationController.js` | `createPledgeWithPaymentHandler` |
| `backend/src/routes/pledgeRoutes.js` | Auth on `POST /`; new `POST /with-payment` |
| `backend/src/services/pledgeAllocationService.js` | `fulfillment_intent: 'later'` in two lookups |

**Frontend — created**

| File | Responsibility |
|---|---|
| `frontend/src/components/pledge/PledgeIntentSelector.tsx` | The three-way choice |
| `frontend/src/components/pledge/PledgeLaterForm.tsx` | Flow 1 |
| `frontend/src/components/pledge/PledgeCheckoutForm.tsx` | Flows 2 and 3 (Stripe inline) |

**Frontend — modified**

| File | Change |
|---|---|
| `frontend/src/pages/PledgePage.tsx` | Route between states; remove the email claim |
| `frontend/src/utils/dataTransformers.ts` | `collectedBy: number \| null` |
| `frontend/src/components/admin/TransactionList.tsx` | "Online" fallback for a null collector |
| `frontend/src/components/admin/AddPaymentModal.tsx` | "Also record as a pledge" block |
| `frontend/src/i18n/dictionaries.ts` | New `en` and `ti` keys |
| `tigrigna-translation-review.md` | Flag new Tigrigna drafts |

---

### Task 1: Anonymous online donations reach the ledger

Implements spec §4.2, §6.3, §7.2, §7.6 (first half), flaw 5. This is a prerequisite for every anonymous pledge task: an anonymous pledge payment writes a transaction with `member_id IS NULL` and hits the same `collected_by NOT NULL` wall.

**Files:**
- Create: `backend/migrations/20260823100000-make-transaction-collected-by-nullable.js`
- Create: `backend/tests/unit/anonymousDonationLedger.test.js`
- Modify: `backend/src/models/Transaction.js:53-62`
- Modify: `backend/src/controllers/donationController.js` (the `handlePaymentSucceeded` body, and the `module.exports` block at the end)
- Modify: `frontend/src/utils/dataTransformers.ts:259,287`
- Modify: `frontend/src/components/admin/TransactionList.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `handlePaymentSucceeded(paymentIntent)` is exported from `donationController` (Tasks 7 depends on this export). `transactions.collected_by` accepts `null`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/anonymousDonationLedger.test.js`:

```js
'use strict';

const { Transaction, LedgerEntry, sequelize } = require('../../src/models');
const { handlePaymentSucceeded } = require('../../src/controllers/donationController');

// A Stripe payment intent whose metadata resolves to no member at all.
const anonymousIntent = (id) => ({
  id,
  amount: 25000,
  amount_received: 25000,
  created: Math.floor(Date.now() / 1000),
  metadata: {
    purpose: 'donation',
    donor_name: 'Test Anonymous Giver',
    donor_type: 'individual'
  }
});

describe('anonymous Stripe donations reach the books', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
  });

  it('creates a transaction with a null member and a null collector', async () => {
    await handlePaymentSucceeded(anonymousIntent('pi_anon_001'));

    const txn = await Transaction.findOne({ where: { external_id: 'pi_anon_001' } });
    expect(txn).not.toBeNull();
    expect(txn.member_id).toBeNull();
    expect(txn.collected_by).toBeNull();
    expect(txn.amount).toBe('250.00');
    expect(txn.status).toBe('succeeded');
  });

  it('records the donor in the note block the dashboard parses', async () => {
    await handlePaymentSucceeded(anonymousIntent('pi_anon_002'));

    const txn = await Transaction.findOne({ where: { external_id: 'pi_anon_002' } });
    expect(txn.donor_name).toBe('Test Anonymous Giver');
    expect(txn.note).toContain('[Anonymous Donor]');
    expect(txn.note).toContain('Name: Test Anonymous Giver');
  });

  it('creates a ledger entry so the money is on the books', async () => {
    await handlePaymentSucceeded(anonymousIntent('pi_anon_003'));

    const txn = await Transaction.findOne({ where: { external_id: 'pi_anon_003' } });
    const entry = await LedgerEntry.findOne({ where: { transaction_id: txn.id } });
    expect(entry).not.toBeNull();
    expect(entry.member_id).toBeNull();
    expect(parseFloat(entry.amount)).toBe(250);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest tests/unit/anonymousDonationLedger.test.js`
Expected: FAIL — `handlePaymentSucceeded is not a function` (it is not exported yet).

- [ ] **Step 3: Write the migration**

Create `backend/migrations/20260823100000-make-transaction-collected-by-nullable.js`:

```js
'use strict';

// transactions.collected_by is NOT NULL, and handlePaymentSucceeded sets it to
// the resolved member id. An online gift from a non-member has no member and
// therefore no collector — nobody collected it. Rather than invent a "system
// member" (which would pollute the members table, whose rows mean "registered
// parishioner"), the column becomes nullable. ledger_entries.collected_by
// already works this way: "Can be null for system-generated entries".

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const isPg = queryInterface.sequelize.getDialect() === 'postgres';

    await queryInterface.sequelize.transaction(async (t) => {
      if (isPg) {
        // Raw ALTER rather than changeColumn: changeColumn re-emits the FK
        // definition, which on Postgres can drop and recreate the constraint
        // (and its ON DELETE RESTRICT) as a side effect. Dropping NOT NULL is
        // all we want.
        await queryInterface.sequelize.query(
          'ALTER TABLE transactions ALTER COLUMN collected_by DROP NOT NULL;',
          { transaction: t }
        );
      } else {
        await queryInterface.changeColumn('transactions', 'collected_by', {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: 'members', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        }, { transaction: t });
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    const isPg = queryInterface.sequelize.getDialect() === 'postgres';

    // This down() FAILS BY DESIGN if any anonymous online gift has been
    // recorded since up() ran, because there is no correct member id to put in
    // those rows and inventing one would corrupt "who collected this". If you
    // genuinely need to roll back, decide what those payments should say first.
    await queryInterface.sequelize.transaction(async (t) => {
      const [rows] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) AS n FROM transactions WHERE collected_by IS NULL;',
        { transaction: t }
      );
      const nullCount = parseInt(rows[0].n, 10);
      if (nullCount > 0) {
        throw new Error(
          `Cannot restore NOT NULL: ${nullCount} transaction(s) have a null collected_by. ` +
          'These are anonymous online gifts with no collector. Resolve them first.'
        );
      }

      if (isPg) {
        await queryInterface.sequelize.query(
          'ALTER TABLE transactions ALTER COLUMN collected_by SET NOT NULL;',
          { transaction: t }
        );
      } else {
        await queryInterface.changeColumn('transactions', 'collected_by', {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'members', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        }, { transaction: t });
      }
    });
  }
};
```

- [ ] **Step 4: Update the Transaction model**

In `backend/src/models/Transaction.js`, change the `collected_by` definition (around line 53) from `allowNull: false` to:

```js
    collected_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'members',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      comment: 'Member who collected the payment. Null for online self-service gifts, which nobody collected.'
    },
```

- [ ] **Step 5: Fix handlePaymentSucceeded**

In `backend/src/controllers/donationController.js`, add the import near the other requires at the top of the file:

```js
const { buildDonorNote } = require('../utils/donorNote');
```

Replace the early return (currently around line 428):

```js
    if (!memberId) {
      console.warn('⚠️ Stripe webhook: could not resolve member for paymentIntent', paymentIntent.id);
      return;
    }
```

with:

```js
    // No resolvable member is NOT a reason to drop the payment. Returning here
    // is how every non-member online gift used to vanish before reaching the
    // books: no Transaction meant no LedgerEntry and no GL coding, while the
    // money sat in Stripe. Record it as an anonymous gift instead.
    const isAnonymousGift = !memberId;
    if (isAnonymousGift) {
      console.warn('ℹ️ Stripe payment has no resolvable member; recording as an anonymous gift:', paymentIntent.id);
    }

    const donorName = md.donor_name || md.baptismName || md.donor_full_name || null;
```

Then in the `Transaction.create({ … })` call (around line 498), replace the `collected_by` and `note` lines and add `donor_name`:

```js
    const baseNote = `Stripe payment ${paymentIntent.id}`;
    const transaction = await Transaction.create({
      member_id: memberId,
      // Null for an anonymous gift: nobody collected it. For a member payment
      // this stays attributed to the member, as before.
      collected_by: memberId,
      payment_date: occurredAt,
      amount,
      payment_type,
      payment_method,
      receipt_number: paymentIntent.charges?.data?.[0]?.receipt_number || null,
      note: isAnonymousGift
        ? buildDonorNote(baseNote, {
            donor_type: md.donor_type || null,
            donor_name: donorName,
            donor_email: md.donor_email || null,
            donor_phone: md.donor_phone || null
          })
        : baseNote,
      donor_name: isAnonymousGift ? donorName : null,
      external_id: paymentIntent.id,
      status: 'succeeded',
      donation_id: (await Donation.findOne({ where: { stripe_payment_intent_id: paymentIntent.id } }))?.id || null
    });
```

In the `LedgerEntry.create({ … })` call that follows (around line 530), add the donor name so non-member income is attributable in the ledger too:

```js
        member_id: memberId,
        donor_name: isAnonymousGift ? donorName : null,
```

Finally, add `handlePaymentSucceeded` to the `module.exports` block at the bottom of the file:

```js
module.exports = {
  createPaymentIntent,
  confirmPayment,
  getDonation,
  getAllDonations,
  handleWebhook,
  // Exported for tests and for the pledge-intent path in pledgeFulfillmentService.
  handlePaymentSucceeded
};
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npx jest tests/unit/anonymousDonationLedger.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 7: Run the surrounding backend suites for regressions**

Run: `cd backend && npx jest tests/unit tests/integration src/__tests__`
Expected: PASS. If a test fails asserting `collected_by` is required, that assertion is now wrong — update it to match the new nullable contract.

- [ ] **Step 8: Make the frontend tolerate a null collector**

In `frontend/src/utils/dataTransformers.ts`, change both interface declarations (around lines 231 and 259):

```ts
  collected_by: number | null;
```

```ts
  collectedBy: number | null;
```

In `frontend/src/components/admin/TransactionList.tsx`, wherever the collector name is rendered, fall back to "Online" rather than blank:

```tsx
{transaction.collector
  ? `${transaction.collector.firstName} ${transaction.collector.lastName}`
  : 'Online'}
```

- [ ] **Step 9: Run the frontend tests**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/migrations/20260823100000-make-transaction-collected-by-nullable.js \
        backend/tests/unit/anonymousDonationLedger.test.js \
        backend/src/models/Transaction.js \
        backend/src/controllers/donationController.js \
        frontend/src/utils/dataTransformers.ts \
        frontend/src/components/admin/TransactionList.tsx
git commit -m "fix: record anonymous online donations in transactions and the ledger"
```

---

### Task 2: Pledge intent and anonymity columns

Implements spec §6.1, §6.2, §7.1, §7.3.

**Files:**
- Create: `backend/migrations/20260823110000-add-pledge-intent-and-anonymity.js`
- Create: `backend/tests/unit/pledgeIntentAnonymity.test.js`
- Modify: `backend/src/models/Pledge.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `pledges.fulfillment_intent` (`'later' | 'immediate'`, default `'later'`), `pledges.is_anonymous` (boolean, default `false`), `pledges.baptism_name` (string, nullable). Tasks 3–8 all read these.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeIntentAnonymity.test.js`:

```js
'use strict';

const { Pledge, PledgeCampaign, Member, sequelize } = require('../../src/models');

describe('pledge intent and anonymity rules', () => {
  let campaign;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });
    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });
  });

  const base = () => ({
    amount: 500,
    first_name: 'Test',
    last_name: 'Pledger',
    campaign_id: campaign.id
  });

  it('defaults an ordinary pledge to later and not anonymous', async () => {
    const pledge = await Pledge.create(base());
    expect(pledge.fulfillment_intent).toBe('later');
    expect(pledge.is_anonymous).toBe(false);
  });

  it('rejects an anonymous pledge for later fulfillment', async () => {
    await expect(Pledge.create({
      ...base(),
      is_anonymous: true,
      fulfillment_intent: 'later',
      baptism_name: 'Tesfay'
    })).rejects.toThrow(/must be fulfilled immediately/);
  });

  it('rejects an anonymous pledge with no internal identifier', async () => {
    await expect(Pledge.create({
      ...base(),
      is_anonymous: true,
      fulfillment_intent: 'immediate'
    })).rejects.toThrow(/baptism name or a linked member/);
  });

  it('accepts an anonymous immediate pledge identified by baptism name', async () => {
    const pledge = await Pledge.create({
      ...base(),
      is_anonymous: true,
      fulfillment_intent: 'immediate',
      baptism_name: 'Tesfay'
    });
    expect(pledge.baptism_name).toBe('Tesfay');
    expect(pledge.member_id).toBeNull();
  });

  it('accepts an anonymous immediate pledge identified by member link', async () => {
    const member = await Member.create({
      first_name: 'Known', last_name: 'Member',
      phone_number: '+15550000101', is_active: true, role: 'member'
    });
    const pledge = await Pledge.create({
      ...base(),
      member_id: member.id,
      is_anonymous: true,
      fulfillment_intent: 'immediate'
    });
    expect(pledge.member_id).toBe(member.id);
  });

  it('rejects an unknown fulfillment_intent value', async () => {
    await expect(Pledge.create({
      ...base(), fulfillment_intent: 'someday'
    })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest tests/unit/pledgeIntentAnonymity.test.js`
Expected: FAIL — the first test fails because `fulfillment_intent` is undefined.

- [ ] **Step 3: Add the model fields and validations**

In `backend/src/models/Pledge.js`, add these three fields after `is_historical`:

```js
    // The recorded human choice, NOT a fulfillment state. Fulfillment is still
    // derived from pledge_allocations by the pledge_balances view and is never
    // stored. This column answers "what did they say they were doing", which
    // cannot be reliably re-derived later.
    fulfillment_intent: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'later',
      validate: { isIn: [['later', 'immediate']] }
    },
    // The donor's recorded wish. Never a viewer permission — PledgeTracker's
    // role-based masking is a different thing entirely.
    is_anonymous: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    // Internal identifier for an anonymous giver with no account, so the church
    // can reconcile the payment. Mirrors members.baptism_name.
    baptism_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
```

Then add a model-level `validate` block. The `Pledge.init` options object currently ends with `indexes: [...]`; add `validate` as a sibling key:

```js
    validate: {
      // Mirrors the pledges_anonymous_requires_immediate CHECK. Required here
      // because the Jest suite builds its schema with sequelize.sync(), which
      // never runs migrations — without this the rule is untested and unenforced
      // outside production.
      anonymousMustBeImmediate() {
        if (this.is_anonymous && this.fulfillment_intent !== 'immediate') {
          throw new Error('An anonymous pledge must be fulfilled immediately');
        }
      },
      // Mirrors the pledges_anonymous_is_identifiable CHECK. Anonymous to the
      // parish, never anonymous to the treasurer.
      anonymousMustBeIdentifiable() {
        if (!this.is_anonymous) return;
        const hasBaptismName = String(this.baptism_name || '').trim().length > 0;
        if (this.member_id == null && !hasBaptismName) {
          throw new Error('An anonymous pledge requires a baptism name or a linked member');
        }
      }
    }
```

Finally, narrow the existing index predicate so a paid immediate pledge never blocks a member from giving again, and can never be chosen as an allocation target:

```js
      {
        name: 'pledges_one_active_per_member_per_campaign',
        unique: true,
        fields: ['campaign_id', 'member_id'],
        where: {
          member_id: { [Op.ne]: null },
          lifecycle: 'active',
          is_historical: false,
          fulfillment_intent: 'later'
        }
      }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest tests/unit/pledgeIntentAnonymity.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the migration**

Create `backend/migrations/20260823110000-add-pledge-intent-and-anonymity.js`:

```js
'use strict';

// Every column is defaulted to the value that is already true of every existing
// row: each pledge on record WAS a promise to pay ('later'), and none was
// donor-anonymous. No backfill statement is needed or wanted.
//
// The index change narrows an existing partial index's WHERE clause by one
// conjunct, which can only remove rows from the index. It therefore cannot fail
// on existing data, and no current row can violate the result.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const isPg = queryInterface.sequelize.getDialect() === 'postgres';

    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn('pledges', 'fulfillment_intent', {
        type: Sequelize.STRING(16), allowNull: false, defaultValue: 'later'
      }, { transaction: t });

      await queryInterface.addColumn('pledges', 'is_anonymous', {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false
      }, { transaction: t });

      await queryInterface.addColumn('pledges', 'baptism_name', {
        type: Sequelize.STRING(255), allowNull: true
      }, { transaction: t });

      if (isPg) {
        await queryInterface.sequelize.query(`
          ALTER TABLE pledges ADD CONSTRAINT pledges_fulfillment_intent_check
          CHECK (fulfillment_intent IN ('later', 'immediate'));
        `, { transaction: t });

        // A pledge for future fulfillment may never be anonymous.
        await queryInterface.sequelize.query(`
          ALTER TABLE pledges ADD CONSTRAINT pledges_anonymous_requires_immediate
          CHECK (is_anonymous = false OR fulfillment_intent = 'immediate');
        `, { transaction: t });

        // Anonymous to the parish, never anonymous to the treasurer.
        await queryInterface.sequelize.query(`
          ALTER TABLE pledges ADD CONSTRAINT pledges_anonymous_is_identifiable
          CHECK (is_anonymous = false OR member_id IS NOT NULL OR baptism_name IS NOT NULL);
        `, { transaction: t });

        // Narrow the uniqueness rule to pledges that can still receive money.
        await queryInterface.sequelize.query(
          'DROP INDEX IF EXISTS pledges_one_active_per_member_per_campaign;',
          { transaction: t }
        );
        await queryInterface.sequelize.query(`
          CREATE UNIQUE INDEX pledges_one_active_per_member_per_campaign
          ON pledges (campaign_id, member_id)
          WHERE member_id IS NOT NULL
            AND lifecycle = 'active'
            AND is_historical = false
            AND fulfillment_intent = 'later';
        `, { transaction: t });
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    const isPg = queryInterface.sequelize.getDialect() === 'postgres';

    await queryInterface.sequelize.transaction(async (t) => {
      if (isPg) {
        await queryInterface.sequelize.query(
          'DROP INDEX IF EXISTS pledges_one_active_per_member_per_campaign;',
          { transaction: t }
        );
        // Restore the original, wider predicate.
        await queryInterface.sequelize.query(`
          CREATE UNIQUE INDEX pledges_one_active_per_member_per_campaign
          ON pledges (campaign_id, member_id)
          WHERE member_id IS NOT NULL AND lifecycle = 'active' AND is_historical = false;
        `, { transaction: t });

        await queryInterface.sequelize.query(
          'ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_anonymous_is_identifiable;',
          { transaction: t });
        await queryInterface.sequelize.query(
          'ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_anonymous_requires_immediate;',
          { transaction: t });
        await queryInterface.sequelize.query(
          'ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_fulfillment_intent_check;',
          { transaction: t });
      }

      await queryInterface.removeColumn('pledges', 'baptism_name', { transaction: t });
      await queryInterface.removeColumn('pledges', 'is_anonymous', { transaction: t });
      await queryInterface.removeColumn('pledges', 'fulfillment_intent', { transaction: t });
    });
  }
};
```

- [ ] **Step 6: Verify the migration is reversible against a real Postgres**

Recreating the narrowed index in `down()` is the step most likely to be wrong, and SQLite never exercises it. Against a **local, disposable** Postgres — never a `DATABASE_URL` containing `supabase.com`:

```bash
cd backend
DATABASE_URL="postgres://localhost:5432/abune_scratch" npx sequelize-cli db:migrate
DATABASE_URL="postgres://localhost:5432/abune_scratch" npx sequelize-cli db:migrate:undo
DATABASE_URL="postgres://localhost:5432/abune_scratch" npx sequelize-cli db:migrate
```

Expected: all three succeed with no error. If no local Postgres is available, say so in the task hand-back rather than skipping silently — this is the one check SQLite cannot substitute for.

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && npx jest`
Expected: PASS. Watch particularly for `tests/unit/pledgeBalances.test.js` and `tests/integration/pledgeAllocations.test.js`, which exercise the index.

- [ ] **Step 8: Commit**

```bash
git add backend/migrations/20260823110000-add-pledge-intent-and-anonymity.js \
        backend/tests/unit/pledgeIntentAnonymity.test.js \
        backend/src/models/Pledge.js
git commit -m "feat: add pledge fulfillment intent and donor anonymity columns"
```

---

### Task 3: Keep pledge lookups deterministic

Implements spec §7.9. A member may now hold one outstanding `later` pledge plus any number of paid `immediate` gifts, so every "the member's pledge" lookup must say which one it means.

**Files:**
- Create: `backend/tests/unit/pledgeIntentDeterminism.test.js`
- Modify: `backend/src/services/pledgeAllocationService.js` (in `maybeAllocateToPledge` and in `listUnallocated`)
- Modify: `backend/src/controllers/pledgeController.js` (in `getPledgeBalance`)

**Interfaces:**
- Consumes: `pledges.fulfillment_intent` from Task 2.
- Produces: no new exports. `maybeAllocateToPledge`, `listUnallocated`, and `GET /api/pledges/balance` now consider only `fulfillment_intent: 'later'` pledges.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeIntentDeterminism.test.js`:

```js
'use strict';

const {
  Pledge, PledgeCampaign, Member, Transaction, sequelize
} = require('../../src/models');
const { maybeAllocateToPledge } = require('../../src/services/pledgeAllocationService');

describe('pledge lookups ignore already-paid immediate pledges', () => {
  let campaign, member, laterPledge;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });
    member = await Member.create({
      first_name: 'Both', last_name: 'Pledges',
      phone_number: '+15550000201', is_active: true, role: 'member'
    });

    // The member already gave once on the spot...
    await Pledge.create({
      amount: 100, first_name: 'Both', last_name: 'Pledges',
      campaign_id: campaign.id, member_id: member.id,
      fulfillment_intent: 'immediate'
    });
    // ...and also holds an outstanding promise.
    laterPledge = await Pledge.create({
      amount: 500, first_name: 'Both', last_name: 'Pledges',
      campaign_id: campaign.id, member_id: member.id,
      fulfillment_intent: 'later'
    });
  });

  it('allocates a new payment to the outstanding later pledge', async () => {
    const txn = await Transaction.create({
      member_id: member.id,
      collected_by: member.id,
      payment_date: '2026-06-01',
      amount: 200,
      payment_type: 'pledge_drive',
      payment_method: 'credit_card',
      status: 'succeeded'
    });

    const allocation = await maybeAllocateToPledge(txn, { source: 'stripe_auto' });

    expect(allocation).not.toBeNull();
    expect(String(allocation.pledge_id)).toBe(String(laterPledge.id));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest tests/unit/pledgeIntentDeterminism.test.js`
Expected: FAIL — `findOne` returns whichever pledge the database yields first, which is the immediate one.

- [ ] **Step 3: Add the filter in all three lookups**

In `backend/src/services/pledgeAllocationService.js`, inside `maybeAllocateToPledge`, change the pledge lookup's `where` to:

```js
    where: {
      campaign_id: campaign.id,
      member_id: txn.member_id,
      lifecycle: 'active',
      is_historical: false,
      // A member may hold one outstanding 'later' pledge plus any number of
      // already-paid 'immediate' gifts. Only the former can still receive
      // money, and the narrowed unique index guarantees there is at most one.
      fulfillment_intent: 'later'
    },
```

In the same file, inside `listUnallocated`, apply the identical filter to the `suggestion` lookup:

```js
      const suggestion = await Pledge.findOne({
        where: {
          campaign_id: campaignId, member_id: txn.member_id,
          lifecycle: 'active', is_historical: false,
          fulfillment_intent: 'later'
        },
        attributes: ['id']
      });
```

In `backend/src/controllers/pledgeController.js`, inside `getPledgeBalance`, apply it to the pledge lookup:

```js
    const pledge = await Pledge.findOne({
      where: {
        campaign_id: campaign.id,
        member_id: targetId,
        lifecycle: 'active',
        is_historical: false,
        fulfillment_intent: 'later'
      }
    });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest tests/unit/pledgeIntentDeterminism.test.js`
Expected: PASS.

- [ ] **Step 5: Run the related suites**

Run: `cd backend && npx jest tests/unit/pledgeAllocate.test.js tests/integration/unallocatedPayments.test.js src/__tests__/services/maybeAllocateToPledge.test.js`
Expected: PASS — existing fixtures all default to `fulfillment_intent: 'later'`, so none should change behavior.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/unit/pledgeIntentDeterminism.test.js \
        backend/src/services/pledgeAllocationService.js \
        backend/src/controllers/pledgeController.js
git commit -m "fix: scope pledge lookups to outstanding later pledges"
```

---

### Task 4: Pledging for later requires a signed-in member

Implements spec §7.4, flaws 2, 3, and 4. `POST /api/pledges` stops guessing who the pledger is.

**Files:**
- Create: `backend/tests/integration/pledgeCreateAuth.test.js`
- Modify: `backend/src/routes/pledgeRoutes.js` (the `router.post('/', …)` line)
- Modify: `backend/src/controllers/pledgeController.js` (`createPledge`)

**Interfaces:**
- Consumes: `pledges.fulfillment_intent` and `pledges.is_anonymous` from Task 2.
- Produces: `POST /api/pledges` requires auth, always writes `fulfillment_intent: 'later'`, and honors a body `member_id` only for `admin` and `treasurer`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/pledgeCreateAuth.test.js`:

```js
'use strict';

const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, PledgeCampaign, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

describe('POST /api/pledges requires a signed-in member', () => {
  let campaign, pledger, treasurer, otherMember;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });
    pledger = await Member.create({
      first_name: 'Selam',
      last_name: 'Pledger',
      phone_number: '+15550000301',
      email: 'selam@example.test', is_active: true, role: 'member',
      firebase_uid: 'uid-pledger'
    });
    treasurer = await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000302',
      email: 'tess@example.test', is_active: true, role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    otherMember = await Member.create({
      first_name: 'Other',
      last_name: 'Person',
      phone_number: '+15550000303',
      email: 'other@example.test', is_active: true, role: 'member',
      firebase_uid: 'uid-other'
    });
  });

  const body = (extra = {}) => ({
    amount: 500, first_name: 'Selam', last_name: 'Pledger', ...extra
  });

  it('rejects an unauthenticated pledge', async () => {
    const res = await request(app).post('/api/pledges').send(body());
    expect(res.status).toBe(401);
  });

  it('links the pledge to the caller resolved from their token', async () => {
    setVerifyTokenPayload({ uid: 'uid-pledger', email: pledger.email });
    const res = await request(app).post('/api/pledges')
      .set('Authorization', 'Bearer t').send(body());

    expect(res.status).toBe(201);
    const pledge = await Pledge.findByPk(res.body.pledge.id);
    expect(String(pledge.member_id)).toBe(String(pledger.id));
    expect(pledge.fulfillment_intent).toBe('later');
  });

  it('ignores a member_id supplied by an ordinary member', async () => {
    setVerifyTokenPayload({ uid: 'uid-pledger', email: pledger.email });
    const res = await request(app).post('/api/pledges')
      .set('Authorization', 'Bearer t')
      .send(body({ member_id: otherMember.id }));

    expect(res.status).toBe(201);
    const pledge = await Pledge.findByPk(res.body.pledge.id);
    expect(String(pledge.member_id)).toBe(String(pledger.id));
  });

  it('honors a member_id supplied by a treasurer pledging on behalf', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const res = await request(app).post('/api/pledges')
      .set('Authorization', 'Bearer t')
      .send(body({ member_id: otherMember.id, first_name: 'Other', last_name: 'Person' }));

    expect(res.status).toBe(201);
    const pledge = await Pledge.findByPk(res.body.pledge.id);
    expect(String(pledge.member_id)).toBe(String(otherMember.id));
  });

  it('refuses an anonymous pledge for later fulfillment', async () => {
    setVerifyTokenPayload({ uid: 'uid-pledger', email: pledger.email });
    const res = await request(app).post('/api/pledges')
      .set('Authorization', 'Bearer t')
      .send(body({ is_anonymous: true }));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/paid at the same time/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest tests/integration/pledgeCreateAuth.test.js`
Expected: FAIL — the first test gets 201 instead of 401, because the route is public.

- [ ] **Step 3: Put the route behind auth**

In `backend/src/routes/pledgeRoutes.js`, replace:

```js
// PUBLIC: visitors pledge at events. Rate-limited by the global /api/ limiter.
router.post('/', validatePledge, pledgeController.createPledge);
```

with:

```js
// AUTHENTICATED. A pledge for future fulfillment must be attributable, because
// member_id is what every downstream path keys on: automatic allocation, the
// member's own balance, the Donate "apply to my pledge" option, and the Dues
// banner all go dark when it is null. It used to be inferred from an email or
// phone string match, which is a guess. Now it comes from the token.
// Anonymous giving has its own path — it requires payment at the same time.
router.post('/', firebaseAuthMiddleware, validatePledge, pledgeController.createPledge);
```

- [ ] **Step 4: Resolve the member from the token**

In `backend/src/controllers/pledgeController.js`, add near the other role constants at the top:

```js
// Who may create a pledge on someone else's behalf (a treasurer taking a
// pledge card at an event, say).
const PLEDGE_ON_BEHALF_ROLES = ['admin', 'treasurer'];
```

Inside `createPledge`, immediately after the `validationResult` check, add:

```js
    // A pledge for future fulfillment can never be anonymous — the church would
    // have no way to collect on it. Anonymity requires paying at the same time.
    if (req.body.is_anonymous) {
      return res.status(400).json({
        success: false,
        message: 'An anonymous contribution must be pledged and paid at the same time.'
      });
    }
```

Then delete the entire member-guessing block:

```js
    // Try to find existing member by email or phone
    let linkedMember = null;
    try {
      if (email) { … }
      if (!linkedMember && phone) { … }
    } catch (memberErr) { … }
```

and replace it with:

```js
    // The caller IS the pledger, unless a privileged caller names someone else.
    // Note that PledgeForm has always sent member_id and createPledge has always
    // ignored it, silently overriding an admin's explicit choice with a guess.
    // This is the first time that parameter means anything.
    const callerRoles = req.user.roles || [];
    const canPledgeOnBehalf = callerRoles.some((r) => PLEDGE_ON_BEHALF_ROLES.includes(r));
    const linkedMemberId = (canPledgeOnBehalf && req.body.member_id)
      ? req.body.member_id
      : req.user.member_id;
```

In the `Pledge.create({ … })` call, replace the `member_id` and `metadata` lines and add the intent:

```js
      member_id: linkedMemberId,
      fulfillment_intent: 'later',
```

```js
      metadata: {
        ...metadata,
        linkedMemberId,
        source: metadata.source || 'website'
      }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx jest tests/integration/pledgeCreateAuth.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 6: Fix the now-stale existing test**

`backend/tests/integration/pledgeAuth.test.js` contains a case asserting that anonymous (unauthenticated) pledge creation is accepted, and a fixture comment saying the campaign "must be live … for anonymous pledge creation to be accepted". Update that case to assert a 401 instead, and correct the comment. Do not delete the test — the behavior change is exactly what it should now document.

Run: `cd backend && npx jest tests/integration/pledgeAuth.test.js`
Expected: PASS.

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && npx jest`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/tests/integration/pledgeCreateAuth.test.js \
        backend/tests/integration/pledgeAuth.test.js \
        backend/src/routes/pledgeRoutes.js \
        backend/src/controllers/pledgeController.js
git commit -m "feat: require a signed-in member to pledge for later fulfillment"
```

---

### Task 5: The pledge-with-payment service

Implements spec §7.7. One definition of "created and paid in one act", shared by the webhook (Task 7) and the treasurer endpoint (Task 6).

**Files:**
- Create: `backend/src/services/pledgeFulfillmentService.js`
- Create: `backend/tests/unit/pledgeFulfillmentService.test.js`

**Interfaces:**
- Consumes: `allocate()` from `pledgeAllocationService`; `pledges` columns from Task 2.
- Produces:
  ```js
  createPledgeWithPayment({
    campaignId, amount, transactionId,
    memberId = null, firstName, lastName, email = null, phone = null,
    baptismName = null, isAnonymous = false, notes = null,
    source, allocatedBy = null
  }, { transaction }) => Promise<{ pledge, allocation }>
  ```
  Tasks 6 and 7 both call exactly this.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeFulfillmentService.test.js`:

```js
'use strict';

const {
  Pledge, PledgeCampaign, PledgeBalance, Member, Transaction, sequelize
} = require('../../src/models');
const { createPledgeWithPayment } = require('../../src/services/pledgeFulfillmentService');

describe('createPledgeWithPayment', () => {
  let campaign, member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });
    member = await Member.create({
      first_name: 'Immediate', last_name: 'Giver',
      phone_number: '+15550000401', is_active: true, role: 'member'
    });
  });

  const makeTransaction = (overrides = {}) => Transaction.create({
    member_id: member.id,
    collected_by: member.id,
    payment_date: '2026-06-01',
    amount: 300,
    payment_type: 'pledge_drive',
    payment_method: 'credit_card',
    status: 'succeeded',
    ...overrides
  });

  it('creates a pledge that pledge_balances reports as fully fulfilled', async () => {
    const txn = await makeTransaction();

    const { pledge, allocation } = await sequelize.transaction((t) =>
      createPledgeWithPayment({
        campaignId: campaign.id, amount: 300, transactionId: txn.id,
        memberId: member.id, firstName: 'Immediate', lastName: 'Giver',
        source: 'stripe_auto'
      }, { transaction: t }));

    expect(pledge.fulfillment_intent).toBe('immediate');
    expect(parseFloat(allocation.amount)).toBe(300);

    const balance = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(balance.paid_amount)).toBe(300);
    expect(balance.derived_status).toBe('fulfilled');
  });

  it('allocates an anonymous pledge that has no member link', async () => {
    // allocate() normally refuses a pledge whose member does not match the
    // payer (MEMBER_MISMATCH). A null member_id can never match, so the service
    // must supply a reason — this test is what proves it does.
    const txn = await makeTransaction({ member_id: null, collected_by: null });

    const { pledge, allocation } = await sequelize.transaction((t) =>
      createPledgeWithPayment({
        campaignId: campaign.id, amount: 300, transactionId: txn.id,
        memberId: null, firstName: 'Anonymous', lastName: 'Giver',
        baptismName: 'Tesfay', isAnonymous: true,
        source: 'stripe_auto'
      }, { transaction: t }));

    expect(pledge.member_id).toBeNull();
    expect(pledge.is_anonymous).toBe(true);
    expect(pledge.baptism_name).toBe('Tesfay');
    expect(allocation.reason).toMatch(/one transaction/i);
  });

  it('leaves no orphan pledge when allocation fails', async () => {
    const txn = await makeTransaction({ amount: 50 });

    // Allocating 300 against a 50 payment is an over-allocation, which
    // allocate() refuses. The pledge insert must roll back with it.
    await expect(sequelize.transaction((t) =>
      createPledgeWithPayment({
        campaignId: campaign.id, amount: 300, transactionId: txn.id,
        memberId: member.id, firstName: 'Immediate', lastName: 'Giver',
        source: 'stripe_auto'
      }, { transaction: t }))).rejects.toThrow();

    expect(await Pledge.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest tests/unit/pledgeFulfillmentService.test.js`
Expected: FAIL — `Cannot find module '../../src/services/pledgeFulfillmentService'`.

- [ ] **Step 3: Write the service**

Create `backend/src/services/pledgeFulfillmentService.js`:

```js
'use strict';

const { Pledge } = require('../models');
const { allocate } = require('./pledgeAllocationService');

/**
 * Creates a pledge and credits it with an already-recorded payment, inside the
 * caller's DB transaction. The single definition of "pledged and paid in one
 * act", shared by the Stripe webhook and the treasurer endpoint.
 *
 * The caller owns the transaction so all writes commit or roll back together.
 * A pledge that exists without its allocation would report as unpaid forever;
 * an allocation without its pledge cannot exist at all.
 *
 * @returns {Promise<{ pledge, allocation }>}
 */
async function createPledgeWithPayment({
  campaignId,
  amount,
  transactionId,
  memberId = null,
  firstName,
  lastName,
  email = null,
  phone = null,
  baptismName = null,
  isAnonymous = false,
  notes = null,
  source,
  allocatedBy = null
}, { transaction }) {
  const pledge = await Pledge.create({
    campaign_id: campaignId,
    member_id: memberId,
    amount,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    baptism_name: baptismName,
    is_anonymous: isAnonymous,
    // Always 'immediate' here by definition: this function exists precisely for
    // the case where the money arrives with the pledge.
    fulfillment_intent: 'immediate',
    notes
  }, { transaction });

  const allocation = await allocate({
    pledgeId: pledge.id,
    transactionId,
    amount,
    source,
    allocatedBy,
    // allocate() refuses a payment whose payer does not match the pledge holder
    // unless given a reason (MEMBER_MISMATCH), and an anonymous pledge has no
    // member to match. The pledge and the payment were created by the same
    // request, so identity is certain — and this string lands in the audit
    // trail where a reader can see why the check was bypassed.
    reason: 'Pledge created and paid in one transaction',
    // Distinct prefix from maybeAllocateToPledge's "txn:<id>" so the two paths
    // can never silently collide on one transaction.
    idempotencyKey: `pledge-with-payment:txn:${transactionId}`
  }, { transaction });

  return { pledge, allocation };
}

module.exports = { createPledgeWithPayment };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest tests/unit/pledgeFulfillmentService.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/pledgeFulfillmentService.js \
        backend/tests/unit/pledgeFulfillmentService.test.js
git commit -m "feat: add pledgeFulfillmentService.createPledgeWithPayment"
```

---

### Task 6: Treasurer records a pledge and its payment together

Implements spec §5.5, §7.8. Thin wrapper over `createTransactionRecord` and Task 5's service — no new transaction, allocation, receipt, or GL logic.

**Files:**
- Create: `backend/tests/integration/pledgeWithPayment.test.js`
- Modify: `backend/src/controllers/pledgeAllocationController.js`
- Modify: `backend/src/routes/pledgeRoutes.js`
- Modify: `backend/src/services/transactionService.js` (wire the documented-but-dropped `donor_name`)

**Interfaces:**
- Consumes: `createPledgeWithPayment` from Task 5; `createTransactionRecord` from `transactionService`.
- Produces: `POST /api/pledges/with-payment`, body
  `{ pledge_amount, amount, payment_date, payment_method, receipt_number?,
  note?, member_id?, first_name, last_name, email?,
  phone?, baptism_name?, is_anonymous? }`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/pledgeWithPayment.test.js`:

```js
'use strict';

const request = require('supertest');
const app = require('../../src/server');
const {
  Member, Pledge, PledgeCampaign, PledgeBalance, Transaction, sequelize
} = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

describe('POST /api/pledges/with-payment', () => {
  let campaign, treasurer, plainMember;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null,
      default_payment_type: 'pledge_drive'
    });
    treasurer = await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000501',
      email: 'tess@example.test', is_active: true, role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    plainMember = await Member.create({
      first_name: 'Plain',
      last_name: 'Member',
      phone_number: '+15550000502',
      email: 'plain@example.test', is_active: true, role: 'member',
      firebase_uid: 'uid-plain'
    });
  });

  const body = (extra = {}) => ({
    pledge_amount: 400,
    amount: 400,
    payment_date: '2026-06-01',
    payment_method: 'cash',
    receipt_number: 'R-1001',
    first_name: 'Anonymous',
    last_name: 'Giver',
    baptism_name: 'Tesfay',
    is_anonymous: true,
    ...extra
  });

  it('rejects a plain member', async () => {
    setVerifyTokenPayload({ uid: 'uid-plain', email: plainMember.email });
    const res = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t').send(body());
    expect(res.status).toBe(403);
  });

  it('creates an anonymous pledge, its payment, and its allocation', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const res = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t').send(body());

    expect(res.status).toBe(201);

    const pledge = await Pledge.findByPk(res.body.pledge.id);
    expect(pledge.is_anonymous).toBe(true);
    expect(pledge.baptism_name).toBe('Tesfay');
    expect(pledge.member_id).toBeNull();

    const balance = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(balance.paid_amount)).toBe(400);
    expect(balance.derived_status).toBe('fulfilled');

    const txn = await Transaction.findByPk(res.body.transaction.id);
    expect(txn.donor_name).toBe('Tesfay');
    expect(String(txn.collected_by)).toBe(String(treasurer.id));
  });

  it('refuses a part payment against a new anonymous pledge', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const res = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t')
      .send(body({ pledge_amount: 400, amount: 100 }));

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/paid in full/i);
    expect(await Pledge.count()).toBe(0);
    expect(await Transaction.count()).toBe(0);
  });

  it('allows a part payment against a new named pledge', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurer.email });
    const res = await request(app).post('/api/pledges/with-payment')
      .set('Authorization', 'Bearer t')
      .send(body({
        is_anonymous: false, baptism_name: null,
        member_id: plainMember.id, first_name: 'Plain', last_name: 'Member',
        pledge_amount: 400, amount: 100, receipt_number: 'R-1002'
      }));

    expect(res.status).toBe(201);
    const balance = await PledgeBalance.findOne({ where: { pledge_id: res.body.pledge.id } });
    expect(parseFloat(balance.paid_amount)).toBe(100);
    expect(balance.derived_status).toBe('partially_fulfilled');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest tests/integration/pledgeWithPayment.test.js`
Expected: FAIL — 404, the route does not exist.

- [ ] **Step 3: Wire the dropped donor_name through transactionService**

`createTransactionRecord`'s JSDoc lists `donor_name` in its payload, but neither `Transaction.create` nor `LedgerEntry.create` writes it. Honor the documented contract.

In `backend/src/services/transactionService.js`, add `donor_name` to the destructure inside `createTransactionRecord`:

```js
    donation_id,
    income_category_id,
    for_year,
    donor_name,
```

and to its `Transaction.create` call:

```js
    status,
    donor_name: donor_name || null,
    donation_id: donation_id || null,
```

In `createLedgerEntryForTransaction`, add it to the payload destructure and the `LedgerEntry.create` call:

```js
  const { payment_type, amount, payment_date, payment_method, note, collected_by, member_id, external_id, donor_name } = payload;
```

```js
      collected_by,
      member_id,
      donor_name: donor_name || null,
```

- [ ] **Step 4: Add the controller handler**

In `backend/src/controllers/pledgeAllocationController.js`, add the imports:

```js
const { createPledgeWithPayment } = require('../services/pledgeFulfillmentService');
const { findLiveCampaign } = require('../services/pledgeCampaignService');
const { buildDonorNote } = require('../utils/donorNote');
```

and the handler:

```js
// A pledge that is created and paid in the same act — a walk-up gift at an
// event, anonymous or named. Distinct from createPledgePayment above, which
// pays an EXISTING pledge named in the URL.
const createPledgeWithPaymentHandler = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const campaign = await findLiveCampaign();
    if (!campaign) {
      throw new AllocationError('CAMPAIGN_NOT_FOUND', 'No pledge drive is currently open');
    }

    const pledgeAmount = parseFloat(req.body.pledge_amount);
    const paymentAmount = parseFloat(req.body.amount);
    const isAnonymous = Boolean(req.body.is_anonymous);
    const baptismName = req.body.baptism_name || null;

    if (!Number.isFinite(pledgeAmount) || pledgeAmount <= 0
        || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new AllocationError('INVALID_AMOUNT', 'Pledge and payment amounts must be positive');
    }

    // An anonymous pledge with an outstanding balance is the exact state the
    // design forbids: nobody to collect from. A part payment against a NAMED
    // pledge is fine and simply leaves a balance.
    if (isAnonymous && Math.abs(pledgeAmount - paymentAmount) > 1e-9) {
      throw new AllocationError('INVALID_AMOUNT',
        'An anonymous pledge must be paid in full: the payment must equal the pledge amount');
    }

    const memberId = req.body.member_id || null;
    const baseNote = req.body.note || null;

    const txn = await createTransactionRecord({
      member_id: memberId,
      collected_by: req.user.id,
      payment_date: req.body.payment_date,
      amount: paymentAmount,
      payment_type: campaign.default_payment_type || 'pledge_drive',
      payment_method: req.body.payment_method,
      receipt_number: req.body.receipt_number || null,
      note: memberId
        ? baseNote
        : buildDonorNote(baseNote, {
            donor_name: baptismName || `${req.body.first_name} ${req.body.last_name}`,
            donor_email: req.body.email || null,
            donor_phone: req.body.phone || null
          }),
      donor_name: memberId ? null : (baptismName || `${req.body.first_name} ${req.body.last_name}`),
      // This request creates the pledge itself a moment from now, so there is
      // nothing for the automatic rule to infer and it must not guess.
      skip_pledge_auto_allocation: true
    }, { transaction: t });

    const { pledge, allocation } = await createPledgeWithPayment({
      campaignId: campaign.id,
      amount: pledgeAmount,
      transactionId: txn.id,
      memberId,
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      email: req.body.email || null,
      phone: req.body.phone || null,
      baptismName,
      isAnonymous,
      notes: baseNote,
      source: 'treasurer_manual',
      allocatedBy: req.user.id
    }, { transaction: t });

    await t.commit();
    return res.status(201).json({ success: true, pledge, transaction: txn, allocation });
  } catch (err) {
    await t.rollback();
    return sendError(res, err);
  }
};
```

Add it to the module exports:

```js
module.exports = {
  createAllocation, createPledgePayment, createPledgeWithPaymentHandler,
  reverseAllocation, listAllocations, listUnallocatedPayments
};
```

- [ ] **Step 5: Add the route**

In `backend/src/routes/pledgeRoutes.js`, add this **above** the `router.get('/:id', …)` line so the literal path is never parsed as a pledge id:

```js
// Creates the pledge AND its payment together. Campaign comes from
// findLiveCampaign(), not from a pledge id, because no pledge exists yet —
// which is also why requireOpenCampaign cannot be used here; the handler makes
// the equivalent check itself.
router.post('/with-payment', firebaseAuthMiddleware, roleMiddleware(editRoles),
  allocationController.createPledgeWithPaymentHandler);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && npx jest tests/integration/pledgeWithPayment.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && npx jest`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/tests/integration/pledgeWithPayment.test.js \
        backend/src/controllers/pledgeAllocationController.js \
        backend/src/routes/pledgeRoutes.js \
        backend/src/services/transactionService.js
git commit -m "feat: let a treasurer record a pledge and its payment together"
```

---

### Task 7: Online pledge-and-pay

Implements spec §7.5 and §7.6 (second half). Validation before money moves; pledge creation after it succeeds.

**Files:**
- Create: `backend/tests/unit/pledgeCheckoutIntent.test.js`
- Modify: `backend/src/controllers/donationController.js` (`createPaymentIntent` guard; `handlePaymentSucceeded` pledge creation)

**Interfaces:**
- Consumes: `createPledgeWithPayment` from Task 5; `handlePaymentSucceeded` export from Task 1.
- Produces: `POST /api/donations/create-payment-intent` accepts and validates `metadata.pledgeIntent === 'immediate'`. `handlePaymentSucceeded` creates a pledge for such payments.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeCheckoutIntent.test.js`:

```js
'use strict';

const {
  Pledge, PledgeCampaign, PledgeBalance, Member, Transaction, sequelize
} = require('../../src/models');
const { handlePaymentSucceeded } = require('../../src/controllers/donationController');

const pledgeIntent = (id, metadata) => ({
  id,
  amount: 40000,
  amount_received: 40000,
  created: Math.floor(Date.now() / 1000),
  metadata: {
    purpose: 'pledge_drive',
    pledgeIntent: 'immediate',
    ...metadata
  }
});

describe('online pledge-and-pay', () => {
  let campaign, member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });
    member = await Member.create({
      first_name: 'Online',
      last_name: 'Giver',
      phone_number: '+15550000601',
      email: 'online@example.test', is_active: true, role: 'member'
    });
  });

  it('creates a fully fulfilled pledge for a signed-in member', async () => {
    await handlePaymentSucceeded(pledgeIntent('pi_pledge_001', {
      memberId: String(member.id),
      campaignId: String(campaign.id),
      donor_first_name: 'Online',
      donor_last_name: 'Giver'
    }));

    const pledge = await Pledge.findOne({ where: { member_id: member.id } });
    expect(pledge).not.toBeNull();
    expect(pledge.fulfillment_intent).toBe('immediate');
    expect(parseFloat(pledge.amount)).toBe(400);

    const balance = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(balance.derived_status).toBe('fulfilled');
  });

  it('creates an anonymous pledge for a giver with no account', async () => {
    await handlePaymentSucceeded(pledgeIntent('pi_pledge_002', {
      campaignId: String(campaign.id),
      isAnonymous: 'true',
      baptismName: 'Tesfay',
      donor_first_name: 'Anonymous',
      donor_last_name: 'Giver'
    }));

    const pledge = await Pledge.findOne({ where: { is_anonymous: true } });
    expect(pledge).not.toBeNull();
    expect(pledge.member_id).toBeNull();
    expect(pledge.baptism_name).toBe('Tesfay');

    const balance = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(balance.derived_status).toBe('fulfilled');
  });

  it('is idempotent when the webhook is redelivered', async () => {
    const intent = pledgeIntent('pi_pledge_003', {
      memberId: String(member.id), campaignId: String(campaign.id),
      donor_first_name: 'Online', donor_last_name: 'Giver'
    });
    await handlePaymentSucceeded(intent);
    await handlePaymentSucceeded(intent);

    expect(await Pledge.count()).toBe(1);
    expect(await Transaction.count()).toBe(1);
  });

  it('keeps the payment when the pledge cannot be created', async () => {
    // Anonymous with no baptism name violates the model validation, so the
    // pledge fails. The money must still be on the books — an unlinked payment
    // is recoverable, lost money is not.
    await handlePaymentSucceeded(pledgeIntent('pi_pledge_004', {
      campaignId: String(campaign.id),
      isAnonymous: 'true',
      donor_first_name: 'Anonymous', donor_last_name: 'Giver'
    }));

    expect(await Pledge.count()).toBe(0);
    const txn = await Transaction.findOne({ where: { external_id: 'pi_pledge_004' } });
    expect(txn).not.toBeNull();
    expect(txn.status).toBe('succeeded');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest tests/unit/pledgeCheckoutIntent.test.js`
Expected: FAIL — no pledge is created; the first two tests find `null`.

- [ ] **Step 3: Guard the payment intent before money moves**

In `backend/src/controllers/donationController.js`, add the import:

```js
const { findLiveCampaign } = require('../services/pledgeCampaignService');
const { createPledgeWithPayment } = require('../services/pledgeFulfillmentService');
```

Inside `createPaymentIntent`, immediately before the `stripe.paymentIntents.create({ … })` call, add:

```js
    // Validate a pledge-and-pay checkout BEFORE any Stripe call. Everything
    // else about this flow happens after the money is taken, so this is the
    // last point at which a bad request costs nothing.
    if (metadata.purpose === 'pledge_drive' && metadata.pledgeIntent === 'immediate') {
      const liveCampaign = await findLiveCampaign();
      if (!liveCampaign) {
        return res.status(400).json({
          success: false,
          message: 'Pledges are not currently being accepted'
        });
      }
      if (String(metadata.isAnonymous) === 'true' && !String(metadata.baptismName || '').trim()) {
        return res.status(400).json({
          success: false,
          message: 'A baptism or church name is required for an anonymous contribution'
        });
      }
      // Pin the campaign so a drive that closes between checkout and webhook
      // still credits the pledge it was given to. We have already taken the
      // money by then; dropping the allocation would be the worse outcome.
      metadata.campaignId = String(liveCampaign.id);
    }
```

- [ ] **Step 4: Create the pledge when the payment succeeds**

In `handlePaymentSucceeded`, immediately after the `Transaction.create({ … })` call and **before** the existing `maybeAllocateToPledge` block, add:

```js
    // A pledge-and-pay checkout: the pledge is created only now, because the
    // money succeeded. Nothing was written at checkout time, so an abandoned
    // payment leaves no orphan pledge inflating the campaign totals.
    //
    // Swallowed on failure for the same reason maybeAllocateToPledge is:
    // recording money always wins. A payment with no pledge is recoverable by
    // a treasurer; a webhook that keeps failing is not.
    let pledgeCreated = false;
    if (md.pledgeIntent === 'immediate') {
      try {
        await sequelize.transaction(async (t) => {
          await createPledgeWithPayment({
            campaignId: md.campaignId,
            amount,
            transactionId: transaction.id,
            memberId,
            firstName: md.donor_first_name || md.baptismName || 'Anonymous',
            lastName: md.donor_last_name || 'Giver',
            email: md.donor_email || null,
            phone: md.donor_phone || null,
            baptismName: md.baptismName || null,
            isAnonymous: String(md.isAnonymous) === 'true',
            source: 'stripe_auto'
          }, { transaction: t });
        });
        pledgeCreated = true;
      } catch (err) {
        console.error('⚠️ Pledge-and-pay pledge creation failed for transaction',
          transaction.id, err.message);
      }
    }
```

Then change the existing automatic-allocation call so the two paths cannot both credit the same payment:

```js
    // Skipped when the pledge-and-pay path already allocated this payment —
    // otherwise the same money would be credited twice, to two pledges.
    if (!pledgeCreated) {
      try {
        await maybeAllocateToPledge(transaction, { source: 'stripe_auto' });
      } catch (err) {
        console.error('⚠️ Pledge allocation failed for transaction', transaction.id, err.message);
      }
    }
```

Make sure `sequelize` is imported at the top of the file alongside the models:

```js
const { Donation, Member, Transaction, LedgerEntry, IncomeCategory, sequelize } = require('../models');
```

(Adjust to match the file's existing require — add `sequelize` to it rather than adding a second require.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx jest tests/unit/pledgeCheckoutIntent.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npx jest`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/tests/unit/pledgeCheckoutIntent.test.js \
        backend/src/controllers/donationController.js
git commit -m "feat: create a fulfilled pledge when an online pledge-and-pay succeeds"
```

---

### Task 8: Honor the donor's anonymity in reporting

Implements spec §7.10 and assumption A2: the real identity is visible to `admin` and `treasurer` only.

**Files:**
- Create: `backend/tests/unit/pledgeStatsAnonymity.test.js`
- Modify: `backend/src/controllers/pledgeController.js` (`getPledgeStats`)

**Interfaces:**
- Consumes: `pledges.is_anonymous` from Task 2.
- Produces: `GET /api/pledges/stats?detail=true` returns `is_anonymous` on each pledge, and replaces `name` with `'Anonymous'` unless the caller holds `admin` or `treasurer`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeStatsAnonymity.test.js`:

```js
'use strict';

const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, PledgeCampaign, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

const namesIn = (body) =>
  body.stats.status_breakdown.flatMap((s) => (s.pledges || []).map((p) => p.name));

describe('anonymity masking in pledge stats', () => {
  let campaign;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });

    await Member.create({
      first_name: 'Tess',
      last_name: 'Treasurer',
      phone_number: '+15550000701',
      email: 'tess@example.test', is_active: true, role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    await Member.create({
      first_name: 'Sam',
      last_name: 'Secretary',
      phone_number: '+15550000702',
      email: 'sam@example.test', is_active: true, role: 'secretary',
      firebase_uid: 'uid-secretary'
    });

    await Pledge.create({
      amount: 400, first_name: 'Discreet', last_name: 'Donor',
      campaign_id: campaign.id, baptism_name: 'Tesfay',
      is_anonymous: true, fulfillment_intent: 'immediate'
    });
  });

  it('shows the real name to a treasurer', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: 'tess@example.test' });
    const res = await request(app).get('/api/pledges/stats?detail=true')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(namesIn(res.body)).toContain('Discreet Donor');
  });

  it('masks the name from a secretary', async () => {
    setVerifyTokenPayload({ uid: 'uid-secretary', email: 'sam@example.test' });
    const res = await request(app).get('/api/pledges/stats?detail=true')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(namesIn(res.body)).toContain('Anonymous');
    expect(namesIn(res.body)).not.toContain('Discreet Donor');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest tests/unit/pledgeStatsAnonymity.test.js`
Expected: FAIL — the second test sees `'Discreet Donor'`.

- [ ] **Step 3: Mask the name**

In `backend/src/controllers/pledgeController.js`, add near the other role constants:

```js
// Anonymous to the parish, never anonymous to the treasurer. Deliberately
// narrower than BALANCE_VIEW_ROLES: a donor who asked for anonymity should not
// have their name visible to all nine view roles.
const ANONYMITY_PIERCING_ROLES = ['admin', 'treasurer'];
```

Inside `getPledgeStats`, add the `is_anonymous` attribute to the `Pledge` include:

```js
          attributes: ['first_name', 'last_name', 'pledge_type', 'event_name',
                       'created_at', 'is_anonymous'],
```

Immediately before the `balances.forEach(…)` loop, add:

```js
  const callerRoles = req.user?.roles || [];
  const canSeeAnonymousNames = callerRoles.some((r) => ANONYMITY_PIERCING_ROLES.includes(r));
  const displayName = (pledge) =>
    (pledge.is_anonymous && !canSeeAnonymousNames)
      ? 'Anonymous'
      : `${pledge.first_name} ${pledge.last_name}`;
```

Replace the two places a name is serialized. In the `statusBreakdownMap[status].pledges.push({ … })` call:

```js
        is_anonymous: Boolean(balance.pledge.is_anonymous),
        name: displayName(balance.pledge),
        spouse_name: (balance.pledge.is_anonymous && !canSeeAnonymousNames)
          ? null
          : (balance.member?.spouse_name || null),
```

and in the `recent_pledges` map:

```js
            name: displayName(balance.pledge),
            is_anonymous: Boolean(balance.pledge.is_anonymous),
```

Also suppress the linked member object there, which would otherwise leak the identity a moment after masking the name:

```js
            member: (balance.member && !(balance.pledge.is_anonymous && !canSeeAnonymousNames))
              ? { first_name: balance.member.first_name, last_name: balance.member.last_name }
              : null
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest tests/unit/pledgeStatsAnonymity.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the related suites**

Run: `cd backend && npx jest tests/integration/paymentStatsOverview.test.js tests/unit/pledgeBalances.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/unit/pledgeStatsAnonymity.test.js \
        backend/src/controllers/pledgeController.js
git commit -m "feat: mask anonymous donor names outside admin and treasurer"
```

---

### Task 9: The pledge page asks what the giver wants to do

Implements spec §5.1, §5.2, §8, and decision D6 (remove the false confirmation-email promise).

**Files:**
- Create: `frontend/src/components/pledge/PledgeIntentSelector.tsx`
- Create: `frontend/src/components/pledge/PledgeLaterForm.tsx`
- Modify: `frontend/src/pages/PledgePage.tsx`
- Modify: `frontend/src/pages/__tests__/PledgePage.test.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`
- Modify: `tigrigna-translation-review.md`

**Interfaces:**
- Consumes: `POST /api/pledges` (now auth-required) from Task 4; `usePledgeBalance` and `useActiveCampaign`, both already present.
- Produces:
  ```ts
  export type PledgeIntent = 'later' | 'immediate' | 'anonymous';
  export interface PledgeIntentSelectorProps {
    signedIn: boolean;
    onChoose: (intent: PledgeIntent) => void;
    onSignIn: () => void;
  }
  export interface PledgeLaterFormProps {
    onSubmit: (data: { amount: string; notes?: string }) => Promise<void>;
    loading: boolean;
  }
  ```
  Task 10 renders inside the same `PledgePage` switch and reuses `PledgeIntent`.

- [ ] **Step 1: Write the failing test**

Add these cases to `frontend/src/pages/__tests__/PledgePage.test.tsx`, keeping the existing imports, mocks, `CAMPAIGN`, and `renderPage` helper. Change the `useAuth` mock to a variable one so signed-in state can vary:

```tsx
const mockUseAuth = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => mockUseAuth()
}));

const mockUsePledgeBalance = jest.fn();
jest.mock('../../hooks/usePledgeBalance', () => ({
  usePledgeBalance: () => mockUsePledgeBalance()
}));
```

Then add:

```tsx
describe('PledgePage intent chooser', () => {
  beforeEach(() => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });
    mockUsePledgeBalance.mockReturnValue({ balance: null, loading: false });
    mockUseAuth.mockReturnValue({ user: null, currentUser: null });
  });

  it('offers sign-in and anonymous giving to a signed-out visitor', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /give anonymously now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to pledge/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pledge for later$/i })).not.toBeInTheDocument();
  });

  it('offers all three choices to a signed-in member with no pledge', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1 }, currentUser: { id: 1 } });
    renderPage();

    expect(screen.getByRole('button', { name: /pledge for later/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pledge and pay now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /give anonymously now/i })).toBeInTheDocument();
  });

  it('offers to pay an existing pledge instead of creating a second one', () => {
    mockUseAuth.mockReturnValue({ user: { id: 1 }, currentUser: { id: 1 } });
    mockUsePledgeBalance.mockReturnValue({
      balance: { id: 3, campaign_name: 'Test Building Drive',
                 pledged_amount: 500, paid_amount: 200, remaining_amount: 300 },
      loading: false
    });

    renderPage();

    expect(screen.getByRole('button', { name: /pay now/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pledge for later/i })).not.toBeInTheDocument();
  });

  it('does not promise a confirmation email that is never sent', () => {
    renderPage();
    expect(screen.queryByText(/confirmation email/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/pages/__tests__/PledgePage.test.tsx`
Expected: FAIL — none of the intent buttons exist.

- [ ] **Step 3: Write the intent selector**

Create `frontend/src/components/pledge/PledgeIntentSelector.tsx`:

```tsx
import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';

export type PledgeIntent = 'later' | 'immediate' | 'anonymous';

export interface PledgeIntentSelectorProps {
  signedIn: boolean;
  onChoose: (intent: PledgeIntent) => void;
  onSignIn: () => void;
}

// The explicit question. Pledging and paying used to be two unconnected acts
// separated by a page navigation, a sign-in, and a checkbox; this is where the
// giver says which one they mean.
const PledgeIntentSelector: React.FC<PledgeIntentSelectorProps> = ({
  signedIn, onChoose, onSignIn
}) => {
  const { t } = useI18n();

  const card = 'w-full text-left rounded-lg border border-gray-200 bg-white p-5 ' +
    'hover:border-primary-500 hover:shadow-md transition focus:outline-none ' +
    'focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-4">
      {signedIn ? (
        <>
          <button type="button" className={card} onClick={() => onChoose('later')}>
            <div className="font-semibold text-gray-900">{t('pledge.intent.later.title')}</div>
            <div className="text-sm text-gray-600 mt-1">{t('pledge.intent.later.body')}</div>
          </button>

          <button type="button" className={card} onClick={() => onChoose('immediate')}>
            <div className="font-semibold text-gray-900">{t('pledge.intent.immediate.title')}</div>
            <div className="text-sm text-gray-600 mt-1">{t('pledge.intent.immediate.body')}</div>
          </button>
        </>
      ) : (
        <button type="button" className={card} onClick={onSignIn}>
          <div className="font-semibold text-gray-900">{t('pledge.intent.signIn.title')}</div>
          <div className="text-sm text-gray-600 mt-1">{t('pledge.intent.signIn.body')}</div>
        </button>
      )}

      {/* Available signed out by design: a giver who wants anonymity should not
          have to create an account to give. It is always pledge-and-pay. */}
      <button type="button" className={card} onClick={() => onChoose('anonymous')}>
        <div className="font-semibold text-gray-900">{t('pledge.intent.anonymous.title')}</div>
        <div className="text-sm text-gray-600 mt-1">{t('pledge.intent.anonymous.body')}</div>
      </button>
    </div>
  );
};

export default PledgeIntentSelector;
```

- [ ] **Step 4: Write the later-pledge form**

Create `frontend/src/components/pledge/PledgeLaterForm.tsx`:

```tsx
import React, { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

export interface PledgeLaterFormProps {
  onSubmit: (data: { amount: string; notes?: string }) => Promise<void>;
  loading: boolean;
}

// Amount and an optional note, nothing else. Identity comes from the auth
// token server-side, so this form never asks for a name, email, or phone —
// asking would invite the mismatch that used to leave member_id null.
const PledgeLaterForm: React.FC<PledgeLaterFormProps> = ({ onSubmit, loading }) => {
  const { t } = useI18n();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value < 1) {
      setError(t('pledgeForm.errors.amountMin'));
      return;
    }
    setError(null);
    await onSubmit({ amount, notes: notes || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg shadow p-6">
      <div>
        <label htmlFor="pledge-amount" className="block text-sm font-medium text-gray-700">
          {t('pledgeForm.amountLabel')}
        </label>
        <input
          id="pledge-amount" type="number" min="1" step="0.01" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>

      <div>
        <label htmlFor="pledge-notes" className="block text-sm font-medium text-gray-700">
          {t('pledgeForm.notesLabel')}
        </label>
        <textarea
          id="pledge-notes" rows={3} value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      <button
        type="submit" disabled={loading}
        className="w-full rounded-md bg-primary-600 px-4 py-2 text-white font-medium disabled:opacity-50"
      >
        {loading ? t('common.submitting') : t('pledge.intent.later.title')}
      </button>
    </form>
  );
};

export default PledgeLaterForm;
```

- [ ] **Step 5: Rewire PledgePage**

In `frontend/src/pages/PledgePage.tsx`:

1. Import `useAuth`, `usePledgeBalance`, `PledgeIntentSelector` (with its `PledgeIntent` type), and `PledgeLaterForm`. Remove the `PledgeForm` import and the now-unused local `PledgeFormData` interface.
2. Add the hooks and derived state at the top of the component, alongside the existing `useActiveCampaign` call:

```tsx
  const { user, currentUser, firebaseUser } = useAuth();
  const { balance: pledgeBalance } = usePledgeBalance();
  const [intent, setIntent] = useState<PledgeIntent | null>(null);
  const signedIn = Boolean(user);
```
3. Send the Firebase ID token with the pledge request, and post only amount and notes:

```tsx
  const handlePledgeSubmit = async (formData: { amount: string; notes?: string }) => {
    try {
      setLoading(true);
      setError(null);

      const idToken = await firebaseUser?.getIdToken();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/pledges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          notes: formData.notes,
          // The server requires these and prefills them from the member record
          // it resolves from the token; sending the profile's values keeps the
          // pledge's contact snapshot accurate.
          first_name: currentUser?.first_name || currentUser?.firstName || '',
          last_name: currentUser?.last_name || currentUser?.lastName || ''
        })
      });

      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/thank-you', { state: { pledgeId: data.pledge.id } });
        }, 2000);
      } else {
        setError(data.message || 'Failed to submit pledge');
      }
    } catch (err) {
      console.error('Pledge submission error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };
```

4. Replace the `<PledgeForm … />` block in the left-hand column with the state machine:

```tsx
{/* An existing outstanding pledge means the member came back to PAY, not to
    promise again. Offering a new pledge here is how a campaign ends up
    double-counting one person's promise. */}
{signedIn && pledgeBalance && pledgeBalance.remaining_amount > 0 ? (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="font-semibold text-gray-900">{t('pledge.existing.title')}</h3>
    <p className="text-gray-600 mt-1">
      {t('pledge.existing.body', {
        remaining: `$${pledgeBalance.remaining_amount.toLocaleString()}`,
        campaign: pledgeBalance.campaign_name
      })}
    </p>
    <button
      type="button"
      onClick={() => navigate('/donate')}
      className="mt-4 rounded-md bg-primary-600 px-4 py-2 text-white font-medium"
    >
      {t('pledge.existing.payNow')}
    </button>
  </div>
) : intent === null ? (
  <PledgeIntentSelector
    signedIn={signedIn}
    onChoose={setIntent}
    onSignIn={() => navigate('/login')}
  />
) : intent === 'later' ? (
  <PledgeLaterForm onSubmit={handlePledgeSubmit} loading={loading} />
) : (
  /* Filled in by Task 10 */
  <div />
)}
```

5. In the success panel, delete the sentence promising a confirmation email. Replace the paragraph with:

```tsx
            <p className="text-gray-600">
              {t('pledge.success.body')}
            </p>
```

- [ ] **Step 6: Add the dictionary keys**

In `frontend/src/i18n/dictionaries.ts`, add to both the `en` and `ti` maps, following the existing key style:

```
pledge.intent.later.title         Pledge for later
pledge.intent.later.body          Make a pledge now and pay it when you are ready.
pledge.intent.immediate.title     Pledge and pay now
pledge.intent.immediate.body      Make your pledge and pay it in full in one step.
pledge.intent.anonymous.title     Give anonymously now
pledge.intent.anonymous.body      Give without your name appearing. Paid in full today; the church records a church name for its records only.
pledge.intent.signIn.title        Sign in to pledge
pledge.intent.signIn.body         A pledge for later needs an account so we can credit your payments to it.
pledge.existing.title             You already have a pledge
pledge.existing.body              {remaining} remaining on your {campaign} pledge.
pledge.existing.payNow            Pay now
pledge.success.body               Your pledge has been recorded. Thank you.
pledgeForm.amountLabel            Pledge Amount *
pledgeForm.notesLabel             Notes (optional)
common.submitting                 Submitting…
```

Write real Tigrigna drafts for each `ti` value — do not copy the English through.

- [ ] **Step 7: Flag the Tigrigna drafts for review**

Append the new `ti` keys to `tigrigna-translation-review.md` under a new dated section, matching the file's existing format, so a native speaker reviews them.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/pages/__tests__/PledgePage.test.tsx`
Expected: PASS.

- [ ] **Step 9: Delete the replaced form**

`frontend/src/components/PledgeForm.tsx` had exactly one consumer, `PledgePage`, which no longer imports it. Leaving it in place leaves 556 lines of dead code that still POSTs to the old unauthenticated contract, which a future reader would reasonably copy.

```bash
git rm frontend/src/components/PledgeForm.tsx
```

Leave its `dictionaries.ts` keys (`pledgeForm.*`) alone — Tasks 9 and 10 reuse several, and the Tigrigna review file already tracks them.

- [ ] **Step 10: Run the wider frontend suite**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false`
Expected: PASS. `src/__tests__/pledgeRedirect.test.tsx` and `src/components/__tests__/DonatePagePledge.test.tsx` are the likeliest to need updating; fix them to match the new page structure rather than deleting them.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/pledge/ \
        frontend/src/pages/PledgePage.tsx \
        frontend/src/pages/__tests__/PledgePage.test.tsx \
        frontend/src/i18n/dictionaries.ts \
        tigrigna-translation-review.md
git commit -m "feat: ask on the pledge page whether to pledge for later or pay now"
```

---

### Task 10: Pay for the pledge on the spot

Implements spec §5.3 and §5.4 — flows 2 and 3, which differ only in whether a member is signed in and whether a baptism name is collected.

**Files:**
- Create: `frontend/src/components/pledge/PledgeCheckoutForm.tsx`
- Create: `frontend/src/components/pledge/__tests__/PledgeCheckoutForm.test.tsx`
- Modify: `frontend/src/pages/PledgePage.tsx` (replace the Task 9 placeholder `<div />`)
- Modify: `frontend/src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `PledgeIntent` from Task 9; the pledge-intent metadata contract from Task 7 — `{ purpose: 'pledge_drive', pledgeIntent: 'immediate', isAnonymous, baptismName, campaignId }`.
- Produces:
  ```ts
  export interface PledgeCheckoutFormProps {
    anonymous: boolean;
    campaignId: number;
    onSuccess: (pledgeId?: number) => void;
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/pledge/__tests__/PledgeCheckoutForm.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import PledgeCheckoutForm from '../PledgeCheckoutForm';

jest.mock('../../StripePayment', () => () => <div>stripe</div>);
jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => ({ user: null, currentUser: null, firebaseUser: null })
}));

const renderForm = (anonymous: boolean) => render(
  <I18nProvider><LanguageProvider>
    <PledgeCheckoutForm anonymous={anonymous} campaignId={7} onSuccess={jest.fn()} />
  </LanguageProvider></I18nProvider>
);

describe('PledgeCheckoutForm', () => {
  it('asks an anonymous giver for a baptism name', () => {
    renderForm(true);
    expect(screen.getByLabelText(/baptism|church name/i)).toBeInTheDocument();
  });

  it('does not ask a signed-in member for a baptism name', () => {
    renderForm(false);
    expect(screen.queryByLabelText(/baptism|church name/i)).not.toBeInTheDocument();
  });

  it('refuses to continue anonymously without a baptism name', async () => {
    renderForm(true);

    fireEvent.change(screen.getByLabelText(/pledge amount/i), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

    await waitFor(() => {
      expect(screen.getByText(/church name is required/i)).toBeInTheDocument();
    });
  });

  it('explains that paying now means paying in full', () => {
    renderForm(false);
    expect(screen.getByText(/in full/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/pledge/__tests__/PledgeCheckoutForm.test.tsx`
Expected: FAIL — `Cannot find module '../PledgeCheckoutForm'`.

- [ ] **Step 3: Write the checkout form**

Create `frontend/src/components/pledge/PledgeCheckoutForm.tsx`:

```tsx
import React, { useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '../../config/stripe';
import StripePayment from '../StripePayment';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n/I18nProvider';

export interface PledgeCheckoutFormProps {
  anonymous: boolean;
  campaignId: number;
  onSuccess: (pledgeId?: number) => void;
}

// Flows 2 and 3. They are one component because they differ in exactly two
// ways: whether a member is signed in, and whether a baptism name is collected.
//
// Paying now always means paying in full — there is a single amount field, and
// it is both the pledge and the payment. Anyone who wants to split chooses
// "pledge for later" and pays in installments afterwards.
const PledgeCheckoutForm: React.FC<PledgeCheckoutFormProps> = ({
  anonymous, campaignId, onSuccess
}) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [baptismName, setBaptismName] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [readyToPay, setReadyToPay] = useState(false);

  const handleContinue = () => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value < 1) {
      setError(t('pledgeForm.errors.amountMin'));
      return;
    }
    // Anonymous to the parish, never anonymous to the treasurer. Without an
    // internal identifier the church cannot reconcile the gift at all, so this
    // is a hard requirement rather than a nicety. The server enforces it too.
    if (anonymous && !baptismName.trim()) {
      setError(t('pledge.anonymous.errors.baptismNameRequired'));
      return;
    }
    setError(null);
    setReadyToPay(true);
  };

  const metadata = {
    purpose: 'pledge_drive',
    pledgeIntent: 'immediate',
    campaignId: String(campaignId),
    isAnonymous: anonymous ? 'true' : 'false',
    baptismName: anonymous ? baptismName.trim() : '',
    donor_first_name: anonymous ? 'Anonymous' : (user?.first_name || user?.firstName || ''),
    donor_last_name: anonymous ? 'Giver' : (user?.last_name || user?.lastName || ''),
    donor_email: anonymous ? contact : (user?.email || ''),
    memberId: anonymous ? '' : String(user?.id || '')
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <p className="text-sm text-gray-600">{t('pledge.checkout.payInFullNote')}</p>

      <div>
        <label htmlFor="checkout-amount" className="block text-sm font-medium text-gray-700">
          {t('pledgeForm.amountLabel')}
        </label>
        <input
          id="checkout-amount" type="number" min="1" step="0.01" value={amount}
          onChange={(e) => setAmount(e.target.value)} disabled={readyToPay}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
      </div>

      {anonymous && (
        <>
          <div>
            <label htmlFor="checkout-baptism-name" className="block text-sm font-medium text-gray-700">
              {t('pledge.anonymous.baptismNameLabel')}
            </label>
            <input
              id="checkout-baptism-name" type="text" value={baptismName}
              onChange={(e) => setBaptismName(e.target.value)} disabled={readyToPay}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
            <p className="mt-1 text-xs text-gray-500">{t('pledge.anonymous.baptismNameHelp')}</p>
          </div>

          <div>
            <label htmlFor="checkout-contact" className="block text-sm font-medium text-gray-700">
              {t('pledge.anonymous.contactLabel')}
            </label>
            <input
              id="checkout-contact" type="text" value={contact}
              onChange={(e) => setContact(e.target.value)} disabled={readyToPay}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!readyToPay ? (
        <button
          type="button" onClick={handleContinue}
          className="w-full rounded-md bg-primary-600 px-4 py-2 text-white font-medium"
        >
          {t('pledge.checkout.continue')}
        </button>
      ) : (
        <Elements stripe={stripePromise}>
          <StripePayment
            amount={parseFloat(amount)}
            purpose="pledge_drive"
            metadata={metadata}
            onSuccess={() => onSuccess()}
            onError={(message: string) => setError(message)}
          />
        </Elements>
      )}
    </div>
  );
};

export default PledgeCheckoutForm;
```

**Before writing this file, read `frontend/src/components/StripePayment.tsx`** and match its actual prop names. The props above (`amount`, `purpose`, `metadata`, `onSuccess`, `onError`) are the expected shape; if the real component differs, adapt the call rather than changing `StripePayment`, which `DonatePage` also uses.

- [ ] **Step 4: Add the dictionary keys**

In `frontend/src/i18n/dictionaries.ts`, add to both `en` and `ti`:

```
pledge.checkout.payInFullNote            Paying now covers your pledge in full.
pledge.checkout.continue                 Continue to payment
pledge.anonymous.baptismNameLabel        Baptism or church name *
pledge.anonymous.baptismNameHelp         Kept for church records only. Your gift is reported as anonymous.
pledge.anonymous.contactLabel            Phone or email (optional)
pledge.anonymous.errors.baptismNameRequired  A baptism or church name is required.
```

Write real Tigrigna drafts, and append them to `tigrigna-translation-review.md` as in Task 9.

- [ ] **Step 5: Wire it into PledgePage**

In `frontend/src/pages/PledgePage.tsx`, replace the Task 9 placeholder `<div />` branch:

```tsx
) : (
  <PledgeCheckoutForm
    anonymous={intent === 'anonymous'}
    campaignId={campaign.id}
    onSuccess={() => setSuccess(true)}
  />
)}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/pledge src/pages/__tests__/PledgePage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/pledge/PledgeCheckoutForm.tsx \
        frontend/src/components/pledge/__tests__/PledgeCheckoutForm.test.tsx \
        frontend/src/pages/PledgePage.tsx \
        frontend/src/i18n/dictionaries.ts \
        tigrigna-translation-review.md
git commit -m "feat: let a giver pledge and pay in one step, anonymously or named"
```

---

### Task 11: Treasurer can record the pledge alongside the payment

Implements spec §5.5's frontend half. `AddPaymentModal` already has the anonymous toggle, the donor fields, the `pledge_drive` type, and the inline pledge balance — this adds only the "also record as a pledge" block.

**Files:**
- Modify: `frontend/src/components/admin/AddPaymentModal.tsx`
- Modify: `frontend/src/components/admin/__tests__/AddPaymentModalPledge.test.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `POST /api/pledges/with-payment` from Task 6, body
  `{ pledge_amount, amount, payment_date, payment_method, receipt_number?,
  note?, member_id?, first_name, last_name, email?,
  phone?, baptism_name?, is_anonymous? }`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/admin/__tests__/AddPaymentModalPledge.test.tsx`, following the file's existing render helper and mocks:

```tsx
  it('offers to record a pledge for a pledge_drive payment', async () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/payment type/i), {
      target: { value: 'pledge_drive' }
    });

    expect(await screen.findByLabelText(/also record this as a pledge/i)).toBeInTheDocument();
  });

  it('does not offer it for other payment types', () => {
    renderModal();

    fireEvent.change(screen.getByLabelText(/payment type/i), {
      target: { value: 'donation' }
    });

    expect(screen.queryByLabelText(/also record this as a pledge/i)).not.toBeInTheDocument();
  });

  it('labels the donor name as a baptism name for an anonymous pledge', async () => {
    renderModal();

    fireEvent.click(screen.getByLabelText(/anonymous \/ non-member payment/i));
    fireEvent.change(screen.getByLabelText(/payment type/i), {
      target: { value: 'pledge_drive' }
    });
    fireEvent.click(await screen.findByLabelText(/also record this as a pledge/i));

    expect(screen.getByLabelText(/baptism or church name/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/__tests__/AddPaymentModalPledge.test.tsx`
Expected: FAIL — the checkbox does not exist.

- [ ] **Step 3: Add the state and the block**

In `frontend/src/components/admin/AddPaymentModal.tsx`, add state near the existing `isAnonymous` / `donorName` declarations (around line 52):

```tsx
  // A pledge_drive payment from someone with no pledge is just drive income —
  // correct, but it never appears in total_pledged, pledge_count, or the donor
  // list. Ticking this records the promise alongside the money.
  const [alsoRecordPledge, setAlsoRecordPledge] = useState(false);
  const [pledgeAmount, setPledgeAmount] = useState('');
```

Render the block wherever the payment-type selector's dependent fields live, gated on the type:

```tsx
{paymentType === 'pledge_drive' && (
  <div className="mt-3 rounded-md bg-gray-50 p-3">
    <label htmlFor="also-record-pledge" className="flex items-start gap-2 cursor-pointer">
      <input
        id="also-record-pledge" type="checkbox" checked={alsoRecordPledge}
        onChange={(e) => setAlsoRecordPledge(e.target.checked)}
        className="mt-1"
      />
      <span className="text-sm text-gray-700">{t('fundraising.alsoRecordPledge')}</span>
    </label>

    {alsoRecordPledge && (
      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="pledge-amount-field" className="block text-sm font-medium text-gray-700">
            {t('fundraising.pledgeAmountLabel')}
          </label>
          <input
            id="pledge-amount-field" type="number" min="1" step="0.01" value={pledgeAmount}
            onChange={(e) => setPledgeAmount(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          {isAnonymous && (
            <p className="mt-1 text-xs text-gray-500">{t('fundraising.anonymousPaidInFull')}</p>
          )}
        </div>

        {isAnonymous && (
          <div>
            <label htmlFor="pledge-baptism-name" className="block text-sm font-medium text-gray-700">
              {t('fundraising.baptismNameLabel')}
            </label>
            <input
              id="pledge-baptism-name" type="text" value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
        )}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Route the submit to the pledge endpoint**

In the modal's submit handler, before the existing transaction POST, add:

```tsx
    // One endpoint creates the pledge, the payment, the ledger entry and the
    // allocation in a single DB transaction, so a payment can never exist with
    // a failed allocation. Do not create the pledge with a second request.
    if (paymentType === 'pledge_drive' && alsoRecordPledge) {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/pledges/with-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          pledge_amount: parseFloat(pledgeAmount),
          amount: parseFloat(amount),
          payment_date: paymentDate,
          payment_method: paymentMethod,
          receipt_number: receiptNumber || null,
          note: note || null,
          member_id: isAnonymous ? null : parseInt(selectedMemberId),
          first_name: isAnonymous ? (donorName || 'Anonymous') : selectedMemberFirstName,
          last_name: isAnonymous ? 'Giver' : selectedMemberLastName,
          baptism_name: isAnonymous ? donorName : null,
          is_anonymous: isAnonymous
        })
      });

      const data = await response.json();
      if (!data.success) {
        setError(data.message || 'Failed to record the pledge');
        return;
      }
      onSuccess();
      return;
    }
```

Match the surrounding code's existing variable names for `idToken`, `amount`, `paymentDate`, `paymentMethod`, `receiptNumber`, `note`, `selectedMemberId`, `setError`, and `onSuccess` — read the handler before editing rather than assuming these.

- [ ] **Step 5: Add the dictionary keys**

In `frontend/src/i18n/dictionaries.ts`, add to both `en` and `ti`:

```
fundraising.alsoRecordPledge      Also record this as a pledge
fundraising.pledgeAmountLabel     Pledge amount
fundraising.baptismNameLabel      Baptism or church name
fundraising.anonymousPaidInFull   An anonymous pledge must be paid in full, so this must equal the payment amount.
```

Write real Tigrigna drafts and append them to `tigrigna-translation-review.md`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/__tests__/AddPaymentModalPledge.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run both full suites**

Run: `cd backend && npx jest` then `cd frontend && CI=true npx react-scripts test --watchAll=false`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin/AddPaymentModal.tsx \
        frontend/src/components/admin/__tests__/AddPaymentModalPledge.test.tsx \
        frontend/src/i18n/dictionaries.ts \
        tigrigna-translation-review.md
git commit -m "feat: let a treasurer record a pledge alongside a drive payment"
```

---

## Deferred to follow-up work

Called out in the spec and deliberately not in this plan:

- Pledge confirmation and reminder emails (the false claim is removed in Task 9; sending mail is separate work).
- Zelle, bank-reconciliation, and Square automatic allocation — each needs a new `pledge_allocations.source` value and a migration to widen that CHECK.
- Retroactive reconstruction of anonymous donations lost before Task 1.
- Removing the vestigial `pledge_type` enum.
- A treasurer "link this pledge to a member" action for the pre-existing `member_id IS NULL` rows.
