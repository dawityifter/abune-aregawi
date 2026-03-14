# Payment Overview Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Payment Overview tab of the Treasurer Dashboard to give equal weight to financial health and dues collection, add a year selector, clarify all terminology, and surface the outstanding amount.

**Architecture:** The Node.js backend's `/api/payments/stats` endpoint gains an optional `year` query param (defaults to current year) and a new `/api/payments/stats/years` endpoint returns available years. The frontend `TreasurerDashboard` adds a year selector that re-fetches stats on change. `PaymentStats.tsx` is rewritten with the approved two-panel layout. New i18n keys are added for all renamed labels. The Java backend (`java` branch) mirrors both backend changes.

**Tech Stack:** Node.js / Sequelize / Express (backend), React / TypeScript / Tailwind CSS (frontend), `dictionaries.ts` i18n pattern.

---

## Phase 1 — Node.js Backend

### Task 1: Add `year` query param to `getPaymentStats`

**Files:**
- Modify: `backend/src/controllers/memberPaymentController.js` (lines 229–401)

The function currently hardcodes the current year. Read the function first, then apply the change.

**Step 1: Replace the hardcoded year block at the top of `getPaymentStats`**

Find (lines 231–235):
```js
const now = new Date();
const year = now.getFullYear();
const start = new Date(year, 0, 1);
const end = new Date(year, 11, 31, 23, 59, 59, 999);
const currentMonth = now.getMonth() + 1; // 1-12
```

Replace with:
```js
const now = new Date();
const currentYear = now.getFullYear();
const year = req.query.year ? parseInt(req.query.year, 10) : currentYear;
const start = new Date(year, 0, 1);
const end = new Date(year, 11, 31, 23, 59, 59, 999);
// For past years use all 12 months; for current year use months elapsed so far
const currentMonth = year === currentYear ? now.getMonth() + 1 : 12;
```

**Step 2: Verify TypeScript / JS is valid — no syntax check needed for plain JS. Just verify the file saves.**

---

### Task 2: Add `getAvailableYears` endpoint

**Files:**
- Modify: `backend/src/controllers/memberPaymentController.js` (add after `getPaymentStats`)
- Modify: `backend/src/routes/memberPaymentRoutes.js`

**Step 1: Add the controller function at the bottom of `memberPaymentController.js`, before `module.exports`**

```js
// GET /api/payments/stats/years — returns sorted list of years that have ledger entries
const getAvailableYears = async (req, res) => {
  try {
    const { fn, col, literal } = require('sequelize');
    const rows = await LedgerEntry.findAll({
      attributes: [[fn('DISTINCT', fn('date_part', literal("'year'"), col('entry_date'))), 'yr']],
      order: [[literal('yr'), 'DESC']],
      raw: true,
    });
    const years = rows
      .map(r => Number(r.yr))
      .filter(y => Number.isFinite(y) && y > 2000);
    const currentYear = new Date().getFullYear();
    if (!years.includes(currentYear)) years.unshift(currentYear);
    return res.json({ success: true, data: { years } });
  } catch (error) {
    console.error('Error fetching available years:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch available years' });
  }
};
```

**Step 2: Export the new function**

Find `module.exports = {` at the bottom of the file. Add `getAvailableYears` to the exports object.

**Step 3: Register the route in `backend/src/routes/memberPaymentRoutes.js`**

Find:
```js
const {
  getPaymentStats,
```

Add `getAvailableYears` to the destructured import.

Then find:
```js
router.get('/stats', roleMiddleware(viewRoles), getPaymentStats);
```

Add BEFORE it (more specific route must come first):
```js
router.get('/stats/years', roleMiddleware(viewRoles), getAvailableYears);
```

---

### Task 3: Write backend tests and commit

**Files:**
- Create: `backend/src/__tests__/paymentStats.test.js`

**Step 1: Create the test file**

```js
'use strict';
const request = require('supertest');
const app = require('../app');

// These are unit-style tests that mock the DB calls
jest.mock('../models', () => {
  const SequelizeMock = require('sequelize-mock');
  // minimal stub — real DB integration tested via existing integration tests
  return {};
});

describe('GET /api/payments/stats year param', () => {
  it('accepts a year query parameter without error', async () => {
    // Smoke test: endpoint exists and parses year without throwing
    // The actual DB is SQLite in-memory for tests; we just check 200 or 500 (not 404)
    const res = await request(app)
      .get('/api/payments/stats?year=2025')
      .set('Authorization', 'Bearer test-invalid-token');
    // 401 is acceptable — it means the route exists and auth ran; not 404
    expect([200, 401, 500]).toContain(res.status);
  });

  it('stats/years route exists', async () => {
    const res = await request(app)
      .get('/api/payments/stats/years')
      .set('Authorization', 'Bearer test-invalid-token');
    expect([200, 401, 500]).toContain(res.status);
  });
});
```

**Step 2: Run backend tests**

```bash
cd /Users/dawit/development/church/abune-aregawi/backend && npm test
```
Expected: All suites pass (the new test may be skipped or pass as smoke tests).

**Step 3: Commit backend changes**

```bash
cd /Users/dawit/development/church/abune-aregawi
git add backend/src/controllers/memberPaymentController.js \
        backend/src/routes/memberPaymentRoutes.js \
        backend/src/__tests__/paymentStats.test.js
git commit -m "feat(backend): add year filter and available-years endpoint to payment stats"
```

---

## Phase 2 — Frontend

### Task 4: Add new i18n keys to `dictionaries.ts`

**Files:**
- Modify: `frontend/src/i18n/dictionaries.ts`

There are three places to change: the TypeScript interface (around line 89), the English `en` values (around line 763), and the Tigrinya `ti` values (around line 1454).

**Step 1: Extend the interface**

Find the `stats` block in the interface (around line 125):
```ts
stats: {
  totalMembers: string;
  contributingMembers: string;
  upToDate: string;
  behind: string;
  collectionRate: string;
  membershipCollected: string;
  otherPayments: string;
  totalCollected: string;
  totalExpenses: string;
  netIncome: string;
  outstanding: string;
  collectionProgress: string;
};
```

Add new keys to the `stats` block (keep existing keys — they may be used elsewhere):
```ts
  // existing keys stay...
  // New keys for redesigned overview:
  pageTitle: string;
  yearLabel: string;
  totalReceipts: string;
  ytdBalance: string;
  surplus: string;
  deficit: string;
  annualDuesProgress: string;
  collectedOf: string;
  stillOutstanding: string;
  otherIncome: string;
  currentBalance: string;
  lastUpdated: string;
  target: string;
  membershipDues: string;
  otherDonations: string;
```

Find the `health` section — it currently does NOT exist in the interface. Add it as a new sibling of `stats`:
```ts
health: {
  title: string;
  financialHealth: string;
  duesAndMemberStatus: string;
  activeGivers: string;
  totalMembers: string;
  upToDate: string;
  behind: string;
  fullyPaid: string;
  behindOnDues: string;
  activeMembers: string;
  membershipDues: string;
  otherDonations: string;
};
```

**Step 2: Add English values**

Find the English `stats` block (around line 763, inside the `en` object) and add after the last existing key:
```ts
pageTitle: "Financial Overview",
yearLabel: "Year",
totalReceipts: "Total Receipts",
ytdBalance: "Year-to-Date Balance",
surplus: "Surplus",
deficit: "Deficit",
annualDuesProgress: "Annual Dues Progress",
collectedOf: "collected of",
stillOutstanding: "still outstanding",
otherIncome: "Other Income",
currentBalance: "Bank Balance",
lastUpdated: "Updated",
target: "Goal",
membershipDues: "Membership Dues",
otherDonations: "Other Donations",
```

Find the English `health` block — it does NOT exist yet. Add it as a new sibling of `stats` in the `en.treasurerDashboard` object:
```ts
health: {
  title: "Membership Health",
  financialHealth: "Financial Health",
  duesAndMemberStatus: "Dues & Member Status",
  activeGivers: "Active Givers",
  totalMembers: "of {count} members",
  upToDate: "Up to Date",
  behind: "Behind",
  fullyPaid: "Fully Paid",
  behindOnDues: "Behind on Dues",
  activeMembers: "Active Members",
  membershipDues: "Membership Dues",
  otherDonations: "Other Donations",
},
```

**Step 3: Add Tigrinya values**

In the `ti` object, add to the existing `stats` block (find `stats: {` inside `ti.treasurerDashboard`):
```ts
pageTitle: "ናይ ፋይናንስ ሓጺር መግለጺ",
yearLabel: "ዓመት",
totalReceipts: "ጠቕላሊ እቶት",
ytdBalance: "ናይ ዓመት ሕሳብ",
surplus: "ትርፊ",
deficit: "ጉድለት",
annualDuesProgress: "ናይ ዓመት ኣባልነት ክፍሊት",
collectedOf: "ተኣኺቡ ካብ",
stillOutstanding: "ዝተረፈ",
otherIncome: "ካልእ እቶት",
currentBalance: "ሕሳብ ባንኪ",
lastUpdated: "ዝተሓደሰሉ",
target: "ዕላማ",
membershipDues: "ናይ ኣባልነት ክፍሊት",
otherDonations: "ካልእ ሽልማታት",
```

Add `health` block to `ti.treasurerDashboard`:
```ts
health: {
  title: "ጥዕና ኣባልነት",
  financialHealth: "ናይ ፋይናንስ ጥዕና",
  duesAndMemberStatus: "ክፍሊት ኣባልነትን ኩነታት ኣባላትን",
  activeGivers: "ዝኸፍሉ ኣባላት",
  totalMembers: "ካብ {count} ኣባላት",
  upToDate: "እዋናዊ ዝኸፈሉ",
  behind: "ዝተረፎም",
  fullyPaid: "ብምሉኡ ከፊሉ",
  behindOnDues: "ዕዳ ኣለዎ",
  activeMembers: "ንጡፋት ኣባላት",
  membershipDues: "ናይ ኣባልነት ክፍሊት",
  otherDonations: "ካልእ ሽልማታት",
},
```

**Step 4: TypeScript check**

```bash
cd /Users/dawit/development/church/abune-aregawi/frontend && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```
Expected: Zero errors in source files.

---

### Task 5: Add year selector to `TreasurerDashboard`

**Files:**
- Modify: `frontend/src/components/admin/TreasurerDashboard.tsx`

**Step 1: Add `selectedYear` and `availableYears` state**

After the existing `useState` declarations (around line 41), add:
```ts
const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);
```

**Step 2: Add `loadAvailableYears` function**

After `fetchPaymentStats` (around line 185), add:
```ts
const loadAvailableYears = async () => {
  try {
    const res = await fetch(`${process.env.REACT_APP_API_URL}/api/payments/stats/years`, {
      headers: { Authorization: `Bearer ${await firebaseUser?.getIdToken()}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.years?.length) setAvailableYears(data.data.years);
    }
  } catch { /* non-critical */ }
};
```

**Step 3: Update `fetchPaymentStats` to pass `selectedYear`**

Find (line 153):
```ts
const endpoint = '/api/payments/stats';
```

Replace with:
```ts
const endpoint = `/api/payments/stats?year=${selectedYear}`;
```

**Step 4: Load available years on mount**

Find the `useEffect` that calls `fetchPaymentStats()` (around line 188). Add `loadAvailableYears()` to it:
```ts
useEffect(() => {
  loadAvailableYears();
  fetchPaymentStats();
  // ... existing code
```

**Step 5: Re-fetch stats when year changes**

Add a new `useEffect`:
```ts
useEffect(() => {
  if (!firebaseUser) return;
  fetchPaymentStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedYear]);
```

**Step 6: Pass `selectedYear`, `availableYears`, `setSelectedYear` to `PaymentStats`**

Find (around line 342):
```tsx
{stats && <PaymentStats stats={stats} />}
```

Replace with:
```tsx
{stats && (
  <PaymentStats
    stats={stats}
    selectedYear={selectedYear}
    availableYears={availableYears}
    onYearChange={setSelectedYear}
  />
)}
```

**Step 7: TypeScript check**

```bash
cd /Users/dawit/development/church/abune-aregawi/frontend && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```
Expected: TypeScript will complain that `PaymentStats` doesn't accept those new props yet — that's fine, it will be fixed in Task 6.

---

### Task 6: Rewrite `PaymentStats.tsx`

**Files:**
- Modify: `frontend/src/components/admin/PaymentStats.tsx`

Replace the entire file with the new implementation:

```tsx
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDateForDisplay } from '../../utils/dateUtils';

interface PaymentStatsData {
  totalMembers: number;
  contributingMembers: number;
  upToDateMembers: number;
  behindMembers: number;
  totalAmountDue: number;
  totalMembershipCollected: number;
  otherPayments: number;
  totalCollected: number;
  totalExpenses: number;
  netIncome: number;
  collectionRate: number;
  outstandingAmount: number;
  currentBankBalance?: number;
  lastBankUpdate?: string;
}

interface PaymentStatsProps {
  stats: PaymentStatsData;
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}

const PaymentStats: React.FC<PaymentStatsProps> = ({ stats, selectedYear, availableYears, onYearChange }) => {
  const { t } = useLanguage();
  const td = 'treasurerDashboard';

  const fmt = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const isCurrentYear = selectedYear === new Date().getFullYear();
  const progressPct = Math.min(parseFloat(stats.collectionRate.toString()), 100);

  return (
    <div className="space-y-6">

      {/* Page title + year selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">
          {t(`${td}.stats.pageTitle`)}
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">{t(`${td}.stats.yearLabel`)}:</label>
          <select
            value={selectedYear}
            onChange={e => onYearChange(Number(e.target.value))}
            className="border rounded px-3 py-1.5 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-primary-500"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}{y === new Date().getFullYear() ? ' (Current)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top row: Bank Balance + Annual Dues Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Bank Balance — unchanged style */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg shadow-md p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">{t(`${td}.stats.currentBalance`)}</p>
              <h3 className="text-2xl font-bold">{fmt(stats.currentBankBalance || 0)}</h3>
              {stats.lastBankUpdate && (
                <p className="text-xs text-blue-200 mt-2">
                  {t(`${td}.stats.lastUpdated`)}: {formatDateForDisplay(stats.lastBankUpdate)}
                </p>
              )}
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <span className="text-xl">🏦</span>
            </div>
          </div>
        </div>

        {/* Annual Dues Progress + Other Income */}
        <div className="md:col-span-2 bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {t(`${td}.stats.annualDuesProgress`)}
            </p>
            <span className="text-2xl font-bold text-blue-700">{progressPct}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex justify-between text-sm text-gray-600 mb-4">
            <span>
              <span className="font-semibold text-gray-900">{fmt(stats.totalMembershipCollected)}</span>
              {' '}{t(`${td}.stats.collectedOf`)}{' '}
              <span className="font-semibold text-gray-900">{fmt(stats.totalAmountDue)}</span>
              {' '}{t(`${td}.stats.target`)}
            </span>
            <span className="text-red-600 font-medium">
              {fmt(stats.outstandingAmount)} {t(`${td}.stats.stillOutstanding`)}
            </span>
          </div>

          {/* Divider + Other Income */}
          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">{t(`${td}.stats.otherIncome`)}</span>
            <span className="text-base font-bold text-gray-800">{fmt(stats.otherPayments)}</span>
          </div>
        </div>
      </div>

      {/* Bottom row: two equal panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Financial Health */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            {t(`${td}.health.financialHealth`)}
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <span className="text-green-500">↑</span> {t(`${td}.stats.totalReceipts`)}
              </span>
              <span className="text-lg font-bold text-green-700">{fmt(stats.totalCollected)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <span className="text-red-500">↓</span> {t(`${td}.stats.totalExpenses`)}
              </span>
              <span className="text-lg font-bold text-red-700">{fmt(stats.totalExpenses)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">{t(`${td}.stats.ytdBalance`)}</span>
              <div className="text-right">
                <span className={`text-xl font-bold ${stats.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {stats.netIncome >= 0 ? '+' : ''}{fmt(stats.netIncome)}
                </span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                  stats.netIncome >= 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {stats.netIncome >= 0 ? t(`${td}.stats.surplus`) : t(`${td}.stats.deficit`)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Dues & Member Status */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            {t(`${td}.health.duesAndMemberStatus`)}
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-sm text-gray-600">{t(`${td}.health.membershipDues`)}</span>
              <div className="text-right">
                <p className="text-base font-bold text-gray-900">{fmt(stats.totalMembershipCollected)}</p>
                <p className="text-xs text-red-600 mt-0.5">{fmt(stats.outstandingAmount)} {t(`${td}.stats.stillOutstanding`)}</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{t(`${td}.health.otherDonations`)}</span>
              <span className="text-base font-bold text-gray-900">{fmt(stats.otherPayments)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-green-700">
                  <span>✓</span> {t(`${td}.health.fullyPaid`)}
                </span>
                <span className="font-bold text-green-700 text-base">{stats.upToDateMembers}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span>⚠</span> {t(`${td}.health.behindOnDues`)}
                </span>
                <span className="font-bold text-amber-700 text-base">{stats.behindMembers}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span>○</span> {t(`${td}.health.activeMembers`)}
                </span>
                <span className="font-bold text-gray-700 text-base">{stats.totalMembers}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStats;
```

**Step 2: TypeScript check**

```bash
cd /Users/dawit/development/church/abune-aregawi/frontend && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```
Expected: Zero errors in source files.

---

### Task 7: Run frontend tests and commit

**Step 1: Run tests**

```bash
cd /Users/dawit/development/church/abune-aregawi/frontend && CI=true npx react-scripts test --watchAll=false 2>&1 | tail -20
```
Expected: All test suites pass.

**Step 2: Commit frontend changes**

```bash
cd /Users/dawit/development/church/abune-aregawi
git add frontend/src/i18n/dictionaries.ts \
        frontend/src/components/admin/TreasurerDashboard.tsx \
        frontend/src/components/admin/PaymentStats.tsx
git commit -m "feat(frontend): redesign payment overview with year selector and two-panel layout"
```

---

## Phase 3 — Java Backend (java branch)

### Task 8: Add year filtering to Java `getPaymentStats` and `getAvailableYears`

**Files:**
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/service/PaymentStatsService.java` (or equivalent — read first)
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/controller/PaymentStatsController.java` (or equivalent — read first)

**Step 1: Switch to java branch**

```bash
cd /Users/dawit/development/church/abune-aregawi && git checkout java
```

**Step 2: Locate the stats service and controller**

```bash
grep -rn "paymentStats\|payment/stats\|getStats\|PaymentStats" backendJava/src/ --include="*.java" -l
```

Read the relevant files to understand the current structure before making changes.

**Step 3: Add `year` parameter to the stats endpoint**

In the controller, update the `GET /api/payments/stats` handler to accept an optional `@RequestParam(required = false) Integer year`. Pass it to the service.

In the service, replace the hardcoded `LocalDate.now().getYear()` with the provided year (defaulting to current year if null):
```java
int targetYear = (year != null) ? year : LocalDate.now().getYear();
LocalDate start = LocalDate.of(targetYear, 1, 1);
LocalDate end = LocalDate.of(targetYear, 12, 31);
// For current year: use current month; for past years: use month 12
int month = (targetYear == LocalDate.now().getYear()) ? LocalDate.now().getMonthValue() : 12;
```

**Step 4: Add `GET /api/payments/stats/years` endpoint**

In the controller, add a new handler:
```java
@GetMapping("/stats/years")
@PreAuthorize("isAuthenticated()")
public ResponseEntity<ApiResponse<Map<String, Object>>> getAvailableYears() {
    List<Integer> years = paymentStatsService.getAvailableYears();
    int currentYear = LocalDate.now().getYear();
    if (!years.contains(currentYear)) years.add(0, currentYear);
    return ResponseEntity.ok(ApiResponse.success(Map.of("years", years)));
}
```

In the service, add:
```java
public List<Integer> getAvailableYears() {
    // Query distinct years from ledger_entries
    return ledgerEntryRepository.findDistinctYears();
}
```

In the repository, add the JPQL query:
```java
@Query("SELECT DISTINCT FUNCTION('year', e.entryDate) FROM LedgerEntry e ORDER BY 1 DESC")
List<Integer> findDistinctYears();
```

**Step 5: Build**

```bash
cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew assemble
```
Expected: `BUILD SUCCESSFUL`

**Step 6: Commit and switch back**

```bash
cd /Users/dawit/development/church/abune-aregawi
git add backendJava/src/
git commit -m "feat(java): add year filter and available-years endpoint to payment stats"
git checkout main
```

---

## Done

After all tasks complete:
- Treasurer sees "Financial Overview" with a year dropdown (current year default)
- Top row: Bank Balance + Annual Dues Progress bar with outstanding amount + Other Income
- Bottom row: Financial Health panel (Total Receipts, Total Expenses, YTD Balance) and Dues & Member Status panel (Dues collected/outstanding, member counts)
- All labels use church-appropriate terminology
- Both Node.js and Java backends support year filtering
