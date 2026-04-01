# Bank Transaction Detail Panel

**Date:** 2026-03-31  
**Status:** Approved  
**Scope:** `frontend/src/components/finance/`

---

## Overview

Add a "Details →" button to each row in the Bank Transactions table (Bank Integration tab). Clicking it opens a slide-over panel from the right showing the full transaction record and all reconciliation actions. The existing inline action buttons are removed from the table row.

---

## Goals

- Give the treasurer a professional, readable view of all transaction fields (currently truncated or hidden)
- Consolidate all per-transaction actions (confirm match, link to member, record expense, ignore) into one place
- Reduce visual clutter in the table by removing multiple inline action buttons per row

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/finance/BankTransactionDetail.tsx` | **New** — slide-over panel component |
| `frontend/src/components/finance/BankTransactionList.tsx` | **Modified** — selection state, "Details →" button, renders panel |

---

## BankTransactionDetail Component

### Props

```ts
interface BankTransactionDetailProps {
  txn: BankTransaction | null;
  onClose: () => void;
  onSuccess: () => void; // called after any successful action
}
```

### Behaviour

- Renders as a fixed-position slide-over panel (`z-50`, `w-96`, full viewport height) on the right side of the screen
- Visible when `txn` is non-null; hidden (off-screen) when null
- Animates in/out using a CSS transition (`translate-x-full` ↔ `translate-x-0`)
- A semi-transparent backdrop overlay covers the rest of the page; clicking it calls `onClose`
- Pressing Escape calls `onClose` (keydown listener added on mount, removed on unmount)
- Calling `onClose` does **not** trigger a list refresh unless an action was successfully taken (`onSuccess` handles that)

### Panel Header

- Dark blue background (`#1e3a5f`)
- Title: "Transaction Details" + transaction ID (`#TXN-{id}`)
- ✕ close button (white, top-right)

### Panel Body — Fields Shown

All fields displayed in a `bg-gray-50` card:

| Field | Notes |
|---|---|
| Date | Formatted (e.g. Mar 28, 2026) |
| Type | Coloured badge (ZELLE, CHECK, ACH, DEBIT) |
| Amount | Large, green for positive / red for negative |
| Payer Name | Full payer name from `payer_name` |
| Full Description | Not truncated; word-break enabled |
| Check Number | Shown only when present |
| Status | Badge at top of panel |

### Panel Actions — By State

| Transaction state | Actions section shows |
|---|---|
| PENDING, amount ≥ 0, `suggested_match` present | Suggested match card (member name, match type) → payment type selector → year selector (membership_due only) → **Confirm Match** (green) + **Link to Different Member** (outline) + **Ignore Transaction** (muted) |
| PENDING, amount ≥ 0, no `suggested_match` | Member search input + results list → payment type selector → year selector (membership_due only) → **Link and Add Transaction** (blue) + **Ignore Transaction** (muted) |
| PENDING, amount < 0 | Expense category selector (required) → payee name (optional) → memo (optional) → **Record Expense** (orange) |
| MATCHED | Linked member name displayed (read-only); no action buttons |
| IGNORED | Details displayed (read-only); no action buttons |

### Local State (self-contained)

The panel calls `useAuth()` directly for its own API requests and owns all its interaction state:

- `selectedPaymentType`, `selectedForYear`
- `searchTerm`, `searchResults`, `searching`
- `expenseCategories` (fetched lazily on first negative-amount open)
- `expGlCode`, `expPayeeName`, `expMemo`, `expLoading`, `expError`

On any successful action the panel calls `onSuccess()` then `onClose()`.

---

## BankTransactionList Changes

### State Removed

All of the following move to `BankTransactionDetail`:

- `showLinkModal`, `showConfirmModal`, `showExpenseModal`
- `txnToLink`, `matchCandidate`
- `selectedPaymentType`, `selectedForYear`
- `searchTerm`, `searchResults`, `searching`
- `expenseCategories`, `expGlCode`, `expPayeeName`, `expMemo`, `expLoading`, `expError`

### State Added

```ts
const [selectedTxn, setSelectedTxn] = useState<BankTransaction | null>(null);
```

### Functions Removed

- `openLinkModal`, `openConfirmModal`, `openExpenseModal`
- `handleReconcile` (single-txn), `handleConfirmReconcile`, `handleManualReconcile`, `handleSubmitExpense`
- Member search `useEffect`

### Functions Kept

- `fetchTransactions`, `handleBulkReconcile`, `formatCurrency`

### Table Row — Action Column

Replaces all current inline buttons with a single button:

```tsx
<button onClick={() => setSelectedTxn(txn)}>
  Details →
</button>
```

The button uses an active/outline style when `selectedTxn?.id === txn.id`.

For MATCHED rows, the current "Linked to: [name]" text is removed; that info is now in the panel.

### Bulk Select (unchanged)

The checkbox column, `selectedTxnIds` state, `isBulkMode`, and `handleBulkReconcile` remain in `BankTransactionList` unchanged. Bulk actions do not go through the detail panel.

### Panel Render

Added once, outside the table:

```tsx
<BankTransactionDetail
  txn={selectedTxn}
  onClose={() => setSelectedTxn(null)}
  onSuccess={() => {
    setSelectedTxn(null);
    fetchTransactions();
    window.dispatchEvent(new CustomEvent('payments:refresh'));
  }}
/>
```

---

## Out of Scope

- Unlink / re-open actions for MATCHED or IGNORED transactions
- Any changes to the bulk reconcile flow
- Changes to other tabs in TreasurerDashboard
