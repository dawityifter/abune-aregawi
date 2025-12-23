# Production Migration Dry Run Report

**Date:** October 4, 2025  
**Database:** Supabase Production (aws-0-us-west-1)  
**Status:** 🔍 DRY RUN - NO CHANGES APPLIED YET

---

## 📊 Current Production State

### Existing Tables (13)
- ✅ SequelizeMeta
- ⚠️  church_transactions (deprecated locally, still in prod)
- ✅ dependents
- ✅ donations
- ✅ groups
- ✅ member_groups
- ✅ member_payments_2024
- ✅ members
- ✅ outreach
- ✅ pledges
- ✅ sms_logs
- ✅ transactions
- ✅ zelle_memo_matches

### Migrations Already Applied (29)
Last migration: `20250914054534-make-pledge-email-optional.js`

---

## 🆕 Pending Migrations (5)

### Migration 1: addIncomeCategorySupport.js
**Purpose:** Add Income GL Codes feature

**Changes:**
1. **Create Table:** `income_categories`
   ```sql
   - id (BIGSERIAL, PRIMARY KEY)
   - gl_code (VARCHAR(20), UNIQUE, NOT NULL)
   - name (VARCHAR(255), NOT NULL)
   - description (TEXT, NULLABLE)
   - payment_type_mapping (VARCHAR(50), NULLABLE)
   - is_active (BOOLEAN, DEFAULT true)
   - display_order (INTEGER, NULLABLE)
   - created_at (TIMESTAMP, DEFAULT NOW())
   - updated_at (TIMESTAMP, DEFAULT NOW())
   ```

2. **Create Indexes:**
   - idx_income_categories_gl_code
   - idx_income_categories_is_active
   - idx_income_categories_payment_type

3. **Alter Table:** `transactions`
   ```sql
   ADD COLUMN income_category_id BIGINT NULL
   REFERENCES income_categories(id)
   ON UPDATE CASCADE
   ON DELETE SET NULL
   ```

4. **Create Index:**
   - idx_transactions_income_category

**Risk Level:** 🟢 LOW
- Non-destructive (only adds columns/tables)
- Uses IF NOT EXISTS checks
- Nullable column (won't break existing data)

---

### Migration 2: addNewPaymentTypesToLedgerEnum.js
**Purpose:** Add new payment types to ledger enum

**Changes:**
1. **Alter ENUM:** `enum_ledger_entries_type`
   ```sql
   ADD VALUE 'vow' IF NOT EXISTS
   ADD VALUE 'tithe' IF NOT EXISTS
   ADD VALUE 'building_fund' IF NOT EXISTS
   ```

**Risk Level:** 🟢 LOW
- Only adds enum values (doesn't remove)
- Uses IF NOT EXISTS
- Won't affect existing data

**⚠️ Note:** PostgreSQL doesn't support removing enum values - these are permanent

---

### Migration 3: createExpenseCategories.js
**Purpose:** Add Expense Tracking feature

**Changes:**
1. **Create Table:** `expense_categories`
   ```sql
   - id (BIGSERIAL, PRIMARY KEY)
   - code (VARCHAR(20), UNIQUE, NOT NULL)
   - name (VARCHAR(255), NOT NULL)
   - description (TEXT, NULLABLE)
   - is_active (BOOLEAN, DEFAULT true)
   - budget_amount (DECIMAL(12,2), NULLABLE)
   - created_at (TIMESTAMP)
   - updated_at (TIMESTAMP)
   ```

2. **Create Indexes:**
   - idx_expense_categories_code
   - idx_expense_categories_is_active

**Risk Level:** 🟢 LOW
- Creates new table only
- No impact on existing tables

---

### Migration 4: updateLedgerEntryTransactionId.js
**Purpose:** Update ledger entry schema

**Changes:**
1. **Check if table exists:** `ledger_entries`
   - If exists: ALTER COLUMN transaction_id to allow NULL
   - If not exists: CREATE TABLE with schema

**Risk Level:** 🟡 MEDIUM
- May create ledger_entries table if doesn't exist
- Alters existing column to NULLABLE (safe change)

---

### Migration 5: updateLedgerEntryTypeEnum.js
**Purpose:** Update ledger entry type enum

**Changes:**
1. **Alter ENUM:** `enum_ledger_entries_type`
   ```sql
   ADD VALUE 'expense' IF NOT EXISTS
   ADD VALUE 'refund' IF NOT EXISTS
   ```

**Risk Level:** 🟢 LOW
- Only adds enum values
- Non-destructive

---

## 📋 Required Post-Migration Steps

### 1. Seed Income Categories (REQUIRED)
```bash
npm run db:seed:income
```
This will create 9 income categories:
- INC001 - Membership
- INC002 - Weekly Offering
- INC003 - Fundraising
- INC004 - Special Donation
- INC005 - Sacramental Services
- INC006 - Newayat Kedesat & Sebkete Wongel
- INC007 - Event Hall & Church Item Rental
- INC008 - Vow (Selet) & Tselot
- INC999 - Other Income

### 2. Seed Expense Categories (REQUIRED)
```bash
npm run db:seed:expense
```

### 3. Restart Backend Server (REQUIRED)
```bash
# In production environment
pm2 restart backend
# or
npm start
```

---

## ⚠️ Important Considerations

### Data Safety
- ✅ All migrations use `IF NOT EXISTS` / `IF NOT NULL` checks
- ✅ All new columns are NULLABLE (won't break existing data)
- ✅ Foreign keys use `ON DELETE SET NULL` (safe)
- ✅ No data deletion or modification
- ✅ All changes are additive only

### Rollback Capability
- ⚠️ Enum values CANNOT be removed once added
- ✅ New tables can be dropped if needed
- ✅ New columns can be removed if needed
- ⚠️ church_transactions table NOT removed (still in prod)

### Performance Impact
- 🟢 Minimal - Only adds indexes
- 🟢 No blocking operations
- 🟢 No table locks expected
- 🟢 Migrations should complete in < 10 seconds

---

## 🎯 Recommended Migration Order

### Step 1: Backup Production Database (CRITICAL!)
```bash
# Create backup before any changes
pg_dump [connection_string] > production_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Run Migrations
```bash
# Run all 5 migrations
npm run db:migrate:income
npm run db:migrate:ledger-types
npm run db:migrate:expense
# etc.
```

### Step 3: Seed Data
```bash
npm run db:seed:income
npm run db:seed:expense
```

### Step 4: Verify
```bash
# Check tables created
psql $DATABASE_URL -c "\dt"

# Check income categories seeded
psql $DATABASE_URL -c "SELECT COUNT(*) FROM income_categories;"

# Expected: 9 categories
```

### Step 5: Deploy Frontend
```bash
cd frontend
npm run build
firebase deploy
```

---

## 🚨 Risks & Mitigation

### Risk 1: Migration Failure
**Mitigation:** 
- Have database backup ready
- Test on staging first if possible
- Run migrations during low-traffic period

### Risk 2: Enum Conflicts
**Mitigation:**
- Check existing enum values before adding
- Enum additions are safe (IF NOT EXISTS)

### Risk 3: Missing Seed Data
**Mitigation:**
- Income categories MUST be seeded before frontend can use them
- Include seeding in deployment checklist

### Risk 4: Frontend-Backend Mismatch
**Mitigation:**
- Deploy backend first
- Then deploy frontend
- Verify API endpoints work before switching traffic

---

## ✅ Pre-Flight Checklist

Before running migrations:

- [ ] **Backup created** - Full database dump saved
- [ ] **Low traffic time** - Choose off-peak hours
- [ ] **Backend stopped** - Stop production backend temporarily
- [ ] **Database URL verified** - Pointing to correct production DB
- [ ] **Migration files reviewed** - All 5 migrations checked
- [ ] **Rollback plan ready** - Know how to restore from backup
- [ ] **Monitoring ready** - Error logging and alerts enabled
- [ ] **Team notified** - Stakeholders aware of deployment

---

## 📞 Emergency Rollback Plan

If something goes wrong:

### Option 1: Restore from Backup
```bash
# Stop backend
pm2 stop backend

# Restore database
psql $DATABASE_URL < production_backup_[timestamp].sql

# Restart backend
pm2 restart backend
```

### Option 2: Selective Rollback
```bash
# Drop new tables (if needed)
DROP TABLE IF EXISTS income_categories CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;

# Remove foreign key from transactions
ALTER TABLE transactions DROP COLUMN IF EXISTS income_category_id;
```

**⚠️ Note:** Cannot remove enum values once added!

---

## 🎯 Success Criteria

Migration is successful when:

1. ✅ All 5 migrations complete without errors
2. ✅ 9 income categories exist in database
3. ✅ Expense categories seeded
4. ✅ No errors in backend logs
5. ✅ Frontend can fetch income categories
6. ✅ Can create transactions with GL codes
7. ✅ Transaction list shows GL Code column
8. ✅ No existing functionality broken

---

## 📝 Summary

**Total Changes:**
- **3 new tables:** income_categories, expense_categories, ledger_entries
- **1 new column:** transactions.income_category_id
- **5 new enum values:** vow, tithe, building_fund, expense, refund
- **7 new indexes:** Various performance indexes

**Overall Risk:** 🟢 **LOW** - All changes are additive and non-destructive

**Estimated Time:** 5-10 minutes total
- Migrations: < 10 seconds
- Seeding: < 5 seconds
- Verification: 2-3 minutes
- Frontend deploy: 3-5 minutes

---

**Ready to proceed?** Review this report carefully and follow the checklist! 🚀
