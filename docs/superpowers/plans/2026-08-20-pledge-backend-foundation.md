# Pledge Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the unauthenticated pledge API, then build the campaign +
allocation schema and the allocation engine so pledge balances derive from real
payments instead of a hand-flipped boolean.

**Architecture:** `pledge_campaigns ──< pledges ──< pledge_allocations >── transactions`.
Allocations are append-only; corrections are reversing rows. Balances come from
the `pledge_balances` SQL view, which counts only allocations whose transaction
is `succeeded`, so failed payments and refunds self-correct. Nothing writes a
cached paid amount anywhere.

**Tech Stack:** Node 20 / Express 4 / Sequelize 6 / PostgreSQL (Supabase) in
production, `sqlite::memory:` under Jest. Tests: Jest + supertest.

**Spec:** `docs/superpowers/specs/2026-08-20-pledge-modernization-design.md`

**Covers:** Spec phases 0, 1, 2. Phases 3–6 are separate plans.

---

## Global Constraints

- **Never put real member data in tests, fixtures, docs, or commits.** All test
  data is synthetic. (CLAUDE.md, non-negotiable — this repo holds real PII.)
- **Never commit or push without asking the user first.** They test locally
  before any production deploy.
- **Tests run on `sqlite::memory:` via `sequelize.sync({ force: true })`, NOT
  migrations** (`tests/setup.js`). Anything a migration creates that tests need
  — views, triggers — must come from a shared module the test setup also calls.
- **`config/config.js` has no `test` environment and hardcodes
  `dialect: 'postgres'`.** `sequelize-cli` cannot run against SQLite. Migration
  up/down is verified against a Postgres copy, never in Jest.
- **SQL must run on both Postgres and SQLite.** Use `SUM(CASE WHEN … END)` not
  `FILTER (WHERE …)`; `LEFT JOIN … GROUP BY` not `LATERAL`; guard every division
  with `CASE WHEN … > 0` (Postgres raises on divide-by-zero, SQLite returns NULL).
- **Postgres-only DDL** (triggers, RLS, `ALTER TYPE`) must be guarded by
  `if (queryInterface.sequelize.getDialect() !== 'postgres') return;`
- **Role vocabulary is fixed.** Reuse the exact arrays from
  `src/routes/transactionRoutes.js:22-25`. Do not invent role names.
- Money columns are `DECIMAL(10, 2)`. Sequelize returns DECIMAL as a **string** —
  always `parseFloat()` before comparing.
- Migration filenames: `YYYYMMDDHHMMSS-kebab-description.js` in `backend/migrations/`.
- Commit style: `feat:` / `fix:` / `test:` / `refactor:` prefix.

---

## File Structure

**Create — backend**

| Path | Responsibility |
|---|---|
| `src/database/pledgeViews.js` | The single source of the view SQL. Exported as `createPledgeViews(qi)` / `dropPledgeViews(qi)`; called by the migration **and** by `tests/setup.js`. |
| `src/models/PledgeCampaign.js` | Campaign model |
| `src/models/PledgeAllocation.js` | Allocation model |
| `src/models/PledgeBalance.js` | Read-only view model |
| `src/models/CampaignTotal.js` | Read-only view model |
| `src/services/transactionService.js` | `createTransactionRecord()` extracted from the controller |
| `src/services/pledgeAllocationService.js` | `allocate()`, `reverse()`, `listUnallocated()` |
| `src/middleware/requireOpenCampaign.js` | 409 on writes to a closed campaign |
| `src/controllers/pledgeCampaignController.js` | Campaign CRUD |
| `src/controllers/pledgeAllocationController.js` | Allocation endpoints |
| `src/routes/pledgeCampaignRoutes.js` | `/api/pledge-campaigns` |
| `src/routes/pledgeAllocationRoutes.js` | `/api/pledge-allocations` |
| `migrations/…` | 7 migration files (Tasks 3, 4, 5, 6, 7, 8) |

**Modify — backend**

| Path | Change |
|---|---|
| `src/routes/pledgeRoutes.js` | Auth + role guards (Task 1); allocation sub-routes (Task 13) |
| `src/controllers/pledgeController.js` | Stats split (Task 2); view-backed reads |
| `src/controllers/transactionController.js` | Extract create logic (Task 9); 409 on deleting allocated (Task 16) |
| `src/models/Pledge.js` | New columns + associations (Task 5) |
| `src/models/index.js` | Register 4 new models |
| `src/server.js` | Mount 2 new route files |
| `tests/setup.js` | Call `createPledgeViews()` after sync |

**Modify — frontend**

| Path | Change |
|---|---|
| `src/components/PledgeManagement.tsx` | `REACT_APP_API_URL` + auth header (Task 3) |

---

## Task 1: Lock down the pledge API

Closes the live exposure: `GET /api/pledges` currently returns every pledger's
name, email, phone and address to anyone on the internet, and `PUT /api/pledges/:id`
lets anyone alter them.

**Files:**
- Modify: `backend/src/routes/pledgeRoutes.js`
- Test: `backend/tests/integration/pledgeAuth.test.js` (create)

**Interfaces:**
- Consumes: `firebaseAuthMiddleware` from `src/middleware/auth`, `roleMiddleware` from `src/middleware/role`
- Produces: authenticated `/api/pledges` routes. Later route files declare the same `viewRoles` / `editRoles` arrays locally — copy them verbatim, do not import them.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/pledgeAuth.test.js`:

```js
const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

describe('Pledge route authorization', () => {
  let memberUser, treasurerUser, pledge;

  beforeAll(async () => { await sequelize.sync({ force: true }); });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await Member.destroy({ where: {} });

    memberUser = await Member.create({
      first_name: 'Plain', last_name: 'Member', phone_number: '+15550000001',
      email: 'plain@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-member'
    });
    treasurerUser = await Member.create({
      first_name: 'Tess', last_name: 'Treasurer', phone_number: '+15550000002',
      email: 'tess@example.com', is_active: true, role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    pledge = await Pledge.create({
      amount: 500, first_name: 'Anon', last_name: 'Pledger',
      email: 'anon@example.com', pledge_type: 'fundraising'
    });
  });

  it('rejects unauthenticated listing of pledges', async () => {
    const res = await request(app).get('/api/pledges');
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated pledge updates', async () => {
    const res = await request(app).put(`/api/pledges/${pledge.id}`).send({ notes: 'hacked' });
    expect(res.status).toBe(401);
  });

  it('rejects a plain member listing all pledges', async () => {
    setVerifyTokenPayload({ uid: 'uid-member', email: memberUser.email });
    const res = await request(app).get('/api/pledges').set('Authorization', 'Bearer t');
    expect(res.status).toBe(403);
  });

  it('allows a treasurer to list pledges', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: treasurerUser.email });
    const res = await request(app).get('/api/pledges').set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('still allows an unauthenticated visitor to create a pledge', async () => {
    const res = await request(app).post('/api/pledges').send({
      amount: 250, first_name: 'Visitor', last_name: 'Guest',
      email: 'visitor@example.com'
    });
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/integration/pledgeAuth.test.js -v`
Expected: the four auth tests FAIL — unauthenticated requests currently return
200, and the plain member gets 200 instead of 403. The visitor-create test passes.

- [ ] **Step 3: Add auth and role guards**

In `backend/src/routes/pledgeRoutes.js`, after the `validatePledge` array and
before the route definitions:

```js
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Same vocabulary as transactionRoutes.js — do not invent new role names.
const viewRoles = ['admin', 'treasurer', 'church_leadership', 'secretary',
  'bookkeeper', 'auditor', 'budget_committee', 'ar_team', 'ap_team'];
const editRoles = ['admin', 'treasurer', 'bookkeeper', 'ar_team'];
```

Then change the route definitions. `POST /` stays public on purpose — visitors
pledge at events:

```js
// PUBLIC: visitors pledge at events. Rate-limited by the global /api/ limiter.
router.post('/', validatePledge, pledgeController.createPledge);

router.get('/', firebaseAuthMiddleware, roleMiddleware(viewRoles), pledgeController.getAllPledges);
router.get('/:id', firebaseAuthMiddleware, roleMiddleware(viewRoles), pledgeController.getPledge);
router.put('/:id', firebaseAuthMiddleware, roleMiddleware(editRoles), pledgeController.updatePledge);

module.exports = router;
```

Leave `router.get('/stats', …)` untouched — Task 2 handles it.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/integration/pledgeAuth.test.js -v`
Expected: all 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/pledgeRoutes.js backend/tests/integration/pledgeAuth.test.js
git commit -m "fix: require auth and roles on pledge read/write routes"
```

---

## Task 2: Split public and private pledge stats

`GET /api/pledges/stats` is public and returns every pledger's name. The
frontend hides names client-side, which means the API ships them to everyone.

**Files:**
- Modify: `backend/src/controllers/pledgeController.js` (`getPledgeStats`)
- Modify: `backend/src/routes/pledgeRoutes.js`
- Test: `backend/tests/integration/pledgeStats.test.js` (create)

**Interfaces:**
- Produces: `GET /api/pledges/stats` → aggregates only. `GET /api/pledges/stats?detail=true` → requires auth + `viewRoles`, adds `status_breakdown[].pledges[]`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/pledgeStats.test.js`:

```js
const request = require('supertest');
const app = require('../../src/server');
const { Member, Pledge, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};

describe('GET /api/pledges/stats', () => {
  beforeAll(async () => { await sequelize.sync({ force: true }); });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await Member.destroy({ where: {} });
    await Member.create({
      first_name: 'Tess', last_name: 'Treasurer', phone_number: '+15550000002',
      email: 'tess@example.com', is_active: true, role: 'treasurer',
      firebase_uid: 'uid-treasurer'
    });
    await Pledge.create({
      amount: 500, first_name: 'Jane', last_name: 'Doe',
      email: 'jane@example.com', pledge_type: 'fundraising'
    });
  });

  it('returns aggregates without any donor names to the public', async () => {
    const res = await request(app).get('/api/pledges/stats');
    expect(res.status).toBe(200);
    expect(res.body.stats.total_pledged).toBe(500);
    // No name must appear anywhere in the public payload.
    expect(JSON.stringify(res.body)).not.toContain('Jane');
    expect(res.body.stats.status_breakdown[0].pledges).toBeUndefined();
  });

  it('rejects ?detail=true without authentication', async () => {
    const res = await request(app).get('/api/pledges/stats?detail=true');
    expect(res.status).toBe(401);
  });

  it('returns per-pledge detail to a treasurer', async () => {
    setVerifyTokenPayload({ uid: 'uid-treasurer', email: 'tess@example.com' });
    const res = await request(app)
      .get('/api/pledges/stats?detail=true')
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.stats.status_breakdown[0].pledges[0].name).toBe('Jane Doe');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/integration/pledgeStats.test.js -v`
Expected: test 1 FAILS (names present), test 2 FAILS (returns 200, not 401).

- [ ] **Step 3: Implement the split**

In `pledgeController.js`, in `getPledgeStats`, add near the top:

```js
  // Detail (per-pledge rows incl. donor names) is privileged. The route layer
  // authenticates; this flag decides what gets serialized.
  const wantDetail = req.query.detail === 'true';
```

Change the `statusBreakdown` mapping in the response so `pledges` is omitted
unless detail was requested:

```js
        status_breakdown: statusBreakdown.map(stat => ({
          status: stat.status,
          count: stat.count,
          total_amount: stat.total_amount,
          ...(wantDetail ? { pledges: stat.pledges } : {})
        })),
        ...(wantDetail ? {
          recent_pledges: recentPledges.map(pledge => ({
            id: pledge.id,
            name: `${pledge.first_name} ${pledge.last_name}`,
            amount: parseFloat(pledge.amount),
            pledge_type: pledge.pledge_type,
            created_at: pledge.created_at,
            member: pledge.member
          }))
        } : {})
```

Remove the unconditional `recent_pledges` block that previously followed.

In `pledgeRoutes.js`, gate the route conditionally:

```js
// Aggregates are public (the progress bar on the public pledge page).
// ?detail=true exposes donor names and requires auth + view role.
const statsAuthGate = (req, res, next) => {
  if (req.query.detail !== 'true') return next();
  return firebaseAuthMiddleware(req, res, (err) =>
    err ? next(err) : roleMiddleware(viewRoles)(req, res, next));
};

router.get('/stats', statsAuthGate, pledgeController.getPledgeStats);
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/integration/pledgeStats.test.js -v`
Expected: all 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/pledgeController.js backend/src/routes/pledgeRoutes.js backend/tests/integration/pledgeStats.test.js
git commit -m "fix: keep donor names out of the public pledge stats endpoint"
```

---

## Task 3: RLS on `pledges` + fix the admin UI fetch

`pledges` has no RLS, unlike `square_payments` / `zelle_email_queue` / etc, so
Supabase auto-exposes it via PostgREST. Separately, `PledgeManagement.tsx`
fetches a relative `/api/pledges`, which on Firebase Hosting hits the hosting
origin rather than the OCI backend — and now sends no auth header, so it would
401 after Task 1.

**Files:**
- Create: `backend/migrations/20260820000001-enable-rls-pledges.js`
- Modify: `frontend/src/components/PledgeManagement.tsx:57` and `:84`

- [ ] **Step 1: Write the RLS migration**

Create `backend/migrations/20260820000001-enable-rls-pledges.js`:

```js
'use strict';

// `pledges` was missed by 20260811000000-enable-rls-square-expense-zelle-tables.js
// but holds the same class of data those tables do: names, emails, phones and
// addresses for every person who pledged. Same treatment, same reasoning —
// enable RLS, add no policies. Deny-all-to-non-owners blocks PostgREST's
// anon/authenticated roles; the backend connects as the table owner, and
// Postgres exempts owners from RLS unless FORCE is also set (it is not).

module.exports = {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    await queryInterface.sequelize.query('ALTER TABLE public."pledges" ENABLE ROW LEVEL SECURITY;');
  },

  down: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    await queryInterface.sequelize
      .query('ALTER TABLE public."pledges" DISABLE ROW LEVEL SECURITY;')
      .catch(() => {});
  }
};
```

- [ ] **Step 2: Fix the frontend fetches**

In `frontend/src/components/PledgeManagement.tsx`, the component currently has
no auth context. Add the import at the top:

```tsx
import { useAuth } from '../contexts/AuthContext';
```

Inside the component, next to the existing `useLanguage()` call:

```tsx
  const { firebaseUser } = useAuth();

  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await firebaseUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };
```

Replace the `fetchPledges` fetch call (line ~57):

```tsx
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/pledges?${params.toString()}`,
        { headers: await authHeaders() }
      );
```

Replace the `handleStatusUpdate` fetch call (line ~84):

```tsx
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/pledges/${pledgeId}`,
        { method: 'PUT', headers: await authHeaders(), body: JSON.stringify(updateData) }
      );
```

Verify the property name against `frontend/src/contexts/AuthContext.tsx` before
writing — use whatever that context actually exposes for the Firebase user, and
match how `TreasurerDashboard.tsx` obtains its token.

- [ ] **Step 3: Verify the frontend still compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new errors in `PledgeManagement.tsx`.

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/20260820000001-enable-rls-pledges.js frontend/src/components/PledgeManagement.tsx
git commit -m "fix: enable RLS on pledges and send authenticated API calls from admin UI"
```

**Phase 0 is now complete and independently shippable.**

---

## Task 4: `pledge_campaigns` table, model, and seeds

**Files:**
- Create: `backend/migrations/20260820000002-create-pledge-campaigns.js`
- Create: `backend/src/models/PledgeCampaign.js`
- Modify: `backend/src/models/index.js`
- Test: `backend/tests/unit/pledgeCampaign.test.js` (create)

**Interfaces:**
- Produces: `PledgeCampaign` model. Fields: `id`, `slug`, `name`, `name_ti`, `description`, `description_ti`, `start_date`, `end_date`, `goal_amount`, `currency`, `status`, `default_payment_type`, `income_category_id`. `status` ∈ `draft|active|closed`. Later tasks use `PledgeCampaign.findOne({ where: { slug } })`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeCampaign.test.js`:

```js
const { PledgeCampaign, sequelize } = require('../../src/models');

describe('PledgeCampaign model', () => {
  beforeAll(async () => { await sequelize.sync({ force: true }); });
  beforeEach(async () => { await PledgeCampaign.destroy({ where: {} }); });

  it('creates a campaign with a unique slug', async () => {
    const c = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026 Pledge Drive',
      start_date: '2026-01-01', end_date: '2026-12-31',
      goal_amount: 100000, status: 'draft', default_payment_type: 'pledge_drive'
    });
    expect(c.slug).toBe('2026-pledge-drive');
    expect(c.currency).toBe('usd');
  });

  it('rejects a duplicate slug', async () => {
    await PledgeCampaign.create({ slug: 'dup', name: 'A', start_date: '2026-01-01' });
    await expect(
      PledgeCampaign.create({ slug: 'dup', name: 'B', start_date: '2026-01-01' })
    ).rejects.toThrow();
  });

  it('rejects an unknown status', async () => {
    await expect(PledgeCampaign.create({
      slug: 'bad-status', name: 'Bad', start_date: '2026-01-01', status: 'archived'
    })).rejects.toThrow();
  });

  it('defaults status to draft', async () => {
    const c = await PledgeCampaign.create({ slug: 'd', name: 'D', start_date: '2026-01-01' });
    expect(c.status).toBe('draft');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/unit/pledgeCampaign.test.js -v`
Expected: FAIL — `Cannot read properties of undefined (reading 'destroy')`, because
`PledgeCampaign` is not registered yet.

- [ ] **Step 3: Write the model**

Create `backend/src/models/PledgeCampaign.js`:

```js
'use strict';

const { Model, DataTypes } = require('sequelize');

const STATUSES = ['draft', 'active', 'closed'];

module.exports = (sequelize) => {
  class PledgeCampaign extends Model {
    static associate(models) {
      PledgeCampaign.hasMany(models.Pledge, { foreignKey: 'campaign_id', as: 'pledges' });
      PledgeCampaign.belongsTo(models.IncomeCategory, {
        foreignKey: 'income_category_id', as: 'incomeCategory'
      });
    }

    get isOpen() {
      return this.status !== 'closed';
    }
  }

  PledgeCampaign.init({
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    slug: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    name_ti: { type: DataTypes.STRING(255), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    description_ti: { type: DataTypes.TEXT, allowNull: true },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    goal_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'usd' },
    // VARCHAR + validation rather than a Postgres ENUM: LedgerEntry sets the
    // precedent (enums mapped as STRING to avoid enum mismatch), and it spares
    // us the CREATE TYPE/swap/rename dance on every future status addition.
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'draft',
      validate: { isIn: [STATUSES] }
    },
    default_payment_type: { type: DataTypes.STRING(50), allowNull: true },
    income_category_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: { model: 'income_categories', key: 'id' }
    }
  }, {
    sequelize,
    modelName: 'PledgeCampaign',
    tableName: 'pledge_campaigns',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  PledgeCampaign.STATUSES = STATUSES;

  return PledgeCampaign;
};
```

Register it in `src/models/index.js` following the pattern already used there
for the other models (match the surrounding require/init/associate style
exactly — read the file before editing).

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/unit/pledgeCampaign.test.js -v`
Expected: all 4 PASS.

- [ ] **Step 5: Write the migration**

Create `backend/migrations/20260820000002-create-pledge-campaigns.js`:

```js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pledge_campaigns', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      slug: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      name_ti: { type: Sequelize.STRING(255), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      description_ti: { type: Sequelize.TEXT, allowNull: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: true },
      goal_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'usd' },
      status: { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'draft' },
      default_payment_type: { type: Sequelize.STRING(50), allowNull: true },
      income_category_id: {
        type: Sequelize.BIGINT, allowNull: true,
        references: { model: 'income_categories', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL'
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('pledge_campaigns', ['status']);

    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        ALTER TABLE pledge_campaigns
        ADD CONSTRAINT pledge_campaigns_status_check
        CHECK (status IN ('draft', 'active', 'closed'));
      `);
    }

    // Both campaigns start as draft. 2025 is frozen only after reconciliation
    // (see the spec, section 4.1) — you cannot reconcile a closed campaign.
    // 2026 is activated in a later phase.
    const now = new Date();
    await queryInterface.bulkInsert('pledge_campaigns', [
      {
        slug: '2025-pledge-drive', name: '2025 Pledge Drive',
        description: 'Pledge drive that ran September 2025 through January 2026.',
        start_date: '2025-09-13', end_date: '2026-01-12',
        currency: 'usd', status: 'draft', default_payment_type: 'building_fund',
        created_at: now, updated_at: now
      },
      {
        slug: '2026-pledge-drive', name: '2026 Pledge Drive',
        start_date: '2026-01-01', end_date: '2026-12-31',
        currency: 'usd', status: 'draft', default_payment_type: 'pledge_drive',
        created_at: now, updated_at: now
      }
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('pledge_campaigns');
  }
};
```

- [ ] **Step 6: Commit**

```bash
git add backend/migrations/20260820000002-create-pledge-campaigns.js backend/src/models/PledgeCampaign.js backend/src/models/index.js backend/tests/unit/pledgeCampaign.test.js
git commit -m "feat: add pledge_campaigns table and model"
```

---

## Task 5: Migrate `pledges` onto campaigns

**The order inside the migration matters:** `is_historical` must be set on the
existing 148 rows *before* the partial unique index is created, or index
creation fails on the 6 members who hold duplicate 2025 pledges.

**Files:**
- Create: `backend/migrations/20260820000003-add-campaign-to-pledges.js`
- Modify: `backend/src/models/Pledge.js`
- Test: `backend/tests/unit/pledgeModel.test.js` (create)

**Interfaces:**
- Produces: `Pledge` gains `campaign_id` (BIGINT, NOT NULL), `lifecycle` (`active|cancelled`), `is_historical` (BOOLEAN), and `legacy_status` (renamed from `status`, nullable). Later tasks read `pledge.campaign_id` and `pledge.lifecycle`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeModel.test.js`:

```js
const { Pledge, PledgeCampaign, Member, sequelize } = require('../../src/models');

describe('Pledge model with campaigns', () => {
  let campaign, member;

  beforeAll(async () => { await sequelize.sync({ force: true }); });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });
    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026 Pledge Drive', start_date: '2026-01-01'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  const base = { amount: 500, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising' };

  it('defaults lifecycle to active and is_historical to false', async () => {
    const p = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id });
    expect(p.lifecycle).toBe('active');
    expect(p.is_historical).toBe(false);
  });

  it('rejects a second active pledge for the same member in the same campaign', async () => {
    await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id });
    await expect(
      Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id })
    ).rejects.toThrow();
  });

  it('allows a second pledge once the first is cancelled', async () => {
    const first = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id });
    await first.update({ lifecycle: 'cancelled' });
    const second = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id });
    expect(second.id).not.toBe(first.id);
  });

  it('allows multiple anonymous pledges in one campaign', async () => {
    await Pledge.create({ ...base, campaign_id: campaign.id, member_id: null });
    const second = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: null });
    expect(second.id).toBeDefined();
  });

  it('exempts historical rows from the uniqueness rule', async () => {
    await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id, is_historical: true });
    const second = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id, is_historical: true });
    expect(second.id).toBeDefined();
  });

  it('rejects an unknown lifecycle value', async () => {
    await expect(Pledge.create({
      ...base, campaign_id: campaign.id, member_id: member.id, lifecycle: 'paused'
    })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/unit/pledgeModel.test.js -v`
Expected: FAIL — `lifecycle` and `is_historical` do not exist on the model.

- [ ] **Step 3: Update the Pledge model**

In `backend/src/models/Pledge.js`:

Rename the `status` attribute to `legacy_status` and make it nullable:

```js
    // Renamed from `status`. Holds the hand-flipped 2025 values verbatim.
    // NOT a source of truth: fulfillment is derived in the pledge_balances view.
    // Renaming was deliberate — leaving it called `status` is how this bug returns.
    legacy_status: {
      type: DataTypes.ENUM('pending', 'fulfilled', 'expired', 'cancelled'),
      allowNull: true
    },
```

Add the three new attributes:

```js
    campaign_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: 'pledge_campaigns', key: 'id' }
    },
    // The ONLY mutable state on a pledge. Fulfillment is never stored.
    lifecycle: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'active',
      validate: { isIn: [['active', 'cancelled']] }
    },
    // True for every 2025 row. Required because 6 members hold duplicate 2025
    // pledges, which would break the partial unique index below.
    is_historical: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
```

Add to the model options object (alongside `tableName`):

```js
    indexes: [
      { fields: ['campaign_id'] },
      { fields: ['campaign_id', 'lifecycle'] },
      {
        name: 'pledges_one_active_per_member_per_campaign',
        unique: true,
        fields: ['campaign_id', 'member_id'],
        where: { member_id: { [Op.ne]: null }, lifecycle: 'active', is_historical: false }
      }
    ],
```

Add `Op` to the requires at the top of the file:

```js
const { Model, DataTypes, Op } = require('sequelize');
```

Add the campaign association inside `associate`:

```js
      Pledge.belongsTo(models.PledgeCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
      Pledge.hasMany(models.PledgeAllocation, { foreignKey: 'pledge_id', as: 'allocations' });
```

The `PledgeAllocation` association will fail until Task 6 registers that model —
add it now and expect Task 6 to complete the pair.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/unit/pledgeModel.test.js -v`
Expected: all 6 PASS.

If the `hasMany(PledgeAllocation)` association throws, comment that one line out
and restore it in Task 6 Step 3.

- [ ] **Step 5: Write the migration**

Create `backend/migrations/20260820000003-add-campaign-to-pledges.js`:

```js
'use strict';

// Order is load-bearing. is_historical must be set on the existing rows BEFORE
// the partial unique index is built, because production has 6 members holding
// duplicate 2025 pledges (max 3 for one member). Building the index first fails.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM pledge_campaigns WHERE slug = '2025-pledge-drive';"
    );
    if (!rows.length) throw new Error('2025-pledge-drive campaign missing — run the campaigns migration first');
    const campaign2025 = rows[0].id;

    // 1. campaign_id, nullable for now
    await queryInterface.addColumn('pledges', 'campaign_id', {
      type: Sequelize.BIGINT, allowNull: true,
      references: { model: 'pledge_campaigns', key: 'id' },
      onUpdate: 'CASCADE', onDelete: 'RESTRICT'
    });

    // 2. Backfill unconditionally: all existing rows are one drive
    //    (verified in production — every row has a blank event_name).
    await queryInterface.sequelize.query(
      'UPDATE pledges SET campaign_id = :cid WHERE campaign_id IS NULL;',
      { replacements: { cid: campaign2025 } }
    );

    await queryInterface.changeColumn('pledges', 'campaign_id', {
      type: Sequelize.BIGINT, allowNull: false
    });

    // 3. is_historical — set true for every pre-existing row
    await queryInterface.addColumn('pledges', 'is_historical', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false
    });
    await queryInterface.sequelize.query(
      'UPDATE pledges SET is_historical = true WHERE campaign_id = :cid;',
      { replacements: { cid: campaign2025 } }
    );

    // 4. lifecycle, derived from the old status
    await queryInterface.addColumn('pledges', 'lifecycle', {
      type: Sequelize.STRING(16), allowNull: false, defaultValue: 'active'
    });
    await queryInterface.sequelize.query(
      "UPDATE pledges SET lifecycle = 'cancelled' WHERE status = 'cancelled';"
    );

    // 5. Rename status -> legacy_status and relax its constraints.
    //    The data is preserved verbatim; only the name changes.
    await queryInterface.renameColumn('pledges', 'status', 'legacy_status');
    await queryInterface.changeColumn('pledges', 'legacy_status', {
      type: Sequelize.ENUM('pending', 'fulfilled', 'expired', 'cancelled'),
      allowNull: true, defaultValue: null
    });

    // 6. Indexes — AFTER is_historical is populated
    await queryInterface.addIndex('pledges', ['campaign_id']);
    await queryInterface.addIndex('pledges', ['campaign_id', 'lifecycle']);

    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX pledges_one_active_per_member_per_campaign
        ON pledges (campaign_id, member_id)
        WHERE member_id IS NOT NULL AND lifecycle = 'active' AND is_historical = false;
      `);
      await queryInterface.sequelize.query(`
        ALTER TABLE pledges ADD CONSTRAINT pledges_lifecycle_check
        CHECK (lifecycle IN ('active', 'cancelled'));
      `);
      await queryInterface.sequelize.query(`
        ALTER TABLE pledges ADD CONSTRAINT pledges_amount_positive CHECK (amount > 0);
      `);
    }
  },

  down: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS pledges_one_active_per_member_per_campaign;');
      await queryInterface.sequelize.query('ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_lifecycle_check;');
      await queryInterface.sequelize.query('ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_amount_positive;');
    }
    await queryInterface.renameColumn('pledges', 'legacy_status', 'status');
    await queryInterface.removeColumn('pledges', 'lifecycle');
    await queryInterface.removeColumn('pledges', 'is_historical');
    await queryInterface.removeColumn('pledges', 'campaign_id');
  }
};
```

- [ ] **Step 6: Run the whole suite to catch fallout from the rename**

Run: `cd backend && npx jest -v 2>&1 | tail -40`
Expected: failures in any test touching `pledge.status` — most likely
`tests/integration/pledgeStats.test.js` and anything exercising
`smsController`. Fix each by reading `legacy_status`; the full repoint to
derived status happens in a later plan.

- [ ] **Step 7: Commit**

```bash
git add backend/migrations/20260820000003-add-campaign-to-pledges.js backend/src/models/Pledge.js backend/tests/unit/pledgeModel.test.js
git commit -m "feat: scope pledges to campaigns and retire the hand-set status field"
```

---

## Task 6: `pledge_allocations` table, model, and append-only trigger

**Files:**
- Create: `backend/migrations/20260820000004-create-pledge-allocations.js`
- Create: `backend/src/models/PledgeAllocation.js`
- Modify: `backend/src/models/index.js`
- Test: `backend/tests/unit/pledgeAllocationModel.test.js` (create)

**Interfaces:**
- Produces: `PledgeAllocation` with `pledge_id`, `transaction_id`, `amount`, `source`, `allocated_by`, `reason`, `reverses_allocation_id`, `idempotency_key`, `created_at`. `SOURCES = ['stripe_auto','treasurer_manual','migration','stripe_refund']`. Task 10 and 11 create rows through the service, never directly.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeAllocationModel.test.js`:

```js
const { PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');

describe('PledgeAllocation model', () => {
  let pledge, txn, member;

  beforeAll(async () => { await sequelize.sync({ force: true }); });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    const campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01', status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
    pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver',
      pledge_type: 'fundraising', campaign_id: campaign.id, member_id: member.id
    });
    txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 1000, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
  });

  it('creates a positive allocation', async () => {
    const a = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000,
      source: 'treasurer_manual', allocated_by: member.id
    });
    expect(parseFloat(a.amount)).toBe(1000);
  });

  it('rejects a zero allocation', async () => {
    await expect(PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 0, source: 'treasurer_manual'
    })).rejects.toThrow();
  });

  it('rejects an unknown source', async () => {
    await expect(PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 100, source: 'guesswork'
    })).rejects.toThrow();
  });

  it('rejects a reversal that is not negative', async () => {
    const a = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000, source: 'treasurer_manual'
    });
    await expect(PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 500,
      source: 'treasurer_manual', reverses_allocation_id: a.id, reason: 'oops'
    })).rejects.toThrow();
  });

  it('rejects a reversal with no reason', async () => {
    const a = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000, source: 'treasurer_manual'
    });
    await expect(PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: -1000,
      source: 'treasurer_manual', reverses_allocation_id: a.id
    })).rejects.toThrow();
  });

  it('accepts a well-formed reversal', async () => {
    const a = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000, source: 'treasurer_manual'
    });
    const r = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: -1000,
      source: 'treasurer_manual', reverses_allocation_id: a.id,
      reason: 'Applied to the wrong pledge', allocated_by: member.id
    });
    expect(parseFloat(r.amount)).toBe(-1000);
  });

  it('rejects a duplicate idempotency key', async () => {
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 500,
      source: 'stripe_auto', idempotency_key: 'auto:pi_123:1'
    });
    await expect(PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 500,
      source: 'stripe_auto', idempotency_key: 'auto:pi_123:1'
    })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/unit/pledgeAllocationModel.test.js -v`
Expected: FAIL — `PledgeAllocation` is undefined.

- [ ] **Step 3: Write the model**

Create `backend/src/models/PledgeAllocation.js`:

```js
'use strict';

const { Model, DataTypes } = require('sequelize');

const SOURCES = ['stripe_auto', 'treasurer_manual', 'migration', 'stripe_refund'];

module.exports = (sequelize) => {
  // APPEND-ONLY. Rows are never updated or deleted — corrections are reversing
  // rows (negative amount + reverses_allocation_id + reason). That is what makes
  // the audit trail (who/when/previous/new/why) fall out of the table itself.
  // A Postgres trigger enforces this in production; the service layer must never
  // issue UPDATE or DELETE against this model.
  class PledgeAllocation extends Model {
    static associate(models) {
      PledgeAllocation.belongsTo(models.Pledge, { foreignKey: 'pledge_id', as: 'pledge' });
      PledgeAllocation.belongsTo(models.Transaction, { foreignKey: 'transaction_id', as: 'transaction' });
      PledgeAllocation.belongsTo(models.Member, { foreignKey: 'allocated_by', as: 'allocator' });
      PledgeAllocation.belongsTo(models.PledgeAllocation, {
        foreignKey: 'reverses_allocation_id', as: 'reverses'
      });
    }
  }

  PledgeAllocation.init({
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    pledge_id: {
      type: DataTypes.BIGINT, allowNull: false,
      references: { model: 'pledges', key: 'id' }
    },
    transaction_id: {
      type: DataTypes.BIGINT, allowNull: false,
      references: { model: 'transactions', key: 'id' }
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        notZero(value) {
          if (parseFloat(value) === 0) throw new Error('Allocation amount cannot be zero');
        }
      }
    },
    source: {
      type: DataTypes.STRING(24), allowNull: false,
      validate: { isIn: [SOURCES] }
    },
    allocated_by: {
      type: DataTypes.BIGINT, allowNull: true,
      references: { model: 'members', key: 'id' },
      comment: 'NULL only for automated sources (stripe_auto, stripe_refund)'
    },
    reason: { type: DataTypes.TEXT, allowNull: true },
    reverses_allocation_id: {
      type: DataTypes.BIGINT, allowNull: true,
      references: { model: 'pledge_allocations', key: 'id' }
    },
    idempotency_key: {
      type: DataTypes.STRING(191), allowNull: true, unique: true,
      comment: 'auto:<external_id>:<pledge_id> for automated allocations; NULL for manual'
    }
  }, {
    sequelize,
    modelName: 'PledgeAllocation',
    tableName: 'pledge_allocations',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,  // rows never change
    indexes: [
      { fields: ['pledge_id'] },
      { fields: ['transaction_id'] },
      { unique: true, fields: ['idempotency_key'] }
    ],
    validate: {
      reversalsAreNegativeAndExplained() {
        if (this.reverses_allocation_id == null) return;
        if (parseFloat(this.amount) >= 0) {
          throw new Error('A reversing allocation must have a negative amount');
        }
        if (!this.reason || !String(this.reason).trim()) {
          throw new Error('A reversing allocation must have a reason');
        }
      }
    }
  });

  PledgeAllocation.SOURCES = SOURCES;

  return PledgeAllocation;
};
```

Register it in `src/models/index.js`, and restore the
`Pledge.hasMany(models.PledgeAllocation, …)` line if it was commented out in
Task 5.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/unit/pledgeAllocationModel.test.js -v`
Expected: all 7 PASS.

- [ ] **Step 5: Write the migration**

Create `backend/migrations/20260820000004-create-pledge-allocations.js`:

```js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pledge_allocations', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      pledge_id: {
        type: Sequelize.BIGINT, allowNull: false,
        references: { model: 'pledges', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'RESTRICT'
      },
      transaction_id: {
        type: Sequelize.BIGINT, allowNull: false,
        references: { model: 'transactions', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'RESTRICT'
      },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      source: { type: Sequelize.STRING(24), allowNull: false },
      allocated_by: {
        type: Sequelize.BIGINT, allowNull: true,
        references: { model: 'members', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL'
      },
      reason: { type: Sequelize.TEXT, allowNull: true },
      reverses_allocation_id: {
        type: Sequelize.BIGINT, allowNull: true,
        references: { model: 'pledge_allocations', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'RESTRICT'
      },
      idempotency_key: { type: Sequelize.STRING(191), allowNull: true, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('pledge_allocations', ['pledge_id']);
    await queryInterface.addIndex('pledge_allocations', ['transaction_id']);

    if (queryInterface.sequelize.getDialect() !== 'postgres') return;

    await queryInterface.sequelize.query(`
      ALTER TABLE pledge_allocations
        ADD CONSTRAINT pledge_allocations_amount_nonzero CHECK (amount <> 0),
        ADD CONSTRAINT pledge_allocations_source_check
          CHECK (source IN ('stripe_auto','treasurer_manual','migration','stripe_refund')),
        ADD CONSTRAINT pledge_allocations_reversal_shape
          CHECK (reverses_allocation_id IS NULL OR (amount < 0 AND reason IS NOT NULL));
    `);

    // Append-only. This is what makes "financial records cannot be corrupted"
    // a guarantee rather than a convention. Corrections are reversing rows.
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION pledge_allocations_append_only()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'pledge_allocations is append-only: insert a reversing row instead of %', TG_OP;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryInterface.sequelize.query(`
      CREATE TRIGGER pledge_allocations_no_update_delete
      BEFORE UPDATE OR DELETE ON pledge_allocations
      FOR EACH ROW EXECUTE FUNCTION pledge_allocations_append_only();
    `);
  },

  down: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS pledge_allocations_no_update_delete ON pledge_allocations;');
      await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS pledge_allocations_append_only();');
    }
    await queryInterface.dropTable('pledge_allocations');
  }
};
```

- [ ] **Step 6: Commit**

```bash
git add backend/migrations/20260820000004-create-pledge-allocations.js backend/src/models/PledgeAllocation.js backend/src/models/index.js backend/tests/unit/pledgeAllocationModel.test.js
git commit -m "feat: add append-only pledge_allocations table and model"
```

---

## Task 7: The balance views

**This is the task the whole design rests on, and the one with the trap.** Tests
run `sequelize.sync({ force: true })`, not migrations — so a view created only
by a migration will not exist under Jest and every balance test fails with "no
such table". The view SQL therefore lives in a shared module that both the
migration and `tests/setup.js` call.

**Files:**
- Create: `backend/src/database/pledgeViews.js`
- Create: `backend/migrations/20260820000005-create-pledge-views.js`
- Create: `backend/src/models/PledgeBalance.js`, `backend/src/models/CampaignTotal.js`
- Modify: `backend/tests/setup.js`, `backend/src/models/index.js`
- Test: `backend/tests/unit/pledgeBalances.test.js` (create)

**Interfaces:**
- Produces: `createPledgeViews(queryInterface)` / `dropPledgeViews(queryInterface)`. Model `PledgeBalance` with `pledge_id`, `campaign_id`, `member_id`, `pledged_amount`, `paid_amount`, `remaining_amount`, `percent_fulfilled`, `derived_status`, `last_payment_at`. `derived_status` ∈ `not_started|partially_fulfilled|fulfilled|cancelled`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeBalances.test.js`:

```js
const { PledgeBalance, PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');

describe('pledge_balances view', () => {
  let campaign, member, pledge;

  beforeAll(async () => { await sequelize.sync({ force: true }); });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01', status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
    pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver',
      pledge_type: 'fundraising', campaign_id: campaign.id, member_id: member.id
    });
  });

  const pay = async (amount, status = 'succeeded') => {
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount, payment_type: 'donation', payment_method: 'zelle', status
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: member.id
    });
    return txn;
  };

  const balance = async () => PledgeBalance.findOne({ where: { pledge_id: pledge.id } });

  it('reports the spec example: 5000 pledged, 1000 + 1500 paid', async () => {
    await pay(1000);
    await pay(1500);
    const b = await balance();
    expect(parseFloat(b.pledged_amount)).toBe(5000);
    expect(parseFloat(b.paid_amount)).toBe(2500);
    expect(parseFloat(b.remaining_amount)).toBe(2500);
    expect(parseFloat(b.percent_fulfilled)).toBe(50);
    expect(b.derived_status).toBe('partially_fulfilled');
  });

  it('reports not_started with no payments', async () => {
    const b = await balance();
    expect(parseFloat(b.paid_amount)).toBe(0);
    expect(parseFloat(b.remaining_amount)).toBe(5000);
    expect(b.derived_status).toBe('not_started');
  });

  it('reports fulfilled when the balance is met exactly', async () => {
    await pay(5000);
    const b = await balance();
    expect(parseFloat(b.remaining_amount)).toBe(0);
    expect(b.derived_status).toBe('fulfilled');
  });

  it('leaves remaining_amount negative on overpayment', async () => {
    await pay(6000);
    const b = await balance();
    expect(parseFloat(b.remaining_amount)).toBe(-1000);
    expect(b.derived_status).toBe('fulfilled');
  });

  it('ignores allocations whose transaction failed', async () => {
    await pay(1000);
    await pay(2000, 'failed');
    const b = await balance();
    expect(parseFloat(b.paid_amount)).toBe(1000);
  });

  it('ignores allocations whose transaction was refunded', async () => {
    await pay(1000);
    await pay(2000, 'refunded');
    const b = await balance();
    expect(parseFloat(b.paid_amount)).toBe(1000);
  });

  it('nets a reversing allocation out of the paid amount', async () => {
    const txn = await pay(1000);
    const original = await PledgeAllocation.findOne({ where: { transaction_id: txn.id } });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: -400,
      source: 'treasurer_manual', reverses_allocation_id: original.id,
      reason: 'Partial refund', allocated_by: member.id
    });
    const b = await balance();
    expect(parseFloat(b.paid_amount)).toBe(600);
  });

  it('reports cancelled regardless of payments', async () => {
    await pay(1000);
    await pledge.update({ lifecycle: 'cancelled' });
    const b = await balance();
    expect(b.derived_status).toBe('cancelled');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/unit/pledgeBalances.test.js -v`
Expected: FAIL — `PledgeBalance` is undefined and the view does not exist.

- [ ] **Step 3: Write the shared view module**

Create `backend/src/database/pledgeViews.js`:

```js
'use strict';

// SINGLE SOURCE OF THE VIEW SQL.
//
// Called by migrations/20260820000005-create-pledge-views.js AND by
// tests/setup.js. Tests run sequelize.sync({force:true}) rather than
// migrations, so a view defined only in a migration would not exist under Jest.
//
// PORTABILITY (must run on Postgres and SQLite):
//   - SUM(CASE WHEN ... END), never FILTER (WHERE ...)
//   - LEFT JOIN + GROUP BY, never LATERAL
//   - every division guarded by CASE WHEN ... > 0: Postgres raises on
//     divide-by-zero where SQLite quietly returns NULL.

const PLEDGE_BALANCES = (securityInvoker) => `
CREATE VIEW pledge_balances ${securityInvoker ? 'WITH (security_invoker = true) ' : ''}AS
SELECT
  p.id                AS pledge_id,
  p.campaign_id       AS campaign_id,
  p.member_id         AS member_id,
  p.amount            AS pledged_amount,
  COALESCE(SUM(CASE WHEN t.status = 'succeeded' THEN a.amount ELSE 0 END), 0) AS paid_amount,
  p.amount - COALESCE(SUM(CASE WHEN t.status = 'succeeded' THEN a.amount ELSE 0 END), 0) AS remaining_amount,
  CASE WHEN p.amount > 0
       THEN ROUND(COALESCE(SUM(CASE WHEN t.status = 'succeeded' THEN a.amount ELSE 0 END), 0) * 100.0 / p.amount, 1)
       ELSE 0 END AS percent_fulfilled,
  CASE
    WHEN p.lifecycle = 'cancelled' THEN 'cancelled'
    WHEN COALESCE(SUM(CASE WHEN t.status = 'succeeded' THEN a.amount ELSE 0 END), 0) <= 0 THEN 'not_started'
    WHEN COALESCE(SUM(CASE WHEN t.status = 'succeeded' THEN a.amount ELSE 0 END), 0) >= p.amount THEN 'fulfilled'
    ELSE 'partially_fulfilled'
  END AS derived_status,
  MAX(CASE WHEN t.status = 'succeeded' THEN t.payment_date ELSE NULL END) AS last_payment_at
FROM pledges p
LEFT JOIN pledge_allocations a ON a.pledge_id = p.id
LEFT JOIN transactions t ON t.id = a.transaction_id
GROUP BY p.id, p.campaign_id, p.member_id, p.amount, p.lifecycle
`;

const CAMPAIGN_TOTALS = (securityInvoker) => `
CREATE VIEW campaign_totals ${securityInvoker ? 'WITH (security_invoker = true) ' : ''}AS
SELECT
  c.id                AS campaign_id,
  c.slug              AS slug,
  c.goal_amount       AS goal_amount,
  COUNT(b.pledge_id)  AS pledge_count,
  COUNT(DISTINCT b.member_id) AS donor_count,
  COALESCE(SUM(b.pledged_amount), 0)   AS total_pledged,
  COALESCE(SUM(b.paid_amount), 0)      AS total_collected,
  COALESCE(SUM(b.remaining_amount), 0) AS outstanding,
  CASE WHEN c.goal_amount > 0
       THEN ROUND(COALESCE(SUM(b.paid_amount), 0) * 100.0 / c.goal_amount, 1)
       ELSE 0 END AS percent_to_goal
FROM pledge_campaigns c
LEFT JOIN pledge_balances b
  ON b.campaign_id = c.id AND b.derived_status <> 'cancelled'
GROUP BY c.id, c.slug, c.goal_amount
`;

async function createPledgeViews(queryInterface) {
  const isPg = queryInterface.sequelize.getDialect() === 'postgres';
  await dropPledgeViews(queryInterface);
  // security_invoker matters: in PG15 a view runs as its OWNER by default, which
  // would bypass the RLS we enabled on pledges. SQLite has no such concept.
  await queryInterface.sequelize.query(PLEDGE_BALANCES(isPg));
  await queryInterface.sequelize.query(CAMPAIGN_TOTALS(isPg));
}

async function dropPledgeViews(queryInterface) {
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS campaign_totals;');
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS pledge_balances;');
}

module.exports = { createPledgeViews, dropPledgeViews };
```

- [ ] **Step 4: Write the view models**

Create `backend/src/models/PledgeBalance.js`:

```js
'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  // Backed by a VIEW. Read-only: never call create/update/destroy on this model.
  class PledgeBalance extends Model {
    static associate(models) {
      PledgeBalance.belongsTo(models.Pledge, { foreignKey: 'pledge_id', as: 'pledge' });
      PledgeBalance.belongsTo(models.Member, { foreignKey: 'member_id', as: 'member' });
    }
  }

  PledgeBalance.init({
    pledge_id: { type: DataTypes.BIGINT, primaryKey: true },
    campaign_id: DataTypes.BIGINT,
    member_id: DataTypes.BIGINT,
    pledged_amount: DataTypes.DECIMAL(10, 2),
    paid_amount: DataTypes.DECIMAL(10, 2),
    remaining_amount: DataTypes.DECIMAL(10, 2),
    percent_fulfilled: DataTypes.DECIMAL(5, 1),
    derived_status: DataTypes.STRING(24),
    last_payment_at: DataTypes.DATEONLY
  }, {
    sequelize,
    modelName: 'PledgeBalance',
    tableName: 'pledge_balances',
    timestamps: false,
    underscored: true
  });

  return PledgeBalance;
};
```

Create `backend/src/models/CampaignTotal.js` following the identical shape, with
`campaign_id` as primary key and fields `slug`, `goal_amount`, `pledge_count`,
`donor_count`, `total_pledged`, `total_collected`, `outstanding`,
`percent_to_goal`, `tableName: 'campaign_totals'`, `timestamps: false`.

Register both in `src/models/index.js`.

**Important:** `sequelize.sync()` will try to CREATE TABLE for view-backed
models. In `src/models/index.js`, exclude them from sync by removing them from
whatever collection `sync` iterates, or define them after sync. The simplest
approach that works with this codebase: register them normally, and in
`tests/setup.js` drop the tables sync creates before creating the views (Step 5
does exactly that).

- [ ] **Step 5: Wire the views into the test setup**

In `backend/tests/setup.js`, inside the existing `beforeAll`, immediately after
`await sequelize.sync({ force: true });`:

```js
    // Tests sync models rather than running migrations, so views must be created
    // here too. sync() creates real tables for the view-backed models — drop
    // those first, then define the actual views over the same names.
    const { createPledgeViews } = require('../src/database/pledgeViews');
    const qi = sequelize.getQueryInterface();
    await sequelize.query('DROP TABLE IF EXISTS campaign_totals;');
    await sequelize.query('DROP TABLE IF EXISTS pledge_balances;');
    await createPledgeViews(qi);
    console.log('✅ Pledge views created');
```

Any test calling `sequelize.sync({ force: true })` in its own `beforeAll` must
recreate the views afterward. Export a helper from `tests/setup.js` or repeat
the three lines — prefer a helper:

```js
// tests/setup.js — add near the bottom, before module-level mocks
global.recreatePledgeViews = async () => {
  const { createPledgeViews } = require('../src/database/pledgeViews');
  await sequelize.query('DROP TABLE IF EXISTS campaign_totals;');
  await sequelize.query('DROP TABLE IF EXISTS pledge_balances;');
  await createPledgeViews(sequelize.getQueryInterface());
};
```

Then in `tests/unit/pledgeBalances.test.js`, change `beforeAll` to:

```js
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });
```

Apply the same two-line `beforeAll` to every test file in this plan that syncs.

- [ ] **Step 6: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/unit/pledgeBalances.test.js -v`
Expected: all 8 PASS.

If `percent_fulfilled` comes back as a string, that is expected — Sequelize
returns DECIMAL as a string. The test already wraps it in `parseFloat`.

- [ ] **Step 7: Write the migration**

Create `backend/migrations/20260820000005-create-pledge-views.js`:

```js
'use strict';

const { createPledgeViews, dropPledgeViews } = require('../src/database/pledgeViews');

module.exports = {
  up: async (queryInterface) => { await createPledgeViews(queryInterface); },
  down: async (queryInterface) => { await dropPledgeViews(queryInterface); }
};
```

- [ ] **Step 8: Run the whole suite**

Run: `cd backend && npx jest 2>&1 | tail -30`
Expected: no new failures. The `DROP TABLE`s in setup are guarded with
`IF EXISTS`, so they are safe on a fresh database.

- [ ] **Step 9: Commit**

```bash
git add backend/src/database/pledgeViews.js backend/migrations/20260820000005-create-pledge-views.js backend/src/models/PledgeBalance.js backend/src/models/CampaignTotal.js backend/src/models/index.js backend/tests/setup.js backend/tests/unit/pledgeBalances.test.js
git commit -m "feat: derive pledge balances from allocations via SQL views"
```

---

## Task 8: Enum additions — `pledge_drive` and `refunded`

**Files:**
- Create: `backend/migrations/20260820000006-add-pledge-drive-payment-type.js`
- Create: `backend/migrations/20260820000007-add-refunded-transaction-status.js`
- Modify: `backend/src/models/Transaction.js`
- Modify: `backend/src/database/seedIncomeCategories.js`
- Test: `backend/tests/unit/transactionEnums.test.js` (create)

**Interfaces:**
- Produces: `transactions.payment_type` accepts `'pledge_drive'`; `transactions.status` accepts `'refunded'`. Task 7's view already filters on `status = 'succeeded'`, so `refunded` is excluded with no further change.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/transactionEnums.test.js`:

```js
const { Transaction, Member, sequelize } = require('../../src/models');

describe('Transaction enum additions', () => {
  let member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await Transaction.destroy({ where: {} });
    await Member.destroy({ where: {} });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  it('accepts the pledge_drive payment type', async () => {
    const t = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 100, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    expect(t.payment_type).toBe('pledge_drive');
  });

  it('accepts the refunded status', async () => {
    const t = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 100, payment_type: 'pledge_drive', payment_method: 'credit_card', status: 'refunded'
    });
    expect(t.status).toBe('refunded');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/unit/transactionEnums.test.js -v`
Expected: both FAIL with a SequelizeDatabaseError about an invalid enum value.

- [ ] **Step 3: Update the Transaction model**

In `backend/src/models/Transaction.js`, add `'pledge_drive'` to the
`payment_type` ENUM list and `'refunded'` to the `status` ENUM list. Keep the
existing values in their current order and append the new ones.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/unit/transactionEnums.test.js -v`
Expected: both PASS.

- [ ] **Step 5: Write the payment_type migration**

Create `backend/migrations/20260820000006-add-pledge-drive-payment-type.js`,
following the shape of `20251231-add-tigray-fundraiser-payment-type.js`:

```js
'use strict';

// NOTE: no transaction wrapper, and the income_categories insert is a SEPARATE
// statement. Postgres will not let a newly-added enum value be USED in the same
// transaction that adds it.

module.exports = {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    const { sequelize } = queryInterface;

    await sequelize.query('SET search_path TO public;');

    await sequelize.query(`
      ALTER TYPE enum_transactions_payment_type ADD VALUE IF NOT EXISTS 'pledge_drive';
    `);

    try {
      await sequelize.query(`
        ALTER TYPE enum_ledger_entries_type ADD VALUE IF NOT EXISTS 'pledge_drive';
      `);
    } catch (e) {
      console.log(`ℹ️  enum_ledger_entries_type not updated: ${e.message}`);
    }

    // Separate statement — the value added above is not usable until commit.
    await sequelize.query(`
      INSERT INTO income_categories (gl_code, name, description, payment_type_mapping, is_active, created_at, updated_at)
      SELECT 'INC011', 'Pledge Drive', 'Payments toward a pledge campaign', 'pledge_drive', true, NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM income_categories WHERE gl_code = 'INC011');
    `);
  },

  down: async () => {
    // Postgres enum values are not removed on rollback — same precedent as
    // 20251231-add-tigray-fundraiser-payment-type.js.
    console.log('ℹ️  Down migration skipped for pledge_drive payment type.');
  }
};
```

Before writing `INC011`, run
`SELECT gl_code, name, payment_type_mapping FROM income_categories ORDER BY gl_code;`
against a database copy and pick the next free code. Also add the matching entry
to `src/database/seedIncomeCategories.js` so fresh environments get it.

- [ ] **Step 6: Write the status migration**

Create `backend/migrations/20260820000007-add-refunded-transaction-status.js`:

```js
'use strict';

module.exports = {
  up: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_transactions_status ADD VALUE IF NOT EXISTS 'refunded';
    `);
  },

  down: async () => {
    console.log('ℹ️  Down migration skipped for refunded transaction status.');
  }
};
```

- [ ] **Step 7: Commit**

```bash
git add backend/migrations/20260820000006-add-pledge-drive-payment-type.js backend/migrations/20260820000007-add-refunded-transaction-status.js backend/src/models/Transaction.js backend/src/database/seedIncomeCategories.js backend/tests/unit/transactionEnums.test.js
git commit -m "feat: add pledge_drive payment type and refunded transaction status"
```

---

## Task 9: Extract `createTransactionRecord`

Task 13's `POST /api/pledges/:id/payments` must create a transaction and an
allocation atomically. Without this extraction it would need its own copy of
receipt-number validation, GL mapping, and ledger-entry creation — two copies
that will drift.

**Files:**
- Create: `backend/src/services/transactionService.js`
- Modify: `backend/src/controllers/transactionController.js:189-514`
- Test: `backend/tests/unit/transactionService.test.js` (create)

**Interfaces:**
- Produces: `createTransactionRecord(payload, options)` → `Promise<Transaction>`.
  - `payload`: `{ member_id, collected_by, payment_date, amount, payment_type, payment_method, receipt_number, note, donor_name, external_id, for_year, donation_id }`
  - `options`: `{ transaction }` — a Sequelize transaction, **required** when the caller needs atomicity.
  - Creates the `LedgerEntry` as a side effect, exactly as the controller does today.

- [ ] **Step 1: Read the current implementation**

Read `backend/src/controllers/transactionController.js` lines 189–514 in full
before changing anything. Identify precisely: validation, member resolution,
receipt-number rules, GL/income-category mapping, `LedgerEntry` creation, and
the response shaping. **Only the first five move.** Response shaping stays in
the controller.

- [ ] **Step 2: Write the failing test**

Create `backend/tests/unit/transactionService.test.js`:

```js
const { createTransactionRecord } = require('../../src/services/transactionService');
const { Transaction, LedgerEntry, Member, sequelize } = require('../../src/models');

describe('createTransactionRecord', () => {
  let member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Member.destroy({ where: {} });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'treasurer', firebase_uid: 'uid-ann'
    });
  });

  const base = () => ({
    member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
    amount: 250, payment_type: 'pledge_drive', payment_method: 'zelle'
  });

  it('creates a transaction and its ledger entry', async () => {
    const txn = await createTransactionRecord(base());
    expect(parseFloat(txn.amount)).toBe(250);
    const entries = await LedgerEntry.findAll({ where: { transaction_id: txn.id } });
    expect(entries).toHaveLength(1);
  });

  it('requires a receipt number for cash', async () => {
    await expect(
      createTransactionRecord({ ...base(), payment_method: 'cash' })
    ).rejects.toThrow(/receipt/i);
  });

  it('rolls back the transaction and the ledger entry together on failure', async () => {
    const t = await sequelize.transaction();
    await createTransactionRecord(base(), { transaction: t });
    await t.rollback();
    expect(await Transaction.count()).toBe(0);
    expect(await LedgerEntry.count()).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/unit/transactionService.test.js -v`
Expected: FAIL — module not found.

- [ ] **Step 4: Create the service and re-point the controller**

Create `backend/src/services/transactionService.js` exporting
`createTransactionRecord(payload, { transaction } = {})`. Move the logic
identified in Step 1 verbatim — do not "improve" it while moving; behavior must
be identical. Pass `{ transaction }` through to every `create` call.

Then in `transactionController.js`, replace the moved block inside
`createTransaction` with a call to the service, keeping the existing HTTP
response shape byte-for-byte.

- [ ] **Step 5: Run the service test and the existing controller tests**

Run: `cd backend && npx jest tests/unit/transactionService.test.js src/__tests__/controllers/transactionController.test.js -v`
Expected: all PASS. If any controller test fails, the extraction changed
behavior — fix the service, not the test.

- [ ] **Step 6: Run the whole suite**

Run: `cd backend && npx jest 2>&1 | tail -30`
Expected: no new failures.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/transactionService.js backend/src/controllers/transactionController.js backend/tests/unit/transactionService.test.js
git commit -m "refactor: extract createTransactionRecord into a service"
```

---

## Task 10: `pledgeAllocationService.allocate()`

The over-allocation guard is the point of this task: allocating locks the parent
`transactions` row inside the same DB transaction, so two concurrent allocations
cannot together exceed the payment.

**Files:**
- Create: `backend/src/services/pledgeAllocationService.js`
- Test: `backend/tests/unit/pledgeAllocate.test.js` (create)

**Interfaces:**
- Produces: `allocate({ pledgeId, transactionId, amount, source, allocatedBy, reason, idempotencyKey }, { transaction } = {})` → `Promise<PledgeAllocation>`.
  - Throws `AllocationError` with `.code` ∈ `PLEDGE_NOT_FOUND | TRANSACTION_NOT_FOUND | CAMPAIGN_CLOSED | OVER_ALLOCATED | MEMBER_MISMATCH | CURRENCY_MISMATCH`.
  - On duplicate `idempotencyKey`, returns the **existing** row instead of throwing.
- Also produces: `class AllocationError extends Error { constructor(code, message) }`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeAllocate.test.js`:

```js
const { allocate, AllocationError } = require('../../src/services/pledgeAllocationService');
const { PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');

describe('pledgeAllocationService.allocate', () => {
  let campaign, member, other, pledge, txn;

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
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01', status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
    other = await Member.create({
      first_name: 'Bob', last_name: 'Other', phone_number: '+15550000011',
      email: 'bob@example.com', is_active: true, role: 'member', firebase_uid: 'uid-bob'
    });
    pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver',
      pledge_type: 'fundraising', campaign_id: campaign.id, member_id: member.id
    });
    txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 1000, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
  });

  const args = (over = {}) => ({
    pledgeId: pledge.id, transactionId: txn.id, amount: 1000,
    source: 'treasurer_manual', allocatedBy: member.id, ...over
  });

  it('allocates a payment to a pledge', async () => {
    const a = await allocate(args());
    expect(parseFloat(a.amount)).toBe(1000);
  });

  it('allows splitting one payment across two allocations', async () => {
    await allocate(args({ amount: 400 }));
    const second = await allocate(args({ amount: 600 }));
    expect(parseFloat(second.amount)).toBe(600);
  });

  it('rejects allocating more than the transaction amount', async () => {
    await allocate(args({ amount: 800 }));
    await expect(allocate(args({ amount: 300 }))).rejects.toMatchObject({ code: 'OVER_ALLOCATED' });
  });

  it('rejects allocation into a closed campaign', async () => {
    await campaign.update({ status: 'closed' });
    await expect(allocate(args())).rejects.toMatchObject({ code: 'CAMPAIGN_CLOSED' });
  });

  it('rejects a member mismatch when no reason is supplied', async () => {
    const foreign = await Transaction.create({
      member_id: other.id, collected_by: other.id, payment_date: '2026-02-01',
      amount: 500, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    await expect(
      allocate(args({ transactionId: foreign.id, amount: 500 }))
    ).rejects.toMatchObject({ code: 'MEMBER_MISMATCH' });
  });

  it('allows a member mismatch when a reason is supplied', async () => {
    const foreign = await Transaction.create({
      member_id: other.id, collected_by: other.id, payment_date: '2026-02-01',
      amount: 500, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    const a = await allocate(args({
      transactionId: foreign.id, amount: 500, reason: 'Paid on behalf of Ann'
    }));
    expect(parseFloat(a.amount)).toBe(500);
  });

  it('allows a household match via family_id with no reason', async () => {
    await other.update({ family_id: member.id });
    const spouseTxn = await Transaction.create({
      member_id: other.id, collected_by: other.id, payment_date: '2026-02-01',
      amount: 500, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    const a = await allocate(args({ transactionId: spouseTxn.id, amount: 500 }));
    expect(parseFloat(a.amount)).toBe(500);
  });

  it('returns the existing row for a duplicate idempotency key', async () => {
    const first = await allocate(args({ amount: 500, idempotencyKey: 'auto:pi_1:9' }));
    const second = await allocate(args({ amount: 500, idempotencyKey: 'auto:pi_1:9' }));
    expect(second.id).toBe(first.id);
    expect(await PledgeAllocation.count()).toBe(1);
  });

  it('rejects an unknown pledge', async () => {
    await expect(allocate(args({ pledgeId: 999999 }))).rejects.toMatchObject({ code: 'PLEDGE_NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/unit/pledgeAllocate.test.js -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

Create `backend/src/services/pledgeAllocationService.js`:

```js
'use strict';

const { Op } = require('sequelize');
const {
  sequelize, Pledge, PledgeCampaign, PledgeAllocation, Transaction, Member
} = require('../models');

class AllocationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AllocationError';
    this.code = code;
  }
}

// Does the transaction's payer belong to the same person or household as the
// pledge holder? Household is the existing members.family_id self-FK — the same
// roll-up the dues views use. Anything else needs an explicit treasurer reason.
async function sameMemberOrHousehold(pledge, txn, options) {
  if (pledge.member_id == null || txn.member_id == null) return false;
  if (String(pledge.member_id) === String(txn.member_id)) return true;

  const [pledger, payer] = await Promise.all([
    Member.findByPk(pledge.member_id, options),
    Member.findByPk(txn.member_id, options)
  ]);
  if (!pledger || !payer) return false;

  const pledgerHousehold = String(pledger.family_id || pledger.id);
  const payerHousehold = String(payer.family_id || payer.id);
  return pledgerHousehold === payerHousehold;
}

async function allocate(
  { pledgeId, transactionId, amount, source, allocatedBy = null, reason = null, idempotencyKey = null },
  { transaction: outer } = {}
) {
  const run = async (t) => {
    const options = { transaction: t };

    if (idempotencyKey) {
      const existing = await PledgeAllocation.findOne({
        where: { idempotency_key: idempotencyKey }, ...options
      });
      if (existing) return existing;
    }

    const pledge = await Pledge.findByPk(pledgeId, options);
    if (!pledge) throw new AllocationError('PLEDGE_NOT_FOUND', 'Pledge not found');

    const campaign = await PledgeCampaign.findByPk(pledge.campaign_id, options);
    if (!campaign || campaign.status === 'closed') {
      throw new AllocationError('CAMPAIGN_CLOSED',
        'This campaign is closed and cannot accept new allocations');
    }

    // Lock the payment row. This is what makes the over-allocation check correct
    // under concurrency — two simultaneous allocations serialise here.
    const txn = await Transaction.findByPk(transactionId, { ...options, lock: t.LOCK.UPDATE });
    if (!txn) throw new AllocationError('TRANSACTION_NOT_FOUND', 'Transaction not found');

    if (!reason && !(await sameMemberOrHousehold(pledge, txn, options))) {
      throw new AllocationError('MEMBER_MISMATCH',
        'Payment belongs to a different member; supply a reason to allocate it anyway');
    }

    const allocatedSoFar = await PledgeAllocation.sum('amount', {
      where: { transaction_id: transactionId }, ...options
    }) || 0;

    const requested = parseFloat(amount);
    if (parseFloat(allocatedSoFar) + requested > parseFloat(txn.amount) + 1e-9) {
      throw new AllocationError('OVER_ALLOCATED',
        `Only ${(parseFloat(txn.amount) - parseFloat(allocatedSoFar)).toFixed(2)} of this payment is unallocated`);
    }

    return PledgeAllocation.create({
      pledge_id: pledgeId,
      transaction_id: transactionId,
      amount: requested,
      source,
      allocated_by: allocatedBy,
      reason,
      idempotency_key: idempotencyKey
    }, options);
  };

  if (outer) return run(outer);
  return sequelize.transaction(run);
}

module.exports = { allocate, AllocationError };
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/unit/pledgeAllocate.test.js -v`
Expected: all 9 PASS.

SQLite ignores `lock: t.LOCK.UPDATE`, so the concurrency guarantee is exercised
only in production. The arithmetic guard is what the test verifies.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/pledgeAllocationService.js backend/tests/unit/pledgeAllocate.test.js
git commit -m "feat: add pledge allocation service with over-allocation guard"
```

---

## Task 11: `pledgeAllocationService.reverse()`

**Files:**
- Modify: `backend/src/services/pledgeAllocationService.js`
- Test: `backend/tests/unit/pledgeReverse.test.js` (create)

**Interfaces:**
- Produces: `reverse({ allocationId, reason, reversedBy, amount, idempotencyKey }, { transaction } = {})` → `Promise<PledgeAllocation>` (the reversing row).
  - `amount` optional; defaults to the full original amount. Partial reversal allowed.
  - Adds error codes `ALLOCATION_NOT_FOUND | REASON_REQUIRED | ALREADY_REVERSED | REVERSAL_TOO_LARGE`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeReverse.test.js`:

```js
const { allocate, reverse } = require('../../src/services/pledgeAllocationService');
const { PledgeAllocation, PledgeBalance, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');

describe('pledgeAllocationService.reverse', () => {
  let campaign, member, pledge, txn, original;

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
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01', status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
    pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver',
      pledge_type: 'fundraising', campaign_id: campaign.id, member_id: member.id
    });
    txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 1000, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    original = await allocate({
      pledgeId: pledge.id, transactionId: txn.id, amount: 1000,
      source: 'treasurer_manual', allocatedBy: member.id
    });
  });

  it('creates a negative reversing row linked to the original', async () => {
    const r = await reverse({
      allocationId: original.id, reason: 'Applied to the wrong pledge', reversedBy: member.id
    });
    expect(parseFloat(r.amount)).toBe(-1000);
    expect(String(r.reverses_allocation_id)).toBe(String(original.id));
    expect(r.reason).toBe('Applied to the wrong pledge');
  });

  it('zeroes the pledge balance after a full reversal', async () => {
    await reverse({ allocationId: original.id, reason: 'Mistake', reversedBy: member.id });
    const b = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(b.paid_amount)).toBe(0);
    expect(b.derived_status).toBe('not_started');
  });

  it('supports a partial reversal', async () => {
    await reverse({ allocationId: original.id, amount: 400, reason: 'Partial refund', reversedBy: member.id });
    const b = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(b.paid_amount)).toBe(600);
  });

  it('requires a reason', async () => {
    await expect(
      reverse({ allocationId: original.id, reversedBy: member.id })
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  it('refuses to reverse the same allocation twice', async () => {
    await reverse({ allocationId: original.id, reason: 'First', reversedBy: member.id });
    await expect(
      reverse({ allocationId: original.id, reason: 'Second', reversedBy: member.id })
    ).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
  });

  it('refuses a reversal larger than the original', async () => {
    await expect(
      reverse({ allocationId: original.id, amount: 1500, reason: 'Too big', reversedBy: member.id })
    ).rejects.toMatchObject({ code: 'REVERSAL_TOO_LARGE' });
  });

  it('leaves the original row untouched', async () => {
    await reverse({ allocationId: original.id, reason: 'Mistake', reversedBy: member.id });
    const untouched = await PledgeAllocation.findByPk(original.id);
    expect(parseFloat(untouched.amount)).toBe(1000);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/unit/pledgeReverse.test.js -v`
Expected: FAIL — `reverse is not a function`.

- [ ] **Step 3: Implement `reverse`**

Add to `backend/src/services/pledgeAllocationService.js`:

```js
async function reverse(
  { allocationId, reason, reversedBy = null, amount = null, idempotencyKey = null },
  { transaction: outer } = {}
) {
  const run = async (t) => {
    const options = { transaction: t };

    if (idempotencyKey) {
      const existing = await PledgeAllocation.findOne({
        where: { idempotency_key: idempotencyKey }, ...options
      });
      if (existing) return existing;
    }

    if (!reason || !String(reason).trim()) {
      throw new AllocationError('REASON_REQUIRED',
        'A reason is required when reversing an allocation');
    }

    const original = await PledgeAllocation.findByPk(allocationId, options);
    if (!original) throw new AllocationError('ALLOCATION_NOT_FOUND', 'Allocation not found');

    const alreadyReversed = await PledgeAllocation.sum('amount', {
      where: { reverses_allocation_id: allocationId }, ...options
    }) || 0;

    const originalAmount = parseFloat(original.amount);
    const outstanding = originalAmount + parseFloat(alreadyReversed); // reversals are negative
    if (outstanding <= 1e-9) {
      throw new AllocationError('ALREADY_REVERSED', 'This allocation has already been reversed');
    }

    const requested = amount == null ? outstanding : parseFloat(amount);
    if (requested > outstanding + 1e-9) {
      throw new AllocationError('REVERSAL_TOO_LARGE',
        `At most ${outstanding.toFixed(2)} of this allocation can be reversed`);
    }

    // Append a reversing row. The original is never modified — that is the
    // entire audit mechanism.
    return PledgeAllocation.create({
      pledge_id: original.pledge_id,
      transaction_id: original.transaction_id,
      amount: -Math.abs(requested),
      source: original.source === 'stripe_refund' ? 'stripe_refund' : 'treasurer_manual',
      allocated_by: reversedBy,
      reason,
      reverses_allocation_id: original.id,
      idempotency_key: idempotencyKey
    }, options);
  };

  if (outer) return run(outer);
  return sequelize.transaction(run);
}
```

Export it: `module.exports = { allocate, reverse, AllocationError };`

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/unit/pledgeReverse.test.js -v`
Expected: all 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/pledgeAllocationService.js backend/tests/unit/pledgeReverse.test.js
git commit -m "feat: reverse allocations by appending a negative row"
```

---

## Task 12: `requireOpenCampaign` middleware

This is the guard that makes 2025 read-only at the API layer.

**Files:**
- Create: `backend/src/middleware/requireOpenCampaign.js`
- Test: `backend/tests/unit/requireOpenCampaign.test.js` (create)

**Interfaces:**
- Produces: `requireOpenCampaign(resolver)` → Express middleware. `resolver(req)` returns a campaign id or `null`. Responds `409 { success: false, code: 'CAMPAIGN_CLOSED', message }` when the campaign is closed.
- Also exports ready-made resolvers: `fromBody`, `fromPledgeParam`, `fromAllocationParam`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/requireOpenCampaign.test.js`:

```js
const express = require('express');
const request = require('supertest');
const requireOpenCampaign = require('../../src/middleware/requireOpenCampaign');
const { Pledge, PledgeCampaign, sequelize } = require('../../src/models');

describe('requireOpenCampaign', () => {
  let openCampaign, closedCampaign, openPledge, closedPledge, app;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();

    app = express();
    app.use(express.json());
    app.post('/body', requireOpenCampaign(requireOpenCampaign.fromBody),
      (req, res) => res.json({ ok: true }));
    app.post('/pledge/:id', requireOpenCampaign(requireOpenCampaign.fromPledgeParam),
      (req, res) => res.json({ ok: true }));
  });

  beforeEach(async () => {
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    openCampaign = await PledgeCampaign.create({
      slug: 'open', name: 'Open', start_date: '2026-01-01', status: 'active'
    });
    closedCampaign = await PledgeCampaign.create({
      slug: 'closed', name: 'Closed', start_date: '2025-09-13', status: 'closed'
    });
    const base = { amount: 100, first_name: 'A', last_name: 'B', pledge_type: 'fundraising' };
    openPledge = await Pledge.create({ ...base, campaign_id: openCampaign.id });
    closedPledge = await Pledge.create({ ...base, campaign_id: closedCampaign.id, is_historical: true });
  });

  it('allows a write to an open campaign via body', async () => {
    const res = await request(app).post('/body').send({ campaign_id: openCampaign.id });
    expect(res.status).toBe(200);
  });

  it('blocks a write to a closed campaign via body', async () => {
    const res = await request(app).post('/body').send({ campaign_id: closedCampaign.id });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CAMPAIGN_CLOSED');
  });

  it('allows a write to a pledge in an open campaign', async () => {
    const res = await request(app).post(`/pledge/${openPledge.id}`).send({});
    expect(res.status).toBe(200);
  });

  it('blocks a write to a 2025 pledge', async () => {
    const res = await request(app).post(`/pledge/${closedPledge.id}`).send({});
    expect(res.status).toBe(409);
  });

  it('passes through when no campaign can be resolved', async () => {
    const res = await request(app).post('/body').send({});
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/unit/requireOpenCampaign.test.js -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the middleware**

Create `backend/src/middleware/requireOpenCampaign.js`:

```js
'use strict';

const { Pledge, PledgeCampaign, PledgeAllocation } = require('../models');

// The 2025 drive is preserved read-only. Every pledge/allocation write route
// passes through here. The append-only trigger on pledge_allocations is the
// second layer — this one produces the friendly error.
const requireOpenCampaign = (resolveCampaignId) => async (req, res, next) => {
  try {
    const campaignId = await resolveCampaignId(req);
    if (campaignId == null) return next();

    const campaign = await PledgeCampaign.findByPk(campaignId);
    if (!campaign) return next();

    if (campaign.status === 'closed') {
      return res.status(409).json({
        success: false,
        code: 'CAMPAIGN_CLOSED',
        message: `${campaign.name} is closed and preserved as read-only history.`
      });
    }

    req.campaign = campaign;
    return next();
  } catch (err) {
    return next(err);
  }
};

requireOpenCampaign.fromBody = (req) => req.body?.campaign_id ?? null;

requireOpenCampaign.fromPledgeParam = async (req) => {
  const id = req.params.id ?? req.params.pledgeId;
  if (!id) return null;
  const pledge = await Pledge.findByPk(id, { attributes: ['id', 'campaign_id'] });
  return pledge ? pledge.campaign_id : null;
};

requireOpenCampaign.fromAllocationParam = async (req) => {
  const id = req.params.id ?? req.params.allocationId;
  if (!id) return null;
  const allocation = await PledgeAllocation.findByPk(id, { attributes: ['id', 'pledge_id'] });
  if (!allocation) return null;
  const pledge = await Pledge.findByPk(allocation.pledge_id, { attributes: ['id', 'campaign_id'] });
  return pledge ? pledge.campaign_id : null;
};

module.exports = requireOpenCampaign;
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/unit/requireOpenCampaign.test.js -v`
Expected: all 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/requireOpenCampaign.js backend/tests/unit/requireOpenCampaign.test.js
git commit -m "feat: block writes to closed pledge campaigns"
```

---

## Task 13: Allocation endpoints

**Files:**
- Create: `backend/src/controllers/pledgeAllocationController.js`
- Create: `backend/src/routes/pledgeAllocationRoutes.js`
- Modify: `backend/src/routes/pledgeRoutes.js`, `backend/src/server.js`
- Test: `backend/tests/integration/pledgeAllocations.test.js` (create)

**Interfaces:**
- Consumes: `allocate`, `reverse`, `AllocationError` (Tasks 10–11); `createTransactionRecord` (Task 9); `requireOpenCampaign` (Task 12).
- Produces:
  - `POST /api/pledges/:id/allocations` body `{ transaction_id, amount, reason? }` → 201 `{ success, allocation }`
  - `POST /api/pledges/:id/payments` body `{ amount, payment_date, payment_method, receipt_number?, note? }` → 201 `{ success, transaction, allocation }`
  - `GET /api/pledges/:id/allocations` → 200 `{ success, allocations }`
  - `POST /api/pledge-allocations/:id/reverse` body `{ reason, amount? }` → 201 `{ success, reversal }`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/pledgeAllocations.test.js`:

```js
const request = require('supertest');
const app = require('../../src/server');
const { PledgeAllocation, PledgeBalance, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const setVerifyTokenPayload = (payload) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue(payload) }));
};
const asTreasurer = () => setVerifyTokenPayload({ uid: 'uid-treasurer', email: 'tess@example.com' });
const asMember = () => setVerifyTokenPayload({ uid: 'uid-ann', email: 'ann@example.com' });

describe('Pledge allocation endpoints', () => {
  let campaign, closed, treasurer, member, pledge, oldPledge, txn;

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
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01', status: 'active'
    });
    closed = await PledgeCampaign.create({
      slug: '2025-pledge-drive', name: '2025', start_date: '2025-09-13', status: 'closed'
    });
    treasurer = await Member.create({
      first_name: 'Tess', last_name: 'Treasurer', phone_number: '+15550000002',
      email: 'tess@example.com', is_active: true, role: 'treasurer', firebase_uid: 'uid-treasurer'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
    const base = { amount: 5000, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising' };
    pledge = await Pledge.create({ ...base, campaign_id: campaign.id, member_id: member.id });
    oldPledge = await Pledge.create({ ...base, campaign_id: closed.id, member_id: member.id, is_historical: true });
    txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 1000, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
  });

  it('lets a treasurer allocate a payment', async () => {
    asTreasurer();
    const res = await request(app)
      .post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t')
      .send({ transaction_id: txn.id, amount: 1000 });
    expect(res.status).toBe(201);

    const b = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(b.paid_amount)).toBe(1000);
    expect(b.derived_status).toBe('partially_fulfilled');
  });

  it('rejects a plain member allocating', async () => {
    asMember();
    const res = await request(app)
      .post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t')
      .send({ transaction_id: txn.id, amount: 1000 });
    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated allocation', async () => {
    const res = await request(app)
      .post(`/api/pledges/${pledge.id}/allocations`)
      .send({ transaction_id: txn.id, amount: 1000 });
    expect(res.status).toBe(401);
  });

  it('blocks allocation against the closed 2025 campaign', async () => {
    asTreasurer();
    const res = await request(app)
      .post(`/api/pledges/${oldPledge.id}/allocations`)
      .set('Authorization', 'Bearer t')
      .send({ transaction_id: txn.id, amount: 500 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CAMPAIGN_CLOSED');
  });

  it('blocks editing a 2025 pledge', async () => {
    asTreasurer();
    const res = await request(app)
      .put(`/api/pledges/${oldPledge.id}`)
      .set('Authorization', 'Bearer t')
      .send({ notes: 'should not be editable' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CAMPAIGN_CLOSED');
  });

  it('returns 422 when over-allocating', async () => {
    asTreasurer();
    await request(app).post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t').send({ transaction_id: txn.id, amount: 800 });
    const res = await request(app).post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t').send({ transaction_id: txn.id, amount: 300 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('OVER_ALLOCATED');
  });

  it('records an offline payment and allocates it atomically', async () => {
    asTreasurer();
    const res = await request(app)
      .post(`/api/pledges/${pledge.id}/payments`)
      .set('Authorization', 'Bearer t')
      .send({ amount: 750, payment_date: '2026-03-01', payment_method: 'check', receipt_number: 'CHK-1001' });
    expect(res.status).toBe(201);

    const b = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(b.paid_amount)).toBe(750);
  });

  it('creates no transaction when the offline payment fails validation', async () => {
    asTreasurer();
    // cash with no receipt number must fail
    const res = await request(app)
      .post(`/api/pledges/${pledge.id}/payments`)
      .set('Authorization', 'Bearer t')
      .send({ amount: 750, payment_date: '2026-03-01', payment_method: 'cash' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await Transaction.count({ where: { payment_method: 'cash' } })).toBe(0);
  });

  it('reverses an allocation through the API', async () => {
    asTreasurer();
    const created = await request(app).post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t').send({ transaction_id: txn.id, amount: 1000 });

    const res = await request(app)
      .post(`/api/pledge-allocations/${created.body.allocation.id}/reverse`)
      .set('Authorization', 'Bearer t')
      .send({ reason: 'Applied to the wrong pledge' });
    expect(res.status).toBe(201);

    const b = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(b.paid_amount)).toBe(0);
  });

  it('refuses a reversal with no reason', async () => {
    asTreasurer();
    const created = await request(app).post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t').send({ transaction_id: txn.id, amount: 1000 });
    const res = await request(app)
      .post(`/api/pledge-allocations/${created.body.allocation.id}/reverse`)
      .set('Authorization', 'Bearer t').send({});
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('REASON_REQUIRED');
  });

  it('returns the audit trail for a pledge', async () => {
    asTreasurer();
    await request(app).post(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t').send({ transaction_id: txn.id, amount: 1000 });
    const res = await request(app).get(`/api/pledges/${pledge.id}/allocations`)
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.allocations).toHaveLength(1);
    expect(res.body.allocations[0].allocated_by).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/integration/pledgeAllocations.test.js -v`
Expected: all FAIL with 404 — the routes do not exist.

- [ ] **Step 3: Write the controller**

Create `backend/src/controllers/pledgeAllocationController.js`. Map
`AllocationError.code` to HTTP status:

```js
'use strict';

const { sequelize, PledgeAllocation, Pledge, Member, Transaction } = require('../models');
const { allocate, reverse, AllocationError } = require('../services/pledgeAllocationService');
const { createTransactionRecord } = require('../services/transactionService');

const STATUS_BY_CODE = {
  PLEDGE_NOT_FOUND: 404,
  TRANSACTION_NOT_FOUND: 404,
  ALLOCATION_NOT_FOUND: 404,
  CAMPAIGN_NOT_FOUND: 404,
  CAMPAIGN_CLOSED: 409,
  OVER_ALLOCATED: 422,
  MEMBER_MISMATCH: 422,
  REASON_REQUIRED: 422,
  ALREADY_REVERSED: 422,
  REVERSAL_TOO_LARGE: 422,
  CURRENCY_MISMATCH: 422
};

const sendError = (res, err) => {
  if (err instanceof AllocationError) {
    return res.status(STATUS_BY_CODE[err.code] || 400)
      .json({ success: false, code: err.code, message: err.message });
  }
  console.error('Pledge allocation error:', err);
  return res.status(500).json({ success: false, message: 'Allocation failed' });
};

const createAllocation = async (req, res) => {
  try {
    const allocation = await allocate({
      pledgeId: req.params.id,
      transactionId: req.body.transaction_id,
      amount: req.body.amount,
      source: 'treasurer_manual',
      allocatedBy: req.user.id,
      reason: req.body.reason || null
    });
    return res.status(201).json({ success: true, allocation });
  } catch (err) { return sendError(res, err); }
};

// Offline cash/check: the transaction and its allocation are created inside one
// DB transaction, so a payment can never exist with a failed allocation.
const createPledgePayment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const pledge = await Pledge.findByPk(req.params.id, { transaction: t });
    if (!pledge) throw new AllocationError('PLEDGE_NOT_FOUND', 'Pledge not found');

    const txn = await createTransactionRecord({
      member_id: pledge.member_id,
      collected_by: req.user.id,
      payment_date: req.body.payment_date,
      amount: req.body.amount,
      payment_type: req.campaign?.default_payment_type || 'pledge_drive',
      payment_method: req.body.payment_method,
      receipt_number: req.body.receipt_number || null,
      note: req.body.note || null
    }, { transaction: t });

    const allocation = await allocate({
      pledgeId: pledge.id,
      transactionId: txn.id,
      amount: req.body.amount,
      source: 'treasurer_manual',
      allocatedBy: req.user.id,
      reason: req.body.reason || null
    }, { transaction: t });

    await t.commit();
    return res.status(201).json({ success: true, transaction: txn, allocation });
  } catch (err) {
    await t.rollback();
    return sendError(res, err);
  }
};

const reverseAllocation = async (req, res) => {
  try {
    const reversal = await reverse({
      allocationId: req.params.id,
      reason: req.body.reason,
      amount: req.body.amount ?? null,
      reversedBy: req.user.id
    });
    return res.status(201).json({ success: true, reversal });
  } catch (err) { return sendError(res, err); }
};

const listAllocations = async (req, res) => {
  try {
    const allocations = await PledgeAllocation.findAll({
      where: { pledge_id: req.params.id },
      order: [['created_at', 'ASC']],
      include: [
        { model: Member, as: 'allocator', attributes: ['id', 'first_name', 'last_name'] },
        { model: Transaction, as: 'transaction',
          attributes: ['id', 'amount', 'payment_date', 'payment_method', 'status', 'receipt_number'] }
      ]
    });
    return res.status(200).json({ success: true, allocations });
  } catch (err) { return sendError(res, err); }
};

module.exports = { createAllocation, createPledgePayment, reverseAllocation, listAllocations };
```

- [ ] **Step 4: Wire the routes**

In `backend/src/routes/pledgeRoutes.js`, add after the existing routes:

```js
const requireOpenCampaign = require('../middleware/requireOpenCampaign');
const allocationController = require('../controllers/pledgeAllocationController');

router.get('/:id/allocations', firebaseAuthMiddleware, roleMiddleware(viewRoles),
  allocationController.listAllocations);

router.post('/:id/allocations', firebaseAuthMiddleware, roleMiddleware(editRoles),
  requireOpenCampaign(requireOpenCampaign.fromPledgeParam), allocationController.createAllocation);

router.post('/:id/payments', firebaseAuthMiddleware, roleMiddleware(editRoles),
  requireOpenCampaign(requireOpenCampaign.fromPledgeParam), allocationController.createPledgePayment);
```

**Also add the guard to the pledge update route from Task 1.** Without this the
read-only guarantee has a hole: a treasurer could still edit a 2025 pledge's
amount or notes. Replace the `router.put('/:id', …)` line with:

```js
router.put('/:id', firebaseAuthMiddleware, roleMiddleware(editRoles),
  requireOpenCampaign(requireOpenCampaign.fromPledgeParam), pledgeController.updatePledge);
```

Create `backend/src/routes/pledgeAllocationRoutes.js`:

```js
const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const requireOpenCampaign = require('../middleware/requireOpenCampaign');
const allocationController = require('../controllers/pledgeAllocationController');

const editRoles = ['admin', 'treasurer', 'bookkeeper', 'ar_team'];

router.use(firebaseAuthMiddleware);

router.post('/:id/reverse', roleMiddleware(editRoles),
  requireOpenCampaign(requireOpenCampaign.fromAllocationParam),
  allocationController.reverseAllocation);

module.exports = router;
```

In `backend/src/server.js`, next to the other route mounts (~line 274):

```js
app.use('/api/pledge-allocations', require('./routes/pledgeAllocationRoutes'));
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/integration/pledgeAllocations.test.js -v`
Expected: all 11 PASS.

- [ ] **Step 6: Run the whole suite**

Run: `cd backend && npx jest 2>&1 | tail -30`
Expected: no new failures.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/pledgeAllocationController.js backend/src/routes/pledgeAllocationRoutes.js backend/src/routes/pledgeRoutes.js backend/src/server.js backend/tests/integration/pledgeAllocations.test.js
git commit -m "feat: add pledge allocation, offline payment, and reversal endpoints"
```

---

## Task 14: Unallocated payments queue

Scenario 4 from the spec: a payment arrives with no pledge selected. It stays
unallocated on purpose, and the treasurer decides where it goes.

**Files:**
- Modify: `backend/src/services/pledgeAllocationService.js`, `backend/src/controllers/pledgeAllocationController.js`, `backend/src/routes/pledgeAllocationRoutes.js`
- Test: `backend/tests/integration/unallocatedPayments.test.js` (create)

**Interfaces:**
- Produces: `listUnallocated({ campaignId, paymentType, limit })` → array of `{ transaction, allocated, unallocated, suggestedPledgeId }`.
- Endpoint: `GET /api/pledge-allocations/unallocated?campaign_id=&payment_type=&limit=` → 200 `{ success, items }`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/unallocatedPayments.test.js`:

```js
const request = require('supertest');
const app = require('../../src/server');
const { PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const asTreasurer = () => {
  admin.auth = jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'uid-treasurer', email: 'tess@example.com' })
  }));
};

describe('GET /api/pledge-allocations/unallocated', () => {
  let campaign, member, pledge;

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
      end_date: '2026-12-31', status: 'active', default_payment_type: 'pledge_drive'
    });
    await Member.create({
      first_name: 'Tess', last_name: 'Treasurer', phone_number: '+15550000002',
      email: 'tess@example.com', is_active: true, role: 'treasurer', firebase_uid: 'uid-treasurer'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
    pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
      campaign_id: campaign.id, member_id: member.id
    });
  });

  const payment = (over = {}) => Transaction.create({
    member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
    amount: 1000, payment_type: 'pledge_drive', payment_method: 'zelle',
    status: 'succeeded', ...over
  });

  it('lists a fully unallocated payment and suggests the member pledge', async () => {
    const txn = await payment();
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(String(res.body.items[0].transaction.id)).toBe(String(txn.id));
    expect(parseFloat(res.body.items[0].unallocated)).toBe(1000);
    expect(String(res.body.items[0].suggestedPledgeId)).toBe(String(pledge.id));
  });

  it('lists the remainder of a partially allocated payment', async () => {
    const txn = await payment();
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 400,
      source: 'treasurer_manual', allocated_by: member.id
    });
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(parseFloat(res.body.items[0].unallocated)).toBe(600);
  });

  it('omits a fully allocated payment', async () => {
    const txn = await payment();
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000,
      source: 'treasurer_manual', allocated_by: member.id
    });
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.body.items).toHaveLength(0);
  });

  it('omits failed payments', async () => {
    await payment({ status: 'failed' });
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.body.items).toHaveLength(0);
  });

  it('defaults to the campaign payment type and does not nag about dues', async () => {
    await payment({ payment_type: 'membership_due' });
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.body.items).toHaveLength(0);
  });

  it('shows other types when payment_type=all', async () => {
    await payment({ payment_type: 'membership_due' });
    asTreasurer();
    const res = await request(app)
      .get(`/api/pledge-allocations/unallocated?campaign_id=${campaign.id}&payment_type=all`)
      .set('Authorization', 'Bearer t');
    expect(res.body.items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/integration/unallocatedPayments.test.js -v`
Expected: FAIL with 404.

- [ ] **Step 3: Implement `listUnallocated`**

Add to `pledgeAllocationService.js`:

```js
// Payments that arrived with no pledge attached (spec scenario 4). This is a
// queue, not an error state — the treasurer decides, the system never guesses.
async function listUnallocated({ campaignId, paymentType = null, limit = 100 }) {
  const campaign = await PledgeCampaign.findByPk(campaignId);
  if (!campaign) throw new AllocationError('CAMPAIGN_NOT_FOUND', 'Campaign not found');

  const where = { status: 'succeeded' };

  if (campaign.start_date) {
    where.payment_date = { [Op.gte]: campaign.start_date };
    if (campaign.end_date) {
      where.payment_date = { [Op.between]: [campaign.start_date, campaign.end_date] };
    }
  }

  // Default to the campaign's own type so the queue does not nag about dues.
  if (paymentType !== 'all') {
    where.payment_type = paymentType || campaign.default_payment_type || 'pledge_drive';
  }

  const candidates = await Transaction.findAll({
    where, order: [['payment_date', 'DESC']], limit: parseInt(limit, 10)
  });

  const items = [];
  for (const txn of candidates) {
    const allocated = parseFloat(await PledgeAllocation.sum('amount', {
      where: { transaction_id: txn.id }
    }) || 0);
    const unallocated = parseFloat(txn.amount) - allocated;
    if (unallocated <= 1e-9) continue;

    // Deterministic because of the one-active-pledge-per-member-per-campaign
    // index — a suggestion, never applied without a click.
    let suggestedPledgeId = null;
    if (txn.member_id) {
      const suggestion = await Pledge.findOne({
        where: {
          campaign_id: campaignId, member_id: txn.member_id,
          lifecycle: 'active', is_historical: false
        },
        attributes: ['id']
      });
      suggestedPledgeId = suggestion ? suggestion.id : null;
    }

    items.push({ transaction: txn, allocated, unallocated, suggestedPledgeId });
  }

  return items;
}
```

Add `PledgeCampaign` and `Op` to the module's requires if not already present,
and export `listUnallocated`.

Add the controller handler and the route:

```js
// pledgeAllocationController.js
const listUnallocatedPayments = async (req, res) => {
  try {
    const items = await listUnallocated({
      campaignId: req.query.campaign_id,
      paymentType: req.query.payment_type || null,
      limit: req.query.limit || 100
    });
    return res.status(200).json({ success: true, items });
  } catch (err) { return sendError(res, err); }
};
```

```js
// pledgeAllocationRoutes.js — BEFORE the /:id/reverse route so 'unallocated'
// is not captured as an :id parameter.
const viewRoles = ['admin', 'treasurer', 'church_leadership', 'secretary',
  'bookkeeper', 'auditor', 'budget_committee', 'ar_team', 'ap_team'];

router.get('/unallocated', roleMiddleware(viewRoles), allocationController.listUnallocatedPayments);
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/integration/unallocatedPayments.test.js -v`
Expected: all 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/pledgeAllocationService.js backend/src/controllers/pledgeAllocationController.js backend/src/routes/pledgeAllocationRoutes.js backend/tests/integration/unallocatedPayments.test.js
git commit -m "feat: add unallocated payments queue for treasurers"
```

---

## Task 15: Campaign endpoints

**Files:**
- Create: `backend/src/controllers/pledgeCampaignController.js`, `backend/src/routes/pledgeCampaignRoutes.js`
- Modify: `backend/src/server.js`
- Test: `backend/tests/integration/pledgeCampaigns.test.js` (create)

**Interfaces:**
- Produces:
  - `GET /api/pledge-campaigns/active` — **public**, returns `{ success, campaigns }` with only `id, slug, name, name_ti, description, description_ti, start_date, end_date, goal_amount, currency`. **No totals, no donor data.**
  - `GET /api/pledge-campaigns` — viewRoles, includes totals
  - `GET /api/pledge-campaigns/:id/totals` — viewRoles
  - `POST /api/pledge-campaigns` — admin
  - `PATCH /api/pledge-campaigns/:id` — admin; logs status changes to `activity_logs`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/pledgeCampaigns.test.js`:

```js
const request = require('supertest');
const app = require('../../src/server');
const { PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const as = (uid, email) => {
  admin.auth = jest.fn(() => ({ verifyIdToken: jest.fn().mockResolvedValue({ uid, email }) }));
};

describe('Pledge campaign endpoints', () => {
  let active, member;

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

    active = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026 Pledge Drive', start_date: '2026-01-01',
      end_date: '2026-12-31', status: 'active', goal_amount: 10000
    });
    await PledgeCampaign.create({
      slug: '2025-pledge-drive', name: '2025 Pledge Drive',
      start_date: '2025-09-13', status: 'draft'
    });
    await Member.create({
      first_name: 'Adam', last_name: 'Admin', phone_number: '+15550000003',
      email: 'adam@example.com', is_active: true, role: 'admin', firebase_uid: 'uid-admin'
    });
    await Member.create({
      first_name: 'Tess', last_name: 'Treasurer', phone_number: '+15550000002',
      email: 'tess@example.com', is_active: true, role: 'treasurer', firebase_uid: 'uid-treasurer'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  it('exposes active campaigns publicly without financial detail', async () => {
    const res = await request(app).get('/api/pledge-campaigns/active');
    expect(res.status).toBe(200);
    expect(res.body.campaigns).toHaveLength(1);
    expect(res.body.campaigns[0].slug).toBe('2026-pledge-drive');
    expect(res.body.campaigns[0].total_collected).toBeUndefined();
  });

  it('rejects an unauthenticated full campaign listing', async () => {
    const res = await request(app).get('/api/pledge-campaigns');
    expect(res.status).toBe(401);
  });

  it('returns campaign totals derived from allocations', async () => {
    const pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
      campaign_id: active.id, member_id: member.id
    });
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 2000, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 2000,
      source: 'treasurer_manual', allocated_by: member.id
    });

    as('uid-treasurer', 'tess@example.com');
    const res = await request(app)
      .get(`/api/pledge-campaigns/${active.id}/totals`)
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(parseFloat(res.body.totals.total_pledged)).toBe(5000);
    expect(parseFloat(res.body.totals.total_collected)).toBe(2000);
    expect(parseFloat(res.body.totals.outstanding)).toBe(3000);
  });

  it('lets an admin close a campaign', async () => {
    as('uid-admin', 'adam@example.com');
    const res = await request(app)
      .patch(`/api/pledge-campaigns/${active.id}`)
      .set('Authorization', 'Bearer t')
      .send({ status: 'closed' });
    expect(res.status).toBe(200);
    await active.reload();
    expect(active.status).toBe('closed');
  });

  it('refuses to let a treasurer close a campaign', async () => {
    as('uid-treasurer', 'tess@example.com');
    const res = await request(app)
      .patch(`/api/pledge-campaigns/${active.id}`)
      .set('Authorization', 'Bearer t')
      .send({ status: 'closed' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid status', async () => {
    as('uid-admin', 'adam@example.com');
    const res = await request(app)
      .patch(`/api/pledge-campaigns/${active.id}`)
      .set('Authorization', 'Bearer t')
      .send({ status: 'archived' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/integration/pledgeCampaigns.test.js -v`
Expected: all FAIL with 404.

- [ ] **Step 3: Implement controller and routes**

Create `backend/src/controllers/pledgeCampaignController.js` with
`listActive`, `listAll`, `getTotals`, `create`, `update`.

`listActive` must select only the public column set listed in the Interfaces
block above — it is unauthenticated, so it must never join `campaign_totals` or
return donor data.

`update` validates `status` against `PledgeCampaign.STATUSES` (400 on anything
else) and writes an `ActivityLog` row on every status change:

```js
    if (req.body.status && req.body.status !== campaign.status) {
      await ActivityLog.create({
        user_id: req.user.id,
        action: 'UPDATE',
        entity_type: 'PledgeCampaign',
        entity_id: String(campaign.id),
        details: { from: campaign.status, to: req.body.status },
        ip_address: req.ip
      });
    }
```

Create `backend/src/routes/pledgeCampaignRoutes.js`. **`/active` must be
registered before `router.use(firebaseAuthMiddleware)`** so it stays public:

```js
const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const c = require('../controllers/pledgeCampaignController');

const viewRoles = ['admin', 'treasurer', 'church_leadership', 'secretary',
  'bookkeeper', 'auditor', 'budget_committee', 'ar_team', 'ap_team'];
const adminRoles = ['admin'];

// PUBLIC — powers the visitor pledge form. Aggregates and donor data excluded.
router.get('/active', c.listActive);

router.use(firebaseAuthMiddleware);
router.get('/', roleMiddleware(viewRoles), c.listAll);
router.get('/:id/totals', roleMiddleware(viewRoles), c.getTotals);
router.post('/', roleMiddleware(adminRoles), c.create);
router.patch('/:id', roleMiddleware(adminRoles), c.update);

module.exports = router;
```

Mount in `server.js`:

```js
app.use('/api/pledge-campaigns', require('./routes/pledgeCampaignRoutes'));
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/integration/pledgeCampaigns.test.js -v`
Expected: all 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/pledgeCampaignController.js backend/src/routes/pledgeCampaignRoutes.js backend/src/server.js backend/tests/integration/pledgeCampaigns.test.js
git commit -m "feat: add pledge campaign endpoints with derived totals"
```

---

## Task 16: Protect allocated transactions from deletion

`ON DELETE RESTRICT` already blocks this at the database, but the admin delete
endpoint would surface it as a 500. Turn it into an explanation.

**Files:**
- Modify: `backend/src/controllers/transactionController.js:720-783` (`deleteTransaction`)
- Test: `backend/tests/integration/transactionDeleteGuard.test.js` (create)

**Interfaces:**
- Produces: `DELETE /api/transactions/:id` → 409 `{ success: false, code: 'TRANSACTION_ALLOCATED', message }` when allocations reference it.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/transactionDeleteGuard.test.js`:

```js
const request = require('supertest');
const app = require('../../src/server');
const { PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const asAdmin = () => {
  admin.auth = jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'uid-admin', email: 'adam@example.com' })
  }));
};

describe('DELETE /api/transactions/:id with allocations', () => {
  let member, txn, pledge;

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

    const campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01', status: 'active'
    });
    await Member.create({
      first_name: 'Adam', last_name: 'Admin', phone_number: '+15550000003',
      email: 'adam@example.com', is_active: true, role: 'admin', firebase_uid: 'uid-admin'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
    pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
      campaign_id: campaign.id, member_id: member.id
    });
    txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 1000, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
  });

  it('refuses to delete an allocated transaction and explains why', async () => {
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000,
      source: 'treasurer_manual', allocated_by: member.id
    });
    asAdmin();
    const res = await request(app).delete(`/api/transactions/${txn.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRANSACTION_ALLOCATED');
    expect(await Transaction.findByPk(txn.id)).not.toBeNull();
  });

  it('still deletes an unallocated transaction', async () => {
    asAdmin();
    const res = await request(app).delete(`/api/transactions/${txn.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(await Transaction.findByPk(txn.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd backend && npx jest tests/integration/transactionDeleteGuard.test.js -v`
Expected: the first test FAILS — deletion currently succeeds (SQLite does not
enforce the FK by default) or returns 500.

- [ ] **Step 3: Add the guard**

In `deleteTransaction`, after the transaction is fetched and before it is
destroyed:

```js
    // Allocated payments are financial history. The FK is ON DELETE RESTRICT;
    // this check turns that database error into an explanation the treasurer
    // can act on — reverse the allocation first, then delete.
    const { PledgeAllocation } = require('../models');
    const allocationCount = await PledgeAllocation.count({ where: { transaction_id: transaction.id } });
    if (allocationCount > 0) {
      return res.status(409).json({
        success: false,
        code: 'TRANSACTION_ALLOCATED',
        message: 'This payment is allocated to a pledge. Reverse the allocation before deleting it.'
      });
    }
```

Prefer adding `PledgeAllocation` to the existing top-of-file model import rather
than requiring it inline, matching the file's style.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `cd backend && npx jest tests/integration/transactionDeleteGuard.test.js -v`
Expected: both PASS.

- [ ] **Step 5: Run the whole suite**

Run: `cd backend && npx jest 2>&1 | tail -40`
Expected: green, or only pre-existing failures unrelated to this plan.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/transactionController.js backend/tests/integration/transactionDeleteGuard.test.js
git commit -m "feat: refuse to delete transactions allocated to a pledge"
```

---

## Task 17: Rehearse the migrations against Postgres

Jest never runs migrations (`config/config.js` has no `test` environment and
hardcodes `dialect: 'postgres'`), so up/down is unverified until this step. Do
not skip it — Task 5 rewrites a column on a table holding real pledge data.

**Files:** none changed. This is a verification task.

- [ ] **Step 1: Get a Postgres copy with production-shaped data**

Follow the `db-migrations` skill for the project's procedure. Do **not** point
`DATABASE_URL` at production. The copy must include the 148 pledge rows with the
6 duplicate-member cases, since those are exactly what the partial unique index
can fail on.

- [ ] **Step 2: Record the before-state**

```sql
SELECT COUNT(*) AS pledges, SUM(amount) AS total FROM pledges;
SELECT status, COUNT(*) FROM pledges GROUP BY status;
```

Expected: 148 / 69949.00; pending 19, fulfilled 129.

- [ ] **Step 3: Run the migrations**

```bash
cd backend && npx sequelize-cli db:migrate
```
Expected: all seven apply with no error. If migration 3 fails on the unique
index, `is_historical` was not populated first — fix the ordering, do not
weaken the index.

- [ ] **Step 4: Verify nothing was lost and the derivation works**

```sql
SELECT COUNT(*) AS pledges, SUM(amount) AS total FROM pledges;
SELECT legacy_status, COUNT(*) FROM pledges GROUP BY legacy_status;
SELECT COUNT(*) FROM pledges WHERE campaign_id IS NULL;
SELECT COUNT(*) FROM pledges WHERE is_historical = false;
SELECT slug, total_pledged, total_collected, outstanding FROM campaign_totals;
```

Expected: 148 / 69949.00 unchanged; `legacy_status` identical to the old
`status` distribution; zero NULL `campaign_id`; zero non-historical rows;
`2025-pledge-drive` shows `total_pledged` 69949.00 and `total_collected` 0
(nothing is allocated yet — reconciliation is a later plan).

- [ ] **Step 5: Verify the append-only trigger**

```sql
INSERT INTO pledge_allocations (pledge_id, transaction_id, amount, source, created_at)
SELECT p.id, t.id, 1.00, 'treasurer_manual', NOW()
FROM pledges p, transactions t LIMIT 1;

UPDATE pledge_allocations SET amount = 2.00 WHERE amount = 1.00;
-- Expected: ERROR ... pledge_allocations is append-only
DELETE FROM pledge_allocations WHERE amount = 1.00;
-- Expected: ERROR ... pledge_allocations is append-only
```

Both statements **must** error. If either succeeds, the trigger did not install.
Clean up afterwards by dropping and restoring the copy — the row cannot be
deleted, which is the point.

- [ ] **Step 6: Verify rollback**

```bash
npx sequelize-cli db:migrate:undo:all --to 20260820000001-enable-rls-pledges.js
```
Then confirm `pledges` has a `status` column again with the original 19/129
distribution, and that `pledge_campaigns` / `pledge_allocations` are gone.

- [ ] **Step 7: Re-apply and record the result**

Re-run `db:migrate`. Write the verified before/after counts into the PR
description. **Do not run this against production** — deployment is the user's
decision, per the standing rule about commits and pushes.

---

## Definition of done

- [ ] `cd backend && npx jest` is green
- [ ] `cd frontend && npx tsc --noEmit` has no new errors
- [ ] Migrations apply and roll back cleanly on a Postgres copy (Task 17)
- [ ] The append-only trigger provably blocks UPDATE and DELETE
- [ ] `GET /api/pledges` returns 401 unauthenticated and 403 for a plain member
- [ ] The public `GET /api/pledges/stats` contains no donor names
- [ ] Every write route against the 2025 campaign returns 409
- [ ] $5,000 pledged with $1,000 + $1,500 allocated reports 2500 / 2500 / 50% / `partially_fulfilled`
- [ ] No real member data appears in any test, fixture, or commit

## What this plan does NOT do

Deliberately deferred to later plans:

- **Stripe auto-allocation, refunds, disputes** (spec §5.2 S1/S5, §6) — plan 3
- **The 2025 reconciliation report and campaign freeze** (spec §4) — plan 2
- **Member `/my-pledge` page and the treasurer pledges tab** (spec §7) — plan 3
- **Repointing `smsController` off `legacy_status`** (spec §7.3) — plan 4.
  Task 5 Step 6 patches it just enough to keep tests green; the correct fix is
  to read `derived_status`. **Until then, no pledge SMS should be sent.**
- **`GET /api/pledges/mine`** (spec §8.2) — ships with the member page in plan 3.
- **View-backed filters on `GET /api/pledges`** (`campaign_id`, `derived_status`,
  search) — ships with the treasurer list in plan 3. `getAllPledges` keeps its
  current shape here.
- **Activating the 2026 campaign.** Both campaigns stay `draft` after this plan.
