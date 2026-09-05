# Household Membership Report + Admin Member Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Member Information report to an admin-only Reports tab in the Admin Panel and add a new printable Household Membership Directory report.

**Architecture:** New admin-only backend endpoints (`/api/members/reports/member-information`, `/api/members/reports/household-directory`) in a dedicated `memberReportController`, consumed by a new `MemberReports` component hosted in a new AdminDashboard tab. Print/PDF is browser print-to-PDF via `@media print` Tailwind utilities. The old `member_information` report is removed from the treasurer Payment Reports (frontend option + backend branch).

**Tech Stack:** Node/Express + Sequelize (backend), React 19 + TypeScript + Tailwind (frontend), Jest for both.

**Spec:** `docs/superpowers/specs/2026-07-18-household-membership-report-design.md`

## Global Constraints

- **Do NOT commit or push.** The user commits only after testing locally (standing preference). Task boundaries are review checkpoints, not commits.
- Never put real member PII in tests/fixtures — use invented names/phones only.
- Every new UI string gets both `en` and `ti` entries in `frontend/src/i18n/dictionaries.ts` (flat dotted keys, matching the existing `memberInfoReport.*` style).
- Backend tests run from `backend/`: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest <file>`.
- Frontend tests run from `frontend/`: `npx react-scripts test --watchAll=false <file>`.
- No new dependencies.
- Report payloads must never include dates of birth, emails, financial data, or notes.

---

### Task 1: Backend — memberReportController with Member Information report

**Files:**
- Create: `backend/src/controllers/memberReportController.js`
- Test: `backend/src/__tests__/controllers/memberReportController.test.js`

**Interfaces:**
- Consumes: `Member`, `Dependent` Sequelize models from `../models` (Member attrs are snake_case: `id, first_name, last_name, phone_number, spouse_name, family_id, city, is_active, registration_status`; Dependent attrs are camelCase: `memberId, firstName, lastName, relationship, phone, dateOfBirth`).
- Produces: `getMemberInformationReport(req, res)` — JSON `{ success, data: { reportType: 'member_information', generatedAt, totalActiveMembers, members: [{ id, first_name, last_name, phone_number, spouse_first_name, spouse_last_name, spouse_phone }] } }`. Also exports helper `splitSpouseName(name)` used by Task 2.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/controllers/memberReportController.test.js`:

```js
'use strict';

jest.mock('../../models', () => ({
  Member: { findAll: jest.fn(), findByPk: jest.fn() },
  Dependent: { findAll: jest.fn() }
}));

const { Member, Dependent } = require('../../models');
const controller = require('../../controllers/memberReportController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('memberReportController.getMemberInformationReport', () => {
  beforeEach(() => jest.clearAllMocks());

  it('prefers spouse dependents over spouse_name and falls back to parsing spouse_name', async () => {
    Member.findAll.mockResolvedValue([
      { id: 1, first_name: 'Abraham', last_name: 'Tesfaye', phone_number: '+19725551234', spouse_name: 'Old Name' },
      { id: 2, first_name: 'Yonas', last_name: 'Gebre', phone_number: null, spouse_name: 'Selam Gebre' }
    ]);
    Dependent.findAll.mockResolvedValue([
      { memberId: 1, firstName: 'Hana', lastName: 'Tesfaye', phone: '+19725555678' }
    ]);

    const res = mockRes();
    await controller.getMemberInformationReport({ query: {} }, res);

    expect(Member.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { is_active: true }
    }));
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.reportType).toBe('member_information');
    expect(payload.data.totalActiveMembers).toBe(2);
    expect(payload.data.members[0]).toEqual(expect.objectContaining({
      spouse_first_name: 'Hana', spouse_last_name: 'Tesfaye', spouse_phone: '+19725555678'
    }));
    expect(payload.data.members[1]).toEqual(expect.objectContaining({
      spouse_first_name: 'Selam', spouse_last_name: 'Gebre', spouse_phone: null
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/memberReportController.test.js`
Expected: FAIL — `Cannot find module '../../controllers/memberReportController'`

- [ ] **Step 3: Write the controller**

Create `backend/src/controllers/memberReportController.js`. The member-information logic is moved verbatim (minus the report-type dispatch) from `backend/src/controllers/memberPaymentController.js:199-244`:

```js
const { Member, Dependent } = require('../models');

// Split a legacy members.spouse_name string into first/last parts.
// Returns null when the name is empty.
const splitSpouseName = (spouseName) => {
  const s = String(spouseName || '').trim();
  if (!s) return null;
  const i = s.indexOf(' ');
  return {
    firstName: i < 0 ? s : s.slice(0, i),
    lastName: i < 0 ? '' : s.slice(i + 1)
  };
};

// Member Information report: active member directory with spouse contact
// details. Spouse first/last/phone come from the dependents table
// (relationship = 'Spouse'); members.spouse_name is only a display fallback
// for members registered before spouse dependents existed.
const getMemberInformationReport = async (req, res) => {
  try {
    const members = await Member.findAll({
      where: { is_active: true },
      attributes: ['id', 'first_name', 'last_name', 'phone_number', 'spouse_name'],
      order: [['id', 'ASC']],
      raw: true
    });

    const spouseRows = members.length > 0 ? await Dependent.findAll({
      where: { relationship: 'Spouse', memberId: members.map((m) => m.id) },
      attributes: ['memberId', 'firstName', 'lastName', 'phone'],
      raw: true
    }) : [];
    const spouseByMember = new Map(spouseRows.map((s) => [String(s.memberId), s]));

    const rows = members.map((m) => {
      const spouse = spouseByMember.get(String(m.id));
      const fallback = spouse ? null : splitSpouseName(m.spouse_name);
      return {
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        phone_number: m.phone_number,
        spouse_first_name: spouse?.firstName || fallback?.firstName || null,
        spouse_last_name: spouse?.lastName || fallback?.lastName || null,
        spouse_phone: spouse?.phone || null
      };
    });

    res.json({
      success: true,
      data: {
        reportType: 'member_information',
        generatedAt: new Date().toISOString(),
        totalActiveMembers: rows.length,
        members: rows
      }
    });
  } catch (error) {
    console.error('Error generating member information report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate member information report' });
  }
};

module.exports = {
  splitSpouseName,
  getMemberInformationReport
};
```

Note the one intentional behavior difference from the old code: when a spouse dependent row exists but `spouse_name` differs, the dependent row still wins (same as before); when neither exists all spouse fields are null (same as before). Empty-string spouse parts become null via the `|| null` chain.

- [ ] **Step 4: Run test to verify it passes**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/memberReportController.test.js`
Expected: PASS (1 test)

---

### Task 2: Backend — Household Directory report

**Files:**
- Modify: `backend/src/controllers/memberReportController.js` (add `getHouseholdDirectoryReport`)
- Test: `backend/src/__tests__/controllers/memberReportController.test.js` (add describe block)

**Interfaces:**
- Consumes: `splitSpouseName` from Task 1; `req.user.id` / `req.user.email` (set by `firebaseAuthMiddleware`).
- Produces: `getHouseholdDirectoryReport(req, res)` — JSON:

```
{ success: true, data: {
    reportType: 'household_directory', generatedAt, generatedBy,
    summary: { totalHouseholds, totalParishMembers, totalHeads, totalSpouses, totalDependents },
    households: [{ headId, householdName,
                   head: { name, phone },
                   spouse: { name, phone } | null,
                   dependents: [{ name, relationship, phone }],
                   otherFamilyMembers: [{ name, phone }] }] } }
```

Query params: `include_inactive` ('true' to include), `last_name`, `city` (case-insensitive substring on the head), `membership_status` (exact match on `registration_status`: pending | complete | incomplete).

- [ ] **Step 1: Write the failing tests**

Append to `memberReportController.test.js`:

```js
describe('memberReportController.getHouseholdDirectoryReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Member.findByPk.mockResolvedValue({ first_name: 'Admin', last_name: 'User' });
  });

  const req = (query = {}, user = { id: 99, email: 'a@b.c' }) => ({ query, user });

  it('groups households, sorts by head last/first name, and builds names', async () => {
    Member.findAll.mockResolvedValue([
      { id: 1, first_name: 'Abraham', last_name: 'Tesfaye', phone_number: '+19725551234', spouse_name: null, family_id: 1, city: 'Dallas' },
      { id: 2, first_name: 'Yonas', last_name: 'Gebre', phone_number: null, spouse_name: 'Selam Haile', family_id: null, city: 'Garland' },
      // linked member (adult child registered as member) in Abraham's household
      { id: 3, first_name: 'Dawit', last_name: 'Tesfaye', phone_number: '+14695550000', spouse_name: null, family_id: 1, city: 'Dallas' }
    ]);
    Dependent.findAll.mockResolvedValue([
      { memberId: 1, firstName: 'Hana', lastName: 'Tesfaye', relationship: 'Spouse', phone: null, dateOfBirth: null },
      { memberId: 1, firstName: 'Ruth', lastName: 'Tesfaye', relationship: 'Daughter', phone: null, dateOfBirth: '2012-05-01' },
      { memberId: 1, firstName: 'Samuel', lastName: 'Tesfaye', relationship: 'Son', phone: '+14695559876', dateOfBirth: '2008-03-02' },
      { memberId: 1, firstName: 'Zara', lastName: 'Tesfaye', relationship: 'Daughter', phone: null, dateOfBirth: null }
    ]);

    const res = mockRes();
    await controller.getHouseholdDirectoryReport(req(), res);
    const { data } = res.json.mock.calls[0][0];

    // Sorted: Gebre before Tesfaye
    expect(data.households.map((h) => h.headId)).toEqual([2, 1]);

    const tesfaye = data.households[1];
    // Spouse shares last name -> "First & SpouseFirst Last Household"
    expect(tesfaye.householdName).toBe('Abraham & Hana Tesfaye Household');
    expect(tesfaye.spouse).toEqual({ name: 'Hana Tesfaye', phone: null });
    // Dependents: DOB ascending (oldest first), missing DOB last alphabetically
    expect(tesfaye.dependents.map((d) => d.name)).toEqual(['Samuel Tesfaye', 'Ruth Tesfaye', 'Zara Tesfaye']);
    expect(tesfaye.dependents[0]).toEqual({ name: 'Samuel Tesfaye', relationship: 'Son', phone: '+14695559876' });
    // Linked member listed under the household
    expect(tesfaye.otherFamilyMembers).toEqual([{ name: 'Dawit Tesfaye', phone: '+14695550000' }]);

    const gebre = data.households[0];
    // Spouse from legacy spouse_name, different last name -> full names joined
    expect(gebre.householdName).toBe('Yonas Gebre & Selam Haile Household');
    expect(gebre.spouse).toEqual({ name: 'Selam Haile', phone: null });

    expect(data.summary).toEqual({
      totalHouseholds: 2,
      totalHeads: 2,
      totalSpouses: 2,
      totalDependents: 3,
      totalParishMembers: 2 + 2 + 3 + 1 // heads + spouses + dependents + linked member
    });
    expect(data.generatedBy).toBe('Admin User');
  });

  it('applies filters: active-only default, membership_status in query, head last_name/city in JS', async () => {
    Member.findAll.mockResolvedValue([
      { id: 1, first_name: 'Abraham', last_name: 'Tesfaye', phone_number: null, spouse_name: null, family_id: null, city: 'Dallas' },
      { id: 2, first_name: 'Yonas', last_name: 'Gebre', phone_number: null, spouse_name: null, family_id: null, city: 'Garland' }
    ]);
    Dependent.findAll.mockResolvedValue([]);

    const res = mockRes();
    await controller.getHouseholdDirectoryReport(req({ last_name: 'tes', city: 'dal', membership_status: 'complete' }), res);

    expect(Member.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { is_active: true, registration_status: 'complete' }
    }));
    const { data } = res.json.mock.calls[0][0];
    expect(data.households).toHaveLength(1);
    expect(data.households[0].headId).toBe(1);
  });

  it('omits the is_active filter when include_inactive=true and handles no spouse', async () => {
    Member.findAll.mockResolvedValue([
      { id: 1, first_name: 'Abraham', last_name: 'Tesfaye', phone_number: null, spouse_name: null, family_id: null, city: null }
    ]);
    Dependent.findAll.mockResolvedValue([]);

    const res = mockRes();
    await controller.getHouseholdDirectoryReport(req({ include_inactive: 'true' }), res);

    expect(Member.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    const { data } = res.json.mock.calls[0][0];
    expect(data.households[0].householdName).toBe('Abraham Tesfaye Household');
    expect(data.households[0].spouse).toBeNull();
    expect(data.summary.totalSpouses).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/memberReportController.test.js`
Expected: Task 1 test PASSES; new tests FAIL with `controller.getHouseholdDirectoryReport is not a function`

- [ ] **Step 3: Implement getHouseholdDirectoryReport**

Add to `memberReportController.js` (before `module.exports`), and add it to the exports:

```js
const fullName = (first, last) => [first, last].filter(Boolean).join(' ');

const compareNames = (a, b) =>
  String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });

// Household Membership Directory: households grouped under each head of
// household (family_id null or = own id), with spouse from the dependents
// table (spouse_name as legacy fallback), dependents oldest-first, and any
// other registered members linked via family_id. No DOBs, emails, or
// financial data in the payload — this prints as a public-facing directory.
const getHouseholdDirectoryReport = async (req, res) => {
  try {
    const includeInactive = String(req.query.include_inactive) === 'true';
    const lastNameFilter = String(req.query.last_name || '').trim().toLowerCase();
    const cityFilter = String(req.query.city || '').trim().toLowerCase();
    const membershipStatus = String(req.query.membership_status || '').trim();

    const where = {};
    if (!includeInactive) where.is_active = true;
    if (membershipStatus) where.registration_status = membershipStatus;

    const members = await Member.findAll({
      where,
      attributes: ['id', 'first_name', 'last_name', 'phone_number', 'spouse_name', 'family_id', 'city'],
      raw: true
    });

    const isHead = (m) => !m.family_id || String(m.family_id) === String(m.id);

    // Head-level filters run in JS so they stay dialect-safe (sqlite tests,
    // Postgres prod) — member volume is small enough for this.
    const heads = members.filter(isHead).filter((m) => {
      if (lastNameFilter && !String(m.last_name || '').toLowerCase().includes(lastNameFilter)) return false;
      if (cityFilter && !String(m.city || '').toLowerCase().includes(cityFilter)) return false;
      return true;
    });

    const linkedByHead = new Map();
    for (const m of members) {
      if (isHead(m)) continue;
      const key = String(m.family_id);
      if (!linkedByHead.has(key)) linkedByHead.set(key, []);
      linkedByHead.get(key).push(m);
    }

    const dependentRows = heads.length > 0 ? await Dependent.findAll({
      where: { memberId: heads.map((m) => m.id) },
      attributes: ['memberId', 'firstName', 'lastName', 'relationship', 'phone', 'dateOfBirth'],
      raw: true
    }) : [];
    const dependentsByHead = new Map();
    for (const d of dependentRows) {
      const key = String(d.memberId);
      if (!dependentsByHead.has(key)) dependentsByHead.set(key, []);
      dependentsByHead.get(key).push(d);
    }

    let totalSpouses = 0;
    let totalDependents = 0;
    let totalOtherMembers = 0;

    const households = heads
      .slice()
      .sort((a, b) => compareNames(a.last_name, b.last_name) || compareNames(a.first_name, b.first_name))
      .map((head) => {
        const deps = dependentsByHead.get(String(head.id)) || [];

        const spouseRow = deps.find((d) => d.relationship === 'Spouse');
        const spouseParts = spouseRow
          ? { firstName: spouseRow.firstName, lastName: spouseRow.lastName }
          : splitSpouseName(head.spouse_name);
        const spouse = spouseParts ? {
          name: fullName(spouseParts.firstName, spouseParts.lastName),
          phone: spouseRow?.phone || null
        } : null;

        const dependents = deps
          .filter((d) => d.relationship !== 'Spouse')
          .sort((a, b) => {
            if (a.dateOfBirth && b.dateOfBirth) return String(a.dateOfBirth).localeCompare(String(b.dateOfBirth));
            if (a.dateOfBirth) return -1;
            if (b.dateOfBirth) return 1;
            return compareNames(fullName(a.firstName, a.lastName), fullName(b.firstName, b.lastName));
          })
          .map((d) => ({
            name: fullName(d.firstName, d.lastName),
            relationship: d.relationship || null,
            phone: d.phone || null
          }));

        const otherFamilyMembers = (linkedByHead.get(String(head.id)) || [])
          .sort((a, b) => compareNames(fullName(a.first_name, a.last_name), fullName(b.first_name, b.last_name)))
          .map((m) => ({ name: fullName(m.first_name, m.last_name), phone: m.phone_number || null }));

        totalSpouses += spouse ? 1 : 0;
        totalDependents += dependents.length;
        totalOtherMembers += otherFamilyMembers.length;

        const headName = fullName(head.first_name, head.last_name);
        let householdName;
        if (spouseParts && spouseParts.lastName &&
            compareNames(spouseParts.lastName, head.last_name) === 0) {
          householdName = `${head.first_name} & ${spouseParts.firstName} ${head.last_name} Household`;
        } else if (spouse) {
          householdName = `${headName} & ${spouse.name} Household`;
        } else {
          householdName = `${headName} Household`;
        }

        return {
          headId: head.id,
          householdName,
          head: { name: headName, phone: head.phone_number || null },
          spouse,
          dependents,
          otherFamilyMembers
        };
      });

    let generatedBy = null;
    if (req.user?.id) {
      const requester = await Member.findByPk(req.user.id, {
        attributes: ['first_name', 'last_name'],
        raw: true
      }).catch(() => null);
      if (requester) generatedBy = fullName(requester.first_name, requester.last_name);
    }
    if (!generatedBy) generatedBy = req.user?.email || 'Admin';

    res.json({
      success: true,
      data: {
        reportType: 'household_directory',
        generatedAt: new Date().toISOString(),
        generatedBy,
        summary: {
          totalHouseholds: households.length,
          totalHeads: households.length,
          totalSpouses,
          totalDependents,
          totalParishMembers: households.length + totalSpouses + totalDependents + totalOtherMembers
        },
        households
      }
    });
  } catch (error) {
    console.error('Error generating household directory report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate household directory report' });
  }
};
```

Update exports:

```js
module.exports = {
  splitSpouseName,
  getMemberInformationReport,
  getHouseholdDirectoryReport
};
```

Known edge case (accepted in design): a non-head member whose head is excluded by a filter (or inactive under the default filter) does not appear; filters intentionally narrow the printed directory.

- [ ] **Step 4: Run tests to verify they pass**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/memberReportController.test.js`
Expected: PASS (4 tests)

---

### Task 3: Backend — admin-only routes + remove old treasurer report branch

**Files:**
- Modify: `backend/src/routes/memberRoutes.js` (add two routes)
- Modify: `backend/src/controllers/memberPaymentController.js` (delete the `member_information` branch, lines ~194-244)
- Test: `backend/src/__tests__/controllers/memberReportController.test.js` (role-gate test)

**Interfaces:**
- Consumes: `getMemberInformationReport` / `getHouseholdDirectoryReport` from Tasks 1-2; existing `roleMiddleware` (`backend/src/middleware/role.js`) and the `router.use(firebaseAuthMiddleware)` at `memberRoutes.js:199`.
- Produces: `GET /api/members/reports/member-information` and `GET /api/members/reports/household-directory`, both `roleMiddleware(['admin'])`. `GET /api/payments/reports/member_information` now returns 400 ("Only summary report is supported currently") like other unknown report types.

- [ ] **Step 1: Write the failing role-gate test**

Append to `memberReportController.test.js`:

```js
describe('admin-only role gate for member reports', () => {
  const roleMiddleware = require('../../middleware/role');

  it('rejects non-admin roles with 403 and accepts admin', () => {
    const gate = roleMiddleware(['admin']);
    const next = jest.fn();

    const resDenied = mockRes();
    gate({ user: { role: 'treasurer', roles: ['treasurer'] }, originalUrl: '/api/members/reports/household-directory' }, resDenied, next);
    expect(resDenied.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    const resAllowed = mockRes();
    gate({ user: { role: 'admin', roles: ['admin'] }, originalUrl: '/api/members/reports/household-directory' }, resAllowed, next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it passes (middleware already exists — this pins the contract)**

Run: `DATABASE_URL=sqlite::memory: NODE_ENV=test npx jest src/__tests__/controllers/memberReportController.test.js`
Expected: PASS (5 tests). (This test guards against someone later widening the role list without noticing.)

- [ ] **Step 3: Register the routes**

In `backend/src/routes/memberRoutes.js`:

1. Add import near the other controller imports (top of file):

```js
const memberReportController = require('../controllers/memberReportController');
```

2. Add the routes **after** `router.use(firebaseAuthMiddleware);` (line ~199) and **before** `router.get('/:id', ...)` — alongside the "Admin routes" block near `router.get('/all', ...)`:

```js
// Member reports (admin only) — must be registered before '/:id'
router.get('/reports/member-information',
  roleMiddleware(['admin']),
  memberReportController.getMemberInformationReport
);

router.get('/reports/household-directory',
  roleMiddleware(['admin']),
  memberReportController.getHouseholdDirectoryReport
);
```

- [ ] **Step 4: Remove the member_information branch from memberPaymentController**

In `backend/src/controllers/memberPaymentController.js`, delete the entire block from the comment `// Member Information report: active member directory with spouse contact` through the closing `}` of `if (reportType === 'member_information') { ... }` (lines ~194-244). The next statement (`if (reportType !== 'summary') { ... 400 ... }`) now handles `member_information` as an unsupported type. If `Dependent` was imported only for this block, remove it from that file's imports (check with grep first).

- [ ] **Step 5: Run the full backend suite**

Run (from `backend/`): `npm test`
Expected: PASS — no test references the removed branch (verify with `grep -rn "member_information" backend/src/__tests__/` → no hits, and `grep -rn "member_information" backend/src/` hits nothing outside git history).

---

### Task 4: Frontend — i18n keys (en + ti)

**Files:**
- Modify: `frontend/src/i18n/dictionaries.ts` (flat-key sections of both `en` (~line 1951) and `ti` (~line 3640), next to the existing `memberInfoReport.*` keys)

**Interfaces:**
- Produces: `t('memberReports.*')` and `t('householdReport.*')` keys used by Tasks 5-6. Existing `memberInfoReport.*` keys are reused unchanged for the flat report.

- [ ] **Step 1: Add English keys** (in `en`, right after the `memberInfoReport.*` block):

```ts
  // -- Admin Member Reports tab --
  "memberReports.tab": "Reports",
  "memberReports.selectLabel": "Report",
  "memberReports.memberInformation": "Member Information",
  "memberReports.householdDirectory": "Household Membership Directory",

  // -- Household Membership Directory report --
  "householdReport.title": "Household Membership Directory",
  "householdReport.filters": "Filters",
  "householdReport.includeInactive": "Include inactive members",
  "householdReport.lastName": "Last name",
  "householdReport.city": "City",
  "householdReport.membershipStatus": "Membership status",
  "householdReport.anyStatus": "Any",
  "householdReport.statusPending": "Pending",
  "householdReport.statusComplete": "Complete",
  "householdReport.statusIncomplete": "Incomplete",
  "householdReport.generate": "Generate",
  "householdReport.savePdf": "Save as PDF",
  "householdReport.summaryTitle": "Membership Summary",
  "householdReport.totalFamilies": "Total Families",
  "householdReport.totalParishMembers": "Total Parish Members",
  "householdReport.totalHeads": "Heads of Household",
  "householdReport.totalSpouses": "Spouses",
  "householdReport.totalDependents": "Dependents",
  "householdReport.generatedOn": "Generated on",
  "householdReport.generatedBy": "Generated by",
  "householdReport.headOfHousehold": "Head of Household",
  "householdReport.spouse": "Spouse",
  "householdReport.dependentsSection": "Dependents",
  "householdReport.householdMembers": "Household Members",
  "householdReport.mobile": "Mobile",
  "householdReport.memberId": "Member ID",
  "householdReport.noResults": "No households match the selected filters.",
  "householdReport.page": "Page",
  "householdReport.of": "of",
  "householdReport.previous": "Previous",
  "householdReport.next": "Next",
  "householdReport.loading": "Loading...",
```

- [ ] **Step 2: Add Tigrigna keys** (in `ti`, right after its `memberInfoReport.*` block). These are drafts — flag them in `tigrigna-translation-review.md` (repo root) for native-speaker review like the rest of the ongoing i18n work:

```ts
  // -- Admin Member Reports tab --
  "memberReports.tab": "ጸብጻባት",
  "memberReports.selectLabel": "ጸብጻብ",
  "memberReports.memberInformation": "ሓበሬታ ኣባላት",
  "memberReports.householdDirectory": "መዝገብ ኣባልነት ስድራቤት",

  // -- Household Membership Directory report --
  "householdReport.title": "መዝገብ ኣባልነት ስድራቤት",
  "householdReport.filters": "መጻረዪታት",
  "householdReport.includeInactive": "ዘይንጡፋት ኣባላት ኣካትት",
  "householdReport.lastName": "ስም ኣቦ",
  "householdReport.city": "ከተማ",
  "householdReport.membershipStatus": "ኩነታት ኣባልነት",
  "householdReport.anyStatus": "ኩሉ",
  "householdReport.statusPending": "ዝጽበ",
  "householdReport.statusComplete": "ዝተዛዘመ",
  "householdReport.statusIncomplete": "ዘይተዛዘመ",
  "householdReport.generate": "ኣውጽእ",
  "householdReport.savePdf": "ከም PDF ኣቐምጥ",
  "householdReport.summaryTitle": "ጽማቕ ኣባልነት",
  "householdReport.totalFamilies": "ጠቕላላ ስድራቤታት",
  "householdReport.totalParishMembers": "ጠቕላላ ኣባላት ቤተ ክርስቲያን",
  "householdReport.totalHeads": "ሓለፍቲ ስድራቤት",
  "householdReport.totalSpouses": "መጻምድቲ",
  "householdReport.totalDependents": "ጽግዕተኛታት",
  "householdReport.generatedOn": "ዝተፈጥረሉ ዕለት",
  "householdReport.generatedBy": "ዘውጽኦ",
  "householdReport.headOfHousehold": "ሓላፊ ስድራቤት",
  "householdReport.spouse": "መጻምዲ",
  "householdReport.dependentsSection": "ጽግዕተኛታት",
  "householdReport.householdMembers": "ኣባላት ስድራቤት",
  "householdReport.mobile": "ሞባይል",
  "householdReport.memberId": "መለለዪ ኣባል",
  "householdReport.noResults": "ምስ መጻረዪታት ዝሰማማዕ ስድራቤት የለን።",
  "householdReport.page": "ገጽ",
  "householdReport.of": "ካብ",
  "householdReport.previous": "ዝሓለፈ",
  "householdReport.next": "ቀጻሊ",
  "householdReport.loading": "ይጽዕን ኣሎ...",
```

Before adding, check whether existing ti keys already translate "Dependents" (`grep -n "ጽግዕተኛ" frontend/src/i18n/dictionaries.ts` and `grep -n "dependents" -i` nearby) and reuse the established term if one exists.

- [ ] **Step 3: Verify the app compiles**

Run (from `frontend/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors (the dictionaries use an `[key: string]: any` index signature, so flat keys type-check).

---

### Task 5: Frontend — MemberReports component

**Files:**
- Create: `frontend/src/components/admin/MemberReports.tsx`
- Test: `frontend/src/components/admin/__tests__/MemberReports.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`firebaseUser.getIdToken()`), `useLanguage()` (`t(key)`), backend endpoints from Task 3, i18n keys from Task 4, church logo at `/cropped-AbuneAregawi-192x192.png` (in `frontend/public/`).
- Produces: default-export React component `MemberReports` (no props), used by Task 6.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/__tests__/MemberReports.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import MemberReports from '../MemberReports';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: async () => 'test-token' } })
}));
jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key })
}));

const householdPayload = {
  success: true,
  data: {
    reportType: 'household_directory',
    generatedAt: '2026-07-18T19:45:00.000Z',
    generatedBy: 'Admin User',
    summary: {
      totalHouseholds: 1,
      totalParishMembers: 3,
      totalHeads: 1,
      totalSpouses: 1,
      totalDependents: 1
    },
    households: [{
      headId: 7,
      householdName: 'Abraham & Hana Tesfaye Household',
      head: { name: 'Abraham Tesfaye', phone: '+19725551234' },
      spouse: { name: 'Hana Tesfaye', phone: null },
      dependents: [{ name: 'Samuel Tesfaye', relationship: 'Son', phone: null }],
      otherFamilyMembers: []
    }]
  }
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => householdPayload
  }) as jest.Mock;
});

test('renders household directory with summary and hides missing phones', async () => {
  render(<MemberReports />);

  await waitFor(() =>
    expect(screen.getByText('Abraham & Hana Tesfaye Household')).toBeInTheDocument()
  );

  // Summary values (appears at top and bottom of the report)
  expect(screen.getAllByText('householdReport.summaryTitle').length).toBeGreaterThanOrEqual(2);
  // Head phone is shown, formatted
  expect(screen.getByText(/\(972\) 555-1234/)).toBeInTheDocument();
  // Spouse has no phone: exactly one Mobile line in the household block
  expect(screen.getAllByText(/householdReport\.mobile/)).toHaveLength(1);
  // Dependent with relationship
  expect(screen.getByText(/Samuel Tesfaye/)).toBeInTheDocument();
  expect(screen.getByText(/\(Son\)/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npx react-scripts test --watchAll=false src/components/admin/__tests__/MemberReports.test.tsx`
Expected: FAIL — `Cannot find module '../MemberReports'`

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/admin/MemberReports.tsx`:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface MemberInfoRow {
  id: number | string;
  first_name: string;
  last_name: string;
  phone_number?: string | null;
  spouse_first_name?: string | null;
  spouse_last_name?: string | null;
  spouse_phone?: string | null;
}

interface MemberInfoData {
  generatedAt?: string;
  totalActiveMembers?: number;
  members: MemberInfoRow[];
}

interface HouseholdDependent { name: string; relationship?: string | null; phone?: string | null }
interface HouseholdPerson { name: string; phone?: string | null }
interface Household {
  headId: number | string;
  householdName: string;
  head: HouseholdPerson;
  spouse: HouseholdPerson | null;
  dependents: HouseholdDependent[];
  otherFamilyMembers: HouseholdPerson[];
}
interface HouseholdData {
  generatedAt: string;
  generatedBy: string;
  summary: {
    totalHouseholds: number;
    totalParishMembers: number;
    totalHeads: number;
    totalSpouses: number;
    totalDependents: number;
  };
  households: Household[];
}

const PAGE_SIZE = 20;

// E.164 US numbers render as (xxx) xxx-xxxx; anything else passes through.
const formatPhone = (phone?: string | null): string | null => {
  if (!phone) return null;
  const m = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
};

const MemberReports: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { t } = useLanguage();

  const [reportType, setReportType] = useState<'household_directory' | 'member_information'>('household_directory');
  const [memberInfo, setMemberInfo] = useState<MemberInfoData | null>(null);
  const [householdData, setHouseholdData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(false);

  // Household filters
  const [includeInactive, setIncludeInactive] = useState(false);
  const [lastName, setLastName] = useState('');
  const [city, setCity] = useState('');
  const [membershipStatus, setMembershipStatus] = useState('');
  const [page, setPage] = useState(1);

  const fetchMemberInfo = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/reports/member-information`, {
        headers: { Authorization: `Bearer ${await firebaseUser?.getIdToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMemberInfo(data.data);
      }
    } catch (error) {
      console.error('Error fetching member information report:', error);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  const fetchHouseholds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (includeInactive) params.set('include_inactive', 'true');
      if (lastName.trim()) params.set('last_name', lastName.trim());
      if (city.trim()) params.set('city', city.trim());
      if (membershipStatus) params.set('membership_status', membershipStatus);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/members/reports/household-directory?${params.toString()}`,
        { headers: { Authorization: `Bearer ${await firebaseUser?.getIdToken()}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setHouseholdData(data.data);
        setPage(1);
      }
    } catch (error) {
      console.error('Error fetching household directory report:', error);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, includeInactive, lastName, city, membershipStatus]);

  useEffect(() => {
    if (reportType === 'member_information' && !memberInfo) {
      fetchMemberInfo();
    } else if (reportType === 'household_directory' && !householdData) {
      fetchHouseholds();
    }
  }, [reportType, memberInfo, householdData, fetchMemberInfo, fetchHouseholds]);

  const renderSummary = (data: HouseholdData) => (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 print:bg-white print:border-gray-400" style={{ breakInside: 'avoid' }}>
      <h4 className="font-bold text-gray-900 mb-2">{t('householdReport.summaryTitle')}</h4>
      <ul className="text-sm text-gray-800 space-y-0.5">
        <li>{t('householdReport.totalFamilies')}: <span className="font-semibold">{data.summary.totalHouseholds}</span></li>
        <li>{t('householdReport.totalParishMembers')}: <span className="font-semibold">{data.summary.totalParishMembers}</span></li>
        <li>{t('householdReport.totalHeads')}: <span className="font-semibold">{data.summary.totalHeads}</span></li>
        <li>{t('householdReport.totalSpouses')}: <span className="font-semibold">{data.summary.totalSpouses}</span></li>
        <li>{t('householdReport.totalDependents')}: <span className="font-semibold">{data.summary.totalDependents}</span></li>
      </ul>
      <p className="text-xs text-gray-500 mt-2">
        {t('householdReport.generatedOn')}: {new Date(data.generatedAt).toLocaleString()}
        {' · '}
        {t('householdReport.generatedBy')}: {data.generatedBy}
      </p>
    </div>
  );

  const renderPerson = (label: string, people: Array<{ name: string; detail?: string | null; phone?: string | null }>) => (
    <div className="mt-2">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide print:text-gray-700">{label}</div>
      {people.map((p, i) => (
        <div key={i} className="ml-3 mt-0.5 text-sm text-gray-900">
          <div>• {p.name}{p.detail ? ` (${p.detail})` : ''}</div>
          {formatPhone(p.phone) && (
            <div className="ml-4 text-gray-600">{t('householdReport.mobile')}: {formatPhone(p.phone)}</div>
          )}
        </div>
      ))}
    </div>
  );

  const renderHousehold = (h: Household, onPage: boolean) => (
    <div
      key={String(h.headId)}
      className={`border border-gray-200 rounded-lg p-4 print:border-0 print:border-b print:border-gray-300 print:rounded-none ${onPage ? '' : 'hidden print:block'}`}
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      <div className="flex items-baseline justify-between border-b border-gray-100 pb-1 print:border-gray-300">
        <h4 className="font-bold text-gray-900">{h.householdName}</h4>
        <span className="text-xs text-gray-500">{t('householdReport.memberId')}: {h.headId}</span>
      </div>
      {renderPerson(t('householdReport.headOfHousehold'), [h.head])}
      {h.spouse && renderPerson(t('householdReport.spouse'), [h.spouse])}
      {h.dependents.length > 0 && renderPerson(
        t('householdReport.dependentsSection'),
        h.dependents.map((d) => ({ name: d.name, detail: d.relationship, phone: d.phone }))
      )}
      {h.otherFamilyMembers.length > 0 && renderPerson(t('householdReport.householdMembers'), h.otherFamilyMembers)}
    </div>
  );

  const renderHouseholdReport = () => {
    if (!householdData) return null;
    const totalPages = Math.max(1, Math.ceil(householdData.households.length / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    return (
      <div className="space-y-4 print:space-y-2">
        {renderSummary(householdData)}
        {householdData.households.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t('householdReport.noResults')}</p>
        ) : (
          <>
            {householdData.households.map((h, i) => renderHousehold(h, i >= start && i < end))}
            {renderSummary(householdData)}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-4 print:hidden">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  {t('householdReport.previous')}
                </button>
                <span className="text-sm text-gray-600">
                  {t('householdReport.page')} {page} {t('householdReport.of')} {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  {t('householdReport.next')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderMemberInfoReport = () => {
    if (!memberInfo?.members) return null;
    const mi = 'memberInfoReport';
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden print:shadow-none print:rounded-none">
        <div className="px-6 py-4 border-b border-gray-200 print:border-gray-800 print:text-center">
          <h3 className="text-lg font-bold text-gray-900 print:font-serif print:text-xl">{t(`${mi}.title`)}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {t(`${mi}.generated`)}: {memberInfo.generatedAt ? new Date(memberInfo.generatedAt).toLocaleDateString() : new Date().toLocaleDateString()}
            {' · '}
            {t(`${mi}.activeMembers`)}: {memberInfo.totalActiveMembers ?? memberInfo.members.length}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 print:text-xs">
            <thead className="bg-gray-50 print:bg-white">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colId`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colFirstName`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colLastName`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colPhone`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colSpouseFirst`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colSpouseLast`)}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider print:border-b print:border-gray-700">{t(`${mi}.colSpousePhone`)}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {memberInfo.members.map((m) => (
                <tr key={String(m.id)} className="even:bg-gray-50 print:even:bg-white" style={{ breakInside: 'avoid' }}>
                  <td className="px-4 py-2 text-right text-sm text-gray-900 tabular-nums whitespace-nowrap">{m.id}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{m.first_name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{m.last_name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 tabular-nums whitespace-nowrap">{m.phone_number || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{m.spouse_first_name || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{m.spouse_last_name || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 tabular-nums whitespace-nowrap">{m.spouse_phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 print:space-y-2">
      {/* Print header: logo, church name, report title, generation date */}
      <div className="hidden print:block text-center mb-6">
        <img
          src="/cropped-AbuneAregawi-192x192.png"
          alt=""
          className="mx-auto mb-2"
          style={{ width: '64px', height: '64px' }}
        />
        <h1 className="text-2xl font-bold text-gray-900 font-serif">Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church</h1>
        <h2 className="text-lg font-semibold text-gray-800 mt-1">
          {reportType === 'household_directory' ? t('householdReport.title') : t('memberInfoReport.title')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString()}</p>
      </div>

      {/* Report selector + actions */}
      <div className="bg-white rounded-lg shadow-md p-6 print:hidden">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-gray-700">{t('memberReports.selectLabel')}</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as 'household_directory' | 'member_information')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="household_directory">{t('memberReports.householdDirectory')}</option>
            <option value="member_information">{t('memberReports.memberInformation')}</option>
          </select>
          <button
            onClick={() => window.print()}
            disabled={loading || (reportType === 'household_directory' ? !householdData : !memberInfo)}
            className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium"
          >
            <i className="fas fa-print mr-2"></i>
            {t('common.print')}
          </button>
          <button
            onClick={() => window.print()}
            disabled={loading || (reportType === 'household_directory' ? !householdData : !memberInfo)}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium"
          >
            <i className="fas fa-file-pdf mr-2"></i>
            {t('householdReport.savePdf')}
          </button>
        </div>

        {/* Household filters */}
        {reportType === 'household_directory' && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-end gap-4">
            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="mr-2 rounded border-gray-300"
              />
              {t('householdReport.includeInactive')}
            </label>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('householdReport.lastName')}</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('householdReport.city')}</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('householdReport.membershipStatus')}</label>
              <select
                value={membershipStatus}
                onChange={(e) => setMembershipStatus(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                <option value="">{t('householdReport.anyStatus')}</option>
                <option value="pending">{t('householdReport.statusPending')}</option>
                <option value="complete">{t('householdReport.statusComplete')}</option>
                <option value="incomplete">{t('householdReport.statusIncomplete')}</option>
              </select>
            </div>
            <button
              onClick={fetchHouseholds}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-md text-sm font-medium"
            >
              {t('householdReport.generate')}
            </button>
          </div>
        )}
      </div>

      {/* Report body */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div>
          {reportType === 'household_directory' && renderHouseholdReport()}
          {reportType === 'member_information' && renderMemberInfoReport()}
        </div>
      )}
    </div>
  );
};

export default MemberReports;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx react-scripts test --watchAll=false src/components/admin/__tests__/MemberReports.test.tsx`
Expected: PASS (1 test)

---

### Task 6: Frontend — Admin Panel tab + remove report from treasurer

**Files:**
- Modify: `frontend/src/components/admin/AdminDashboard.tsx`
- Modify: `frontend/src/components/admin/PaymentReports.tsx`

**Interfaces:**
- Consumes: `MemberReports` component (Task 5); existing `userRoles` array in AdminDashboard.

- [ ] **Step 1: Add the admin-only Reports tab to AdminDashboard.tsx**

1. Import: `import MemberReports from './MemberReports';`
2. Widen the tab type: `useState<'members' | 'roles' | 'departments' | 'activity-logs' | 'voicemails' | 'reports'>('members')`
3. Add an `isAdmin` flag after `permissions`: `const isAdmin = userRoles.includes('admin');`
4. In the hash-navigation effect, add `'reports'` to the allowed hash list.
5. In `renderContent()`, add before `default`:

```tsx
      case 'reports':
        return isAdmin ? <MemberReports /> : <div className="p-4 text-center text-gray-500">Access Denied</div>;
```

6. Add the tab button after the Manage Members button (same classes as siblings), guarded by `isAdmin`:

```tsx
            {isAdmin && (
              <button
                onClick={() => setActiveTab('reports')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'reports'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <i className="fas fa-file-alt mr-2"></i>
                {t('memberReports.tab')}
              </button>
            )}
```

- [ ] **Step 2: Remove member_information from PaymentReports.tsx**

In `frontend/src/components/admin/PaymentReports.tsx`:
1. Delete the `reportType`/`generatedAt`/`totalActiveMembers`/`members` fields (and their comment) from `ReportData`.
2. Narrow the state union back to `'summary' | 'behind_payments' | 'monthly_breakdown' | 'fundraiser'`.
3. In `fetchReport`, replace the `baseEndpoint` conditional with the plain view switch:

```ts
      const baseEndpoint = paymentView === 'new' ? '/api/transactions' : '/api/payments';
```

(and delete the "Member information is view-independent" comment.)
4. Delete the whole `renderMemberInfoReport` function.
5. Delete the `<option value="member_information">…</option>` and the `{reportType === 'member_information' && renderMemberInfoReport()}` line.

Leave the `memberInfoReport.*` i18n keys in place — `MemberReports.tsx` now uses them.

- [ ] **Step 3: Verify compile + full frontend suite**

Run (from `frontend/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.
Run: `npm test -- --watchAll=false`
Expected: PASS. If an existing PaymentReports test references `member_information` (check `grep -rn "member_information" frontend/src`), update/remove that assertion — only test code may still reference it after this step.

---

### Task 7: End-to-end verification (no commits)

- [ ] **Step 1: Full backend suite** — from `backend/`: `npm test` → all pass.
- [ ] **Step 2: Full frontend suite** — from `frontend/`: `npm test -- --watchAll=false` → all pass.
- [ ] **Step 3: Grep sweep** — `grep -rn "member_information" backend/src frontend/src` → hits only in `memberReportController` (reportType string), `MemberReports.tsx` (state value), and their tests. No hits left in `memberPaymentController.js` or `PaymentReports.tsx`.
- [ ] **Step 4: Manual smoke test (user-driven)** — `npm run dev` from repo root; log in as an admin; Admin Panel → Reports tab; verify: household directory renders grouped/sorted, filters work, pagination works, Print/Save-as-PDF opens the browser dialog with logo + title + summary at top and bottom, households don't split across pages, missing phones show no placeholder; Member Information report renders in its new home; treasurer Payment Reports no longer offers Member Information; a treasurer-only account gets 403 on `/api/members/reports/*` and sees no Reports tab.
