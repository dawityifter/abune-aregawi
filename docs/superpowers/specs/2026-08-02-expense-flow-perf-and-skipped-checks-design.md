# Expense Flow: Performance, Editing, and Skipped Check Numbers

**Date:** 2026-08-02
**Status:** Approved design — pending spec review

## Context & Problem

Three related issues on the Treasurer Dashboard, all in the expense area.

**1. Saving an expense feels like a full page reload.** After `AddExpenseModal` succeeds, the
dashboard blanks out and takes several seconds to come back. Three causes compound:

- **Work that isn't on screen.** `onSuccess`
  ([`TreasurerDashboard.tsx:599-604`](../../../frontend/src/components/admin/TreasurerDashboard.tsx#L599-L604))
  calls `refreshFinancialData()`
  ([lines 255-260](../../../frontend/src/components/admin/TreasurerDashboard.tsx#L255-L260)), which
  unconditionally hits `/api/payments/stats` and `/api/transactions/skipped-receipts`. When the
  expense was added from the **Expenses** tab, `PaymentStats` isn't rendered at all
  ([line 382](../../../frontend/src/components/admin/TreasurerDashboard.tsx#L382)), and skipped
  *receipts* are derived from the `transactions` table — nothing to do with expenses. Both
  responses are discarded.
- **The screen is deliberately blanked.** `fetchPaymentStats` starts with
  `setStats(null); setLoading(true)`
  ([lines 204-205](../../../frontend/src/components/admin/TreasurerDashboard.tsx#L204-L205)), so the
  Overview unmounts its content and rebuilds from empty.
- **`/api/payments/stats` is ~12 sequential DB round trips.** In `getPaymentStats`
  ([`memberPaymentController.js:269`](../../../backend/src/controllers/memberPaymentController.js#L269)):
  `Member.count`, `Member.findAll`, `LedgerEntry.sum(membership_due)`, a grouped
  `LedgerEntry.findAll`, `LedgerEntry.sum(other)`, `LedgerEntry.sum(expense)`,
  `BankTransaction.findOne`, `BankTransaction.sum`, then `computeReconciliation`'s two
  `BankTransaction.sum` calls plus a `ChurchSetting` lookup. Every one is a separate network hop to
  Supabase, and production sits behind a 60s nginx proxy timeout.

Secondary contributors: `/api/transactions/skipped-receipts`
([`transactionController.js:1147`](../../../backend/src/controllers/transactionController.js#L1147))
loads every non-null `receipt_number` row with no year bound, and it is fetched on dashboard mount
rather than when the Payments tab is opened. `AddExpenseModal` refetches categories, employees and
vendors on every open.

**2. There is no gap detection for check numbers.** Receipts have a "Show Skipped Receipt Numbers"
button on the Payments tab that surfaces missing numbers so the treasurer can audit the receipt
book. Checks are recorded the same way (`check_number` on expenses) but have no equivalent, so a
skipped or unrecorded check goes unnoticed.

**3. Expenses can't be edited from the details drawer, and the check number is hidden behind a
fallback.** The drawer in `ExpenseList`
([lines 406-503](../../../frontend/src/components/admin/ExpenseList.tsx#L406-L503)) is read-only. It
does render a check number, but merged into a single row as
`check_number || receipt_number || '-'`
([lines 479-480](../../../frontend/src/components/admin/ExpenseList.tsx#L479-L480)) under a combined
"Check / Receipt" label — so a check-method expense with no check number silently displays its
*receipt* number instead, and the two are indistinguishable.

Related, and contrary to the assumption that it is already enforced: **`check_number` is currently
optional, and its uniqueness is only half-enforced.**

- `AddExpenseModal`'s field has no `required` attribute
  ([lines 538-544](../../../frontend/src/components/admin/AddExpenseModal.tsx#L538-L544)), and the
  value is only sent when truthy
  ([line 216](../../../frontend/src/components/admin/AddExpenseModal.tsx#L216)).
- `createExpense` runs its duplicate lookup only when a check number is supplied
  ([lines 110-119](../../../backend/src/controllers/expenseController.js#L110-L119)); a check-method
  expense with no number saves without complaint.
- `updateExpense` ([line 372](../../../backend/src/controllers/expenseController.js#L372)) accepts
  only `gl_code`, `amount`, `expense_date`, `payment_method`, `receipt_number` and `memo`. It ignores
  `check_number`, `invoice_number` and all three payee fields, so the edit path bypasses the
  uniqueness check entirely.
- Uniqueness is application-level only (a pre-insert `findOne`), with no database constraint.

## Goals

- Make the post-save experience feel immediate: no blanked Overview, no fetches for data that isn't
  visible, and a materially faster `/api/payments/stats`.
- Add a "Show Skipped Check Numbers" button on the Expenses tab that mirrors the existing receipt
  feature.
- Make expenses editable from the details drawer, show the check number as its own labelled field,
  and make `check_number` genuinely required and unique for check-method expenses on both create and
  edit.

## Non-goals

- Database indexes or any migration (explicitly deferred — see Known Limitations). In particular, no
  DB-level unique constraint on `check_number`; enforcement stays application-level.
- Editing the payee (employee / vendor / free-text name) — see Decisions.
- Backfilling check numbers on existing rows.
- Changing how expenses are stored, validated, or what `getPaymentStats` computes. The arithmetic in
  `getPaymentStats` is unchanged; only its query scheduling changes.
- Reworking `ExpenseList` pagination or filtering.
- Optimistic UI (inserting the new expense client-side before the server confirms).

## Decisions

- **Button placement:** Expenses tab header, next to "Add Expense" — mirrors the receipt button
  exactly. Not inline in the modal.
- **Perf scope:** frontend refetch behavior + backend query parallelization. No schema changes.
- **Check number range start:** lowest check number on record, overridable by `START_CHECK_NUMBER`.
- **No year filter on check gaps:** a checkbook runs continuously across years.
- **Editable fields:** everything except payee — category, amount, date, payment method, check #,
  receipt #, invoice #, memo. Payee stays read-only because changing employee/vendor rewrites who was
  paid, which is closer to a delete-and-recreate than an edit.
- **Legacy rows:** check # is required on every create and every edit going forward; existing
  check-method expenses with no number are flagged visually rather than force-blocked.
- **Uniqueness:** application-level, extended to cover the edit path. No migration.

---

## Part A — Performance

### A1. Tab-aware refresh (`TreasurerDashboard.tsx`)

`refreshFinancialData()` currently fans out to everything. Replace it with targeted refreshes.

Add a `statsStale` state flag. The expense `onSuccess` handler becomes:

- always dispatch `expenses:refresh` (the expense list is the thing that actually changed);
- always refetch skipped **checks** (directly affected — see Part B);
- refetch `/api/payments/stats` **only if** `activeTab === 'overview'`; otherwise `setStatsStale(true)`;
- never refetch skipped **receipts** — receipts come from `transactions`, which an expense cannot change.

A `useEffect` on `activeTab` fetches stats when the user lands on Overview with `statsStale === true`,
then clears the flag.

The payment path (`AddPaymentModal.onPaymentAdded`, `TransactionList.onTransactionAdded`) keeps its
current behavior: refresh stats **and** skipped receipts, since payments affect both.

### A2. Stop blanking the Overview (`TreasurerDashboard.tsx`)

In `fetchPaymentStats`:

- remove `setStats(null)`;
- keep `stats` populated during the refetch and render a subtle "refreshing" affordance instead of
  the empty state (the existing `loading` flag drives this; the `{stats && ...}` guard at line 382
  then only gates the genuine first load);
- add a monotonically increasing request-sequence ref so a slow in-flight response cannot overwrite a
  newer one when the year selector is changed rapidly.

Also remove the `console.log` calls in `fetchPaymentStats` (lines 199-227) — they currently dump the
full stats payload, which is member financial data, into the browser console.

### A3. Lazy skipped-receipts fetch (`TreasurerDashboard.tsx`)

The mount-time `useEffect` at
[lines 136-140](../../../frontend/src/components/admin/TreasurerDashboard.tsx#L136-L140) fires for
every treasurer regardless of which tab they use. Change it to fetch on first visit to the Payments
tab (guarded by a `hasFetchedReceipts` ref so it runs once per session, plus explicit refresh after a
payment is added).

### A4. Parallelize `getPaymentStats` (`memberPaymentController.js`)

Split `computeReconciliation` (lines 10-41) into two pieces:

```js
async function fetchReconciliationInputs(year) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const [depositsSum, debitsSum, threshold] = await Promise.all([
    BankTransaction.sum('amount', { where: { amount: { [Op.gt]: 0 }, date: { [Op.gte]: yearStart, [Op.lte]: yearEnd } } }),
    BankTransaction.sum('amount', { where: { amount: { [Op.lt]: 0 }, date: { [Op.gte]: yearStart, [Op.lte]: yearEnd } } }),
    getReconcileThresholdValue()
  ]);
  return { depositsSum, debitsSum, threshold };
}

function buildReconciliation(inputs, totalCollected, totalExpenses) { /* pure arithmetic, unchanged */ }
```

`computeReconciliation(year, collected, expenses)` is kept as a thin wrapper over the two so the
early-return branch at
[line 312](../../../backend/src/controllers/memberPaymentController.js#L312) and any other caller
stay working.

In `getPaymentStats`, issue one `Promise.all` wave covering: `Member.count`, `Member.findAll`,
`LedgerEntry.sum(membership_due)`, the grouped `LedgerEntry.findAll`, `LedgerEntry.sum(other)`,
`LedgerEntry.sum(expense)`, `BankTransaction.findOne(latest)`, and `fetchReconciliationInputs(year)`.
Only `BankTransaction.sum(newer than latest.date)` depends on a prior result, so it forms a second
short wave. `buildReconciliation` then runs on already-fetched inputs.

Net effect: ~12 sequential round trips collapse to 2 waves, so the endpoint's latency approaches its
slowest single query rather than the sum of all of them.

**Behavioral constraint:** the returned payload must be byte-identical to today's. The
`contributingMembers === 0` early return still short-circuits — it just does so after the wave has
been issued, which costs a few now-unused queries in an edge case that only occurs when no member has
a pledge. `paymentStatsComputation.test.js` must pass unchanged.

### A5. Cache modal dropdown data (`AddExpenseModal.tsx`)

`fetchCategories`, `fetchEmployees` and `fetchVendors` run on every open. Introduce a small shared
cache module, `frontend/src/utils/referenceDataCache.ts`:

```ts
export function getCached<T>(key: string): T | undefined;
export function setCached<T>(key: string, value: T): void;
export function invalidateCached(key: string): void;   // also accepts no arg to clear all
```

`AddExpenseModal` reads from the cache on open and only fetches on a miss, so reopening the modal is
instant.

**Correctness requirement:** today's fetch-every-open behavior means a vendor or employee added in the
Vendors/Employees tab shows up in the modal immediately. Caching would silently break that, so
`VendorList` and `EmployeeList` must call `invalidateCached('vendors')` / `invalidateCached('employees')`
after a successful create, update or delete. There is currently no `vendors:refresh`-style window event
in the codebase to hook into, so these are direct calls at the existing mutation success sites.
Expense categories are seeded reference data with no in-app editor, so `'categories'` needs no
invalidation path.

---

## Part B — Skipped Check Numbers

### B1. Backend: `GET /api/expenses/skipped-checks`

New handler `getSkippedChecks` in `expenseController.js`, modeled on `getSkippedReceipts`.

```js
const rows = await LedgerEntry.findAll({
  attributes: ['check_number'],
  where: { check_number: { [Op.ne]: null } },
  raw: true
});
```

Normalization: `check_number` is free text (`STRING(50)`, placeholder `CHK-1234`), so values are
normalized by stripping every non-digit character and parsing the remainder — `CHK-1234`, `#1234` and
`1234` all resolve to `1234`. Values with no digits at all are counted as `ignoredNonNumeric` and
reported in the response rather than silently dropped. Duplicates are collapsed via a `Set`.

Range:

- `start` = `parseInt(process.env.START_CHECK_NUMBER)` when set and valid, else the **minimum**
  observed check number. Receipts hardcode a `START_RECEIPT_NUMBER` default of `5680`; checks have no
  such known anchor, so anchoring to the lowest recorded check avoids reporting thousands of phantom
  gaps below the first check ever entered.
- `end` = maximum observed check number.
- Gaps = every integer in `[start, end)` absent from the set (matching the receipt implementation's
  bound).

Empty/no-numeric-data case returns `{ skippedChecks: [], range: null, ignoredNonNumeric }` with HTTP
200, matching how `getSkippedReceipts` handles an empty result.

Response shape:

```json
{ "success": true, "data": { "skippedChecks": [1012, 1013, 1044], "range": { "start": 1001, "end": 1147 }, "ignoredNonNumeric": 2 } }
```

### B2. Route registration (`expenseRoutes.js`)

```js
router.get('/skipped-checks', roleMiddleware(viewRoles), expenseController.getSkippedChecks);
```

**Must be registered before `router.get('/:id', ...)`** (currently
[line 25](../../../backend/src/routes/expenseRoutes.js#L25)) or the `:id` route swallows the request
and returns a 404/500 for expense id `"skipped-checks"`. Placing it next to `/categories` and
`/stats` satisfies this.

Guard is `viewRoles` — same as the rest of the read endpoints, and consistent with skipped receipts
using `viewRoles` on the transaction router.

### B3. Frontend: shared modal component

The skipped-receipts modal is ~65 lines of JSX inlined in `TreasurerDashboard`
([lines 609-675](../../../frontend/src/components/admin/TreasurerDashboard.tsx#L609-L675)). Rather
than duplicate it, extract `frontend/src/components/admin/SkippedNumbersModal.tsx`:

```ts
interface SkippedNumbersModalProps {
  title: string;
  warning: string;
  note: string;
  rangeLabel: string;
  numbers: number[];
  range: { start: number; end: number } | null;
  noneFoundLabel: string;
  closeLabel: string;
  onClose: () => void;
}
```

Presentational only — no data fetching, no i18n lookups inside. Both the receipts and checks call
sites pass their own translated strings. Markup and Tailwind classes are moved across verbatim so the
receipt modal is visually unchanged.

### B4. Frontend: Expenses tab wiring (`TreasurerDashboard.tsx`)

- New state: `skippedChecks: number[]`, `checkRange`, `showSkippedChecksModal`.
- `fetchSkippedChecks` callback, invoked on first visit to the Expenses tab (guarded by a ref, same
  pattern as A3) and after every successful expense add.
- Guarded by `permissions.canViewExpenses`, consistent with the tab itself.
- Yellow warning button rendered in the Expenses tab header next to "Add Expense"
  ([lines 428-437](../../../frontend/src/components/admin/TreasurerDashboard.tsx#L428-L437)), shown
  only when `skippedChecks.length > 0` — same conditional style as the receipt button.

```
Expenses                    [⚠ Show Skipped Check Numbers] [Add Expense]
```

### B5. i18n (`LanguageContext.tsx`)

Add a `treasurer.skippedChecks.*` block in both `en` and `ti`, mirroring
[`LanguageContext.tsx:541-547`](../../../frontend/src/contexts/LanguageContext.tsx#L541-L547):
`button`, `title`, `warning`, `range`, `noneFound`, `note`, `close`.

The Tigrigna strings are drafts and are added to `tigrigna-translation-review.md` for native-speaker
review, consistent with how the rest of the `ti` dictionary is tracked.

---

## Part C — Editable Expense Details + Required Check Number

### C1. Backend: `check_number` required and unique (`expenseController.js`)

A shared helper used by both create and update:

```js
async function validateCheckNumber({ paymentMethod, checkNumber, excludeId = null }) {
  if (paymentMethod !== 'check') return { ok: true, value: null };
  const value = (checkNumber || '').trim();
  if (!value) return { ok: false, status: 400, message: 'Check number is required for check payments' };
  const where = { check_number: value };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const existing = await LedgerEntry.findOne({ where });
  if (existing) return { ok: false, status: 409, message: `Check number "${value}" has already been used. Please use a unique check number.` };
  return { ok: true, value };
}
```

- **`createExpense`:** replace the conditional duplicate block at
  [lines 109-119](../../../backend/src/controllers/expenseController.js#L109-L119) with this helper.
  A check-method expense with a blank check number now returns 400 instead of saving.
- **`updateExpense`:** add `check_number` and `invoice_number` to the destructured body. Resolve the
  effective payment method as `payment_method ?? expense.payment_method` (the request may change only
  one of the two), then run the same helper with `excludeId: expense.id` so a row doesn't collide with
  itself. Switching an expense from cash to check without supplying a check number returns 400.
- Cash-method expenses continue to store `check_number: null`; if a method is changed from check to
  cash, the stored check number is cleared so it stops appearing in the gap scan.

`updateExpense` gains no payee handling — `employee_id`, `vendor_id` and `payee_name` remain
unaccepted, matching the read-only-payee decision.

**Interaction with Part B:** because check numbers were optional until now, existing check-method rows
with a null number represent checks that were written but recorded without a number. Those appear as
gaps in `/skipped-checks`, which is arguably correct — they *are* unaccounted-for numbers — but it
means the list will be noisy until the flagged legacy rows are cleaned up. C3's warning badge is the
mechanism for finding them.

### C2. Frontend: required check number in `AddExpenseModal`

Add `required` to the check number input, mark the label with the red asterisk used by the other
required fields, and extend `validateForm` to reject a blank check number when
`paymentMethod === 'check'` before the request is sent. Always send `check_number` when the method is
check (drop the `&& checkNumber` guard at
[line 216](../../../frontend/src/components/admin/AddExpenseModal.tsx#L216)) so the server-side
validation is reachable rather than shadowed by the client omitting the field.

The 409 duplicate response is surfaced in the existing `error` banner — the message from the API is
already user-facing.

### C3. Frontend: details drawer — display (`ExpenseList.tsx`)

Split the merged "Check / Receipt" row
([lines 478-481](../../../frontend/src/components/admin/ExpenseList.tsx#L478-L481)) into two
independent rows:

- **Check Number** — rendered only when `payment_method === 'check'`. Shows the number, or an amber
  "missing check number" badge when null (the legacy-row flag).
- **Receipt Number** — always rendered, `'-'` when absent.

The same amber badge appears in the expenses table row for check-method expenses with no number, so
they can be spotted without opening each drawer.

### C4. Frontend: details drawer — editing (`ExpenseList.tsx`)

An **Edit** button in the drawer header toggles the body between the current read-only view and a form
over the same fields. This is an in-place mode toggle, not a second modal, so the drawer keeps its
context.

- Editable: category (select, reusing the already-fetched `categories`), amount, date, payment method,
  check #, receipt #, invoice #, memo.
- Read-only throughout: payee, recorded-by, expense id, created-at.
- Client validation mirrors `AddExpenseModal`: positive amount, no future date, check # required when
  method is check.
- Save issues `PUT /api/expenses/:id` with only the changed fields, then replaces the row in local
  state from the response and re-runs `fetchExpenses()` so filters and totals stay consistent.
- Cancel restores the original values and returns to read-only.
- Errors (400 validation, 409 duplicate check number) render in a banner inside the drawer; the form
  stays open with the user's input intact.
- The Edit button is gated on the caller's ability to edit. `ExpenseList` currently takes no props and
  computes no permissions, so it accepts a new `canEdit?: boolean` prop, passed from
  `TreasurerDashboard` as `permissions.canAddExpenses` — the same permission that gates the Add
  Expense button. (The API is guarded independently by `editRoles` on the PUT route.)

Saving an edit also refreshes skipped checks and marks stats stale, reusing the A1 mechanism — an
edited amount changes the totals just as a new expense does. `ExpenseList` signals this by dispatching
the existing `expenses:refresh` event plus a new `expenses:changed` event that `TreasurerDashboard`
listens for.

### C5. i18n

New keys for: Edit / Save / Cancel, "Check Number", "Receipt Number", "Invoice Number", the
"missing check number" badge, and the required-check-number validation message — added to both `en`
and `ti`, with the Tigrigna drafts flagged for review alongside the Part B strings.

Several drawer labels are currently hardcoded English ("Expense Details", "Payee", "Record Info",
"Recorded By", "Memo", "Details", "Action"). Those are pre-existing and out of scope; new strings are
added properly rather than matching the surrounding hardcoding.

---

## Testing

**Backend** — new `backend/src/__tests__/controllers/expenseSkippedChecks.test.js` (sqlite in-memory,
following the existing controller-test pattern):

| Case | Expectation |
|---|---|
| Contiguous checks 1001-1005 | `skippedChecks: []` |
| 1001, 1002, 1005 | `skippedChecks: [1003, 1004]`, range `1001-1005` |
| Mixed `CHK-1001`, `#1002`, `1004` | normalized; `skippedChecks: [1003]` |
| No expenses with check numbers | `skippedChecks: []`, `range: null`, HTTP 200 |
| Entries with no digits (`"void"`) | excluded from gaps, counted in `ignoredNonNumeric` |
| `START_CHECK_NUMBER=1000` set, lowest recorded is 1001 | range starts at 1000, `1000` reported as a gap |
| Duplicate check numbers | collapsed, no spurious gap |

**Backend** — new/extended tests for Part C (`expenseController` create + update):

| Case | Expectation |
|---|---|
| Create, method `check`, blank check number | 400, nothing written |
| Create, method `cash`, blank check number | 201, `check_number` null |
| Create, duplicate check number | 409 |
| Update amount only, leaving an existing check number untouched | 200, no false self-collision |
| Update check number to one used by another expense | 409 |
| Update check number to a free value | 200, persisted |
| Update method `cash` → `check` without a check number | 400 |
| Update method `check` → `cash` | 200, stored check number cleared |
| Update attempts to set `employee_id` / `vendor_id` / `payee_name` | ignored, payee unchanged |

**Backend regression** — `paymentStatsComputation.test.js` must pass unchanged after A4. This is the
guard that parallelization did not alter the computed output.

**Frontend** — extend `frontend/src/components/admin/__tests__/`:

- skipped-checks button renders only when the endpoint returns gaps;
- `SkippedNumbersModal` renders the supplied numbers and range, and calls `onClose`;
- adding an expense while on the Expenses tab does **not** issue a `/api/payments/stats` request
  (the core A1 regression guard);
- `AddExpenseModal` reopened after a first load serves dropdowns from cache without refetching, and
  refetches after `invalidateCached('vendors')` (the A5 correctness guard);
- the drawer shows a distinct Check Number row for check-method expenses and the amber badge when it
  is null, and does **not** fall back to the receipt number (the C3 regression guard);
- the Edit button is hidden when `canEdit` is false;
- editing and saving issues a `PUT` with only changed fields and re-renders the updated row;
- a 409 from the API keeps the form open with the entered values and shows the error.

## Known Limitations

- **No indexes.** `ledger_entries` has no index on `type` or `check_number`
  ([`LedgerEntry.js:178-186`](../../../backend/src/models/LedgerEntry.js#L178-L186)). The expense
  list, the duplicate-check-number guard in `createExpense`
  ([line 111](../../../backend/src/controllers/expenseController.js#L111)) and the new
  `/skipped-checks` endpoint therefore all perform sequential scans. Acceptable at current row
  counts; the first place to look if `/skipped-checks` feels slow.
- **`/api/transactions/skipped-receipts` still scans unbounded.** A3 reduces how often it is called
  but does not make the query cheaper.
- **Uniqueness has a race window.** Enforcement is a `findOne` before the write, not a DB constraint,
  so two simultaneous saves of the same check number can both pass. Unlikely with a single treasurer
  entering expenses; a partial unique index on `ledger_entries(check_number)` closes it if it ever
  matters.
- **Legacy check-method rows with no check number stay invalid.** They are flagged but not blocked, so
  they will continue to appear as gaps in `/skipped-checks` until someone edits each one. There is no
  bulk-fix path in this design.
- **Check-number normalization is lossy by design.** Two genuinely different series (e.g. two
  checkbooks, or `A-1001` and `B-1001`) would collide. The current data model has no series field, so
  this is accepted; the `ignoredNonNumeric` count gives the treasurer a signal that something in the
  column isn't a plain check number.

## Files Touched

| File | Change |
|---|---|
| `frontend/src/components/admin/TreasurerDashboard.tsx` | A1, A2, A3, B4, C4 (`canEdit` prop, `expenses:changed`) |
| `frontend/src/components/admin/ExpenseList.tsx` | C3, C4 |
| `frontend/src/components/admin/AddExpenseModal.tsx` | A5, C2 |
| `frontend/src/utils/referenceDataCache.ts` | **new** — A5 |
| `frontend/src/components/admin/VendorList.tsx` | A5 — cache invalidation on mutation |
| `frontend/src/components/admin/EmployeeList.tsx` | A5 — cache invalidation on mutation |
| `frontend/src/components/admin/SkippedNumbersModal.tsx` | **new** — B3 |
| `frontend/src/contexts/LanguageContext.tsx` | B5, C5 |
| `backend/src/controllers/memberPaymentController.js` | A4 |
| `backend/src/controllers/expenseController.js` | B1, C1 |
| `backend/src/routes/expenseRoutes.js` | B2 |
| `backend/env.example` | document `START_CHECK_NUMBER` (optional) |
| `backend/src/__tests__/controllers/expenseSkippedChecks.test.js` | **new** — tests |
| `backend/src/__tests__/controllers/expenseController.test.js` | **new** — C1 create/update tests |
| `frontend/src/components/admin/__tests__/` | tests |
