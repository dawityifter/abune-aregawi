# Pledge Executive Read API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the corrected pledge aggregates through three read endpoints, with donor-name access tiering and small-number suppression, so Plan 3 can build the executive dashboard against a stable contract.

**Architecture:** Three new read-only endpoints on the existing `pledge-campaigns` router, all reading Plan 1's views (`campaign_totals`, `campaign_status_totals`, `pledge_balances`) plus `countActiveHouseholds()`. One new privacy module owns the tier rules and the suppression threshold so no endpoint reinvents them. Derived figures (day-of-campaign, pace, run-rate, gap-to-goal) are computed in the controller, not in SQL. **Purely additive** — no existing endpoint changes behaviour.

**Tech Stack:** Node/Express, Sequelize, PostgreSQL (Supabase) in production, sqlite in-memory under Jest, Firebase Admin auth, `roleMiddleware`.

**Spec:** `docs/PLEDGE_DASHBOARD_SPEC.md` — §5 (executive band), §6 (year-over-year), §7 (charts), §8 (access tiers and privacy rules), §10 (attention panel), §12 (phasing). This is Plan 2 of 5; Plan 1 (`2026-09-21-pledge-metric-integrity.md`) is complete and merged into this branch.

## Global Constraints

- **Purely additive.** No existing endpoint's response shape or auth may change. In particular `GET /api/pledges/stats` stays exactly as it is — tightening its public payload is **Plan 5's** job (spec §12), because the public `PledgeTracker` still renders the section that would be removed.
- **Tier 3 (may see donor names): `admin`, `treasurer`, `bookkeeper`, `ar_team`.** Tier 2 (aggregates only): the remaining view roles — `church_leadership`, `secretary`, `auditor`, `budget_committee`, `ap_team`. Decided in spec §8; `bookkeeper`/`ar_team` are tier 3 because `pledgeRoutes.js:58` already grants them pledge edit rights, and you cannot cancel a pledge you cannot identify.
- **Small-number suppression: any figure derived from 1–4 pledges is `null` for tier 2.** Zero is never suppressed — it reveals nothing. One threshold, defined once, in the privacy module.
- **Never use the raw netted `campaign_totals.outstanding` in a response.** It nets one member's over-payment against another's shortfall. The API field is `outstanding_owed`, sourced from `outstanding_positive`, with `overpaid` reported beside it.
- **No raw SQL month/date formatting.** `to_char` is Postgres-only and `strftime` is SQLite-only. Fetch rows and group in JavaScript.
- Money columns are `DECIMAL(10,2)` and arrive from Sequelize **as strings**. Always `parseFloat` before arithmetic, and return JSON numbers, not strings.
- **Never real member PII in tests.** Invented names; phone numbers in the reserved fictional block **555-0100 – 555-0199** (e.g. `+15555550100`). The pre-commit guard exempts that block by value, so **no `ALLOWLIST_RE` entry is needed or wanted** — adding one would be a regression against Plan 1's ruling 11.
- Tests run with `DATABASE_URL=sqlite::memory: NODE_ENV=test`. Never point anything at a `DATABASE_URL` containing `supabase.com`.
- Jest is pinned to `maxWorkers: 1` (the suite is not parallel-safe). Do not raise it.
- Dates use the church timezone via `todayInChurchTz()` from `src/services/pledgeCampaignService.js`, never `new Date()` directly for day-of-campaign maths.

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/services/pledgeDashboardPrivacy.js` | **new** — tier resolution and the suppression threshold. The single place either rule is expressed. |
| `backend/src/services/pledgeDashboardService.js` | **new** — assembles the dashboard snapshot, the attention counts, the monthly series and the comparison payload from the views. All read-only. |
| `backend/src/controllers/pledgeDashboardController.js` | **new** — three handlers; HTTP shape, status codes, error handling. |
| `backend/src/routes/pledgeCampaignRoutes.js` | modify — three route registrations. |
| `backend/tests/integration/pledgeDashboard*.test.js` | **new** — one file per endpoint. |

Service and controller are split because the service is pure data assembly that Plan 3's tests and any future export job can reuse, while the controller owns request/response concerns. This mirrors `routes/ → controllers/ → services/ → models/` as described in `backend/CLAUDE.md`.

---

### Task 1: Privacy module — tiers and suppression

Every later task depends on these two rules, and the spec is emphatic that they be expressed once. Tier membership decides whether donor-identifying detail may be returned at all; suppression blanks any figure computed from a group small enough to identify someone. At 310 households and ~150 pledges, "2 pledges over-paid by $340" is functionally a name.

**Files:**
- Create: `backend/src/services/pledgeDashboardPrivacy.js`
- Test: `backend/tests/unit/pledgeDashboardPrivacy.test.js`

**Interfaces:**
- Consumes: nothing — first task.
- Produces:
  - `TIER3_ROLES` — `string[]`
  - `SMALL_GROUP_THRESHOLD` — `number` (5)
  - `canSeeDonors(req)` → `boolean`
  - `suppressSmall(value, groupSize, canSee)` → same type as `value`, or `null`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pledgeDashboardPrivacy.test.js`:

```js
const {
  TIER3_ROLES, SMALL_GROUP_THRESHOLD, canSeeDonors, suppressSmall
} = require('../../src/services/pledgeDashboardPrivacy');

describe('pledge dashboard privacy rules', () => {
  describe('canSeeDonors', () => {
    it('admits the four tier-3 roles', () => {
      ['admin', 'treasurer', 'bookkeeper', 'ar_team'].forEach((role) => {
        expect(canSeeDonors({ user: { roles: [role] } })).toBe(true);
      });
    });

    it('refuses ap_team, which has no pledge edit rights', () => {
      expect(canSeeDonors({ user: { roles: ['ap_team'] } })).toBe(false);
    });

    it('refuses the other aggregate-only view roles', () => {
      ['church_leadership', 'secretary', 'auditor', 'budget_committee'].forEach((role) => {
        expect(canSeeDonors({ user: { roles: [role] } })).toBe(false);
      });
    });

    it('admits a user whose tier-3 role is one of several', () => {
      expect(canSeeDonors({ user: { roles: ['secretary', 'treasurer'] } })).toBe(true);
    });

    // roleMiddleware falls back to the singular `role` when `roles` is absent;
    // mirror that exactly or the two disagree about who a user is.
    it('falls back to the singular role field', () => {
      expect(canSeeDonors({ user: { role: 'treasurer' } })).toBe(true);
      expect(canSeeDonors({ user: { role: 'ap_team' } })).toBe(false);
    });

    it('refuses an unauthenticated request', () => {
      expect(canSeeDonors({})).toBe(false);
      expect(canSeeDonors({ user: null })).toBe(false);
    });
  });

  describe('suppressSmall', () => {
    it('blanks a figure drawn from fewer than five pledges', () => {
      expect(suppressSmall(340, 2, false)).toBeNull();
      expect(suppressSmall(340, 4, false)).toBeNull();
    });

    it('keeps a figure at the threshold and above', () => {
      expect(suppressSmall(340, 5, false)).toBe(340);
      expect(suppressSmall(340, 47, false)).toBe(340);
    });

    // Zero identifies nobody, and blanking it would read as "unknown" when the
    // true answer is "none" — the exact confusion spec section 11 warns about.
    it('never blanks a zero-sized group', () => {
      expect(suppressSmall(0, 0, false)).toBe(0);
    });

    it('returns the value untouched for a tier-3 caller', () => {
      expect(suppressSmall(340, 2, true)).toBe(340);
    });

    it('applies to counts as well as amounts', () => {
      expect(suppressSmall(3, 3, false)).toBeNull();
    });
  });

  it('exports the threshold so no caller hardcodes 5', () => {
    expect(SMALL_GROUP_THRESHOLD).toBe(5);
    expect(TIER3_ROLES).toEqual(['admin', 'treasurer', 'bookkeeper', 'ar_team']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/unit/pledgeDashboardPrivacy.test.js`

Expected: FAIL — `Cannot find module '../../src/services/pledgeDashboardPrivacy'`.

- [ ] **Step 3: Write the module**

Create `backend/src/services/pledgeDashboardPrivacy.js`:

```js
'use strict';

/**
 * The two privacy rules the executive dashboard runs on, in one place.
 *
 * Tier 3 may see donor names. It is NOT the same list as pledgeRoutes.js's
 * viewRoles, and deliberately so: bookkeeper and ar_team sit here because
 * editRoles already lets them change and cancel individual pledges, and you
 * cannot cancel a pledge you are not allowed to identify. ap_team holds no
 * edit rights and stays aggregate-only. See spec section 8.
 */
const TIER3_ROLES = ['admin', 'treasurer', 'bookkeeper', 'ar_team'];

/**
 * Below this many pledges, a figure is treated as identifying and withheld
 * from tier 2. At roughly 310 households, "2 pledges over-paid by $340" names
 * someone to anyone who knows the parties.
 */
const SMALL_GROUP_THRESHOLD = 5;

/**
 * Mirrors roleMiddleware's own resolution — array `roles` when present, else
 * the singular `role`. If the two ever disagree about who a user is, the
 * route guard and the payload filter disagree too.
 */
const canSeeDonors = (req) => {
  const user = req?.user;
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [user.role];
  return roles.some((role) => TIER3_ROLES.includes(role));
};

/**
 * Returns `value`, or null when the group behind it is small enough to
 * identify a donor and the caller is not tier 3.
 *
 * A zero-sized group is never suppressed: zero reveals nothing, and blanking
 * it would render as "unknown" when the honest answer is "none".
 */
const suppressSmall = (value, groupSize, canSee) => {
  if (canSee) return value;
  if (groupSize > 0 && groupSize < SMALL_GROUP_THRESHOLD) return null;
  return value;
};

module.exports = { TIER3_ROLES, SMALL_GROUP_THRESHOLD, canSeeDonors, suppressSmall };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/unit/pledgeDashboardPrivacy.test.js`

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/pledgeDashboardPrivacy.js backend/tests/unit/pledgeDashboardPrivacy.test.js
git commit -m "feat(pledges): one home for the dashboard's tier and suppression rules

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Dashboard snapshot endpoint

The executive band in one request. A single snapshot matters beyond round-trip count: spec §11 rule 9 requires an "as of HH:MM" reading with manual refresh, and figures fetched separately could disagree mid-render.

**Files:**
- Create: `backend/src/services/pledgeDashboardService.js`
- Create: `backend/src/controllers/pledgeDashboardController.js`
- Modify: `backend/src/routes/pledgeCampaignRoutes.js`
- Test: `backend/tests/integration/pledgeDashboardSnapshot.test.js`

**Interfaces:**
- Consumes: `canSeeDonors`, `suppressSmall` from Task 1. `CampaignTotal`, `CampaignStatusTotal`, `PledgeCampaign` models and `countActiveHouseholds()` from Plan 1.
- Produces:
  - `buildSnapshot(campaignId, { canSee })` in `pledgeDashboardService.js` → the `dashboard` object below.
  - `GET /api/pledge-campaigns/:id/dashboard` → `{ success: true, dashboard }`.
  - Task 3 adds an `attention` key to the same object; Tasks 4 and 5 are separate endpoints.

Response contract (Plan 3 builds against this):

```js
{
  campaign: { id, slug, name, name_ti, start_date, end_date, status, goal_amount },
  timeline: { day, total_days, days_remaining, elapsed_fraction },
  money: {
    pledged, collected, outstanding_owed, overpaid, goal,
    gap_to_goal, percent_to_goal, fulfillment_rate,
    linear_pace_target, required_run_rate
  },
  participation: {
    households, active_households, rate,
    anonymous_pledges, anonymous_collected, family_id_populated
  },
  breakdown: [ { status, pledge_count, household_count, total_pledged, total_collected, outstanding_owed } ],
  as_of: "<ISO timestamp>"
}
```

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/pledgeDashboardSnapshot.test.js`:

```js
const request = require('supertest');
const {
  sequelize, PledgeCampaign, Pledge, Member, Transaction, PledgeAllocation
} = require('../../src/models');

jest.mock('../../src/middleware/auth', () => ({
  firebaseAuthMiddleware: (req, res, next) => {
    req.user = global.__TEST_USER__ || { role: 'treasurer', roles: ['treasurer'] };
    next();
  }
}));

const app = require('../../src/server');

describe('GET /api/pledge-campaigns/:id/dashboard', () => {
  let campaign, head, spouse;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    global.__TEST_USER__ = { role: 'treasurer', roles: ['treasurer'] };
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026 Pledge Drive',
      start_date: '2026-09-01', end_date: '2026-12-31',
      goal_amount: 100000, status: 'active'
    });
    head = await Member.create({
      first_name: 'Abraham', last_name: 'Tesfaye', phone_number: '+15555550100',
      email: 'abraham@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-abraham', family_id: null
    });
    spouse = await Member.create({
      first_name: 'Selam', last_name: 'Tesfaye', phone_number: '+15555550101',
      email: 'selam@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-selam', family_id: head.id
    });
  });

  const pledgeFor = async (memberId, amount) => Pledge.create({
    amount, first_name: 'X', last_name: 'Y', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: memberId, fulfillment_intent: 'immediate'
  });

  const pay = async (pledge, amount) => {
    const txn = await Transaction.create({
      member_id: head.id, collected_by: head.id, payment_date: '2026-09-15',
      amount, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: head.id
    });
  };

  const get = () => request(app).get(`/api/pledge-campaigns/${campaign.id}/dashboard`);

  it('reports money with outstanding_owed clamped and overpaid reported beside it', async () => {
    const over = await pledgeFor(head.id, 1000);
    await pay(over, 1200);                 // overshoots by 200
    const short = await pledgeFor(spouse.id, 5000);
    await pay(short, 1000);                // still owes 4000

    const res = await get();
    expect(res.status).toBe(200);
    const { money } = res.body.dashboard;

    expect(money.pledged).toBe(6000);
    expect(money.collected).toBe(2200);
    // The netted figure would be 3800. The honest one is 4000.
    expect(money.outstanding_owed).toBe(4000);
    expect(money.overpaid).toBe(200);
    expect(money.goal).toBe(100000);
    expect(money.gap_to_goal).toBe(97800);
  });

  it('counts a family once in participation and reports anonymous gifts beside it', async () => {
    await pledgeFor(head.id, 1000);
    await pledgeFor(spouse.id, 500);
    await Pledge.create({
      amount: 750, first_name: 'Anonymous', last_name: 'Giver',
      pledge_type: 'fundraising', campaign_id: campaign.id, member_id: null,
      is_anonymous: true, fulfillment_intent: 'immediate', baptism_name: 'Gebre Mesqel'
    });

    const res = await get();
    const { participation } = res.body.dashboard;

    expect(participation.households).toBe(1);        // one family, two members
    expect(participation.active_households).toBe(1); // one head, spouse is linked
    expect(participation.anonymous_pledges).toBe(1); // reported, not folded in
    expect(participation.family_id_populated).toBe(true);
  });

  it('never reports participation above 100 percent when a pledger is deactivated', async () => {
    await pledgeFor(head.id, 1000);
    const departed = await Member.create({
      first_name: 'Yonas', last_name: 'Gebre', phone_number: '+15555550102',
      email: 'yonas@example.com', is_active: false, role: 'member',
      firebase_uid: 'uid-yonas', family_id: null
    });
    await pledgeFor(departed.id, 500);

    const res = await get();
    const { participation } = res.body.dashboard;
    expect(participation.households).toBeLessThanOrEqual(participation.active_households);
    expect(participation.rate).toBeLessThanOrEqual(100);
  });

  it('computes the campaign timeline in days, not fractions of a year', async () => {
    const res = await get();
    const { timeline } = res.body.dashboard;
    expect(timeline.total_days).toBe(122);          // 2026-09-01 .. 2026-12-31
    expect(timeline.day).toBeGreaterThan(0);
    expect(timeline.day + timeline.days_remaining).toBe(122);
  });

  it('returns a status breakdown carrying both counts and dollars', async () => {
    const paid = await pledgeFor(head.id, 1000);
    await pay(paid, 1000);
    await pledgeFor(spouse.id, 800);

    const res = await get();
    const byStatus = Object.fromEntries(
      res.body.dashboard.breakdown.map((r) => [r.status, r])
    );
    expect(byStatus.fulfilled.pledge_count).toBe(1);
    expect(byStatus.fulfilled.total_collected).toBe(1000);
    expect(byStatus.not_started.pledge_count).toBe(1);
    expect(byStatus.not_started.outstanding_owed).toBe(800);
  });

  it('suppresses a small status bucket for a tier-2 caller but not for a treasurer', async () => {
    // Two pledges in one bucket: identifying at parish scale.
    await pledgeFor(head.id, 1000);
    await pledgeFor(spouse.id, 500);

    global.__TEST_USER__ = { role: 'ap_team', roles: ['ap_team'] };
    const tier2 = await get();
    const t2 = tier2.body.dashboard.breakdown.find((r) => r.status === 'not_started');
    expect(t2.total_pledged).toBeNull();
    expect(t2.pledge_count).toBeNull();

    global.__TEST_USER__ = { role: 'treasurer', roles: ['treasurer'] };
    const tier3 = await get();
    const t3 = tier3.body.dashboard.breakdown.find((r) => r.status === 'not_started');
    expect(t3.total_pledged).toBe(1500);
    expect(t3.pledge_count).toBe(2);
  });

  it('404s for a campaign that does not exist', async () => {
    const res = await request(app).get('/api/pledge-campaigns/999999/dashboard');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('stamps the snapshot with an as_of timestamp', async () => {
    const res = await get();
    expect(Date.parse(res.body.dashboard.as_of)).not.toBeNaN();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/pledgeDashboardSnapshot.test.js`

Expected: FAIL — every case 404s, because the route does not exist yet.

- [ ] **Step 3: Write the service**

Create `backend/src/services/pledgeDashboardService.js`:

```js
'use strict';

const {
  PledgeCampaign, CampaignTotal, CampaignStatusTotal
} = require('../models');
const { countActiveHouseholds, todayInChurchTz } = require('./pledgeCampaignService');
const { suppressSmall } = require('./pledgeDashboardPrivacy');

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value) => Math.round(value * 100) / 100;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayCount = (fromISO, toISO) =>
  Math.round((Date.parse(toISO) - Date.parse(fromISO)) / DAY_MS) + 1;

/**
 * Day-of-campaign maths in church time. A drive with no end_date has no total
 * and no remaining — an open-ended campaign has no pace to be behind.
 */
const buildTimeline = (campaign, today = todayInChurchTz()) => {
  const start = campaign.start_date;
  const end = campaign.end_date;
  const elapsed = Math.max(1, dayCount(start, today));
  if (!end) {
    return { day: elapsed, total_days: null, days_remaining: null, elapsed_fraction: null };
  }
  const total = dayCount(start, end);
  const day = Math.min(Math.max(elapsed, 1), total);
  return {
    day,
    total_days: total,
    days_remaining: total - day,
    elapsed_fraction: round2(day / total)
  };
};

const buildMoney = (totals, campaign, timeline) => {
  const pledged = num(totals?.total_pledged);
  const collected = num(totals?.total_collected);
  // outstanding_positive, never the netted `outstanding` — that one lets one
  // member's over-payment cancel another member's shortfall.
  const outstandingOwed = num(totals?.outstanding_positive);
  const overpaid = num(totals?.overpaid_amount);
  const goal = campaign.goal_amount == null ? null : num(campaign.goal_amount);

  const gapToGoal = goal == null ? null : round2(Math.max(goal - collected, 0));
  const percentToGoal = goal ? round2((collected / goal) * 100) : null;
  const fulfillmentRate = pledged ? round2((collected / pledged) * 100) : 0;

  const linearPaceTarget = (goal != null && timeline.elapsed_fraction != null)
    ? round2(goal * timeline.elapsed_fraction) : null;
  const requiredRunRate = (gapToGoal != null && timeline.days_remaining > 0)
    ? round2(gapToGoal / timeline.days_remaining) : null;

  return {
    pledged, collected, outstanding_owed: outstandingOwed, overpaid, goal,
    gap_to_goal: gapToGoal, percent_to_goal: percentToGoal,
    fulfillment_rate: fulfillmentRate,
    linear_pace_target: linearPaceTarget, required_run_rate: requiredRunRate
  };
};

const buildParticipation = async (totals) => {
  const { households: active, familyIdPopulated } = await countActiveHouseholds();
  const households = Number(totals?.household_count) || 0;
  return {
    households,
    active_households: active,
    rate: active ? round2((households / active) * 100) : 0,
    anonymous_pledges: Number(totals?.anonymous_pledge_count) || 0,
    anonymous_collected: num(totals?.anonymous_collected),
    family_id_populated: familyIdPopulated
  };
};

const buildBreakdown = (rows, canSee) => rows.map((row) => {
  const size = Number(row.pledge_count) || 0;
  return {
    status: row.status,
    pledge_count: suppressSmall(size, size, canSee),
    household_count: suppressSmall(Number(row.household_count) || 0, size, canSee),
    total_pledged: suppressSmall(num(row.total_pledged), size, canSee),
    total_collected: suppressSmall(num(row.total_collected), size, canSee),
    outstanding_owed: suppressSmall(num(row.outstanding_positive), size, canSee)
  };
});

/** Returns null when the campaign does not exist, so the controller can 404. */
const buildSnapshot = async (campaignId, { canSee }) => {
  const campaign = await PledgeCampaign.findByPk(campaignId);
  if (!campaign) return null;

  const [totals, statusRows] = await Promise.all([
    CampaignTotal.findByPk(campaignId),
    CampaignStatusTotal.findAll({ where: { campaign_id: campaignId }, order: [['status', 'ASC']] })
  ]);

  const timeline = buildTimeline(campaign);

  return {
    campaign: {
      id: String(campaign.id),
      slug: campaign.slug,
      name: campaign.name,
      name_ti: campaign.name_ti,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      status: campaign.status,
      goal_amount: campaign.goal_amount == null ? null : num(campaign.goal_amount)
    },
    timeline,
    money: buildMoney(totals, campaign, timeline),
    participation: await buildParticipation(totals),
    breakdown: buildBreakdown(statusRows, canSee),
    as_of: new Date().toISOString()
  };
};

module.exports = { buildSnapshot, buildTimeline, num, round2, dayCount };
```

- [ ] **Step 4: Write the controller**

Create `backend/src/controllers/pledgeDashboardController.js`:

```js
'use strict';

const { buildSnapshot } = require('../services/pledgeDashboardService');
const { canSeeDonors } = require('../services/pledgeDashboardPrivacy');

const getDashboard = async (req, res) => {
  try {
    const snapshot = await buildSnapshot(req.params.id, { canSee: canSeeDonors(req) });
    if (!snapshot) {
      return res.status(404).json({ success: false, message: 'Pledge campaign not found' });
    }
    return res.status(200).json({ success: true, dashboard: snapshot });
  } catch (error) {
    console.error('Error building pledge dashboard:', error);
    return res.status(500).json({
      success: false, message: 'Failed to build the pledge dashboard', error: error.message
    });
  }
};

module.exports = { getDashboard };
```

- [ ] **Step 5: Register the route**

In `backend/src/routes/pledgeCampaignRoutes.js`, add the controller import beside the existing one:

```js
const c = require('../controllers/pledgeCampaignController');
const dashboard = require('../controllers/pledgeDashboardController');
```

and add the route after the existing `/:id/totals` line, inside the authenticated section:

```js
router.get('/:id/totals', roleMiddleware(viewRoles), c.getTotals);
// Aggregates only — donor names never appear in this payload. Tier 2 callers
// additionally get small buckets blanked; see pledgeDashboardPrivacy.
router.get('/:id/dashboard', roleMiddleware(viewRoles), dashboard.getDashboard);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/pledgeDashboardSnapshot.test.js`

Expected: PASS, 8 tests.

- [ ] **Step 7: Run the pledge suite**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest --testPathPattern="pledge|campaign"`

Expected: PASS. Nothing existing should change — this task only adds.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/pledgeDashboardService.js backend/src/controllers/pledgeDashboardController.js backend/src/routes/pledgeCampaignRoutes.js backend/tests/integration/pledgeDashboardSnapshot.test.js
git commit -m "feat(pledges): executive dashboard snapshot endpoint

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Attention counts on the snapshot

Spec §10's attention panel: five counts, each a link into the filtered table. Counts only — the names live behind the tier-3 detail endpoint that already exists. This extends Task 2's endpoint rather than adding another, because it is part of the same snapshot and must agree with the rest of it.

**Files:**
- Modify: `backend/src/services/pledgeDashboardService.js`
- Test: `backend/tests/integration/pledgeDashboardAttention.test.js`

**Interfaces:**
- Consumes: Task 2's `buildSnapshot`.
- Produces: an `attention` key on the snapshot:
  `{ stalled, never_started, overpaid, unlinked, ending_soon }` — all integers, all suppressed for tier 2 when 1–4.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/pledgeDashboardAttention.test.js`:

```js
const request = require('supertest');
const {
  sequelize, PledgeCampaign, Pledge, Member, Transaction, PledgeAllocation
} = require('../../src/models');

jest.mock('../../src/middleware/auth', () => ({
  firebaseAuthMiddleware: (req, res, next) => {
    req.user = global.__TEST_USER__ || { role: 'treasurer', roles: ['treasurer'] };
    next();
  }
}));

const app = require('../../src/server');

describe('dashboard attention counts', () => {
  let campaign, member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    global.__TEST_USER__ = { role: 'treasurer', roles: ['treasurer'] };
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-09-01',
      end_date: '2026-12-31', goal_amount: 100000, status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15555550110',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  const pledgeFor = async (amount, overrides = {}) => Pledge.create({
    amount, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: member.id, fulfillment_intent: 'immediate',
    ...overrides
  });

  const pay = async (pledge, amount, paymentDate) => {
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: paymentDate,
      amount, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: member.id
    });
  };

  const attention = async () => {
    const res = await request(app).get(`/api/pledge-campaigns/${campaign.id}/dashboard`);
    return res.body.dashboard.attention;
  };

  it('counts a part-paid pledge with no payment in 60+ days as stalled', async () => {
    const stalled = await pledgeFor(5000);
    await pay(stalled, 1000, '2026-01-05');     // long ago
    const fresh = await pledgeFor(5000);
    await pay(fresh, 1000, todayISO());

    const a = await attention();
    expect(a.stalled).toBe(1);
  });

  it('counts pledges with nothing received', async () => {
    await pledgeFor(800);
    await pledgeFor(900);
    const a = await attention();
    expect(a.never_started).toBe(2);
  });

  it('counts over-paid pledges', async () => {
    const over = await pledgeFor(1000);
    await pay(over, 1200, todayISO());
    const a = await attention();
    expect(a.overpaid).toBe(1);
  });

  it('counts pledges with no linked member', async () => {
    await Pledge.create({
      amount: 400, first_name: 'Anonymous', last_name: 'Giver',
      pledge_type: 'fundraising', campaign_id: campaign.id, member_id: null,
      is_anonymous: true, fulfillment_intent: 'immediate', baptism_name: 'Gebre Mesqel'
    });
    const a = await attention();
    expect(a.unlinked).toBe(1);
  });

  it('excludes cancelled pledges from every attention count', async () => {
    const doomed = await pledgeFor(800);
    await doomed.update({ lifecycle: 'cancelled' });
    const a = await attention();
    expect(a.never_started).toBe(0);
  });

  it('flags a drive inside its final 30 days', async () => {
    await campaign.update({ end_date: addDays(todayISO(), 10) });
    const a = await attention();
    expect(a.ending_soon).toBe(true);

    await campaign.update({ end_date: addDays(todayISO(), 90) });
    const later = await attention();
    expect(later.ending_soon).toBe(false);
  });

  it('suppresses small attention counts for a tier-2 caller', async () => {
    const over = await pledgeFor(1000);
    await pay(over, 1200, todayISO());

    global.__TEST_USER__ = { role: 'ap_team', roles: ['ap_team'] };
    const a = await attention();
    expect(a.overpaid).toBeNull();
  });
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso, days) {
  return new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/pledgeDashboardAttention.test.js`

Expected: FAIL — `Cannot read properties of undefined (reading 'stalled')`; `attention` is not on the snapshot.

- [ ] **Step 3: Add the attention builder**

In `backend/src/services/pledgeDashboardService.js`, add `PledgeBalance` and `Pledge` to the model import:

```js
const {
  PledgeCampaign, CampaignTotal, CampaignStatusTotal, PledgeBalance, Pledge
} = require('../models');
```

Add this function above `buildSnapshot`:

```js
const STALLED_AFTER_DAYS = 60;
const ENDING_SOON_DAYS = 30;

/**
 * Five operational counts, derived from pledge_balances. Counts only — the
 * names behind them stay on the tier-3 detail route, so this payload is safe
 * for every view role (small buckets are still blanked for tier 2).
 *
 * Cancelled pledges are excluded from all of them: a retired pledge owes
 * nothing and needs no chasing.
 */
const buildAttention = async (campaignId, timeline, canSee) => {
  const balances = await PledgeBalance.findAll({
    where: { campaign_id: campaignId },
    include: [{ model: Pledge, as: 'pledge', attributes: ['member_id'], required: true }]
  });

  const live = balances.filter((b) => b.derived_status !== 'cancelled');
  const cutoff = Date.now() - STALLED_AFTER_DAYS * DAY_MS;

  const stalled = live.filter((b) =>
    b.derived_status === 'partially_fulfilled'
    && b.last_payment_at
    && Date.parse(b.last_payment_at) < cutoff).length;

  const neverStarted = live.filter((b) => b.derived_status === 'not_started').length;
  const overpaid = live.filter((b) => num(b.remaining_amount) < 0).length;
  const unlinked = live.filter((b) => b.member_id == null).length;

  return {
    stalled: suppressSmall(stalled, stalled, canSee),
    never_started: suppressSmall(neverStarted, neverStarted, canSee),
    overpaid: suppressSmall(overpaid, overpaid, canSee),
    unlinked: suppressSmall(unlinked, unlinked, canSee),
    ending_soon: timeline.days_remaining != null
      && timeline.days_remaining <= ENDING_SOON_DAYS
  };
};
```

Then add it to the returned snapshot, after `breakdown`:

```js
    breakdown: buildBreakdown(statusRows, canSee),
    attention: await buildAttention(campaignId, timeline, canSee),
    as_of: new Date().toISOString()
```

and add `buildAttention` to the module exports:

```js
module.exports = { buildSnapshot, buildTimeline, buildAttention, num, round2, dayCount };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/pledgeDashboardAttention.test.js`

Expected: PASS, 7 tests.

- [ ] **Step 5: Run the pledge suite**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest --testPathPattern="pledge|campaign"`

Expected: PASS, including Task 2's file.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/pledgeDashboardService.js backend/tests/integration/pledgeDashboardAttention.test.js
git commit -m "feat(pledges): attention counts on the dashboard snapshot

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Monthly collections series

Spec §7 chart 3: a single-series column chart of money received per month, current campaign only. Hidden entirely for historical drives rather than rendered empty — a drive with `is_historical` pledges has no payment dates at all, so its series would be a lie of omission.

**Files:**
- Modify: `backend/src/services/pledgeDashboardService.js`
- Modify: `backend/src/controllers/pledgeDashboardController.js`
- Modify: `backend/src/routes/pledgeCampaignRoutes.js`
- Test: `backend/tests/integration/pledgeDashboardMonthly.test.js`

**Interfaces:**
- Consumes: Task 1's privacy module; Plan 1's views.
- Produces:
  - `buildMonthlySeries(campaignId)` → `{ available: boolean, reason: string|null, months: [{ month, collected, cumulative }] }`
  - `GET /api/pledge-campaigns/:id/monthly` → `{ success: true, series }`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/pledgeDashboardMonthly.test.js`:

```js
const request = require('supertest');
const {
  sequelize, PledgeCampaign, Pledge, Member, Transaction, PledgeAllocation
} = require('../../src/models');

jest.mock('../../src/middleware/auth', () => ({
  firebaseAuthMiddleware: (req, res, next) => {
    req.user = { role: 'treasurer', roles: ['treasurer'] };
    next();
  }
}));

const app = require('../../src/server');

describe('GET /api/pledge-campaigns/:id/monthly', () => {
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
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-09-01',
      end_date: '2026-12-31', goal_amount: 100000, status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15555550120',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  const pledgeFor = async (amount, overrides = {}) => Pledge.create({
    amount, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: member.id, fulfillment_intent: 'immediate',
    ...overrides
  });

  const pay = async (pledge, amount, paymentDate, status = 'succeeded') => {
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: paymentDate,
      amount, payment_type: 'donation', payment_method: 'zelle', status
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: member.id
    });
  };

  const series = async () => {
    const res = await request(app).get(`/api/pledge-campaigns/${campaign.id}/monthly`);
    expect(res.status).toBe(200);
    return res.body.series;
  };

  it('groups receipts by calendar month and carries a running cumulative', async () => {
    const p = await pledgeFor(10000);
    await pay(p, 1000, '2026-09-10');
    await pay(p, 500, '2026-09-20');
    await pay(p, 2000, '2026-11-03');

    const s = await series();
    expect(s.available).toBe(true);
    expect(s.months).toEqual([
      { month: '2026-09', collected: 1500, cumulative: 1500 },
      { month: '2026-11', collected: 2000, cumulative: 3500 }
    ]);
  });

  it('ignores allocations whose transaction did not succeed', async () => {
    const p = await pledgeFor(10000);
    await pay(p, 1000, '2026-09-10');
    await pay(p, 5000, '2026-09-11', 'failed');

    const s = await series();
    expect(s.months).toEqual([{ month: '2026-09', collected: 1000, cumulative: 1000 }]);
  });

  it('nets a reversing allocation out of its month', async () => {
    const p = await pledgeFor(10000);
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-09-10',
      amount: 1000, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
    const original = await PledgeAllocation.create({
      pledge_id: p.id, transaction_id: txn.id, amount: 1000,
      source: 'treasurer_manual', allocated_by: member.id
    });
    await PledgeAllocation.create({
      pledge_id: p.id, transaction_id: txn.id, amount: -400,
      source: 'treasurer_manual', allocated_by: member.id,
      reverses_allocation_id: original.id, reason: 'partial refund'
    });

    const s = await series();
    expect(s.months).toEqual([{ month: '2026-09', collected: 600, cumulative: 600 }]);
  });

  it('reports unavailable for a drive whose pledges predate the allocation model', async () => {
    await pledgeFor(5000, { is_historical: true, legacy_status: 'fulfilled' });

    const s = await series();
    expect(s.available).toBe(false);
    expect(s.reason).toBe('historical_campaign');
    expect(s.months).toEqual([]);
  });

  it('returns an empty but available series for a drive with no payments yet', async () => {
    await pledgeFor(5000);
    const s = await series();
    expect(s.available).toBe(true);
    expect(s.months).toEqual([]);
  });

  it('404s for a campaign that does not exist', async () => {
    const res = await request(app).get('/api/pledge-campaigns/999999/monthly');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/pledgeDashboardMonthly.test.js`

Expected: FAIL — the route 404s on every case.

- [ ] **Step 3: Add the series builder**

In `backend/src/services/pledgeDashboardService.js`, extend the model import with `PledgeAllocation` and `Transaction`:

```js
const {
  PledgeCampaign, CampaignTotal, CampaignStatusTotal, PledgeBalance, Pledge,
  PledgeAllocation, Transaction
} = require('../models');
```

Add above `buildSnapshot`:

```js
/**
 * Money received per calendar month for one drive.
 *
 * Grouped in JavaScript rather than SQL on purpose: month extraction is
 * `to_char` on Postgres and `strftime` on SQLite, and this file has to run on
 * both. The row count is one per allocation for a single campaign — a few
 * hundred at parish scale — so the cost is irrelevant.
 *
 * Pre-allocation drives return available:false rather than an empty chart:
 * their fulfilment was a flag on the pledge with no payment date anywhere, so
 * an empty series would read as "nothing was collected" when in fact tens of
 * thousands were.
 */
const buildMonthlySeries = async (campaignId) => {
  const pledges = await Pledge.findAll({
    where: { campaign_id: campaignId },
    attributes: ['id', 'is_historical']
  });

  if (pledges.length && pledges.every((p) => p.is_historical)) {
    return { available: false, reason: 'historical_campaign', months: [] };
  }

  const allocations = await PledgeAllocation.findAll({
    where: { pledge_id: pledges.map((p) => p.id) },
    include: [{
      model: Transaction, as: 'transaction',
      attributes: ['payment_date', 'status'], required: true
    }]
  });

  const byMonth = new Map();
  allocations.forEach((a) => {
    if (a.transaction.status !== 'succeeded') return;
    const month = String(a.transaction.payment_date).slice(0, 7); // YYYY-MM
    byMonth.set(month, (byMonth.get(month) || 0) + num(a.amount));
  });

  let running = 0;
  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, collected]) => {
      running = round2(running + collected);
      return { month, collected: round2(collected), cumulative: running };
    });

  return { available: true, reason: null, months };
};
```

Add it to the exports:

```js
module.exports = {
  buildSnapshot, buildTimeline, buildAttention, buildMonthlySeries,
  num, round2, dayCount
};
```

- [ ] **Step 4: Add the handler**

In `backend/src/controllers/pledgeDashboardController.js`, extend the import and add the handler:

```js
const { buildSnapshot, buildMonthlySeries } = require('../services/pledgeDashboardService');
const { canSeeDonors } = require('../services/pledgeDashboardPrivacy');
const { PledgeCampaign } = require('../models');
```

```js
const getMonthly = async (req, res) => {
  try {
    const campaign = await PledgeCampaign.findByPk(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Pledge campaign not found' });
    }
    const series = await buildMonthlySeries(req.params.id);
    return res.status(200).json({ success: true, series });
  } catch (error) {
    console.error('Error building monthly pledge series:', error);
    return res.status(500).json({
      success: false, message: 'Failed to build the monthly series', error: error.message
    });
  }
};

module.exports = { getDashboard, getMonthly };
```

- [ ] **Step 5: Register the route**

In `backend/src/routes/pledgeCampaignRoutes.js`, below the dashboard route:

```js
router.get('/:id/monthly', roleMiddleware(viewRoles), dashboard.getMonthly);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/pledgeDashboardMonthly.test.js`

Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/pledgeDashboardService.js backend/src/controllers/pledgeDashboardController.js backend/src/routes/pledgeCampaignRoutes.js backend/tests/integration/pledgeDashboardMonthly.test.js
git commit -m "feat(pledges): monthly collections series endpoint

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Year-over-year comparison with capability flags

Spec §6. Two drives, the seven figures that survive honest comparison, a cumulative-pledged-by-day curve for both, and a `comparable` block telling the UI which comparisons it may render. The flags are the point: they let Plan 3 ship the chart once and light up more of it in 2027 without a rewrite, and they stop a future drive silently showing a zero bar where the answer is "unknown".

**Files:**
- Modify: `backend/src/services/pledgeDashboardService.js`
- Modify: `backend/src/controllers/pledgeDashboardController.js`
- Modify: `backend/src/routes/pledgeCampaignRoutes.js`
- Test: `backend/tests/integration/pledgeDashboardCompare.test.js`

**Interfaces:**
- Consumes: Task 1's privacy module; Plan 1's views.
- Produces:
  - `buildComparison(currentId, priorId)` → the payload below, or `null` if either campaign is missing.
  - `GET /api/pledge-campaigns/:id/compare?to=<priorId>` → `{ success: true, comparison }`

```js
{
  comparable: { goal: bool, collections: bool, partial: bool, pledging_curve: bool },
  campaigns: {
    current: { id, slug, name, start_date, end_date, total_days, in_progress, day },
    prior:   { id, slug, name, start_date, end_date, total_days, in_progress, day }
  },
  figures: {
    total_pledged:   { current, prior },
    total_collected: { current, prior },
    outstanding_owed:{ current, prior },
    pledge_count:    { current, prior },
    household_count: { current, prior },
    fulfillment_rate:{ current, prior },
    fully_paid:      { current, prior },
    never_paid:      { current, prior }
  },
  pledging_curve: {
    current: [ { day, cumulative_pledged } ],
    prior:   [ { day, cumulative_pledged } ]
  }
}
```

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/pledgeDashboardCompare.test.js`:

```js
const request = require('supertest');
const {
  sequelize, PledgeCampaign, Pledge, Member, Transaction, PledgeAllocation
} = require('../../src/models');

jest.mock('../../src/middleware/auth', () => ({
  firebaseAuthMiddleware: (req, res, next) => {
    req.user = { role: 'treasurer', roles: ['treasurer'] };
    next();
  }
}));

const app = require('../../src/server');

describe('GET /api/pledge-campaigns/:id/compare', () => {
  let current, prior, member;

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

    prior = await PledgeCampaign.create({
      slug: '2025-pledge-drive', name: '2025', start_date: '2025-09-13',
      end_date: '2026-01-12', status: 'closed'          // no goal, like the real one
    });
    current = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-09-01',
      end_date: '2026-12-31', goal_amount: 100000, status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann', last_name: 'Giver', phone_number: '+15555550130',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  const pledgeIn = async (campaign, amount, overrides = {}) => Pledge.create({
    amount, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: member.id, fulfillment_intent: 'immediate',
    ...overrides
  });

  const compare = async () => {
    const res = await request(app)
      .get(`/api/pledge-campaigns/${current.id}/compare?to=${prior.id}`);
    expect(res.status).toBe(200);
    return res.body.comparison;
  };

  it('marks goal and collections incomparable against a historical drive with no goal', async () => {
    await pledgeIn(prior, 5000, { is_historical: true, legacy_status: 'fulfilled' });
    await pledgeIn(current, 1000);

    const c = await compare();
    expect(c.comparable.goal).toBe(false);          // prior has no goal_amount
    expect(c.comparable.collections).toBe(false);   // prior has no payment dates
    expect(c.comparable.partial).toBe(false);       // prior is binary paid/unpaid
    expect(c.comparable.pledging_curve).toBe(true); // created_at exists on both
  });

  it('reports both windows so the UI can say they are the same length', async () => {
    const c = await compare();
    expect(c.campaigns.current.total_days).toBe(122);
    expect(c.campaigns.prior.total_days).toBe(122);
    expect(c.campaigns.current.in_progress).toBe(true);
    expect(c.campaigns.prior.in_progress).toBe(false);
  });

  it('returns the comparable figures side by side', async () => {
    await pledgeIn(prior, 4000, { is_historical: true, legacy_status: 'fulfilled' });
    await pledgeIn(current, 1000);
    await pledgeIn(current, 3000);

    const c = await compare();
    expect(c.figures.total_pledged.prior).toBe(4000);
    expect(c.figures.total_pledged.current).toBe(4000);
    expect(c.figures.total_collected.prior).toBe(4000);
    expect(c.figures.total_collected.current).toBe(0);
    expect(c.figures.pledge_count.prior).toBe(1);
    expect(c.figures.pledge_count.current).toBe(2);
  });

  it('builds a cumulative pledged curve keyed on day of campaign', async () => {
    await pledgeIn(current, 1000, { created_at: '2026-09-01T12:00:00Z' });
    await pledgeIn(current, 500, { created_at: '2026-09-03T12:00:00Z' });

    const c = await compare();
    expect(c.pledging_curve.current).toEqual([
      { day: 1, cumulative_pledged: 1000 },
      { day: 3, cumulative_pledged: 1500 }
    ]);
  });

  it('excludes cancelled pledges from the figures and the curve', async () => {
    const doomed = await pledgeIn(current, 9999);
    await doomed.update({ lifecycle: 'cancelled' });

    const c = await compare();
    expect(c.figures.total_pledged.current).toBe(0);
    expect(c.pledging_curve.current).toEqual([]);
  });

  it('400s when the `to` campaign is not supplied', async () => {
    const res = await request(app).get(`/api/pledge-campaigns/${current.id}/compare`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('404s when either campaign does not exist', async () => {
    const res = await request(app)
      .get(`/api/pledge-campaigns/${current.id}/compare?to=999999`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/pledgeDashboardCompare.test.js`

Expected: FAIL — the route 404s on every case.

- [ ] **Step 3: Add the comparison builder**

In `backend/src/services/pledgeDashboardService.js`, add above `buildSnapshot`:

```js
/**
 * Cumulative pledged dollars by day-of-campaign, from pledges.created_at.
 *
 * This is PLEDGING, not collections. The 2025 drive has no payment dates at
 * all, so a collections curve cannot be built for it and must never be faked;
 * created_at is a real pledge date on both drives, which makes this the one
 * curve that compares honestly. Cancelled pledges are excluded.
 */
const buildPledgingCurve = (pledges, startDate) => {
  const points = pledges
    .filter((p) => p.lifecycle !== 'cancelled')
    .map((p) => ({
      day: Math.max(1, dayCount(startDate, new Date(p.created_at).toISOString().slice(0, 10))),
      amount: num(p.amount)
    }))
    .sort((a, b) => a.day - b.day);

  const byDay = new Map();
  points.forEach(({ day, amount }) => byDay.set(day, (byDay.get(day) || 0) + amount));

  let running = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, amount]) => {
      running = round2(running + amount);
      return { day, cumulative_pledged: running };
    });
};

const summarise = async (campaign) => {
  const totals = await CampaignTotal.findByPk(campaign.id);
  const statusRows = await CampaignStatusTotal.findAll({
    where: { campaign_id: campaign.id }
  });
  const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r]));
  const pledged = num(totals?.total_pledged);
  const collected = num(totals?.total_collected);

  return {
    total_pledged: pledged,
    total_collected: collected,
    outstanding_owed: num(totals?.outstanding_positive),
    pledge_count: Number(totals?.pledge_count) || 0,
    household_count: Number(totals?.household_count) || 0,
    fulfillment_rate: pledged ? round2((collected / pledged) * 100) : 0,
    fully_paid: Number(byStatus.fulfilled?.pledge_count) || 0,
    never_paid: Number(byStatus.not_started?.pledge_count) || 0
  };
};

const describeWindow = (campaign, today = todayInChurchTz()) => {
  const timeline = buildTimeline(campaign, today);
  const ended = campaign.end_date ? Date.parse(campaign.end_date) < Date.parse(today) : false;
  return {
    id: String(campaign.id),
    slug: campaign.slug,
    name: campaign.name,
    start_date: campaign.start_date,
    end_date: campaign.end_date,
    total_days: timeline.total_days,
    in_progress: !ended,
    day: timeline.day
  };
};

/**
 * Returns null when either campaign is missing, so the controller can 404.
 *
 * `comparable` is the contract that keeps this honest. Plan 3 reads it to
 * decide which rows to render at all — a comparison it cannot compute must be
 * OMITTED, never drawn as a zero, because a zero bar reads as "we did badly"
 * rather than "we do not know" (spec section 6, rule 3).
 */
const buildComparison = async (currentId, priorId) => {
  const [currentCampaign, priorCampaign] = await Promise.all([
    PledgeCampaign.findByPk(currentId),
    PledgeCampaign.findByPk(priorId)
  ]);
  if (!currentCampaign || !priorCampaign) return null;

  const [currentPledges, priorPledges] = await Promise.all([
    Pledge.findAll({
      where: { campaign_id: currentId },
      attributes: ['amount', 'created_at', 'lifecycle', 'is_historical']
    }),
    Pledge.findAll({
      where: { campaign_id: priorId },
      attributes: ['amount', 'created_at', 'lifecycle', 'is_historical']
    })
  ]);

  const anyHistorical = (rows) => rows.some((p) => p.is_historical);
  const allocationBacked = !anyHistorical(currentPledges) && !anyHistorical(priorPledges);

  return {
    comparable: {
      goal: currentCampaign.goal_amount != null && priorCampaign.goal_amount != null,
      collections: allocationBacked,
      partial: allocationBacked,
      pledging_curve: true
    },
    campaigns: {
      current: describeWindow(currentCampaign),
      prior: describeWindow(priorCampaign)
    },
    figures: await (async () => {
      const [cur, pri] = await Promise.all([
        summarise(currentCampaign), summarise(priorCampaign)
      ]);
      return Object.fromEntries(
        Object.keys(cur).map((key) => [key, { current: cur[key], prior: pri[key] }])
      );
    })(),
    pledging_curve: {
      current: buildPledgingCurve(currentPledges, currentCampaign.start_date),
      prior: buildPledgingCurve(priorPledges, priorCampaign.start_date)
    }
  };
};
```

Add to the exports:

```js
module.exports = {
  buildSnapshot, buildTimeline, buildAttention, buildMonthlySeries,
  buildComparison, buildPledgingCurve, num, round2, dayCount
};
```

- [ ] **Step 4: Add the handler**

In `backend/src/controllers/pledgeDashboardController.js`, extend the import and add:

```js
const {
  buildSnapshot, buildMonthlySeries, buildComparison
} = require('../services/pledgeDashboardService');
```

```js
const getComparison = async (req, res) => {
  try {
    const priorId = req.query.to;
    if (!priorId) {
      return res.status(400).json({
        success: false,
        message: 'A `to` campaign id is required to compare against'
      });
    }
    const comparison = await buildComparison(req.params.id, priorId);
    if (!comparison) {
      return res.status(404).json({ success: false, message: 'Pledge campaign not found' });
    }
    return res.status(200).json({ success: true, comparison });
  } catch (error) {
    console.error('Error building pledge comparison:', error);
    return res.status(500).json({
      success: false, message: 'Failed to build the comparison', error: error.message
    });
  }
};

module.exports = { getDashboard, getMonthly, getComparison };
```

- [ ] **Step 5: Register the route**

In `backend/src/routes/pledgeCampaignRoutes.js`, below the monthly route:

```js
router.get('/:id/compare', roleMiddleware(viewRoles), dashboard.getComparison);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest tests/integration/pledgeDashboardCompare.test.js`

Expected: PASS, 7 tests.

- [ ] **Step 7: Run the full suite**

Run: `cd backend && DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest`

Expected: PASS — all suites green. Plan 1 left the suite at 948 passing with zero failures; this plan adds roughly 40 tests and must not break any of them.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/pledgeDashboardService.js backend/src/controllers/pledgeDashboardController.js backend/src/routes/pledgeCampaignRoutes.js backend/tests/integration/pledgeDashboardCompare.test.js
git commit -m "feat(pledges): year-over-year comparison endpoint with capability flags

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage.** §5's executive band → Task 2 (money, timeline, participation, breakdown). §5's pace marker and run-rate → Task 2's `linear_pace_target` / `required_run_rate`, factual figures with no verdict attached. §6's year-over-year, including the capability flags and the cumulative-pledged curve → Task 5. §7's chart 2 (paired count/dollar bars) → Task 2's `breakdown`, which carries both per status; chart 3 (monthly collections) → Task 4. §8's tiering → Task 1, applied in Tasks 2, 3 and 4. §8's small-number suppression → Task 1, applied throughout. §10's attention panel → Task 3.

Deliberately out of scope, with reasons: **§8 rule 4** (tighten the public `/api/pledges/stats`) belongs to Plan 5 per §12, because the public `PledgeTracker` still renders the section it would remove — doing it here would break a live page before its replacement exists. **§8 rule 2** (round public money, refresh daily) is likewise Plan 5, as it applies only to the public tier. All UI is Plans 3–5. Table sort/search/filter is Plan 4.

**Placeholder scan.** No TBDs. Every code step carries the real implementation or the real test. No step says "add validation" or "handle edge cases" without showing how.

**Type consistency.** `outstanding_owed` is the API field name in Tasks 2, 3 and 5, always sourced from the view column `outstanding_positive`, and the raw netted `outstanding` is never returned. `canSeeDonors(req)` and `suppressSmall(value, groupSize, canSee)` keep the signatures declared in Task 1 through every call site. `buildTimeline` returns the same four keys wherever it is used, including inside `describeWindow`. `num`, `round2` and `dayCount` are defined once in Task 2 and reused by Tasks 3, 4 and 5 — Task 3's `buildAttention` depends on `DAY_MS`, which Task 2 defines at module scope in the same file.

**One risk flagged for the executor.** Tasks 2–5 all extend `pledgeDashboardService.js`. Each adds a function and extends the export list; none rewrites an earlier one. An implementer who replaces the module exports rather than extending them will break the preceding tasks — the export block is shown in full at each step for exactly that reason.
