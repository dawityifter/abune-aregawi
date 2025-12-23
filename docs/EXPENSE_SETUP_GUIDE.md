# Expense Tracking Setup Guide

## Quick Start

### Step 1: Database Migration

Run these commands in the backend directory:

```bash
cd backend

# Create expense_categories table
npm run db:migrate:expenses

# Seed fixed expense categories
npm run db:seed:expenses
```

### Step 2: Start Backend

```bash
# In backend directory
npm run dev
```

### Step 3: Start Frontend

```bash
# In frontend directory (new terminal)
cd ../frontend
npm start
```

### Step 4: Test the Feature

1. Log in as a **Treasurer** or **Admin**
2. Go to **Treasurer Dashboard**
3. You should see:
   - **"Add Expense" button** (red) next to "Add Payment" button
   - New **"Expenses" tab** in the navigation
4. Click **"Add Expense"** to record an expense
5. Select a category (EXP001-EXP009)
6. Enter amount, date, payment method (cash/check)
7. Submit

---

## Available Expense Categories

After running the seed script, you'll have these categories:

| GL Code | Name | Fixed |
|---------|------|-------|
| EXP001 | Salary/Allowance | ✅ |
| EXP002 | Mortgage | ✅ |
| EXP003 | 1800 Loan Interest Payment | ✅ |
| EXP004 | Monthly FDGL Lease PYMT ZOOM, T-MOBILE & TSYS | ✅ |
| EXP005 | Utility | ✅ |
| EXP006 | Cable | ✅ |
| EXP007 | Property Insurance | ✅ |
| EXP008 | Rent Expense | ✅ |
| EXP009 | Chase Credit Card Payment | ✅ |

---

## API Endpoints

### Get Categories
```bash
GET /api/expenses/categories
Authorization: Bearer <token>
```

### Add Expense
```bash
POST /api/expenses
Authorization: Bearer <token>
Content-Type: application/json

{
  "gl_code": "EXP001",
  "amount": 5000.00,
  "expense_date": "2025-10-02",
  "payment_method": "check",
  "receipt_number": "CHK-1234",
  "memo": "Monthly salary - October 2025"
}
```

### List Expenses
```bash
GET /api/expenses?page=1&limit=20&start_date=2025-01-01&end_date=2025-12-31
Authorization: Bearer <token>
```

### Get Statistics
```bash
GET /api/expenses/stats?year=2025
Authorization: Bearer <token>
```

---

## Role Permissions

| Role | View Expenses | Add Expenses | Edit Expenses | Delete Expenses |
|------|---------------|--------------|---------------|-----------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Treasurer** | ✅ | ✅ | ✅ | ❌ |
| **Church Leadership** | ✅ | ❌ | ❌ | ❌ |
| **Others** | ❌ | ❌ | ❌ | ❌ |

---

## Troubleshooting

### "Failed to load expense categories"
- Check backend is running (`npm run dev`)
- Verify database migration ran successfully
- Check browser console for API errors

### "Invalid GL code"
- Ensure you ran the seed script: `npm run db:seed:expenses`
- Check database: `SELECT * FROM expense_categories;`

### "Cannot see Add Expense button"
- Verify user role is **Treasurer** or **Admin**
- Check user permissions in browser DevTools

### Database connection errors
- Verify `DATABASE_URL` in backend `.env` file
- Check PostgreSQL is running
- Ensure SSL settings match your environment

---

## Testing Checklist

- [ ] Backend migration runs without errors
- [ ] Seed script creates 9 expense categories
- [ ] Backend API `/api/expenses/categories` returns data
- [ ] Frontend shows "Add Expense" button (Treasurer/Admin)
- [ ] "Expenses" tab appears in navigation
- [ ] Can record a cash expense
- [ ] Can record a check expense
- [ ] Expense list displays correctly
- [ ] Filters work (date, category, payment method)
- [ ] Pagination works
- [ ] Non-treasurers cannot see expenses

---

## Next Steps (Future Enhancements)

1. Add expense approval workflow
2. Implement expense reimbursements
3. Add receipt/attachment uploads
4. Support additional payment methods
5. Create expense reports/analytics
6. Add recurring expense templates
7. Implement budget tracking

---

**Questions?** Check `/Users/dawit/development/church/abune-aregawi../backend/EXPENSE_TRACKING_RUNBOOK.md` for full documentation.
