# Income GL Codes - Quick Reference Guide

## 🚀 Quick Setup (First Time)

```bash
# 1. Run database migrations
cd backend
npm run db:migrate:income
npm run db:seed:income
npm run db:migrate:ledger-types

# 2. Restart backend
npm run dev

# 3. Verify setup
curl http://localhost:5001/api/income-categories
# Should return 9 categories

# 4. Start frontend
cd ../frontend
npm start
```

---

## 📊 Income Categories Reference

| GL Code | Category Name | Payment Types | Auto-Assigned? |
|---------|---------------|---------------|----------------|
| **INC001** | Membership | membership_due | ✅ Yes |
| **INC002** | Weekly Offering | offering, tithe | ✅ Yes |
| **INC003** | Fundraising | event, building_fund | ✅ Yes |
| **INC004** | Special Donation | donation | ✅ Yes |
| **INC005** | Sacramental Services | - | ❌ Manual only |
| **INC006** | Newayat Kedesat | - | ❌ Manual only |
| **INC007** | Event Hall Rental | - | ❌ Manual only |
| **INC008** | Vow (Selet) & Tselot | vow | ✅ Yes |
| **INC999** | Other Income | other | ✅ Yes |

---

## 💻 API Examples

### Get All Income Categories
```bash
curl -X GET "http://localhost:5001/api/income-categories" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Transaction (Auto-Assign)
```bash
curl -X POST "http://localhost:5001/api/transactions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "collected_by": 1,
    "amount": 100.00,
    "payment_type": "membership_due",
    "payment_method": "cash",
    "payment_date": "2025-10-03"
  }'
```
**Result**: Auto-assigns INC001 (Membership)

### Create Transaction (Manual Select)
```bash
curl -X POST "http://localhost:5001/api/transactions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": 1,
    "collected_by": 1,
    "amount": 500.00,
    "payment_type": "other",
    "payment_method": "cash",
    "income_category_id": 5,
    "payment_date": "2025-10-03"
  }'
```
**Result**: Uses INC005 (Sacramental Services)

---

## 🔧 Troubleshooting

### Issue: Enum Error for Vow/Tithe/Building Fund
```
"invalid input value for enum enum_ledger_entries_type: vow"
```
**Fix**:
```bash
npm run db:migrate:ledger-types
```

### Issue: income_categories table doesn't exist
**Fix**:
```bash
npm run db:migrate:income
npm run db:seed:income
```

### Issue: Income category dropdown not updating
**Fix**: Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)

### Issue: "Cannot find module IncomeCategory"
**Fix**: Restart backend server

---

## 📝 Database Queries

### Check Income Categories
```sql
SELECT * FROM income_categories ORDER BY display_order;
```

### Check Recent Transactions with GL Codes
```sql
SELECT 
  t.id,
  t.payment_type,
  ic.gl_code,
  ic.name as category_name,
  t.amount
FROM transactions t
LEFT JOIN income_categories ic ON t.income_category_id = ic.id
ORDER BY t.created_at DESC
LIMIT 10;
```

### Check Ledger Entries Use GL Codes
```sql
SELECT 
  type,
  category,
  amount,
  memo
FROM ledger_entries
WHERE category LIKE 'INC%'
ORDER BY created_at DESC
LIMIT 10;
```

### Find Transactions Without Income Category
```sql
SELECT 
  id,
  payment_type,
  amount,
  created_at
FROM transactions
WHERE income_category_id IS NULL
ORDER BY created_at DESC;
```

---

## 🎯 Testing Checklist

### Backend Tests
- [ ] GET /api/income-categories returns 9 categories
- [ ] POST /api/transactions with membership_due → income_category_id = 1
- [ ] POST /api/transactions with vow → income_category_id = 8
- [ ] POST /api/transactions with tithe → income_category_id = 2
- [ ] POST /api/transactions with building_fund → income_category_id = 3
- [ ] Ledger entries have category = 'INC001', 'INC002', etc.

### Frontend Tests
- [ ] Income category dropdown appears in Add Payment modal
- [ ] Dropdown shows 9 categories
- [ ] Select "Membership Due" → Auto-selects "INC001 - Membership"
- [ ] Select "Tithe" → Auto-selects "INC002 - Weekly Offering"
- [ ] Select "Building Fund" → Auto-selects "INC003 - Fundraising"
- [ ] Select "Vow" → Auto-selects "INC008 - Vow (Selet) & Tselot"
- [ ] Can manually change category
- [ ] Changing payment type updates auto-selection
- [ ] Transaction list shows GL Code column
- [ ] GL code displays correctly (two lines: code + name)

---

## 📚 Documentation Links

- **Full Analysis**: `INCOME_GL_CODES_ANALYSIS.md`
- **Backend Details**: `INCOME_GL_CODES_PHASE2_COMPLETE.md`
- **Frontend Details**: `INCOME_GL_CODES_PHASE3_COMPLETE.md`
- **Payment Mappings**: `PAYMENT_TYPE_MAPPINGS.md`
- **Implementation Summary**: `INCOME_GL_CODES_IMPLEMENTATION_SUMMARY.md`
- **This Guide**: `INCOME_GL_CODES_QUICK_REFERENCE.md`

---

## 🆘 Need Help?

1. Check the troubleshooting section above
2. Review error logs in browser console (F12)
3. Check backend terminal for error messages
4. Verify all migrations ran successfully
5. Ensure backend server restarted after changes

---

## ✅ Production Deployment

```bash
# 1. Run migrations on production database
npm run db:migrate:income
npm run db:seed:income
npm run db:migrate:ledger-types

# 2. Deploy backend (restart server)
pm2 restart abune-aregawi-backend
# or
npm start

# 3. Build and deploy frontend
cd frontend
npm run build
firebase deploy
# or your hosting provider's deploy command

# 4. Verify in production
curl https://your-api.com/api/income-categories
```

---

**Last Updated**: October 3, 2025  
**Version**: 1.0  
**Status**: Production Ready ✅
