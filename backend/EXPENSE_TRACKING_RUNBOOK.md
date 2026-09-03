# Expense Tracking System - Implementation Runbook

**Version**: 1.0.0  
**Date**: October 2025  
**Feature**: Church Expense Management System

---

## 📋 Overview

This runbook documents the implementation of the Expense Tracking System for Abune Aregawi Church. The system allows treasurers, administrators, and church leadership to record, track, and report on church expenses using GL (General Ledger) codes.

---

## 🎯 Feature Scope

### Included in v1.0.0
- ✅ Record expenses with GL codes
- ✅ Support for cash and check payment methods
- ✅ Check numbers are numeric-only, unique across expenses, and audited for gaps from #1593
- ✅ Fixed expense categories (9 predefined)
- ✅ Direct expense entry (no approval required)
- ✅ Expense list view with filtering
- ✅ Expense statistics and reporting
- ✅ Role-based access (Treasurer, Admin, Leadership)
- ✅ Integration with existing ledger_entries table

### Deferred to Future Versions
- ⏳ Approval workflow
- ⏳ Expense reimbursements
- ⏳ Receipt/attachment uploads
- ⏳ Additional payment methods (wire, credit card, etc.)
- ⏳ Recurring expense scheduling
- ⏳ Budget vs actual tracking

---


## Checks and bank reconciliation

Check numbers are the church's own checkbook sequence, so they are stored as
canonical digits: `#1593`, `01593` and `1593` all normalize to `1593`. A
non-numeric check number is rejected with a 400, and a number already used by
another expense with a 409. The uniqueness check is scoped to expenses — a
member paying the church by check may legitimately use the same number.

The skipped-check audit (`GET /api/expenses/skipped-checks`) anchors at check
**1593**, the first check of the current checkbook. Numbers below it belong to a
retired book and are not reported as gaps. Override with `START_CHECK_NUMBER`
when a new checkbook starts.

**Checks are never auto-created from the bank.** The treasurer records the
expense when the check is written; the bank debit that clears days later is
matched against it on check number *and* amount:

| Situation | Bank screen | Expenses screen |
|---|---|---|
| Number and amount both match | `RECONCILED` (green) | `Reconciled` |
| Number matches, amount differs | `NOT RECONCILED` (red), shows both amounts | `Not reconciled` |
| No expense recorded for that number | `NOT RECONCILED` (red) | — |
| Bank row has no readable check number | `NOT RECONCILED` (red) | — |

Undoing a check match unlinks the expense; it never deletes it, because the
expense was entered by hand.

Non-check debits (ACH, card) still auto-record an expense from a learned
payee→GL mapping, unchanged.

### Payment methods

Manual entry accepts only `cash` and `check`. Bank reconciliation also writes
`ach`, `debit_card`, `credit_card` and `other`, so the expense list can contain
methods the Add Expense form cannot produce. The Method filter is populated from
`GET /api/expenses/payment-methods`, which returns the methods actually present
on expenses, so it never offers a choice that matches nothing.

Both the automatic pass and the treasurer's manual **Reconcile as expense**
action derive the method from the bank row via the same
`paymentMethodForBankTxn()` helper. The manual path used to hardcode `check`,
filing every ACH and card debit as a check with no check number.

Card purchases previously fell through to `other`, because `sourceTypeFor()`
recognizes only ZELLE, ACH and CHECK and returns the bank's raw type otherwise.
They are now labelled `debit_card` (or `credit_card`). **Rows recorded before
this change remain `other`** — no backfill was run. `sourceTypeFor()` itself is
deliberately unchanged: its output also forms `expense_memo_matches.match_key`,
so altering it would orphan every learned payee→GL mapping.

## 🗄️ Database Changes

### 1. New Table: `expense_categories`

```sql
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gl_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_fixed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expense_categories_gl_code ON expense_categories(gl_code);
CREATE INDEX idx_expense_categories_is_active ON expense_categories(is_active);
```

### 2. Seed Data - Fixed Expense Categories

```sql
INSERT INTO expense_categories (gl_code, name, description, is_active, is_fixed) VALUES
('EXP001', 'Salary/Allowance', 'Monthly staff salaries and allowances', true, true),
('EXP002', 'Mortgage', 'Monthly mortgage payment', true, true),
('EXP003', '1800 Loan Interest Payment', 'Interest payment on 1800 loan', true, true),
('EXP004', 'Monthly FDGL Lease PYMT ZOOM, T-MOBILE & TSYS', 'Fixed monthly lease payments', true, true),
('EXP005', 'Utility', 'Electricity, water, gas utilities', true, true),
('EXP006', 'Cable', 'Cable and internet services', true, true),
('EXP007', 'Property Insurance', 'Property and liability insurance', true, true),
('EXP008', 'Rent Expense', 'Rental expenses for facilities', true, true),
('EXP009', 'Chase Credit Card Payment', 'Credit card payment to Chase', true, true);
```

### 3. ledger_entries Table Usage

No schema changes needed. Expenses use:
- `type = 'expense'` (currently only 'income')
- `category` = GL code (e.g., 'EXP001')
- `transaction_id` = NULL
- `member_id` = NULL

---

## 🔧 Backend Implementation

### File Structure
```
backend/src/
├── models/ExpenseCategory.js          [NEW]
├── controllers/expenseController.js   [NEW]
├── routes/expenseRoutes.js            [NEW]
└── server.js                          [UPDATE]
```

### API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/expenses/categories | Treasurer+ | Get expense categories |
| POST | /api/expenses | Treasurer+ | Create expense |
| GET | /api/expenses | Treasurer+ | List expenses |
| GET | /api/expenses/:id | Treasurer+ | Get expense detail |
| PUT | /api/expenses/:id | Treasurer+ | Update expense |
| DELETE | /api/expenses/:id | Admin | Delete expense |
| GET | /api/expenses/stats | Treasurer+ | Expense statistics |

---

## 🎨 Frontend Implementation

### File Structure
```
frontend/src/components/admin/
├── AddExpenseModal.tsx        [NEW]
├── ExpenseList.tsx            [NEW]
├── ExpenseStats.tsx           [NEW]
└── TreasurerDashboard.tsx     [UPDATE]
```

### UI Changes
1. Add "Add Expense" button next to "Add Payment"
2. New "Expenses" tab in Treasurer Dashboard
3. Update Overview stats to include expenses

---

## 🔐 Role Permissions

| Action | Treasurer | Admin | Leadership |
|--------|-----------|-------|------------|
| View Expenses | ✅ | ✅ | ✅ |
| Add Expense | ✅ | ✅ | ❌ |
| Edit Expense | ✅ | ✅ | ❌ |
| Delete Expense | ❌ | ✅ | ❌ |

---

## 📊 Updated Stats Response

```javascript
{
  // Income
  totalIncome: 57000,
  totalMembershipCollected: 45000,
  otherPayments: 12000,
  
  // Expenses (new)
  totalExpenses: 38500,
  netIncome: 18500,
  
  // Breakdown
  expensesByCategory: [...]
}
```

---

## 🚀 Deployment Steps

### Step 1: Database Migration
```bash
# Run migration to create expense_categories table
npm run db:migrate

# Seed expense categories
npm run db:seed:expenses
```

### Step 2: Backend Deployment
```bash
cd backend
npm install
npm test
git add .
git commit -m "feat: add expense tracking system"
git push origin main
```

### Step 3: Frontend Deployment
```bash
cd frontend
npm install
npm test
git add .
git commit -m "feat: add expense tracking UI"
git push origin main
```

### Step 4: Verification
- [ ] Access /api/expenses/categories
- [ ] Create test expense
- [ ] View expenses in dashboard
- [ ] Check stats calculation

---

## 🧪 Testing Scenarios

### Manual Test Cases
1. **Add Expense**: Record $5000 salary (EXP001) via check
2. **Filter**: Filter expenses by date range
3. **Stats**: Verify total expenses calculation
4. **Permissions**: Test as different roles
5. **Validation**: Try invalid GL code, negative amount

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue**: NaN in expense stats
- **Cause**: No expenses recorded
- **Fix**: Returns 0 when sum is null

**Issue**: Cannot see Add Expense button
- **Cause**: Wrong role
- **Fix**: Verify user has Treasurer/Admin role

**Issue**: Invalid GL code error
- **Cause**: Category not seeded or inactive
- **Fix**: Check expense_categories table

---

## 📝 Future Enhancements

1. Approval workflow for large expenses
2. Receipt upload and OCR
3. Expense reimbursements
4. Recurring expense templates
5. Budget tracking and alerts
6. Additional payment methods
7. Vendor management
8. Multi-currency support

---

**Last Updated**: October 2025  
**Maintained By**: Development Team  
**Questions**: Contact system administrator
