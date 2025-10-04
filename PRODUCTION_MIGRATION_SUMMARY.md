# Production Migration - Executive Summary

**Date:** October 4, 2025  
**Status:** 🔍 DRY RUN COMPLETE - READY FOR REVIEW

---

## 🎯 What Will Change

### New Features Being Added:
1. **Income GL Codes** - Categorize income with GL codes (INC001-INC008, INC999)
2. **Expense Tracking** - Track church expenses with categories
3. **Ledger Entries** - Double-entry bookkeeping system

---

## 📊 Database Changes Summary

### ✅ SAFE - What Will Be Added

| Change Type | Details | Risk |
|-------------|---------|------|
| **New Tables (3)** | income_categories, expense_categories, ledger_entries | 🟢 LOW |
| **New Column (1)** | transactions.income_category_id (NULLABLE) | 🟢 LOW |
| **New Indexes (7)** | Performance indexes for new tables | 🟢 LOW |
| **New Enum Values (5)** | vow, tithe, building_fund, expense, refund | 🟢 LOW |

### ⚠️ Important Notes

**What's NOT Changed:**
- ✅ No existing data modified
- ✅ No existing columns removed
- ✅ No existing tables dropped
- ✅ All changes are additive only
- ✅ Backward compatible

**What Production Has That Local Doesn't:**
- ⚠️ `church_transactions` table (deprecated but still in prod)
  - Safe to keep for now
  - Can be removed in future cleanup

---

## 🔍 Current Production State

### Verified Information:

**Database:** Supabase (aws-0-us-west-1.pooler.supabase.com)

**Existing Tables (13):**
```
✅ SequelizeMeta           - Migration tracking
⚠️  church_transactions    - DEPRECATED (safe to keep)
✅ dependents              - Working
✅ donations               - Working
✅ groups                  - Working
✅ member_groups           - Working
✅ member_payments_2024    - Working
✅ members                 - Working
✅ outreach                - Working
✅ pledges                 - Working
✅ sms_logs                - Working
✅ transactions            - Working (will get new column)
✅ zelle_memo_matches      - Working
```

**Missing (Will Be Created):**
```
❌ income_categories       → Will be created ✅
❌ expense_categories      → Will be created ✅
❌ ledger_entries          → Will be created ✅
❌ enum_ledger_entries_type → Will be created ✅
```

---

## 📋 Migration Steps (In Order)

### 1. Income Category Support
**File:** `addIncomeCategorySupport.js`

**Actions:**
- CREATE TABLE `income_categories` with 9 columns
- CREATE 3 indexes on income_categories
- ALTER TABLE `transactions` ADD COLUMN `income_category_id`
- CREATE index on transactions.income_category_id

**Impact:** Enables GL code tracking for income

### 2. Ledger Enum Payment Types
**File:** `addNewPaymentTypesToLedgerEnum.js`

**Actions:**
- CREATE TYPE `enum_ledger_entries_type` with values:
  - 'vow'
  - 'tithe'
  - 'building_fund'

**Impact:** Allows new payment types in ledger

### 3. Expense Categories
**File:** `createExpenseCategories.js`

**Actions:**
- CREATE TABLE `expense_categories` with 8 columns
- CREATE 2 indexes on expense_categories

**Impact:** Enables expense tracking feature

### 4. Ledger Entry Schema
**File:** `updateLedgerEntryTransactionId.js`

**Actions:**
- CREATE TABLE `ledger_entries` (if not exists)
- ALTER COLUMN transaction_id to NULLABLE

**Impact:** Sets up double-entry bookkeeping

### 5. Ledger Entry Types
**File:** `updateLedgerEntryTypeEnum.js`

**Actions:**
- ALTER TYPE `enum_ledger_entries_type` ADD VALUES:
  - 'expense'
  - 'refund'

**Impact:** Support for expense and refund ledger entries

---

## 🎯 Post-Migration Requirements

### CRITICAL - Must Run After Migrations:

1. **Seed Income Categories** (9 records)
   ```bash
   npm run db:seed:income
   ```

2. **Seed Expense Categories** (multiple records)
   ```bash
   npm run db:seed:expense
   ```

3. **Restart Backend Server**
   ```bash
   pm2 restart backend  # or your restart command
   ```

4. **Deploy Frontend**
   ```bash
   cd frontend
   npm run build
   firebase deploy
   ```

---

## ⚠️ Risk Assessment

### Overall Risk Level: 🟢 **LOW**

**Why Low Risk:**
- ✅ All changes are additive (no deletions)
- ✅ New column is NULLABLE (won't break existing data)
- ✅ Uses IF NOT EXISTS checks everywhere
- ✅ Foreign keys use ON DELETE SET NULL (safe)
- ✅ No table locks expected
- ✅ Should complete in < 10 seconds
- ✅ Tested extensively in local environment

**Potential Issues:**
- ⚠️ Enum values can't be removed (permanent once added)
- ⚠️ Must seed data after migrations
- ⚠️ Frontend must be deployed after backend

---

## 🚨 Before You Start - Checklist

### Pre-Migration Checklist:

- [ ] **Backup Database** 
  ```bash
  pg_dump "postgresql://postgres.sqjdhtqiuvmsabaqgqhx:AksumTsion21@aws-0-us-west-1.pooler.supabase.com:6543/postgres" > prod_backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Stop Backend Server** (optional, but safer)
  ```bash
  pm2 stop backend
  ```

- [ ] **Low Traffic Time** - Choose off-peak hours

- [ ] **Team Notified** - Inform stakeholders

- [ ] **Rollback Plan Ready** - Have backup file location noted

### Migration Checklist:

- [ ] **Run Migration 1** - Income Categories
  ```bash
  cd backend
  npm run db:migrate:income
  ```

- [ ] **Run Migration 2** - Ledger Enum
  ```bash
  npm run db:migrate:ledger-types
  ```

- [ ] **Run Migration 3** - Expense Categories
  ```bash
  npm run db:migrate:expense
  ```

- [ ] **Run Migration 4 & 5** - Ledger Entries
  ```bash
  node src/database/migrations/updateLedgerEntryTransactionId.js
  node src/database/migrations/updateLedgerEntryTypeEnum.js
  ```

- [ ] **Seed Income Categories**
  ```bash
  npm run db:seed:income
  ```

- [ ] **Seed Expense Categories**
  ```bash
  npm run db:seed:expense
  ```

- [ ] **Verify Seeding**
  ```bash
  psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM income_categories;"
  # Expected: 9
  ```

- [ ] **Restart Backend**
  ```bash
  pm2 restart backend
  ```

- [ ] **Test Backend API**
  ```bash
  curl https://your-api.com/api/income-categories
  # Should return 9 categories
  ```

- [ ] **Deploy Frontend**
  ```bash
  cd frontend
  npm run build
  firebase deploy
  ```

- [ ] **Verify Frontend**
  - Open Treasurer Dashboard
  - Check Add Payment modal
  - Verify Income Category field appears
  - Create test transaction
  - Verify GL Code appears in list

### Success Verification:

- [ ] All migrations completed without errors
- [ ] Income categories table has 9 rows
- [ ] Expense categories table populated
- [ ] Backend API returns income categories
- [ ] Frontend displays GL codes
- [ ] No errors in production logs
- [ ] Can create transactions successfully

---

## 🔄 Rollback Plan

If something goes wrong:

### Option 1: Full Restore (Nuclear Option)
```bash
# Stop backend
pm2 stop backend

# Restore from backup
psql "$DATABASE_URL" < prod_backup_[timestamp].sql

# Restart backend
pm2 restart backend
```

### Option 2: Selective Cleanup (Partial)
```bash
# Remove new tables
DROP TABLE IF EXISTS income_categories CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;

# Remove new column
ALTER TABLE transactions DROP COLUMN IF EXISTS income_category_id;

# Note: Cannot remove enum values!
```

---

## 📞 Support Contacts

**In Case of Emergency:**
- Database Admin: [Contact Info]
- Backend Developer: [Contact Info]
- DevOps: [Contact Info]

**Backup Location:**
- Local: `./prod_backup_[timestamp].sql`
- S3: [If applicable]

---

## ✅ Expected Outcome

After successful migration:

### Backend Changes:
- ✅ 3 new tables created
- ✅ 9 income categories seeded
- ✅ Expense categories seeded
- ✅ transactions table has new column
- ✅ API returns income categories

### Frontend Changes:
- ✅ Add Payment modal shows Income Category field (read-only)
- ✅ Income category auto-assigns based on payment type
- ✅ Transaction list shows GL Code column
- ✅ GL codes display correctly

### User Experience:
- ✅ Existing functionality unchanged
- ✅ New GL code feature available
- ✅ Expense tracking available
- ✅ Weekly reports enhanced

---

## 📊 Monitoring

After deployment, monitor:

1. **Error Logs**
   - Check for database errors
   - Check for API errors
   - Check frontend console errors

2. **Performance**
   - Query performance (should be same or better with indexes)
   - Page load times
   - API response times

3. **Functionality**
   - Transaction creation works
   - GL codes assign correctly
   - Reports generate successfully

---

## 🎯 Go/No-Go Decision

**✅ GO if:**
- All pre-migration checklist items complete
- Backup created and verified
- Team ready to support
- Low traffic time scheduled
- Rollback plan understood

**❌ NO-GO if:**
- No backup created
- High traffic time
- Team unavailable
- Unclear rollback plan
- Production issues present

---

**Status:** 🟢 READY FOR PRODUCTION MIGRATION

**Confidence Level:** HIGH - All changes are additive and tested

**Recommendation:** Proceed with migration during next maintenance window

---

**Need Help?** Review the detailed dry-run report: `PRODUCTION_MIGRATION_DRY_RUN.md`
