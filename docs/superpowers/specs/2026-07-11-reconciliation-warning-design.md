# Reconciliation-Required Warning on Payment Overview

**Date:** 2026-07-11
**Status:** Approved design — pending spec review

## Context & Problem

The Treasurer → Payment Overview page shows a "Financial Health" card with **Total Receipts (YEAR)**, **Total Expenses (YEAR)**, and a **Jan–<month> Net**. These come from `/api/payments/stats` (`getPaymentStats`), which is derived from `ledger_entries` — the church's *internal* record of recorded income and categorized expenses.

Separately, the Bank Reconciliation tab shows a Monthly Summary derived from `bank_transactions` (the actual Chase CSV). The two never reconcile on their own: the ledger only contains recorded/categorized activity, while the bank contains every deposit and debit that hit the account. When they diverge, a treasurer should be prompted that **reconciliation is required**.

## Goal

Show a small warning indicator (icon + tooltip) next to **Total Receipts** and **Total Expenses** on the Payment Overview when the ledger total for the selected year differs from the corresponding bank total by more than a configurable threshold. The icon links to the Bank Reconciliation tab.

## Non-goals

- Making the two data sources actually reconcile (they are different by design).
- Per-month or per-transaction warnings.
- A dedicated admin settings **screen** for the threshold (the value is editable via the settings API; a UI control is a possible follow-up, see Out of Scope).

## Decisions (from brainstorming)

- **Trigger:** ledger total vs bank total differ (not "unreconciled count").
- **Comparison:** Receipts ↔ bank deposits; Expenses ↔ bank debits, both scoped to the selected year.
- **Tolerance:** fixed dollar threshold, default **$50**, stored in `ChurchSetting` (admin-editable), shared by both sides.
- **UI:** amber ⚠ icon + hover tooltip; icon **links to the Bank Reconciliation tab**; the dollar amount itself stays visually subtle (no color change).

## Design Overview

Compute the comparison server-side in `getPaymentStats` and return a `reconciliation` object alongside the existing stats. The Payment Overview (`PaymentStats.tsx`) reads that object and renders an icon+tooltip when a side is unreconciled. The icon triggers a tab switch to Bank Reconciliation via a new callback prop.

Approach chosen over (a) client-side comparison — the bank Monthly Summary endpoint is a rolling 12 months, not year-scoped, and the threshold/config would leak into the client; and (b) a new dedicated endpoint — an extra round-trip for data the page already loads.

## Backend Changes

### 1. Threshold setting (`ChurchSetting` + settings API)

`ChurchSetting` is a key/value store (`key` PK, `value` TEXT).

- **Key:** `reconcile_threshold_dollars`, **default `50`** when unset.
- **Read helper** (in `churchSettingController` or inline in `getPaymentStats`):
  `const s = await ChurchSetting.findByPk('reconcile_threshold_dollars'); const threshold = s ? parseFloat(s.value) : 50;` (fall back to 50 if `NaN` or `<= 0`).
- **New endpoints** in `settingRoutes.js` + `churchSettingController.js`, mirroring the `tv-rotation-interval` pattern:
  - `GET /api/settings/reconcile-threshold` → `{ success, data: { dollars } }`
  - `PUT /api/settings/reconcile-threshold` body `{ dollars }` → validates `dollars` is a number `>= 0` and `<= 100000`, `upsert({ key, value: String(dollars) })`.
  - Guard: `firebaseAuthMiddleware, roleMiddleware(['admin', 'treasurer'])`.

### 2. `getPaymentStats` — bank year totals + `reconciliation` object

`getPaymentStats` already resolves `year`, `totalCollected`, and `totalExpenses`. Add, using the year as string bounds (the `date` column is `DATEONLY`; avoid `new Date()` coercion — consistent with `getMonthlySummary`):

```js
const yearStart = `${year}-01-01`;
const yearEnd   = `${year}-12-31`;

const depositsSum = await BankTransaction.sum('amount', {
  where: { amount: { [Op.gt]: 0 }, date: { [Op.gte]: yearStart, [Op.lte]: yearEnd } }
});
const debitsSum = await BankTransaction.sum('amount', {
  where: { amount: { [Op.lt]: 0 }, date: { [Op.gte]: yearStart, [Op.lte]: yearEnd } }
});

const hasBankData   = depositsSum !== null || debitsSum !== null; // sum() is null when no rows
const bankDeposits  = Number(depositsSum || 0);
const bankDebits    = Math.abs(Number(debitsSum || 0));           // debits stored negative

const receiptsDifference = Number((totalCollected - bankDeposits).toFixed(2));
const expensesDifference = Number((totalExpenses - bankDebits).toFixed(2));

const receiptsReconciled = hasBankData ? Math.abs(receiptsDifference) <= threshold : true;
const expensesReconciled = hasBankData ? Math.abs(expensesDifference) <= threshold : true;

const reconciliation = {
  thresholdDollars: threshold,
  hasBankData,
  bankDeposits: Number(bankDeposits.toFixed(2)),
  bankDebits:   Number(bankDebits.toFixed(2)),
  receiptsReconciled,  receiptsDifference,
  expensesReconciled,  expensesDifference,
};
```

- Compute `threshold` and `reconciliation` **before** the `contributingMembers === 0` early return, and include the `reconciliation` object in **both** return paths (in the early-return branch, `totalCollected` is other-income only and `totalExpenses` is absent, so `expensesDifference` there compares against `0`; that branch only fires when no members have a pledge, and receipts still compare correctly).
- No change to existing fields; `reconciliation` is additive.

### API response shape (additive)

```jsonc
{
  "success": true,
  "data": {
    "totalCollected": 42300.00,
    "totalExpenses": 18900.00,
    "netIncome": 23400.00,
    // ...existing fields...
    "reconciliation": {
      "thresholdDollars": 50,
      "hasBankData": true,
      "bankDeposits": 45100.00,
      "bankDebits": 18920.00,
      "receiptsReconciled": false,
      "receiptsDifference": -2800.00,
      "expensesReconciled": true,
      "expensesDifference": -20.00
    }
  }
}
```

## Frontend Changes (`PaymentStats.tsx` + `TreasurerDashboard.tsx`)

### 1. Types

Add to `PaymentStatsData` (in `TreasurerDashboard.tsx`, where the interface lives) an optional field:

```ts
reconciliation?: {
  thresholdDollars: number;
  hasBankData: boolean;
  bankDeposits: number;
  bankDebits: number;
  receiptsReconciled: boolean;
  receiptsDifference: number;
  expensesReconciled: boolean;
  expensesDifference: number;
};
```

Add a prop to `PaymentStatsProps`: `onNavigateToBank?: () => void;`

### 2. Wire the tab switch

Bank Reconciliation is a **tab** in `TreasurerDashboard` (`activeTab === 'bank'`), not a route. Where `<PaymentStats ... />` is rendered (under `activeTab === 'overview'`), pass `onNavigateToBank={() => setActiveTab('bank')}`.

### 3. Icon + tooltip

Next to the Total Receipts label (`PaymentStats.tsx` ~line 179) and Total Expenses label (~line 185), render a warning affordance when that side is unreconciled:

- Condition (receipts): `const r = stats.reconciliation; const showReceiptsWarn = !!r && r.hasBankData && !r.receiptsReconciled;` (analogous `showExpensesWarn`).
- Element: a `<button type="button" onClick={onNavigateToBank}>` wrapping an amber warning icon (⚠ / small triangle SVG), `aria-label` set to the tooltip text, `title` attribute (or existing tooltip pattern) for hover text. Keep the dollar amount styling unchanged (subtle).
- Tooltip copy (receipts example):
  `Ledger shows {fmt(totalCollected)}, bank shows {fmt(bankDeposits)} — a {fmt(|receiptsDifference|)} difference. Reconciliation required.`
  Expenses uses `totalExpenses` / `bankDebits` / `expensesDifference`.

### 4. i18n

Add strings under the `treasurerDashboard.stats` namespace (both `en` and `ti` locale files), e.g. `reconcileWarningReceipts`, `reconcileWarningExpenses`, with interpolation for ledger/bank/difference amounts. Follow the existing `t(...)` usage in the component.

## Edge Cases

- **No bank data for the year** (`hasBankData === false`, e.g. statement not uploaded): both sides reported reconciled → no icon. Avoids a misleading "bank $0" prompt.
- **Debits stored negative:** bank debits use `Math.abs(SUM(amount < 0))`.
- **Rounding:** all money rounded to 2 decimals; comparison uses `Math.abs(diff) <= threshold`.
- **Threshold unset / invalid:** falls back to `50`.
- **Early-return branch** (no pledged members): still returns `reconciliation`; receipts comparison valid, expenses compares to `0`.

## Testing

**Backend** (extend the `paymentStatsComputation.test.js` mock-model style):
- Within threshold → `receiptsReconciled`/`expensesReconciled` true.
- Beyond threshold → false, with correct signed `*Difference`.
- No bank rows (`BankTransaction.sum` → null) → `hasBankData` false, both reconciled true.
- Threshold read from `ChurchSetting` (default 50 when unset; custom value honored).
- Settings endpoint: `PUT /api/settings/reconcile-threshold` validation (rejects negatives / non-numbers) and `GET` returns stored/default value.

**Frontend** (`PaymentStats` render tests):
- Renders the receipts warning icon only when `hasBankData && !receiptsReconciled`; none when reconciled or no bank data.
- Clicking the icon calls `onNavigateToBank`.
- Amount text keeps its existing class (no color change).

## Out of Scope (confirm during review)

- A dedicated **admin settings UI control** for the threshold. The value is editable via `PUT /api/settings/reconcile-threshold` (and directly in `church_settings`); a form input on a settings page can be a follow-up.
- Reconciling the ledger and bank data sources; per-month/per-transaction indicators.
