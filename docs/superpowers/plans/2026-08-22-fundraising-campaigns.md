# Fundraising Campaigns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin create a fundraising campaign with dates and a goal, show a home-page link to the pledge page only while that campaign is running, and scope the pledge tracker to it.

**Architecture:** No schema change — `pledge_campaigns` already carries every field. One server-side helper defines "live" (`status='active'` AND today inside the date window, in `America/Chicago`); `/api/pledge-campaigns/active`, pledge creation, and the tracker all read that one definition. The frontend gets a single `useActiveCampaign()` hook so the home card, pledge page, and tracker cannot disagree, plus a Fundraising tab in the admin dashboard.

**Tech Stack:** Node/Express, Sequelize, PostgreSQL (tests on `sqlite::memory:`), moment-timezone; React 19 + TypeScript, CRA, Tailwind, Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-22-fundraising-campaigns-design.md` (builds on `docs/superpowers/specs/2026-08-20-pledge-modernization-design.md`)

## Global Constraints

- **No real member data** in any test, fixture, doc, or commit. All fixtures synthetic. (CLAUDE.md)
- **No schema change.** No new migration in this plan. `pledge_campaigns` already has `name`, `name_ti`, `description`, `description_ti`, `start_date`, `end_date`, `goal_amount`, `currency`, `status`.
- **Every new UI string gets both `en` and `ti`** entries in `frontend/src/i18n/dictionaries.ts`. Tigrigna drafts are flagged in `tigrigna-translation-review.md` (Task 11).
- **Role vocabulary is fixed** — reuse `viewRoles` / `adminRoles` exactly as `pledgeCampaignRoutes.js` defines them. Do not invent role names.
- **"Today" is always `America/Chicago`**, obtained via `formatForDB(now())` from `backend/src/config/timezone.js`. Never `new Date().toISOString()`.
- **Backend test command:** from `backend/`: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest <path>`
- **Frontend test command:** from `frontend/`: `CI=true npx react-scripts test --testPathPattern="<pattern>" --watchAll=false`
- **Work happens on the `feat/fundraising-campaigns` branch.** A pre-commit hook runs the full backend and frontend suites on every commit; a red suite blocks the commit.
- `start_date` / `end_date` are Sequelize `DATEONLY` and come back as `'YYYY-MM-DD'` **strings**, so ISO string comparison is correct and no `Date` parsing is needed.
- `goal_amount` is `DECIMAL` and arrives as a **string** from Postgres — always `parseFloat` before arithmetic.
- **Never call `sequelize.close()` in a backend test's `afterAll`.** The models module shares one connection and registers its own exit handling; closing it fails the suite with `SQLITE_MISUSE: Database is closed` even when every test passed. Verified empirically while writing this plan.
- **`pledge_balances` and `campaign_totals` are VIEWS, and `sequelize.sync()` does not create them** — `PledgeBalance.sync`/`CampaignTotal.sync` are deliberate no-ops. Any test that reads a balance or total must call `createPledgeViews(sequelize.getQueryInterface())` from `backend/src/database/pledgeViews.js` **after** `sync({ force: true })`. This works on SQLite; confirmed by running it.

---

## File Structure

**Backend — create:**
- `backend/src/services/pledgeCampaignService.js` — the single definition of "live" and "overlapping". No HTTP, no `res`.
- `backend/src/__tests__/services/pledgeCampaignService.test.js`
- `backend/src/__tests__/controllers/pledgeCampaignController.test.js`

**Backend — modify:**
- `backend/src/controllers/pledgeCampaignController.js` — `listActive` date filter; overlap 409 in `create`/`update`
- `backend/src/controllers/pledgeController.js` — `getPledgeStats` campaign filter; `createPledge` binds to the live campaign

**Frontend — create:**
- `frontend/src/utils/pledgeCampaignApi.ts` — typed client (public `/active`, admin list/create/update)
- `frontend/src/hooks/useActiveCampaign.ts` — the one client-side source
- `frontend/src/components/admin/FundraisingCampaigns.tsx` — admin list + form
- Tests alongside each.

**Frontend — modify:**
- `frontend/src/components/QuickLinks.tsx` — card becomes conditional, titled from the campaign
- `frontend/src/pages/PledgePage.tsx` — empty state when nothing is live
- `frontend/src/components/PledgeTracker.tsx` — `campaignId` scoping + goal progress bar
- `frontend/src/components/admin/AdminDashboard.tsx` — new tab
- `frontend/src/i18n/dictionaries.ts` — `en` + `ti` strings
- **Existing tests that must be updated, not left failing:** `frontend/src/components/__tests__/QuickLinks.test.tsx` (Task 7) and `frontend/src/components/__tests__/PledgeTracker.test.tsx` (Task 9).

`FundraisingCampaigns` is imported directly into `AdminDashboard` like every other panel there. `AdminDashboard` is itself lazy-loaded in `App.tsx` under `webpackChunkName: "admin"`, so the new panel lands in the admin chunk and stays out of members' bundles — do **not** add a second `React.lazy` inside it.

---

### Task 1: The live-campaign service

**Files:**
- Create: `backend/src/services/pledgeCampaignService.js`
- Test: `backend/src/__tests__/services/pledgeCampaignService.test.js`

**Interfaces:**
- Consumes: `PledgeCampaign` from `../models`; `now`, `formatForDB` from `../config/timezone`
- Produces:
  - `todayInChurchTz(): string` — `'YYYY-MM-DD'` in America/Chicago
  - `isLive(campaign: {status, start_date, end_date}, today?: string): boolean`
  - `findLiveCampaign(): Promise<PledgeCampaign | null>`
  - `findOverlappingActive({ id, start_date, end_date }): Promise<PledgeCampaign | null>`

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/services/pledgeCampaignService.test.js`:

```js
'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign } = require('../../models');
const {
  isLive, findLiveCampaign, findOverlappingActive, todayInChurchTz
} = require('../../services/pledgeCampaignService');

// Fixed reference day used for every isLive() assertion, so these tests do not
// change meaning as the calendar moves.
const TODAY = '2026-06-15';

const campaign = (overrides = {}) => ({
  status: 'active',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  ...overrides
});

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterEach(async () => { await PledgeCampaign.destroy({ where: {}, truncate: true }); });
// Deliberately no sequelize.close() here — see Global Constraints.

describe('isLive', () => {
  it('is not live the day before it starts', () => {
    expect(isLive(campaign({ start_date: '2026-06-16' }), TODAY)).toBe(false);
  });

  it('is live on its first day', () => {
    expect(isLive(campaign({ start_date: TODAY }), TODAY)).toBe(true);
  });

  it('is live on its last day', () => {
    expect(isLive(campaign({ end_date: TODAY }), TODAY)).toBe(true);
  });

  it('is not live the day after it ends', () => {
    expect(isLive(campaign({ end_date: '2026-06-14' }), TODAY)).toBe(false);
  });

  it('is live with no end date', () => {
    expect(isLive(campaign({ end_date: null }), TODAY)).toBe(true);
  });

  it('is not live while draft, even inside the window', () => {
    expect(isLive(campaign({ status: 'draft' }), TODAY)).toBe(false);
  });

  it('is not live once closed, even inside the window', () => {
    expect(isLive(campaign({ status: 'closed' }), TODAY)).toBe(false);
  });
});

describe('todayInChurchTz', () => {
  it('returns a YYYY-MM-DD date in the church timezone', () => {
    expect(todayInChurchTz()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('uses America/Chicago, not UTC', () => {
    // 01:30 UTC on Jan 2 is still Jan 1 in Dallas. A campaign ending Jan 1 must
    // still be live for its final evening — the bug this pins down.
    jest.useFakeTimers().setSystemTime(new Date('2026-01-02T01:30:00Z'));
    try {
      expect(todayInChurchTz()).toBe('2026-01-01');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('findLiveCampaign', () => {
  it('returns null when nothing is active', async () => {
    await PledgeCampaign.create({
      slug: 'draft-drive', name: 'Draft Drive', status: 'draft',
      start_date: '2026-01-01', end_date: '2026-12-31'
    });
    expect(await findLiveCampaign()).toBeNull();
  });

  it('returns the active campaign whose window contains today', async () => {
    const today = todayInChurchTz();
    await PledgeCampaign.create({
      slug: 'live-drive', name: 'Live Drive', status: 'active',
      start_date: today, end_date: null
    });
    const found = await findLiveCampaign();
    expect(found).not.toBeNull();
    expect(found.slug).toBe('live-drive');
  });

  it('ignores an active campaign whose window has passed', async () => {
    await PledgeCampaign.create({
      slug: 'past-drive', name: 'Past Drive', status: 'active',
      start_date: '2020-01-01', end_date: '2020-12-31'
    });
    expect(await findLiveCampaign()).toBeNull();
  });
});

describe('findOverlappingActive', () => {
  const makeActive = () => PledgeCampaign.create({
    slug: 'existing', name: 'Existing Drive', status: 'active',
    start_date: '2026-01-01', end_date: '2026-06-30'
  });

  it('finds an active campaign overlapping the candidate window', async () => {
    await makeActive();
    const clash = await findOverlappingActive({
      start_date: '2026-06-01', end_date: '2026-12-31'
    });
    expect(clash).not.toBeNull();
    expect(clash.slug).toBe('existing');
  });

  it('allows an adjacent, non-overlapping window', async () => {
    await makeActive();
    expect(await findOverlappingActive({
      start_date: '2026-07-01', end_date: '2026-12-31'
    })).toBeNull();
  });

  it('treats a null end date as unbounded', async () => {
    await makeActive();
    expect(await findOverlappingActive({
      start_date: '2026-07-01', end_date: null
    })).toBeNull();
    expect(await findOverlappingActive({
      start_date: '2025-01-01', end_date: null
    })).not.toBeNull();
  });

  it('ignores draft and closed campaigns', async () => {
    await PledgeCampaign.create({
      slug: 'drafty', name: 'Drafty', status: 'draft',
      start_date: '2026-01-01', end_date: '2026-12-31'
    });
    expect(await findOverlappingActive({
      start_date: '2026-01-01', end_date: '2026-12-31'
    })).toBeNull();
  });

  it('excludes the campaign being updated from its own overlap check', async () => {
    const existing = await makeActive();
    expect(await findOverlappingActive({
      id: existing.id, start_date: '2026-01-01', end_date: '2026-06-30'
    })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/services/pledgeCampaignService.test.js`
Expected: FAIL — `Cannot find module '../../services/pledgeCampaignService'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/services/pledgeCampaignService.js`:

```js
'use strict';

const { Op } = require('sequelize');
const { PledgeCampaign } = require('../models');
const { now, formatForDB } = require('../config/timezone');

/**
 * "Today" for every campaign date comparison, as YYYY-MM-DD in the church's
 * timezone (America/Chicago). Deliberately not UTC: a drive ending today must
 * stay live through its final Dallas evening, and UTC would end it early.
 */
const todayInChurchTz = () => formatForDB(now());

/**
 * A campaign is live when an admin has activated it AND today falls inside its
 * window. start_date/end_date are DATEONLY, so they arrive as 'YYYY-MM-DD'
 * strings and compare correctly as strings. A null end_date means open-ended.
 */
const isLive = (campaign, today = todayInChurchTz()) => {
  if (!campaign || campaign.status !== 'active') return false;
  if (campaign.start_date > today) return false;
  if (campaign.end_date && campaign.end_date < today) return false;
  return true;
};

const findLiveCampaign = async () => {
  const today = todayInChurchTz();
  return PledgeCampaign.findOne({
    where: {
      status: 'active',
      start_date: { [Op.lte]: today },
      [Op.or]: [{ end_date: null }, { end_date: { [Op.gte]: today } }]
    },
    // Enforcement of "one live campaign" is newer than the data, so it cannot
    // fix rows activated before it existed. If two somehow match, return the
    // most recent rather than erroring — the public home page must not break
    // because of a data state an admin created.
    order: [['start_date', 'DESC']]
  });
};

/**
 * The active campaign whose window intersects the candidate's, or null.
 * Two windows overlap when each starts on or before the other ends, with a
 * null end date treated as no upper bound.
 */
const findOverlappingActive = async ({ id, start_date, end_date }) => {
  const conditions = [
    { [Op.or]: [{ end_date: null }, { end_date: { [Op.gte]: start_date } }] }
  ];
  if (end_date) conditions.push({ start_date: { [Op.lte]: end_date } });

  const where = { status: 'active', [Op.and]: conditions };
  if (id) where.id = { [Op.ne]: id };

  return PledgeCampaign.findOne({ where });
};

module.exports = { todayInChurchTz, isLive, findLiveCampaign, findOverlappingActive };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/services/pledgeCampaignService.test.js`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/pledgeCampaignService.js backend/src/__tests__/services/pledgeCampaignService.test.js
git commit -m "feat: add live-campaign resolution keyed to church timezone"
```

---

### Task 2: `/active` returns only the live campaign

**Files:**
- Modify: `backend/src/controllers/pledgeCampaignController.js` (`listActive`, lines 13–35)
- Test: `backend/src/__tests__/controllers/pledgeCampaignController.test.js`

**Interfaces:**
- Consumes: `findLiveCampaign()` from Task 1
- Produces: `GET /api/pledge-campaigns/active` → `{ success: true, campaigns: [] | [campaign] }` (shape unchanged, now ≤ 1 entry)

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/controllers/pledgeCampaignController.test.js`:

```js
'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign } = require('../../models');
const { listActive } = require('../../controllers/pledgeCampaignController');
const { todayInChurchTz } = require('../../services/pledgeCampaignService');

function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterEach(async () => { await PledgeCampaign.destroy({ where: {}, truncate: true }); });
// Deliberately no sequelize.close() here — see Global Constraints.

describe('GET /api/pledge-campaigns/active', () => {
  it('returns an active campaign whose window contains today', async () => {
    await PledgeCampaign.create({
      slug: 'live-drive', name: 'Live Drive', status: 'active',
      start_date: todayInChurchTz(), end_date: null, goal_amount: 50000
    });

    const res = mockRes();
    await listActive({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.campaigns).toHaveLength(1);
    expect(res.payload.campaigns[0].slug).toBe('live-drive');
  });

  it('returns nothing for an active campaign whose window has passed', async () => {
    await PledgeCampaign.create({
      slug: 'past-drive', name: 'Past Drive', status: 'active',
      start_date: '2020-01-01', end_date: '2020-12-31'
    });

    const res = mockRes();
    await listActive({ query: {} }, res);

    expect(res.payload.campaigns).toEqual([]);
  });

  it('never exposes columns outside the public allow-list', async () => {
    await PledgeCampaign.create({
      slug: 'live-drive', name: 'Live Drive', status: 'active',
      start_date: todayInChurchTz(), end_date: null,
      default_payment_type: 'pledge_drive'
    });

    const res = mockRes();
    await listActive({ query: {} }, res);

    const returned = Object.keys(res.payload.campaigns[0].toJSON
      ? res.payload.campaigns[0].toJSON()
      : res.payload.campaigns[0]);
    expect(returned).not.toContain('default_payment_type');
    expect(returned).not.toContain('income_category_id');
    expect(returned).not.toContain('status');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/pledgeCampaignController.test.js`
Expected: FAIL — the "window has passed" case returns 1 campaign instead of `[]`, because `listActive` filters on status only.

- [ ] **Step 3: Write the implementation**

In `backend/src/controllers/pledgeCampaignController.js`, add to the imports at the top:

```js
const { findLiveCampaign } = require('../services/pledgeCampaignService');
```

Replace the body of `listActive` with:

```js
const listActive = async (req, res) => {
  try {
    // Live means active AND inside the date window — see
    // services/pledgeCampaignService. Exactly one drive runs at a time, so
    // this is 0 or 1 rows; the array shape is kept so existing callers of
    // this endpoint keep working.
    const live = await findLiveCampaign();

    const campaigns = live
      ? [await PledgeCampaign.findByPk(live.id, { attributes: PUBLIC_ATTRIBUTES })]
      : [];

    res.status(200).json({
      success: true,
      campaigns
    });
  } catch (error) {
    console.error('Error listing active pledge campaigns:', error);
    // This endpoint is public and unauthenticated — deliberately withhold
    // error.message from the response so internal/DB detail never reaches
    // an anonymous caller. Full detail stays in the server log above.
    res.status(500).json({
      success: false,
      message: 'Failed to load campaigns'
    });
  }
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/pledgeCampaignController.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/pledgeCampaignController.js backend/src/__tests__/controllers/pledgeCampaignController.test.js
git commit -m "feat: filter the public active-campaign endpoint by date window"
```

---

### Task 3: Refuse overlapping active campaigns

**Files:**
- Modify: `backend/src/controllers/pledgeCampaignController.js` (`create`, `update`)
- Test: `backend/src/__tests__/controllers/pledgeCampaignController.test.js` (append)

**Interfaces:**
- Consumes: `findOverlappingActive()` from Task 1
- Produces: `409 { success: false, code: 'CAMPAIGN_OVERLAP', message }` from `POST /` and `PATCH /:id`

- [ ] **Step 1: Write the failing test**

Append to `backend/src/__tests__/controllers/pledgeCampaignController.test.js`:

```js
const { create, update } = require('../../controllers/pledgeCampaignController');

describe('campaign overlap enforcement', () => {
  const existingActive = () => PledgeCampaign.create({
    slug: 'existing', name: 'Existing Drive', status: 'active',
    start_date: '2026-01-01', end_date: '2026-06-30'
  });

  // req.user is required because update() writes an ActivityLog on status change.
  const adminReq = (body, params = {}) => ({ body, params, user: { id: 1 }, ip: '127.0.0.1' });

  it('rejects creating a second active campaign over the same dates', async () => {
    await existingActive();

    const res = mockRes();
    await create(adminReq({
      slug: 'clashing', name: 'Clashing Drive', status: 'active',
      start_date: '2026-06-01', end_date: '2026-12-31'
    }), res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('CAMPAIGN_OVERLAP');
    expect(res.payload.message).toContain('Existing Drive');
    expect(await PledgeCampaign.count({ where: { slug: 'clashing' } })).toBe(0);
  });

  it('allows creating a draft campaign over the same dates', async () => {
    await existingActive();

    const res = mockRes();
    await create(adminReq({
      slug: 'next-year', name: 'Next Drive', status: 'draft',
      start_date: '2026-06-01', end_date: '2026-12-31'
    }), res);

    expect(res.statusCode).toBe(201);
  });

  it('rejects activating a draft that overlaps a live campaign', async () => {
    await existingActive();
    const draft = await PledgeCampaign.create({
      slug: 'draft-clash', name: 'Draft Clash', status: 'draft',
      start_date: '2026-02-01', end_date: '2026-03-01'
    });

    const res = mockRes();
    await update(adminReq({ status: 'active' }, { id: String(draft.id) }), res);

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('CAMPAIGN_OVERLAP');
    await draft.reload();
    expect(draft.status).toBe('draft');
  });

  it('rejects widening an active window until it swallows another live campaign', async () => {
    await existingActive();
    const other = await PledgeCampaign.create({
      slug: 'later', name: 'Later Drive', status: 'active',
      start_date: '2026-07-01', end_date: '2026-08-31'
    });

    const res = mockRes();
    // Moving this one's start back into the existing drive's window.
    await update(adminReq({ start_date: '2026-05-01' }, { id: String(other.id) }), res);

    expect(res.statusCode).toBe(409);
    await other.reload();
    expect(other.start_date).toBe('2026-07-01');
  });

  it('allows editing an active campaign without moving it onto another', async () => {
    const existing = await existingActive();

    const res = mockRes();
    await update(adminReq({ name: 'Renamed Drive' }, { id: String(existing.id) }), res);

    expect(res.statusCode).toBe(200);
    await existing.reload();
    expect(existing.name).toBe('Renamed Drive');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/pledgeCampaignController.test.js -t overlap`
Expected: FAIL — creation returns 201 and the clashing row exists; no overlap check exists yet.

- [ ] **Step 3: Write the implementation**

In `backend/src/controllers/pledgeCampaignController.js`, extend the service import:

```js
const { findLiveCampaign, findOverlappingActive } = require('../services/pledgeCampaignService');
```

Add this helper above `create`:

```js
// Exactly one campaign runs at a time. Checked in the app layer rather than
// with a Postgres EXCLUDE constraint because the test suite runs on SQLite,
// which has no such constraint — the same portability rule that shaped the
// pledge views. Two admins activating in the same instant could still race;
// activation is admin-only and rare, and the result is a visible duplicate
// rather than corrupted money.
const overlapConflict = async ({ id, start_date, end_date }) => {
  const clash = await findOverlappingActive({ id, start_date, end_date });
  if (!clash) return null;
  const window = `${clash.start_date} – ${clash.end_date || 'no end date'}`;
  return {
    success: false,
    code: 'CAMPAIGN_OVERLAP',
    message: `${clash.name} (${window}) is already active for these dates.`
  };
};
```

In `create`, immediately after the existing status validation block and before `PledgeCampaign.create(...)`:

```js
    if (status === 'active') {
      const conflict = await overlapConflict({ start_date, end_date });
      if (conflict) return res.status(409).json(conflict);
    }
```

In `update`, after `previousStatus` is captured and after `updateData` is built, but **before** `await campaign.update(updateData)`:

```js
    // Check the campaign's post-update state, not just the request body: an
    // admin widening an already-active campaign's dates can swallow another
    // live one without ever sending status='active'.
    const nextStatus = updateData.status ?? campaign.status;
    if (nextStatus === 'active') {
      const conflict = await overlapConflict({
        id: campaign.id,
        start_date: updateData.start_date ?? campaign.start_date,
        end_date: updateData.end_date !== undefined ? updateData.end_date : campaign.end_date
      });
      if (conflict) return res.status(409).json(conflict);
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/pledgeCampaignController.test.js`
Expected: PASS — including Task 2's cases.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/pledgeCampaignController.js backend/src/__tests__/controllers/pledgeCampaignController.test.js
git commit -m "feat: refuse activating a campaign that overlaps a live one"
```

---

### Task 4: Scope pledge stats to a campaign

**Files:**
- Modify: `backend/src/controllers/pledgeController.js` (`getPledgeStats`, the `PledgeBalance.findAll` include around lines 334–350)
- Test: `backend/src/__tests__/controllers/pledgeStatsCampaign.test.js`

**Interfaces:**
- Produces: `GET /api/pledges/stats?campaign_id=<id>` filters to that campaign. Omitting it keeps today's all-campaign behaviour.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/controllers/pledgeStatsCampaign.test.js`:

```js
'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign, Pledge } = require('../../models');
const { createPledgeViews } = require('../../database/pledgeViews');
const { getPledgeStats } = require('../../controllers/pledgeController');

function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

let campaignA;
let campaignB;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  // getPledgeStats reads the pledge_balances VIEW, which sync() does not
  // create — PledgeBalance.sync is a deliberate no-op. Without this the suite
  // fails with "no such table: pledge_balances".
  await createPledgeViews(sequelize.getQueryInterface());

  campaignA = await PledgeCampaign.create({
    slug: 'drive-a', name: 'Drive A', status: 'active',
    start_date: '2026-01-01', end_date: '2026-12-31'
  });
  campaignB = await PledgeCampaign.create({
    slug: 'drive-b', name: 'Drive B', status: 'closed',
    start_date: '2025-01-01', end_date: '2025-12-31'
  });

  // Synthetic donors only — never real member names.
  await Pledge.create({
    campaign_id: campaignA.id, amount: 300, first_name: 'Test', last_name: 'DonorOne'
  });
  await Pledge.create({
    campaign_id: campaignB.id, amount: 700, first_name: 'Test', last_name: 'DonorTwo'
  });
});

// Deliberately no sequelize.close() here — see Global Constraints.

describe('GET /api/pledges/stats?campaign_id=', () => {
  it('totals only the requested campaign', async () => {
    const res = mockRes();
    await getPledgeStats({ query: { campaign_id: String(campaignA.id) } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.stats.total_pledged).toBe(300);
  });

  it('totals every campaign when campaign_id is omitted', async () => {
    const res = mockRes();
    await getPledgeStats({ query: {} }, res);

    expect(res.payload.stats.total_pledged).toBe(1000);
  });

  it('returns zeroed totals for a campaign with no pledges', async () => {
    const empty = await PledgeCampaign.create({
      slug: 'drive-c', name: 'Drive C', status: 'draft',
      start_date: '2027-01-01', end_date: '2027-12-31'
    });

    const res = mockRes();
    await getPledgeStats({ query: { campaign_id: String(empty.id) } }, res);

    expect(res.payload.stats.total_pledged).toBe(0);
    expect(res.payload.stats.status_breakdown).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/pledgeStatsCampaign.test.js`
Expected: FAIL — the first case reports `1000`, because `campaign_id` is ignored.

- [ ] **Step 3: Write the implementation**

In `getPledgeStats`, change the destructuring of the query:

```js
    const { event_name, campaign_id } = req.query;
```

Then, in the `PledgeBalance.findAll` call, replace the `Pledge` include's `where` so it carries both filters:

```js
        {
          model: Pledge,
          as: 'pledge',
          attributes: ['first_name', 'last_name', 'pledge_type', 'event_name', 'created_at'],
          required: true,
          // campaign_id scopes the public tracker to the current drive. Both
          // filters are optional; omitting them keeps the all-campaign total
          // that staff callers already rely on.
          where: {
            ...(event_name ? { event_name } : {}),
            ...(campaign_id ? { campaign_id } : {})
          }
        },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/pledgeStatsCampaign.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/pledgeController.js backend/src/__tests__/controllers/pledgeStatsCampaign.test.js
git commit -m "feat: allow scoping pledge stats to one campaign"
```

---

### Task 5: Bind new pledges to the live campaign

**Files:**
- Modify: `backend/src/controllers/pledgeController.js` (`createPledge`, the campaign resolution at lines 57–69)
- Test: `backend/src/__tests__/controllers/pledgeCreateCampaign.test.js`

**Interfaces:**
- Consumes: `findLiveCampaign()` from Task 1
- Produces: `POST /api/pledges` attaches to the live campaign; `503` when none; a client-sent `campaign_id` is ignored.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/controllers/pledgeCreateCampaign.test.js`:

```js
'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { sequelize, PledgeCampaign, Pledge } = require('../../models');
const { createPledge } = require('../../controllers/pledgeController');
const { todayInChurchTz } = require('../../services/pledgeCampaignService');

function mockRes() {
  const res = { statusCode: 200, payload: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

// Synthetic donor — never a real member.
const body = (overrides = {}) => ({
  amount: 250, first_name: 'Test', last_name: 'Donor', ...overrides
});

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterEach(async () => {
  await Pledge.destroy({ where: {}, truncate: true, cascade: true });
  await PledgeCampaign.destroy({ where: {}, truncate: true, cascade: true });
});
// Deliberately no sequelize.close() here — see Global Constraints.

describe('POST /api/pledges campaign binding', () => {
  it('attaches the pledge to the live campaign', async () => {
    const live = await PledgeCampaign.create({
      slug: 'live-drive', name: 'Live Drive', status: 'active',
      start_date: todayInChurchTz(), end_date: null
    });

    const res = mockRes();
    await createPledge({ body: body(), ip: '127.0.0.1' }, res);

    expect(res.statusCode).toBe(201);
    const stored = await Pledge.findByPk(res.payload.pledge.id);
    expect(String(stored.campaign_id)).toBe(String(live.id));
  });

  it('ignores a client-supplied campaign_id', async () => {
    const live = await PledgeCampaign.create({
      slug: 'live-drive', name: 'Live Drive', status: 'active',
      start_date: todayInChurchTz(), end_date: null
    });
    const draft = await PledgeCampaign.create({
      slug: 'draft-drive', name: 'Draft Drive', status: 'draft',
      start_date: '2027-01-01', end_date: '2027-12-31'
    });

    const res = mockRes();
    await createPledge({ body: body({ campaign_id: draft.id }), ip: '127.0.0.1' }, res);

    const stored = await Pledge.findByPk(res.payload.pledge.id);
    expect(String(stored.campaign_id)).toBe(String(live.id));
  });

  it('refuses the pledge when no campaign is live', async () => {
    await PledgeCampaign.create({
      slug: 'draft-drive', name: 'Draft Drive', status: 'draft',
      start_date: todayInChurchTz(), end_date: null
    });

    const res = mockRes();
    await createPledge({ body: body(), ip: '127.0.0.1' }, res);

    expect(res.statusCode).toBe(503);
    expect(await Pledge.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/pledgeCreateCampaign.test.js`
Expected: FAIL — the third case returns 201, because the current code accepts any non-closed campaign, including a draft.

- [ ] **Step 3: Write the implementation**

In `backend/src/controllers/pledgeController.js`, add to the imports:

```js
const { findLiveCampaign } = require('../services/pledgeCampaignService');
```

Replace the campaign resolution block in `createPledge` (the `openCampaign` lookup) with:

```js
    // Pledges bind to the campaign that is live right now — active AND inside
    // its date window. Resolved server-side and any client-supplied
    // campaign_id is ignored on purpose: a crafted request must not be able to
    // attach a pledge to a different drive, including a draft one that the
    // previous non-closed check would have accepted.
    const liveCampaign = await findLiveCampaign();
    if (!liveCampaign) {
      return res.status(503).json({
        success: false,
        message: 'Pledges are not currently being accepted'
      });
    }
```

Then in the `Pledge.create({ ... })` call, replace `campaign_id: openCampaign.id,` with:

```js
      campaign_id: liveCampaign.id,
```

Verify no other reference to `openCampaign` remains in the file:

```bash
cd backend && grep -n "openCampaign" src/controllers/pledgeController.js
```
Expected: no output.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/pledgeCreateCampaign.test.js`
Expected: PASS

- [ ] **Step 5: Run the whole backend suite for regressions**

Run: `cd backend && npm test`
Expected: PASS. `createPledge` is covered elsewhere; if another test seeded a draft-only campaign and expected a pledge to succeed, update that test to seed a live one — the new behaviour is intended.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/pledgeController.js backend/src/__tests__/controllers/pledgeCreateCampaign.test.js
git commit -m "feat: bind new pledges to the live campaign only"
```

---

### Task 6: Frontend campaign client and `useActiveCampaign()`

**Files:**
- Create: `frontend/src/utils/pledgeCampaignApi.ts`
- Create: `frontend/src/hooks/useActiveCampaign.ts`
- Test: `frontend/src/hooks/__tests__/useActiveCampaign.test.tsx`

**Interfaces:**
- Produces:
  - `interface PledgeCampaign { id: number; slug: string; name: string; name_ti: string | null; description: string | null; description_ti: string | null; start_date: string; end_date: string | null; goal_amount: string | null; currency: string; }`
  - `fetchActiveCampaign(): Promise<PledgeCampaign | null>`
  - `fetchAllCampaigns(): Promise<AdminCampaign[]>`, `createCampaign(input): Promise<AdminCampaign>`, `updateCampaign(id, input): Promise<AdminCampaign>` (used in Task 10)
  - `useActiveCampaign(): { campaign: PledgeCampaign | null; loading: boolean; error: string | null }`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/__tests__/useActiveCampaign.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useActiveCampaign } from '../useActiveCampaign';

const Probe: React.FC = () => {
  const { campaign, loading, error } = useActiveCampaign();
  if (loading) return <div>loading</div>;
  if (error) return <div>error:{error}</div>;
  return <div>campaign:{campaign ? campaign.name : 'none'}</div>;
};

const mockFetchOnce = (payload: unknown, ok = true) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: async () => payload
  }) as unknown as typeof fetch;
};

afterEach(() => { jest.restoreAllMocks(); });

describe('useActiveCampaign', () => {
  it('exposes the live campaign', async () => {
    mockFetchOnce({
      success: true,
      campaigns: [{
        id: 7, slug: 'test-drive', name: 'Test Drive', name_ti: null,
        description: null, description_ti: null,
        start_date: '2026-01-01', end_date: '2026-12-31',
        goal_amount: '50000.00', currency: 'usd'
      }]
    });

    render(<Probe />);
    expect(await screen.findByText('campaign:Test Drive')).toBeInTheDocument();
  });

  it('reports no campaign when none is live', async () => {
    mockFetchOnce({ success: true, campaigns: [] });

    render(<Probe />);
    expect(await screen.findByText('campaign:none')).toBeInTheDocument();
  });

  it('reports an error when the request fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

    render(<Probe />);
    await waitFor(() => {
      expect(screen.getByText(/^error:/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="useActiveCampaign" --watchAll=false`
Expected: FAIL — `Cannot find module '../useActiveCampaign'`

- [ ] **Step 3: Write the implementation**

Create `frontend/src/utils/pledgeCampaignApi.ts`:

```ts
import { auth } from '../firebase';

/** The public shape returned by GET /api/pledge-campaigns/active. */
export interface PledgeCampaign {
  id: number;
  slug: string;
  name: string;
  name_ti: string | null;
  description: string | null;
  description_ti: string | null;
  start_date: string;
  end_date: string | null;
  goal_amount: string | null;
  currency: string;
}

/** The admin shape from GET /api/pledge-campaigns — adds status and totals. */
export interface AdminCampaign extends PledgeCampaign {
  status: 'draft' | 'active' | 'closed';
  default_payment_type: string | null;
  income_category_id: number | null;
  totals: {
    total_pledged: string | null;
    total_collected: string | null;
    percent_to_goal: string | null;
    pledge_count: number | null;
    donor_count: number | null;
  } | null;
}

export interface CampaignInput {
  slug?: string;
  name: string;
  name_ti?: string | null;
  description?: string | null;
  description_ti?: string | null;
  start_date: string;
  end_date?: string | null;
  goal_amount?: number | null;
  currency?: string;
  status?: 'draft' | 'active' | 'closed';
  default_payment_type?: string | null;
  income_category_id?: number | null;
}

const BASE = `${process.env.REACT_APP_API_URL}/api/pledge-campaigns`;

/** Public and unauthenticated — the visitor home page calls this. */
export async function fetchActiveCampaign(): Promise<PledgeCampaign | null> {
  const response = await fetch(`${BASE}/active`);
  if (!response.ok) throw new Error('Failed to load the active campaign');
  const data = await response.json();
  // The endpoint returns 0 or 1 entries; one drive runs at a time.
  return data.campaigns?.[0] ?? null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function fetchAllCampaigns(): Promise<AdminCampaign[]> {
  const response = await fetch(BASE, { headers: await authHeaders() });
  if (!response.ok) throw new Error('Failed to load campaigns');
  const data = await response.json();
  return data.campaigns || [];
}

/**
 * Both writers surface the server's message rather than a generic one: the
 * 409 CAMPAIGN_OVERLAP body names the conflicting drive, which is the whole
 * point of that error.
 */
export async function createCampaign(input: CampaignInput): Promise<AdminCampaign> {
  const response = await fetch(BASE, {
    method: 'POST', headers: await authHeaders(), body: JSON.stringify(input)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create the campaign');
  return data.campaign;
}

export async function updateCampaign(id: number, input: Partial<CampaignInput>): Promise<AdminCampaign> {
  const response = await fetch(`${BASE}/${id}`, {
    method: 'PATCH', headers: await authHeaders(), body: JSON.stringify(input)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update the campaign');
  return data.campaign;
}
```

Create `frontend/src/hooks/useActiveCampaign.ts`:

```ts
import { useState, useEffect } from 'react';
import { fetchActiveCampaign, PledgeCampaign } from '../utils/pledgeCampaignApi';

interface ActiveCampaignState {
  campaign: PledgeCampaign | null;
  loading: boolean;
  error: string | null;
}

/**
 * The single client-side source for "is a drive running right now?". The home
 * card, the pledge page, and the tracker all read this so they cannot
 * disagree. The live/not-live decision itself is made on the server — this
 * only carries the answer.
 */
export function useActiveCampaign(): ActiveCampaignState {
  const [state, setState] = useState<ActiveCampaignState>({
    campaign: null, loading: true, error: null
  });

  useEffect(() => {
    let cancelled = false;

    fetchActiveCampaign()
      .then((campaign) => {
        if (!cancelled) setState({ campaign, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ campaign: null, loading: false, error: err.message || 'Failed to load' });
        }
      });

    return () => { cancelled = true; };
  }, []);

  return state;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="useActiveCampaign" --watchAll=false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/pledgeCampaignApi.ts frontend/src/hooks/useActiveCampaign.ts frontend/src/hooks/__tests__/useActiveCampaign.test.tsx
git commit -m "feat: add campaign API client and useActiveCampaign hook"
```

---

### Task 7: Home card appears only while a drive is running

**Files:**
- Modify: `frontend/src/components/QuickLinks.tsx`
- Modify: `frontend/src/components/__tests__/QuickLinks.test.tsx` — **an existing test asserts the card always renders; it must be updated, not deleted**
- Modify: `frontend/src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `useActiveCampaign()` from Task 6

- [ ] **Step 1: Rewrite the existing QuickLinks test**

Replace the whole of `frontend/src/components/__tests__/QuickLinks.test.tsx` with:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import QuickLinks from '../QuickLinks';

const mockUseActiveCampaign = jest.fn();
jest.mock('../../hooks/useActiveCampaign', () => ({
  useActiveCampaign: () => mockUseActiveCampaign()
}));

const CAMPAIGN = {
  id: 7, slug: 'test-drive', name: 'Test Building Drive', name_ti: null,
  description: 'Help us finish the hall.', description_ti: null,
  start_date: '2026-01-01', end_date: '2026-12-31',
  goal_amount: '50000.00', currency: 'usd'
};

const renderWithProviders = () => render(
  <BrowserRouter><I18nProvider><LanguageProvider><QuickLinks /></LanguageProvider></I18nProvider></BrowserRouter>
);

beforeEach(() => {
  mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: false, error: null });
});

describe('QuickLinks', () => {
  it('links to the survey page', () => {
    renderWithProviders();
    const link = screen.getByText('Church Services Survey').closest('a');
    expect(link).toHaveAttribute('href', '/survey');
  });

  it('shows a pledge card named for the running campaign', async () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });

    renderWithProviders();

    const link = (await screen.findByText('Test Building Drive')).closest('a');
    expect(link).toHaveAttribute('href', '/pledge');
    expect(screen.getByText('Help us finish the hall.')).toBeInTheDocument();
  });

  it('shows no pledge card when no campaign is running', () => {
    renderWithProviders();
    expect(screen.queryByText(/pledge/i)).not.toBeInTheDocument();
  });

  it('shows no pledge card while the campaign is still loading', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: true, error: null });

    renderWithProviders();
    expect(screen.queryByText(/pledge/i)).not.toBeInTheDocument();
  });

  it('fails closed: shows no pledge card when the lookup errored', async () => {
    // A broken card on the parish home page is worse than no card.
    mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: false, error: 'offline' });

    renderWithProviders();
    await waitFor(() => {
      expect(screen.queryByText(/pledge/i)).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="QuickLinks" --watchAll=false`
Expected: FAIL — the card currently renders unconditionally with a hardcoded title, so "no campaign" and "loading" cases find a pledge card.

- [ ] **Step 3: Write the implementation**

In `frontend/src/components/QuickLinks.tsx`, add imports:

```tsx
import { useI18n } from '../i18n/I18nProvider';
import { useActiveCampaign } from '../hooks/useActiveCampaign';
```

Inside the component, above the `return`:

```tsx
const QuickLinks: React.FC = () => {
  const { t } = useLanguage();
  const { lang } = useI18n();
  const { campaign } = useActiveCampaign();
```

Replace the pledge card block added earlier (the `fas fa-hand-holding-heart` card) with:

```tsx
        {/* Only while a drive is actually running. Loading and error both
            leave `campaign` null, so the card fails closed rather than
            rendering a broken entry on the parish home page. */}
        {campaign && (
          <div className="h-full">
            <Card
              icon="fas fa-hand-holding-heart"
              title={(lang === 'ti' && campaign.name_ti) || campaign.name}
              desc={(lang === 'ti' && campaign.description_ti) || campaign.description || t('pledge.homeCard.description')}
              to="/pledge"
            />
          </div>
        )}
```

The campaign's own name and description now title the card, so a new drive needs no code change. `pledge.homeCard.description` survives as the fallback when an admin leaves the description empty; `pledge.homeCard.title` is no longer used here but stays in the dictionary for the pledge page (Task 8).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="QuickLinks" --watchAll=false`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/QuickLinks.tsx frontend/src/components/__tests__/QuickLinks.test.tsx
git commit -m "feat: show the home pledge card only while a drive is running"
```

---

### Task 8: Pledge page explains itself when no drive is running

**Files:**
- Modify: `frontend/src/pages/PledgePage.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`
- Test: `frontend/src/pages/__tests__/PledgePage.test.tsx`

**Interfaces:**
- Consumes: `useActiveCampaign()` from Task 6

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/__tests__/PledgePage.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import PledgePage from '../PledgePage';

const mockUseActiveCampaign = jest.fn();
jest.mock('../../hooks/useActiveCampaign', () => ({
  useActiveCampaign: () => mockUseActiveCampaign()
}));

jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => ({ user: null, currentUser: null })
}));

// The tracker fetches on mount; keep it quiet and irrelevant to these cases.
jest.mock('../../components/PledgeTracker', () => () => <div>tracker</div>);

const CAMPAIGN = {
  id: 7, slug: 'test-drive', name: 'Test Building Drive', name_ti: null,
  description: 'Help us finish the hall.', description_ti: null,
  start_date: '2026-01-01', end_date: '2026-12-31',
  goal_amount: '50000.00', currency: 'usd'
};

const renderPage = () => render(
  <MemoryRouter><I18nProvider><LanguageProvider><PledgePage /></LanguageProvider></I18nProvider></MemoryRouter>
);

describe('PledgePage', () => {
  it('shows the pledge form while a drive is running', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: CAMPAIGN, loading: false, error: null });

    renderPage();

    expect(screen.getByText('Test Building Drive')).toBeInTheDocument();
    expect(screen.queryByText(/no fundraising drive/i)).not.toBeInTheDocument();
  });

  it('explains that no drive is running instead of showing a form', () => {
    mockUseActiveCampaign.mockReturnValue({ campaign: null, loading: false, error: null });

    renderPage();

    expect(screen.getByText(/no fundraising drive/i)).toBeInTheDocument();
    expect(screen.queryByText('Pledge Amount *')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="PledgePage" --watchAll=false`
Expected: FAIL — the page always renders the form; there is no empty state.

- [ ] **Step 3: Add the strings**

In `frontend/src/i18n/dictionaries.ts`, extend the `pledge` block in **both** `en` and `ti`.

`en`:

```ts
  pledge: {
    homeCard: {
      title: "Make a Pledge",
      description: "Pledge your support for the church and pay when you're ready — we'll send payment instructions."
    },
    noCampaign: {
      title: "No fundraising drive is running right now",
      body: "There is no active pledge drive at the moment. Please check back, or contact the church office if you would like to give."
    }
  },
```

`ti` (draft, flagged in Task 11):

```ts
  pledge: {
    homeCard: {
      title: "መብጽዓ ምእታው",
      description: "ንቤተ ክርስቲያን ደገፍኩም ብመብጽዓ ኣረጋግጹ፤ ምስ ተዳለኹም ክትከፍሉ ትኽእሉ — መምርሒ ክፍሊት ክንሰደልኩም ኢና።"
    },
    noCampaign: {
      title: "ሕጂ ዝካየድ ዘሎ ወፈያ የለን",
      body: "ኣብዚ እዋን ንጡፍ መደብ መብጽዓ የለን። በጃኹም ደሓር ተመልከቱ፡ ወይ ክትህቡ እንተደሊኹም ንቤት ጽሕፈት ቤተ ክርስቲያን ተወከሱ።"
    }
  },
```

Also add `noCampaign` to the `Dictionaries` interface's `pledge` block:

```ts
  pledge: {
    homeCard: {
      title: string;
      description: string;
    };
    noCampaign: {
      title: string;
      body: string;
    };
  };
```

- [ ] **Step 4: Write the implementation**

In `frontend/src/pages/PledgePage.tsx`, add imports:

```tsx
import { useI18n } from '../i18n/I18nProvider';
import { useActiveCampaign } from '../hooks/useActiveCampaign';
```

Inside the component, alongside the existing state:

```tsx
  const { lang, t } = useI18n();
  const { campaign, loading: campaignLoading } = useActiveCampaign();
```

After the existing `if (success) { ... }` block, add:

```tsx
  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // No live drive: say so, rather than showing a form whose submission the
  // server would refuse with a 503.
  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{t('pledge.noCampaign.title')}</h1>
          <p className="text-gray-600">{t('pledge.noCampaign.body')}</p>
        </div>
      </div>
    );
  }

  const campaignName = (lang === 'ti' && campaign.name_ti) || campaign.name;
  const campaignDescription =
    (lang === 'ti' && campaign.description_ti) || campaign.description;
```

Then, in the hero block, replace the heading and subheading expressions so the running drive names the page:

```tsx
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {campaignName}
            </h1>
            <p className="text-xl md:text-2xl mb-6 opacity-90">
              {campaignDescription || 'Support our church with your generous pledge'}
            </p>
```

Finally, pass the campaign to the tracker (its props land in Task 9):

```tsx
              <PledgeTracker
                campaignId={campaign.id}
                goalAmount={campaign.goal_amount ? parseFloat(campaign.goal_amount) : undefined}
                showRecentPledges={true}
                compact={false}
              />
```

Note the existing `eventName` variable from `?event=` still feeds `PledgeForm`; leave that alone.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="PledgePage" --watchAll=false`
Expected: PASS. TypeScript will still flag `campaignId`/`goalAmount` on `PledgeTracker` until Task 9 adds them — that is expected and Task 9 closes it.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/PledgePage.tsx frontend/src/pages/__tests__/PledgePage.test.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat: name the pledge page after the running drive, explain when none is"
```

---

### Task 9: Scope the tracker to the campaign and show goal progress

**Files:**
- Modify: `frontend/src/components/PledgeTracker.tsx`
- Modify: `frontend/src/components/__tests__/PledgeTracker.test.tsx` — **existing tests must be updated, not left failing**

**Interfaces:**
- Consumes: `campaignId` and `goalAmount` passed by `PledgePage` (Task 8)
- Produces: `PledgeTrackerProps { campaignId?: number; goalAmount?: number; showRecentPledges?: boolean; compact?: boolean }` — the `eventName` prop is removed

- [ ] **Step 1: Update the existing test file**

In `frontend/src/components/__tests__/PledgeTracker.test.tsx`, change `renderTracker` to pass the new props and append two cases:

```tsx
const renderTracker = () => render(
  <I18nProvider>
    <LanguageProvider>
      <PledgeTracker campaignId={7} goalAmount={10000} showRecentPledges={true} compact={false} />
    </LanguageProvider>
  </I18nProvider>
);
```

Append inside the existing `describe('PledgeTracker', ...)`:

```tsx
  it('requests only the given campaign', async () => {
    renderTracker();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('campaign_id=7');
    // The legacy free-text filter is gone; campaign scoping replaces it.
    expect(url).not.toContain('event_name');
  });

  it('shows progress toward the campaign goal', async () => {
    renderTracker();

    // $5,000 pledged against a $10,000 goal.
    expect(await screen.findByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText(/\$10,000/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="PledgeTracker" --watchAll=false`
Expected: FAIL — the URL has no `campaign_id`, and no goal figure renders.

- [ ] **Step 3: Write the implementation**

In `frontend/src/components/PledgeTracker.tsx`, replace the props interface and signature:

```tsx
interface PledgeTrackerProps {
  /** Scopes every figure to one drive. Without it the tracker would total
      every pledge ever recorded, including closed historical campaigns. */
  campaignId?: number;
  /** Drives the goal progress bar. Absent when the campaign has no goal. */
  goalAmount?: number;
  showRecentPledges?: boolean;
  compact?: boolean;
}

const PledgeTracker: React.FC<PledgeTrackerProps> = ({
  campaignId,
  goalAmount,
  showRecentPledges = true,
  compact = false
}) => {
```

Replace the query-building lines in `fetchStats`:

```tsx
      const params = new URLSearchParams();
      if (campaignId) {
        params.append('campaign_id', String(campaignId));
      }
```

and change the callback's dependency array from `[eventName, t]` to:

```tsx
  }, [campaignId, t]);
```

Then add the goal progress block immediately after the existing "Fulfillment Progress" section:

```tsx
      {/* Progress toward the campaign's goal — distinct from fulfillment,
          which measures money collected against money pledged. */}
      {goalAmount ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{t('pledgeTracker.goalProgress')}</span>
            <span className="text-sm text-gray-600">
              {formatCurrency(stats.total_pledged)} / {formatCurrency(goalAmount)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-primary-600 h-3 rounded-full transition-all"
              style={{ width: `${Math.min(100, (stats.total_pledged / goalAmount) * 100)}%` }}
            ></div>
          </div>
          <div className="mt-1 text-right text-sm font-semibold text-primary-700">
            {((stats.total_pledged / goalAmount) * 100).toFixed(0)}%
          </div>
        </div>
      ) : null}
```

Add the string to `frontend/src/i18n/dictionaries.ts` in the existing `pledgeTracker` blocks — `en`: `goalProgress: "Goal Progress",`; `ti` (draft): `goalProgress: "ኣብ ሸቶ ዝበጽሐ",`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="PledgeTracker" --watchAll=false`
Expected: PASS

- [ ] **Step 5: Confirm no caller still passes `eventName`**

Run: `cd frontend && grep -rn "eventName" src/components/PledgeTracker.tsx src/pages/PledgePage.tsx`
Expected: matches only in `PledgePage.tsx`, and only for `PledgeForm` — none for `PledgeTracker`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PledgeTracker.tsx frontend/src/components/__tests__/PledgeTracker.test.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat: scope the pledge tracker to one campaign and show goal progress"
```

---

### Task 10: Admin Fundraising tab

**Files:**
- Create: `frontend/src/components/admin/FundraisingCampaigns.tsx`
- Create: `frontend/src/components/admin/__tests__/FundraisingCampaigns.test.tsx`
- Modify: `frontend/src/components/admin/AdminDashboard.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `fetchAllCampaigns`, `createCampaign`, `updateCampaign`, `AdminCampaign`, `CampaignInput` from Task 6

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/__tests__/FundraisingCampaigns.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { I18nProvider } from '../../../i18n/I18nProvider';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import FundraisingCampaigns from '../FundraisingCampaigns';

const mockFetchAll = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../../../utils/pledgeCampaignApi', () => ({
  fetchAllCampaigns: () => mockFetchAll(),
  createCampaign: (input: unknown) => mockCreate(input),
  updateCampaign: (id: number, input: unknown) => mockUpdate(id, input)
}));

const CAMPAIGN = {
  id: 7, slug: 'test-drive', name: 'Test Drive', name_ti: null,
  description: null, description_ti: null,
  start_date: '2026-01-01', end_date: '2026-12-31',
  goal_amount: '50000.00', currency: 'usd', status: 'draft' as const,
  default_payment_type: 'pledge_drive', income_category_id: null,
  totals: null
};

const renderTab = () => render(
  <I18nProvider><LanguageProvider><FundraisingCampaigns /></LanguageProvider></I18nProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchAll.mockResolvedValue([CAMPAIGN]);
  mockCreate.mockResolvedValue({ ...CAMPAIGN, id: 8, name: 'New Drive' });
  mockUpdate.mockResolvedValue({ ...CAMPAIGN, status: 'active' });
});

describe('FundraisingCampaigns', () => {
  it('lists existing campaigns with their window and status', async () => {
    renderTab();

    expect(await screen.findByText('Test Drive')).toBeInTheDocument();
    expect(screen.getByText(/2026-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it('creates a campaign from the form', async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByText('Test Drive');

    await user.click(screen.getByRole('button', { name: /new campaign/i }));
    await user.type(screen.getByLabelText(/^name/i), 'Building Drive');
    await user.type(screen.getByLabelText(/start date/i), '2027-01-01');
    await user.type(screen.getByLabelText(/end date/i), '2027-12-31');
    await user.type(screen.getByLabelText(/goal amount/i), '75000');
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      name: 'Building Drive',
      start_date: '2027-01-01',
      end_date: '2027-12-31',
      goal_amount: 75000,
      // Derived from the name so an admin never has to invent one.
      slug: 'building-drive'
    });
  });

  it('surfaces the overlap conflict message from the server', async () => {
    const user = userEvent.setup();
    mockUpdate.mockRejectedValue(
      new Error('Existing Drive (2026-01-01 – 2026-06-30) is already active for these dates.')
    );
    renderTab();
    await screen.findByText('Test Drive');

    await user.click(screen.getByRole('button', { name: /activate/i }));

    expect(await screen.findByText(/already active for these dates/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="FundraisingCampaigns" --watchAll=false`
Expected: FAIL — `Cannot find module '../FundraisingCampaigns'`

- [ ] **Step 3: Add the strings**

In `frontend/src/i18n/dictionaries.ts`, add a top-level `fundraising` block to `en` and `ti`, and to the `Dictionaries` interface.

`en`:

```ts
  fundraising: {
    tab: "Fundraising",
    heading: "Fundraising Campaigns",
    newCampaign: "New Campaign",
    name: "Name",
    nameTi: "Name (Tigrigna)",
    description: "Description",
    descriptionTi: "Description (Tigrigna)",
    startDate: "Start date",
    endDate: "End date",
    goalAmount: "Goal amount",
    status: "Status",
    window: "Dates",
    pledged: "Pledged",
    save: "Save",
    cancel: "Cancel",
    activate: "Activate",
    close: "Close campaign",
    closeWarning: "Closing a campaign is permanent — it becomes read-only history.",
    endBeforeStart: "The end date must be on or after the start date.",
    noCampaigns: "No campaigns yet. Create one to start a drive."
  },
```

`ti` (drafts, flagged in Task 11):

```ts
  fundraising: {
    tab: "ወፈያ",
    heading: "መደባት ወፈያ",
    newCampaign: "ሓድሽ መደብ",
    name: "ስም",
    nameTi: "ስም (ትግርኛ)",
    description: "መግለጺ",
    descriptionTi: "መግለጺ (ትግርኛ)",
    startDate: "መጀመሪ ዕለት",
    endDate: "መወዳእታ ዕለት",
    goalAmount: "ሸቶ መጠን",
    status: "ኩነታት",
    window: "ዕለታት",
    pledged: "ተመባጺዑ",
    save: "ኣቐምጥ",
    cancel: "ሰርዝ",
    activate: "ኣንቅሕ",
    close: "መደብ ዕጾ",
    closeWarning: "መደብ ምዕጻው ቀዋሚ እዩ — ከም ታሪኽ ንንባብ ጥራይ ይኸውን።",
    endBeforeStart: "መወዳእታ ዕለት ካብ መጀመሪ ዕለት ንድሕሪት ክኸውን የብሉን።",
    noCampaigns: "ጌና መደባት የለዉን። ንምጅማር ሓደ ፍጠሩ።"
  },
```

Interface addition:

```ts
  fundraising: {
    tab: string;
    heading: string;
    newCampaign: string;
    name: string;
    nameTi: string;
    description: string;
    descriptionTi: string;
    startDate: string;
    endDate: string;
    goalAmount: string;
    status: string;
    window: string;
    pledged: string;
    save: string;
    cancel: string;
    activate: string;
    close: string;
    closeWarning: string;
    endBeforeStart: string;
    noCampaigns: string;
  };
```

- [ ] **Step 4: Write the implementation**

Create `frontend/src/components/admin/FundraisingCampaigns.tsx`:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  fetchAllCampaigns, createCampaign, updateCampaign,
  AdminCampaign, CampaignInput
} from '../../utils/pledgeCampaignApi';

/** Admins should never have to invent a slug; the name gives a good one. */
const slugify = (name: string): string =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const emptyForm = {
  name: '', name_ti: '', description: '', description_ti: '',
  start_date: '', end_date: '', goal_amount: ''
};

const FundraisingCampaigns: React.FC = () => {
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCampaigns(await fetchAllCampaigns());
    } catch (err: any) {
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (form.end_date && form.end_date < form.start_date) {
      setError(t('fundraising.endBeforeStart'));
      return;
    }

    const input: CampaignInput = {
      slug: slugify(form.name),
      name: form.name,
      name_ti: form.name_ti || null,
      description: form.description || null,
      description_ti: form.description_ti || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      goal_amount: form.goal_amount ? parseFloat(form.goal_amount) : null,
      // Routes drive money to its own GL code instead of the INC999 fallback.
      default_payment_type: 'pledge_drive',
      status: 'draft'
    };

    try {
      setError(null);
      await createCampaign(input);
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to create the campaign');
    }
  };

  // The 409 body names the conflicting drive, so show the server's message
  // verbatim rather than a generic failure.
  const handleStatus = async (campaign: AdminCampaign, status: 'active' | 'closed') => {
    try {
      setError(null);
      await updateCampaign(campaign.id, { status });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update the campaign');
    }
  };

  const field = (key: keyof typeof emptyForm, label: string, type = 'text') => (
    <div>
      <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        id={key}
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded-md border-gray-300 shadow-sm"
      />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">{t('fundraising.heading')}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          {t('fundraising.newCampaign')}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-8 bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('name', t('fundraising.name'))}
          {field('name_ti', t('fundraising.nameTi'))}
          {field('description', t('fundraising.description'))}
          {field('description_ti', t('fundraising.descriptionTi'))}
          {field('start_date', t('fundraising.startDate'), 'date')}
          {field('end_date', t('fundraising.endDate'), 'date')}
          {field('goal_amount', t('fundraising.goalAmount'), 'number')}
          <div className="md:col-span-2 flex gap-3">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              {t('fundraising.save')}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="px-4 py-2 border border-gray-300 rounded-md"
            >
              {t('fundraising.cancel')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">…</div>
      ) : campaigns.length === 0 ? (
        <div className="py-8 text-center text-gray-500">{t('fundraising.noCampaigns')}</div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-900">{campaign.name}</div>
                <div className="text-sm text-gray-600">
                  {campaign.start_date} – {campaign.end_date || '—'}
                </div>
                <div className="text-sm text-gray-500 capitalize">{campaign.status}</div>
              </div>
              <div className="text-right">
                {campaign.totals && (
                  <div className="text-sm text-gray-700">
                    {t('fundraising.pledged')}: ${campaign.totals.total_pledged ?? '0'}
                  </div>
                )}
                <div className="mt-2 flex gap-2 justify-end">
                  {campaign.status === 'draft' && (
                    <button
                      onClick={() => handleStatus(campaign, 'active')}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      {t('fundraising.activate')}
                    </button>
                  )}
                  {campaign.status === 'active' && (
                    <button
                      onClick={() => {
                        if (window.confirm(t('fundraising.closeWarning'))) {
                          handleStatus(campaign, 'closed');
                        }
                      }}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md"
                    >
                      {t('fundraising.close')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FundraisingCampaigns;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --testPathPattern="FundraisingCampaigns" --watchAll=false`
Expected: PASS

- [ ] **Step 6: Wire the tab into AdminDashboard**

In `frontend/src/components/admin/AdminDashboard.tsx`:

Add the import beside the other panel imports:

```tsx
import FundraisingCampaigns from './FundraisingCampaigns';
```

Extend the `activeTab` union on line 17 with `'fundraising'`:

```tsx
  const [activeTab, setActiveTab] = useState<'members' | 'roles' | 'departments' | 'activity-logs' | 'voicemails' | 'reports' | 'survey-report' | 'fundraising'>('members');
```

Add a case in `renderContent`'s switch, before `default`:

```tsx
      case 'fundraising':
        // Campaign create/update is admin-only at the API; mirror that here.
        return isAdmin ? <FundraisingCampaigns /> : <div className="p-4 text-center text-gray-500">Access Denied</div>;
```

Add the tab button inside the `<nav>`, following the existing `isAdmin &&` pattern:

```tsx
            {isAdmin && (
              <button
                onClick={() => setActiveTab('fundraising')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'fundraising'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <i className="fas fa-hand-holding-heart mr-2"></i>
                {t('fundraising.tab')}
              </button>
            )}
```

- [ ] **Step 7: Verify the dashboard still compiles and renders**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "AdminDashboard|FundraisingCampaigns|PledgeTracker|PledgePage|QuickLinks"`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin/FundraisingCampaigns.tsx frontend/src/components/admin/__tests__/FundraisingCampaigns.test.tsx frontend/src/components/admin/AdminDashboard.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat: add the admin fundraising campaign tab"
```

---

### Task 11: Flag the Tigrigna drafts and verify the whole feature

**Files:**
- Modify: `tigrigna-translation-review.md`

- [ ] **Step 1: Append the review entry**

Add to the end of `tigrigna-translation-review.md`:

```markdown
## Fundraising campaigns (Aug 2026)

New `pledge.noCampaign.*`, `pledgeTracker.goalProgress`, and `fundraising.*`
keys. The `fundraising.*` strings are admin-facing; the `pledge.noCampaign.*`
pair is read by visitors when no drive is running. Campaign names and
descriptions themselves come from the database (`name_ti`, `description_ti`),
so those are entered by an admin, not translated here. Drafts by a non-native
speaker.

| Key | English | Tigrigna (draft) | Flag |
|-----|---------|------------------|------|
| pledge.noCampaign.title | No fundraising drive is running right now | ሕጂ ዝካየድ ዘሎ ወፈያ የለን | ⚠️ confirm "ወፈያ" is the right word for an organised pledge drive rather than a single offering |
| pledge.noCampaign.body | There is no active pledge drive at the moment… | ኣብዚ እዋን ንጡፍ መደብ መብጽዓ የለን። … | ⚠️ confirm "መደብ መብጽዓ" reads as "pledge programme/drive" |
| pledgeTracker.goalProgress | Goal Progress | ኣብ ሸቶ ዝበጽሐ | ⚠️ literally "what has reached the goal"; confirm it works as a progress-bar label |
| fundraising.tab | Fundraising | ወፈያ | ⚠️ same "ወፈያ" question as above, here as a short nav label |
| fundraising.activate | Activate | ኣንቅሕ | ⚠️ confirm this reads as "make live/switch on" rather than "wake up" |
| fundraising.closeWarning | Closing a campaign is permanent… | መደብ ምዕጻው ቀዋሚ እዩ… | ⚠️ confirm "ቀዋሚ" carries "permanent/irreversible" for a destructive action |
```

- [ ] **Step 2: Run the full backend suite**

Run: `cd backend && npm test`
Expected: PASS, 0 failures.

- [ ] **Step 3: Run the full frontend suite**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false`
Expected: PASS, 0 failures.

- [ ] **Step 4: Typecheck the frontend**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors in any file this plan touched. Pre-existing errors in `AuthContext.test.tsx`, `errorTracking.test.ts`, `analytics.test.ts`, and `RegistrationSteps.test.tsx` are unrelated and were there before — do not fix them here.

- [ ] **Step 5: Verify end to end against a running stack**

With the backend and frontend running locally:

```bash
# No campaign live yet: the home card is absent and /pledge explains itself.
curl -s localhost:5001/api/pledge-campaigns/active
# Expect: {"success":true,"campaigns":[]}
```

Then, in the admin dashboard's Fundraising tab, create a campaign whose window
contains today and click **Activate**. Reload the home page: the card appears,
titled with the campaign's name. Follow it to `/pledge` and confirm the tracker
shows that campaign's totals and its goal bar — **not** the 2025 drive's
$70,119. Try activating a second overlapping campaign and confirm the inline
409 message names the first.

- [ ] **Step 6: Commit**

```bash
git add tigrigna-translation-review.md
git commit -m "docs: flag fundraising campaign Tigrigna drafts for review"
```

---

## Self-Review Notes

**Spec coverage:** §3 live rule → Task 1. §4 overlap incl. all three write paths → Task 3. §5.1 `/active` date filter and defensive ordering → Tasks 1–2. §5.2 stats filter → Task 4. §5.3 pledge binding → Task 5. §6 admin UI → Task 10. §7.1 hook → Task 6. §7.2 conditional card → Task 7. §7.3 empty state → Task 8. §7.4 tracker scoping + goal bar → Task 9. §8 testing → distributed, with the timezone case in Task 1 and fail-closed in Task 7. Bilingual requirement → Tasks 8, 9, 10; review flagging → Task 11.

**Not covered by any task, by design:** everything in spec §9 (out of scope).
