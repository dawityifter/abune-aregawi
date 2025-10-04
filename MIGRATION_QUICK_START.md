# Production Migration - Quick Start Guide

**Status:** ✅ DRY RUN COMPLETE  
**Risk Level:** 🟢 LOW  
**Ready to Migrate:** YES

---

## 📊 Dry Run Results

### What We Found:

**Production Database Status:**
- ✅ Connected to Supabase (aws-0-us-west-1)
- ✅ 13 existing tables (all working)
- ✅ 29 migrations already applied
- ✅ No blocking issues found

**What Will Be Added:**
- 3 new tables (income_categories, expense_categories, ledger_entries)
- 1 new column (transactions.income_category_id - NULLABLE)
- 5 new enum values (vow, tithe, building_fund, expense, refund)
- 7 new indexes (for performance)

**Risk Assessment:**
- 🟢 **LOW RISK** - All changes are additive only
- ✅ No data will be modified or deleted
- ✅ No existing functionality will break
- ✅ Rollback available if needed

---

## 🚀 How to Migrate (3 Options)

### Option 1: Automated Script (Recommended)
```bash
# 1. Create backup first!
pg_dump "$DATABASE_URL" > prod_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migration script
./run-production-migration.sh
```

This will:
- ✅ Check you're connected to production
- ✅ Confirm backup created
- ✅ Run all 5 migrations
- ✅ Seed all data
- ✅ Verify everything worked

### Option 2: Manual Step-by-Step
```bash
# 1. Backup
pg_dump "$DATABASE_URL" > prod_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migrations
cd backend
npm run db:migrate:income
npm run db:migrate:ledger-types
npm run db:migrate:expense
node src/database/migrations/updateLedgerEntryTransactionId.js
node src/database/migrations/updateLedgerEntryTypeEnum.js

# 3. Seed data
npm run db:seed:income
npm run db:seed:expense

# 4. Verify
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM income_categories;"
# Expected: 9
```

### Option 3: One Command at a Time (Safest)
See detailed instructions in `PRODUCTION_MIGRATION_SUMMARY.md`

---

## ⚠️ CRITICAL: Before You Start

### 1. Create Backup (REQUIRED!)
```bash
pg_dump "$DATABASE_URL" > prod_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Verify Backup
```bash
# Check file size (should be > 0 bytes)
ls -lh prod_backup_*.sql
```

### 3. Choose Low-Traffic Time
- Migrations take < 10 seconds
- But choose off-peak hours to be safe

---

## 📋 After Migration

### 1. Restart Backend
```bash
pm2 restart backend
# or
npm start
```

### 2. Test Backend API
```bash
curl https://your-api-url.com/api/income-categories
```
**Expected:** Should return 9 income categories

### 3. Deploy Frontend
```bash
cd frontend
npm run build
firebase deploy
```

### 4. Test Frontend
- Open Treasurer Dashboard
- Click "Add Payment"
- Verify Income Category field appears
- Create test transaction
- Verify GL Code shows in list

---

## 🔍 Verification Checklist

After migration, verify:

- [ ] No errors in migration output
- [ ] Backend starts without errors
- [ ] API returns income categories
- [ ] Frontend displays GL codes
- [ ] Can create transactions
- [ ] Transaction list shows GL Code column
- [ ] No errors in production logs

---

## 🚨 If Something Goes Wrong

### Quick Rollback:
```bash
# Stop backend
pm2 stop backend

# Restore database
psql "$DATABASE_URL" < prod_backup_[your_timestamp].sql

# Restart backend
pm2 restart backend
```

---

## 📞 Need Help?

### Documentation Files Created:

1. **PRODUCTION_MIGRATION_SUMMARY.md** - Full detailed guide
2. **PRODUCTION_MIGRATION_DRY_RUN.md** - Technical deep-dive
3. **run-production-migration.sh** - Automated script
4. **MIGRATION_QUICK_START.md** - This file

### Key Information:

**What Changes:** 3 new tables, 1 new column, 5 enum values  
**Estimated Time:** 5-10 minutes total  
**Downtime Required:** None (but safer to stop backend)  
**Risk Level:** LOW  
**Tested:** YES (extensively in local environment)

---

## ✅ Ready to Proceed?

### Checklist:
- [ ] Backup created
- [ ] Low-traffic time chosen
- [ ] Team notified
- [ ] Read migration summary
- [ ] Understand rollback plan

### Commands to Run:
```bash
# Create backup
pg_dump "$DATABASE_URL" > prod_backup_$(date +%Y%m%d_%H%M%S).sql

# Run migration
./run-production-migration.sh

# Or manual
cd backend
npm run db:migrate:income
npm run db:seed:income
# ... etc
```

---

**Confidence Level:** ✅ HIGH

All changes tested locally. Migration is additive only. Rollback plan in place.

**Recommendation:** PROCEED when ready! 🚀
