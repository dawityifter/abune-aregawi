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
