# Bank Transaction Detail Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slide-over detail panel to the Bank Transactions table that shows the full transaction record and consolidates all reconciliation actions, replacing the existing inline action buttons.

**Architecture:** A new `BankTransactionDetail` component receives the selected `BankTransaction` as a prop and owns all display + action logic (confirm match, link to member, record expense, ignore). `BankTransactionList` adds a single `selectedTxn` state and a "Details →" button per row; the three existing modals and their associated state are removed.

**Tech Stack:** React, TypeScript, Tailwind CSS, `@testing-library/react`, Firebase Auth via `useAuth()`

---

## File Map

| File | Change |
|---|---|
| `frontend/src/components/finance/BankTransactionList.tsx` | Export `BankTransaction` interface; add `selectedTxn` state + "Details →" button; remove 3 modals + all migrated state/functions; render `<BankTransactionDetail>` |
| `frontend/src/components/finance/BankTransactionDetail.tsx` | **New** — slide-over panel: shell, field display, income actions, expense actions |
| `frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx` | **New** — tests for all panel behavior |
| `frontend/src/components/finance/__tests__/BankTransactionList.test.tsx` | Update to match new table row structure (Details button instead of inline actions) |

---

## Test Commands

Run finance-specific tests only (fast):
```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="finance"
```

Run all frontend tests:
```bash
cd frontend && npm test -- --watchAll=false
```

---

## Task 1: Export `BankTransaction` type + create `BankTransactionDetail` shell

**Files:**
- Modify: `frontend/src/components/finance/BankTransactionList.tsx:5` (add `export` to interface)
- Create: `frontend/src/components/finance/BankTransactionDetail.tsx`
- Create: `frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx`

- [ ] **Step 1.1: Write failing tests for open/close behavior**

Create `frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionDetail from '../BankTransactionDetail';
import { BankTransaction } from '../BankTransactionList';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

global.fetch = jest.fn();

const mockTxn: BankTransaction = {
  id: 42,
  date: '2026-03-28',
  amount: 200,
  description: 'ZELLE FROM DAWIT YIFTER ON 03/28 REF#ABC123',
  type: 'ZELLE',
  status: 'PENDING',
  payer_name: 'Dawit Yifter',
  check_number: null,
};

describe('BankTransactionDetail — shell behavior', () => {
  test('renders nothing when txn is null', () => {
    const { container } = render(
      <BankTransactionDetail txn={null} onClose={jest.fn()} onSuccess={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders panel when txn is provided', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Transaction Details' })).toBeInTheDocument();
  });

  test('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(<BankTransactionDetail txn={mockTxn} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByTestId('panel-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<BankTransactionDetail txn={mockTxn} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalled();
  });

  test('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn();
    render(<BankTransactionDetail txn={mockTxn} onClose={onClose} onSuccess={jest.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 1.2: Run tests — expect FAIL (file does not exist yet)**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="BankTransactionDetail"
```

Expected: FAIL — `Cannot find module '../BankTransactionDetail'`

- [ ] **Step 1.3: Export `BankTransaction` interface from `BankTransactionList.tsx`**

In `frontend/src/components/finance/BankTransactionList.tsx`, line 5, change:
```tsx
interface BankTransaction {
```
to:
```tsx
export interface BankTransaction {
```

- [ ] **Step 1.4: Create `BankTransactionDetail.tsx` shell**

Create `frontend/src/components/finance/BankTransactionDetail.tsx`:

```tsx
import React, { useEffect } from 'react';
import { BankTransaction } from './BankTransactionList';

interface Props {
  txn: BankTransaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

const BankTransactionDetail: React.FC<Props> = ({ txn, onClose, onSuccess }) => {
  useEffect(() => {
    if (!txn) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [txn, onClose]);

  if (!txn) return null;

  return (
    <>
      <div
        data-testid="panel-backdrop"
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Transaction Details"
        className="fixed top-0 right-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col"
      >
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-blue-900">
          <div>
            <p className="font-bold text-white text-sm">Transaction Details</p>
            <p className="text-blue-300 text-xs mt-0.5">#{txn.id}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="text-white bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full w-7 h-7 flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {/* Fields and actions added in Tasks 2–4 */}
        </div>
      </div>
    </>
  );
};

export default BankTransactionDetail;
```

- [ ] **Step 1.5: Run tests — expect PASS**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="BankTransactionDetail"
```

Expected: PASS (5 tests)

- [ ] **Step 1.6: Commit**

```bash
git add frontend/src/components/finance/BankTransactionDetail.tsx \
        frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx \
        frontend/src/components/finance/BankTransactionList.tsx
git commit -m "feat(bank): add BankTransactionDetail shell with slide-over behavior"
```

---

## Task 2: Transaction field display

**Files:**
- Modify: `frontend/src/components/finance/BankTransactionDetail.tsx`
- Modify: `frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx`

- [ ] **Step 2.1: Add failing tests for field display**

Append to the `describe` block in `BankTransactionDetail.test.tsx`:

```tsx
describe('BankTransactionDetail — field display', () => {
  test('shows transaction id in header', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('#42')).toBeInTheDocument();
  });

  test('shows PENDING status badge', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('PENDING REVIEW')).toBeInTheDocument();
  });

  test('shows full description without truncation', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('ZELLE FROM DAWIT YIFTER ON 03/28 REF#ABC123')).toBeInTheDocument();
  });

  test('shows type badge', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('ZELLE')).toBeInTheDocument();
  });

  test('shows payer name', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Dawit Yifter')).toBeInTheDocument();
  });

  test('shows formatted amount', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('$200.00')).toBeInTheDocument();
  });

  test('does not show check number when null', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.queryByText(/Check #/)).not.toBeInTheDocument();
  });

  test('shows check number when present', () => {
    const txnWithCheck = { ...mockTxn, check_number: '1042' };
    render(<BankTransactionDetail txn={txnWithCheck} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Check #1042')).toBeInTheDocument();
  });

  test('shows MATCHED status badge for matched transaction', () => {
    const matched = { ...mockTxn, status: 'MATCHED' as const, member: { first_name: 'Dawit', last_name: 'Yifter' } };
    render(<BankTransactionDetail txn={matched} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('MATCHED')).toBeInTheDocument();
    expect(screen.getByText('Dawit Yifter')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2: Run tests — expect FAIL on field display tests**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="BankTransactionDetail"
```

Expected: 5 PASS (shell), 9 FAIL (field display)

- [ ] **Step 2.3: Implement field display in the panel body**

Replace the `{/* Fields and actions added in Tasks 2–4 */}` comment in the panel body with:

```tsx
{/* Status badge */}
<div className="mb-4">
  {txn.status === 'PENDING' && (
    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
      PENDING REVIEW
    </span>
  )}
  {txn.status === 'MATCHED' && (
    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
      MATCHED
    </span>
  )}
  {txn.status === 'IGNORED' && (
    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
      IGNORED
    </span>
  )}
</div>

{/* Core fields card */}
<div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-3">
  <div className="grid grid-cols-2 gap-3">
    <div>
      <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Date</p>
      <p className="text-sm text-gray-900 font-medium">{txn.date}</p>
    </div>
    <div>
      <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Type</p>
      <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">
        {txn.type}
      </span>
    </div>
    <div>
      <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Amount</p>
      <p className={`text-lg font-bold ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(txn.amount)}
      </p>
    </div>
    {txn.payer_name && (
      <div>
        <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Payer Name</p>
        <p className="text-sm text-gray-900 font-medium">{txn.payer_name}</p>
      </div>
    )}
  </div>

  <div className="border-t border-gray-200 pt-3">
    <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Description</p>
    <p className="text-sm text-gray-900 break-words">{txn.description}</p>
  </div>

  {txn.check_number && (
    <div className="border-t border-gray-200 pt-3">
      <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Check Number</p>
      <p className="text-sm text-gray-900 font-medium">Check #{txn.check_number}</p>
    </div>
  )}
</div>

{/* Linked member (MATCHED) */}
{txn.status === 'MATCHED' && txn.member && (
  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
    <p className="text-xs text-green-700 font-bold mb-1">Linked Member</p>
    <p className="text-sm text-gray-900 font-semibold">
      {txn.member.first_name} {txn.member.last_name}
    </p>
  </div>
)}

{/* Actions section added in Tasks 3–4 */}
```

- [ ] **Step 2.4: Run tests — expect PASS**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="BankTransactionDetail"
```

Expected: PASS (14 tests)

- [ ] **Step 2.5: Commit**

```bash
git add frontend/src/components/finance/BankTransactionDetail.tsx \
        frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx
git commit -m "feat(bank): add transaction field display to detail panel"
```

---

## Task 3: PENDING income actions (confirm match, link to member, ignore)

**Files:**
- Modify: `frontend/src/components/finance/BankTransactionDetail.tsx`
- Modify: `frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx`

- [ ] **Step 3.1: Add failing tests for income actions**

Append to `BankTransactionDetail.test.tsx`:

```tsx
describe('BankTransactionDetail — PENDING income actions', () => {
  const mockTxnWithMatch: BankTransaction = {
    ...mockTxn,
    suggested_match: {
      type: 'donation',
      member: { id: 5, first_name: 'Dawit', last_name: 'Yifter' },
    },
  };

  test('shows suggested match card when suggested_match is present', () => {
    render(<BankTransactionDetail txn={mockTxnWithMatch} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Suggested Match Found')).toBeInTheDocument();
    expect(screen.getByText('Confirm Match')).toBeInTheDocument();
  });

  test('shows payment type selector for PENDING income', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByLabelText('Payment Type')).toBeInTheDocument();
  });

  test('year selector hidden when payment type is not membership_due', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.queryByLabelText('Year (Optional)')).not.toBeInTheDocument();
  });

  test('year selector appears when membership_due is selected', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Payment Type'), { target: { value: 'membership_due' } });
    expect(screen.getByLabelText('Year (Optional)')).toBeInTheDocument();
  });

  test('calls /api/bank/reconcile with MATCH action on Confirm Match', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    const onSuccess = jest.fn();
    render(<BankTransactionDetail txn={mockTxnWithMatch} onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText('Confirm Match'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bank/reconcile'),
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.action).toBe('MATCH');
    expect(body.transaction_id).toBe(42);
    expect(body.member_id).toBe(5);
  });

  test('shows member search input for Link to Different Member', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByPlaceholderText(/search member/i)).toBeInTheDocument();
  });

  test('shows Ignore Transaction button for PENDING income', () => {
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Ignore Transaction')).toBeInTheDocument();
  });

  test('calls /api/bank/reconcile with IGNORE action on Ignore', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    const onSuccess = jest.fn();
    render(<BankTransactionDetail txn={mockTxn} onClose={jest.fn()} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText('Ignore Transaction'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.action).toBe('IGNORE');
    expect(body.transaction_id).toBe(42);
  });
});
```

Also add `waitFor` to the import at the top of the test file:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
```

- [ ] **Step 3.2: Run tests — expect FAIL on new tests**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="BankTransactionDetail"
```

Expected: 14 PASS, 8 FAIL

- [ ] **Step 3.3: Add income actions state and logic to `BankTransactionDetail.tsx`**

Add state and helpers at the top of the component (after the `if (!txn) return null` guard, before the return):

```tsx
const { firebaseUser } = useAuth();
const [selectedPaymentType, setSelectedPaymentType] = useState('donation');
const [selectedForYear, setSelectedForYear] = useState<number | ''>('');
const [searchTerm, setSearchTerm] = useState('');
const [searchResults, setSearchResults] = useState<any[]>([]);
const [searching, setSearching] = useState(false);

const paymentTypes = [
  { value: 'donation', label: 'Donation (General)' },
  { value: 'tithe', label: 'Tithe (አስራት)' },
  { value: 'membership_due', label: 'Membership Due (ወርहዊ ክፍያ)' },
  { value: 'offering', label: 'Offering (መባእ)' },
  { value: 'building_fund', label: 'Building Fund (ንሕንጻ)' },
  { value: 'event', label: 'Event / Fundraising (ንበዓል)' },
  { value: 'tigray_hunger_fundraiser', label: 'Tigray Hunger Fundraiser (ረድኤት ንትግራይ)' },
  { value: 'vow', label: 'Vow / Selet (ስለት)' },
  { value: 'religious_item_sales', label: 'Religious Item Sales (ንዋየ ቅድሳት)' },
  { value: 'other', label: 'Other (ሌላ)' },
];

const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Member search debounce
useEffect(() => {
  const timer = setTimeout(async () => {
    if (!searchTerm || searchTerm.length < 3) { setSearchResults([]); return; }
    try {
      setSearching(true);
      const token = await firebaseUser?.getIdToken();
      const res = await fetch(`${apiUrl}/api/members/search?q=${encodeURIComponent(searchTerm)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setSearchResults(data.data.results);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, 300);
  return () => clearTimeout(timer);
}, [searchTerm, firebaseUser, apiUrl]);

const handleReconcile = async (memberId: number, paymentType: string = selectedPaymentType) => {
  const token = await firebaseUser?.getIdToken();
  const payload: any = { transaction_id: txn.id, action: 'MATCH', member_id: memberId, payment_type: paymentType };
  if (selectedForYear) payload.for_year = selectedForYear;
  const res = await fetch(`${apiUrl}/api/bank/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (res.ok) { onSuccess(); onClose(); }
};

const handleIgnore = async () => {
  const token = await firebaseUser?.getIdToken();
  const res = await fetch(`${apiUrl}/api/bank/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ transaction_id: txn.id, action: 'IGNORE' }),
  });
  if (res.ok) { onSuccess(); onClose(); }
};
```

Add `useState` and `useEffect` to the React import. Add `useAuth` import:
```tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
```

Replace `{/* Actions section added in Tasks 3–4 */}` in the JSX with:

```tsx
{/* Actions — PENDING income */}
{txn.status === 'PENDING' && txn.amount >= 0 && (
  <div className="border-t border-gray-200 pt-4">
    <p className="text-xs text-gray-400 uppercase font-semibold mb-3">Actions</p>

    {/* Suggested match card */}
    {txn.suggested_match && (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
        <p className="text-xs text-green-700 font-bold mb-1">Suggested Match Found</p>
        <p className="text-sm font-semibold text-gray-900">
          {txn.suggested_match.member.first_name} {txn.suggested_match.member.last_name}
        </p>
      </div>
    )}

    {/* Payment type + year */}
    <div className="mb-3">
      <label htmlFor="detail-payment-type" className="block text-xs font-semibold text-gray-600 mb-1">
        Payment Type
      </label>
      <select
        id="detail-payment-type"
        value={selectedPaymentType}
        onChange={(e) => setSelectedPaymentType(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
      >
        {paymentTypes.map((pt) => (
          <option key={pt.value} value={pt.value}>{pt.label}</option>
        ))}
      </select>
    </div>

    {selectedPaymentType === 'membership_due' && (
      <div className="mb-3">
        <label htmlFor="detail-payment-year" className="block text-xs font-semibold text-gray-600 mb-1">
          Year (Optional)
        </label>
        <select
          id="detail-payment-year"
          value={selectedForYear}
          onChange={(e) => setSelectedForYear(e.target.value ? parseInt(e.target.value) : '')}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Default (Auto)</option>
          {Array.from({ length: new Date().getFullYear() - 2025 }, (_, i) => new Date().getFullYear() - 1 - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    )}

    <div className="flex flex-col gap-2">
      {txn.suggested_match && (
        <button
          onClick={() => handleReconcile(txn.suggested_match!.member.id)}
          className="w-full bg-green-600 hover:bg-green-700 text-white rounded-md py-2 text-sm font-semibold"
        >
          Confirm Match
        </button>
      )}

      {/* Member search for Link to Different Member */}
      <div>
        <input
          type="text"
          placeholder="Search member by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        {searching && <p className="text-xs text-gray-400 mt-1">Searching...</p>}
        {searchResults.length > 0 && (
          <div className="mt-1 border border-gray-200 rounded-md max-h-40 overflow-y-auto">
            {searchResults.map((m) => (
              <div
                key={m.id}
                onClick={() => handleReconcile(m.id)}
                className="cursor-pointer hover:bg-gray-50 px-3 py-2 text-sm flex justify-between border-b last:border-0"
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-gray-400">{m.phoneNumber}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleIgnore}
        className="w-full border border-gray-200 text-gray-400 hover:bg-gray-50 rounded-md py-2 text-sm"
      >
        Ignore Transaction
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3.4: Run tests — expect PASS**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="BankTransactionDetail"
```

Expected: PASS (22 tests)

- [ ] **Step 3.5: Commit**

```bash
git add frontend/src/components/finance/BankTransactionDetail.tsx \
        frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx
git commit -m "feat(bank): add PENDING income actions to detail panel"
```

---

## Task 4: PENDING expense actions

**Files:**
- Modify: `frontend/src/components/finance/BankTransactionDetail.tsx`
- Modify: `frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx`

- [ ] **Step 4.1: Add failing tests for expense actions**

Append to `BankTransactionDetail.test.tsx`:

```tsx
describe('BankTransactionDetail — PENDING expense actions', () => {
  const mockExpenseTxn: BankTransaction = {
    id: 43,
    date: '2026-03-20',
    amount: -250,
    description: 'CHECK #1099 TO VENDOR',
    type: 'CHECK',
    status: 'PENDING',
    payer_name: null,
    check_number: '1099',
  };

  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  test('shows Record Expense button for negative-amount PENDING', () => {
    render(<BankTransactionDetail txn={mockExpenseTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Record Expense')).toBeInTheDocument();
  });

  test('does not show income action buttons for negative amount', () => {
    render(<BankTransactionDetail txn={mockExpenseTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.queryByLabelText('Payment Type')).not.toBeInTheDocument();
    expect(screen.queryByText('Ignore Transaction')).not.toBeInTheDocument();
  });

  test('fetches expense categories on mount for negative-amount PENDING', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ gl_code: '6000', name: 'Utilities', is_active: true }],
      }),
    });
    render(<BankTransactionDetail txn={mockExpenseTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/expenses/categories'),
        expect.any(Object)
      )
    );
  });

  test('calls /api/bank/reconcile-expense on Record Expense', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ gl_code: '6000', name: 'Utilities', is_active: true }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    const onSuccess = jest.fn();
    render(<BankTransactionDetail txn={mockExpenseTxn} onClose={jest.fn()} onSuccess={onSuccess} />);

    // Wait for categories to load
    await waitFor(() => screen.getByText('Utilities'));

    fireEvent.change(screen.getByRole('combobox', { name: /expense category/i }), {
      target: { value: '6000' },
    });
    fireEvent.click(screen.getByText('Record Expense'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bank/reconcile-expense'),
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(body.transaction_id).toBe(43);
    expect(body.gl_code).toBe('6000');
  });

  test('Record Expense button is disabled when no category selected', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    render(<BankTransactionDetail txn={mockExpenseTxn} onClose={jest.fn()} onSuccess={jest.fn()} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText('Record Expense')).toBeDisabled();
  });
});
```

- [ ] **Step 4.2: Run tests — expect FAIL on expense tests**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="BankTransactionDetail"
```

Expected: 22 PASS, 5 FAIL

- [ ] **Step 4.3: Add expense state and logic to `BankTransactionDetail.tsx`**

Add expense state alongside the income state (top of component body):

```tsx
const [expenseCategories, setExpenseCategories] = useState<{ gl_code: string; name: string }[]>([]);
const [expGlCode, setExpGlCode] = useState('');
const [expPayeeName, setExpPayeeName] = useState(txn.payer_name || '');
const [expMemo, setExpMemo] = useState(txn.description);
const [expLoading, setExpLoading] = useState(false);
const [expError, setExpError] = useState<string | null>(null);
```

Add lazy expense category fetch effect (after the member search effect):

```tsx
useEffect(() => {
  if (txn.amount >= 0) return;
  (async () => {
    const token = await firebaseUser?.getIdToken();
    const res = await fetch(`${apiUrl}/api/expenses/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setExpenseCategories((data.data || []).filter((c: any) => c.is_active));
    }
  })();
}, [txn.id, txn.amount, firebaseUser, apiUrl]);
```

Add `handleSubmitExpense` after `handleIgnore`:

```tsx
const handleSubmitExpense = async () => {
  if (!expGlCode) return;
  setExpLoading(true);
  try {
    const token = await firebaseUser?.getIdToken();
    const res = await fetch(`${apiUrl}/api/bank/reconcile-expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        transaction_id: txn.id,
        gl_code: expGlCode,
        payee_name: expPayeeName || undefined,
        memo: expMemo || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to record expense');
    onSuccess();
    onClose();
  } catch (err: any) {
    setExpError(err.message);
  } finally {
    setExpLoading(false);
  }
};
```

Add expense actions JSX after the income actions block:

```tsx
{/* Actions — PENDING expense */}
{txn.status === 'PENDING' && txn.amount < 0 && (
  <div className="border-t border-gray-200 pt-4">
    <p className="text-xs text-gray-400 uppercase font-semibold mb-3">Record as Expense</p>

    {expError && <p className="text-red-600 text-xs mb-3">{expError}</p>}

    <div className="mb-3">
      <label htmlFor="detail-exp-category" className="block text-xs font-semibold text-gray-600 mb-1">
        Expense Category *
      </label>
      <select
        id="detail-exp-category"
        aria-label="Expense Category"
        value={expGlCode}
        onChange={(e) => setExpGlCode(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
      >
        <option value="">-- Select category --</option>
        {expenseCategories.map((c) => (
          <option key={c.gl_code} value={c.gl_code}>{c.gl_code} — {c.name}</option>
        ))}
      </select>
    </div>

    <div className="mb-3">
      <label className="block text-xs font-semibold text-gray-600 mb-1">Payee (optional)</label>
      <input
        type="text"
        value={expPayeeName}
        onChange={(e) => setExpPayeeName(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        placeholder="Vendor or payee name"
      />
    </div>

    <div className="mb-4">
      <label className="block text-xs font-semibold text-gray-600 mb-1">Memo (optional)</label>
      <textarea
        value={expMemo}
        onChange={(e) => setExpMemo(e.target.value)}
        rows={2}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
      />
    </div>

    <button
      onClick={handleSubmitExpense}
      disabled={expLoading || !expGlCode}
      className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-md py-2 text-sm font-semibold"
    >
      {expLoading ? 'Saving...' : 'Record Expense'}
    </button>
  </div>
)}
```

- [ ] **Step 4.4: Run tests — expect PASS**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="BankTransactionDetail"
```

Expected: PASS (27 tests)

- [ ] **Step 4.5: Commit**

```bash
git add frontend/src/components/finance/BankTransactionDetail.tsx \
        frontend/src/components/finance/__tests__/BankTransactionDetail.test.tsx
git commit -m "feat(bank): add PENDING expense actions to detail panel"
```

---

## Task 5: Update `BankTransactionList` — wire in panel, remove old modals

**Files:**
- Modify: `frontend/src/components/finance/BankTransactionList.tsx`
- Modify: `frontend/src/components/finance/__tests__/BankTransactionList.test.tsx`

- [ ] **Step 5.1: Update the existing test to match new table row structure**

Replace the entire content of `frontend/src/components/finance/__tests__/BankTransactionList.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BankTransactionList from '../BankTransactionList';

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ firebaseUser: { getIdToken: () => Promise.resolve('mock-token') } }),
}));

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

global.fetch = jest.fn();

const mockTransactions = [
  {
    id: 1,
    date: '2026-02-01',
    amount: 100,
    description: 'Test Payment',
    type: 'ZELLE',
    status: 'PENDING',
    payer_name: 'John Doe',
    check_number: null,
  },
];

const setupFetchMock = () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    json: () =>
      Promise.resolve({
        success: true,
        data: { transactions: mockTransactions, pagination: { pages: 1 }, current_balance: 1000 },
      }),
  });
};

describe('BankTransactionList', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  test('shows Details button for each transaction', async () => {
    setupFetchMock();
    render(<BankTransactionList refreshTrigger={0} />);
    await waitFor(() => screen.getByText('Test Payment'));
    expect(screen.getByText('Details →')).toBeInTheDocument();
  });

  test('does not show inline action buttons in table row', async () => {
    setupFetchMock();
    render(<BankTransactionList refreshTrigger={0} />);
    await waitFor(() => screen.getByText('Test Payment'));
    expect(screen.queryByText('Link and Add Transaction')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm Match')).not.toBeInTheDocument();
    expect(screen.queryByText('Add Expense')).not.toBeInTheDocument();
  });

  test('opens detail panel when Details button is clicked', async () => {
    setupFetchMock();
    render(<BankTransactionList refreshTrigger={0} />);
    await waitFor(() => screen.getByText('Test Payment'));
    fireEvent.click(screen.getByText('Details →'));
    expect(screen.getByRole('dialog', { name: 'Transaction Details' })).toBeInTheDocument();
  });

  test('closes detail panel when backdrop is clicked', async () => {
    setupFetchMock();
    render(<BankTransactionList refreshTrigger={0} />);
    await waitFor(() => screen.getByText('Test Payment'));
    fireEvent.click(screen.getByText('Details →'));
    expect(screen.getByRole('dialog', { name: 'Transaction Details' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('panel-backdrop'));
    expect(screen.queryByRole('dialog', { name: 'Transaction Details' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 5.2: Run test — expect FAIL (new assertions, old component structure)**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="BankTransactionList.test"
```

Expected: FAIL — `Details →` not found, inline buttons still present

- [ ] **Step 5.3: Update `BankTransactionList.tsx` — remove migrated state/functions**

**Remove these state declarations** (lines approx. 52–69):
```tsx
// Remove all of these:
const [showLinkModal, setShowLinkModal] = useState(false);
const [showConfirmModal, setShowConfirmModal] = useState(false);
const [txnToLink, setTxnToLink] = useState<BankTransaction | null>(null);
const [matchCandidate, setMatchCandidate] = useState<any>(null);
const [selectedPaymentType, setSelectedPaymentType] = useState('donation');
const [searchTerm, setSearchTerm] = useState('');
const [searchResults, setSearchResults] = useState<any[]>([]);
const [searching, setSearching] = useState(false);
const [showExpenseModal, setShowExpenseModal] = useState(false);
const [txnToExpense, setTxnToExpense] = useState<BankTransaction | null>(null);
const [expenseCategories, setExpenseCategories] = useState<...>([]);
const [expGlCode, setExpGlCode] = useState('');
const [expPayeeName, setExpPayeeName] = useState('');
const [expMemo, setExpMemo] = useState('');
const [expLoading, setExpLoading] = useState(false);
const [expError, setExpError] = useState<string | null>(null);
const [selectedForYear, setSelectedForYear] = useState<number | ''>('');
```

**Remove these functions** (roughly lines 173–367):
- `openExpenseModal`
- `handleSubmitExpense`
- `handleReconcile` (single-txn only; `handleBulkReconcile` stays)
- `openConfirmModal`
- `handleConfirmReconcile`
- `openLinkModal`
- `handleManualReconcile`
- Member search `useEffect`
- `paymentTypes` constant

**Remove these useEffect hooks:**
- The member search debounce `useEffect` (lines ~72–101)

**Add `selectedTxn` state** (after `currentBalance` state):
```tsx
const [selectedTxn, setSelectedTxn] = useState<BankTransaction | null>(null);
```

**Add import** at top of file:
```tsx
import BankTransactionDetail from './BankTransactionDetail';
```

- [ ] **Step 5.4: Update the Action column in the table row**

Replace the entire `<td>` that renders action buttons (the one starting with `{txn.status === 'PENDING' && (`) with:

```tsx
<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
  <button
    onClick={() => setSelectedTxn(txn)}
    className={`text-xs px-3 py-1.5 rounded font-semibold border transition-colors ${
      selectedTxn?.id === txn.id
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
    }`}
  >
    Details →
  </button>
</td>
```

Also remove the `{txn.status === 'MATCHED' && txn.member && (...)}` span that shows "Linked to: [name]" — this info is now in the panel.

- [ ] **Step 5.5: Add `<BankTransactionDetail>` render and remove the 3 old modals**

At the very bottom of the component return, remove the three modal blocks:
- `{/* Manual Link Modal */}` block
- `{/* Confirm Match Modal */}` block
- `{/* Expense Modal */}` block

Replace them with:

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

- [ ] **Step 5.6: Run all finance tests — expect PASS**

```bash
cd frontend && npx react-scripts test --watchAll=false --testPathPattern="finance"
```

Expected: PASS (all tests across both test files)

- [ ] **Step 5.7: Commit**

```bash
git add frontend/src/components/finance/BankTransactionList.tsx \
        frontend/src/components/finance/__tests__/BankTransactionList.test.tsx
git commit -m "feat(bank): wire BankTransactionDetail into list, remove inline action buttons"
```

---

## Final Verification

- [ ] **Run full frontend test suite**

```bash
cd frontend && npm test -- --watchAll=false
```

Expected: All tests pass, no regressions.

- [ ] **Manual smoke test**
  1. Open the Bank Integration tab
  2. Click "Details →" on a PENDING income transaction — panel slides in, shows all fields, actions present
  3. Click "Details →" on a PENDING negative-amount transaction — expense form shown, income actions absent
  4. Click "Details →" on a MATCHED transaction — linked member shown, no action buttons
  5. Click "Details →" on an IGNORED transaction — details shown, no action buttons
  6. Close panel via ✕ button, backdrop click, and Escape key
  7. Confirm the bulk select checkboxes and "Link N Transactions" button still work as before
