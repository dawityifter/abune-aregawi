# Root Cause Analysis - Payment System Regressions

**Date:** October 10, 2025  
**Affected Features:** Income GL code population, Anonymous payments  
**Severity:** High - Broke core treasurer functionality

---

## TL;DR - Why Things Broke

Both issues were caused by **incomplete database migrations** where:
1. Code models were updated but database schema was NOT updated
2. Initial seed data contained errors that weren't caught in testing
3. No automated checks to verify model-database schema alignment

This is a **classic schema drift problem** in database-driven applications.

---

## Issue 1: Income GL Code Not Populating

### Timeline of Events

**August/September 2025 - Initial Income Category Infrastructure**

**Commit:** `a529205` - feat(backend): add income category database infrastructure

**What happened:**
- Income category system was introduced with seed data
- **MISTAKE:** INC007 was given `payment_type_mapping: 'event'`
- This conflicted with INC003 which already mapped to `'event'`

**The seed data bug:**
```javascript
// INC003 - Correct
{
  gl_code: 'INC003',
  name: 'Fundraising',
  payment_type_mapping: 'event',  // ✅ Intended
}

// INC007 - INCORRECT
{
  gl_code: 'INC007',
  name: 'Event Hall & Church Item Rental',
  payment_type_mapping: 'event',  // ❌ Should have been NULL
}
```

### Why It Happened

1. **Unclear requirements:** The documentation stated INC007 should require manual selection, but the seed data included automatic mapping
2. **No validation:** No database constraint prevents duplicate payment_type_mapping values
3. **Non-deterministic behavior:** The `getIncomeCategoryByPaymentType()` function used `.find()`, which returns the FIRST match. Depending on query order, it could return either INC003 or INC007
4. **Missing tests:** No integration tests verified GL code auto-selection for all payment types

### Impact

- Treasurers selecting payment types got inconsistent GL code assignments
- Some payments may have been assigned wrong GL codes
- Reports using GL codes would show incorrect categorization

---

## Issue 2: Anonymous Payments Failing

### Timeline of Events

**August 3, 2025 - Database Migration**

**Commit:** `e67e597` - feat: complete database migration to new schema

**What happened:**
- New transactions table created with `member_id BIGINT NOT NULL`
- Migration was designed for existing member-only payments

**Migration code:**
```javascript
member_id: {
  type: Sequelize.BIGINT,
  allowNull: false,  // ❌ Hard-coded NOT NULL
  references: {
    model: 'members_new',
    key: 'id'
  },
  onUpdate: 'CASCADE',
  onDelete: 'RESTRICT'
}
```

**September 2025 - Model Updated for Anonymous Payments**

**Commit:** `2ee9174` - feat(backend): integrate income categories with transactions

**What happened:**
- Transaction.js model was updated to support anonymous payments
- `member_id` changed to `allowNull: true`
- Comment added: `'Member ID (null for anonymous/non-member donations)'`
- **CRITICAL MISTAKE:** No migration created to alter the database

**Model code (updated):**
```javascript
member_id: {
  type: DataTypes.BIGINT,
  allowNull: true,  // ✅ Model says nullable
  references: {
    model: 'members',
    key: 'id'
  },
  onUpdate: 'CASCADE',
  onDelete: 'SET NULL',
  comment: 'Member ID (null for anonymous/non-member donations)'
}
```

**The Disconnect:**
- **Model said:** member_id can be NULL ✅
- **Database enforced:** member_id CANNOT be NULL ❌
- **Result:** Anonymous payments threw constraint violation errors

### Additional Sub-Issue: Missing Payment Type Enums

**What happened:**
- Frontend added payment types: `'offering'`, `'vow'`, `'building_fund'`
- These were added to the UI dropdowns
- **MISTAKE:** Database enum was never updated with these new types
- Backend model also wasn't updated

**The Disconnect:**
```javascript
// Frontend sent:
payment_type: 'offering'  // ✅ Valid UI option

// Database enum only had:
['membership_due', 'tithe', 'donation', 'event', 'other']  // ❌ Missing 3 types

// Result: Database rejected the value
```

### Why It Happened

1. **No migration discipline:** Model changes weren't accompanied by database migrations
2. **Dev-prod drift:** Changes worked in dev if dev DB was recreated from models, but production DB was never updated
3. **Missing enum validation:** No pre-insert validation checked if payment_type was valid
4. **Split ownership:** Frontend team added payment types without coordinating with ../backend/DB team
5. **No schema validation tests:** No automated tests verified model definitions matched actual database schema

### Impact

- **Complete breakage** of anonymous payment functionality
- Treasurers couldn't record cash donations from non-members
- Error messages exposed database internals to users
- Potential data loss if users gave up and didn't record payments

---

## Common Root Causes

### 1. **Schema Drift - The Primary Culprit**

**What is Schema Drift?**
When your code's understanding of the database structure diverges from the actual database structure.

**How it happened here:**
```
Model Code (Transaction.js)  ≠  Actual Database Schema
     allowNull: true                 NOT NULL constraint
```

This happens when:
- Migrations aren't run in production
- Dev databases are recreated but production isn't updated
- Model changes aren't accompanied by migrations

### 2. **Missing Migration Discipline**

**The broken process:**
1. ❌ Developer updates Sequelize model
2. ❌ Developer tests in dev (works because dev DB syncs)
3. ❌ Code ships to production
4. ❌ Production database never updated
5. ❌ Production breaks

**The correct process:**
1. ✅ Developer updates Sequelize model
2. ✅ Developer creates migration script
3. ✅ Tests migration in dev environment
4. ✅ Code review includes migration review
5. ✅ Deployment runs migrations BEFORE code deploy
6. ✅ Verification tests confirm schema matches model

### 3. **Insufficient Testing**

**Missing test coverage:**
- ❌ No integration tests for anonymous payment creation
- ❌ No tests verifying GL code auto-assignment for each payment type
- ❌ No schema validation tests comparing models to actual DB
- ❌ No enum validation tests for payment types
- ❌ No database constraint tests

**What SHOULD have been tested:**
```javascript
describe('Anonymous Payments', () => {
  it('should allow creating transaction with null member_id', async () => {
    const tx = await Transaction.create({
      member_id: null,  // This should have caught the bug
      collected_by: 1,
      amount: 100.00,
      payment_type: 'donation',
      payment_method: 'cash',
      receipt_number: 'R001'
    });
    expect(tx.member_id).toBeNull();
  });
});
```

### 4. **Poor Initial Design Decisions**

**INC007 duplicate mapping:**
- Requirements said "manual selection"
- Seed data implemented "automatic mapping"
- No code review caught the inconsistency
- No validation enforced one-to-one payment_type mapping

### 5. **Lack of Automated Schema Validation**

**What was missing:**
- No pre-deployment hook verifying model schema matches database
- No CI/CD check comparing Sequelize definitions to actual tables
- No automated migration verification

**Example of what could prevent this:**
```javascript
// Pre-deploy validation script
const modelSchema = getSequelizeModelSchema('Transaction');
const dbSchema = getDatabaseTableSchema('transactions');
const diff = compareSchemas(modelSchema, dbSchema);

if (diff.length > 0) {
  console.error('Schema mismatch detected!');
  console.error(diff);
  process.exit(1);  // Fail the deployment
}
```

---

## How These Bugs Survived

### Why Anonymous Payments Worked Before (Your Question!)

**The likely scenario:**

1. **Before Aug 3, 2025:** Old schema allowed anonymous payments OR anonymous payments weren't being used
2. **Aug 3, 2025:** Migration `e67e597` ran, adding NOT NULL constraint
3. **Sep 2025:** Model updated but migration not created
4. **Between Sep-Oct:** Feature worked in dev but not production
   - Dev might have been using `sync: true` which recreates tables
   - Production used migrations only
5. **October 2025:** Someone tried it in production and it failed

OR:

**Alternative scenario:**
- Anonymous payments were never fully tested
- Code was written but never actually used in production
- When treasurer tried to use it, discovered it was broken

**The smoking gun in the code:**
```javascript
// Transaction controller had this code for months:
if (!member_id && (donor_name || donor_email...)) {
  // Build anonymous donor info
}

// But database constraint prevented it from ever working
```

### Why GL Code Worked Before Then Stopped

**Most likely:**
- It NEVER fully worked correctly
- But users didn't notice because:
  - Only certain payment types were being used
  - The inconsistency wasn't obvious
  - Treasurers manually corrected GL codes after creation
- Once more payment types were added, the problem became obvious

---

## Lessons Learned

### 1. **Always Create Migrations for Model Changes**

**Rule:** If you touch a model, you MUST create a migration.

```javascript
// Bad: Just updating model
member_id: { allowNull: true }

// Good: Update model + create migration
// 1. Update Transaction.js
// 2. Create: migrations/20250915-make-member-id-nullable.js
// 3. Test migration in dev
// 4. Include migration in PR
```

### 2. **Validate Schema on Deployment**

Add pre-deployment checks:
```bash
npm run validate:schema  # Compares models to DB
npm run test:migrations  # Runs migrations on test DB
```

### 3. **Database Constraints Must Match Model Definitions**

Regularly run schema validation:
```javascript
// Add to CI/CD pipeline
npm run verify:schema-sync
```

### 4. **Integration Tests Are Critical**

Unit tests aren't enough. Test actual DB operations:
```javascript
// This would have caught the bug immediately
it('creates anonymous transaction', async () => {
  const tx = await createTransaction({
    member_id: null,  // The bug would have surfaced here
    // ...
  });
});
```

### 5. **Code Review Checklists**

For any PR touching database models:
- ✅ Migration script included?
- ✅ Migration tested locally?
- ✅ Model changes match migration?
- ✅ Integration tests added/updated?
- ✅ Seed data validated?
- ✅ Documentation updated?

### 6. **Seed Data Validation**

Add validation to seed scripts:
```javascript
// Check for duplicate mappings
const mappings = categories.map(c => c.payment_type_mapping).filter(Boolean);
const duplicates = mappings.filter((m, i) => mappings.indexOf(m) !== i);
if (duplicates.length > 0) {
  throw new Error(`Duplicate payment_type_mapping: ${duplicates}`);
}
```

### 7. **Better Development Workflow**

**DON'T:**
```bash
# Dangerous: Auto-sync in development
sequelize.sync({ force: true })
```

**DO:**
```bash
# Safe: Always use migrations, even in dev
npm run migrate
```

This ensures dev and production follow the same schema evolution path.

---

## Prevention Checklist

To prevent this from happening again:

### Immediate Actions
- [x] Fix INC007 duplicate mapping
- [x] Make member_id nullable
- [x] Add missing payment type enums
- [ ] Add schema validation to CI/CD
- [ ] Write integration tests for anonymous payments
- [ ] Write tests for all GL code mappings

### Process Changes
- [ ] Update PR template to require migration checklist
- [ ] Add pre-commit hook for model changes
- [ ] Document migration workflow
- [ ] Create runbook for database changes
- [ ] Set up schema drift monitoring

### Technical Debt
- [ ] Add unique constraint on income_categories.payment_type_mapping
- [ ] Add validation in controller for valid payment types
- [ ] Create database schema snapshot tests
- [ ] Add database seed validation
- [ ] Implement migration verification in deployment pipeline

---

## Conclusion

**Bottom Line:** These bugs were caused by incomplete implementation of database changes, not by code breaking "mysteriously."

**The Pattern:**
1. Feature requirements changed (support anonymous payments)
2. Code was updated (model changed)
3. Database was NOT updated (no migration run)
4. Schema drift occurred (model ≠ database)
5. Feature broke in production (constraint violation)

**The Fix:**
- Not just patching the bugs
- But establishing processes to prevent schema drift
- And adding automated validation to catch mismatches

**Your Intuition Was Right:** Something WAS breaking mysteriously, and it's because the development workflow had gaps where schema changes weren't being properly applied to the database.

---

## References

- Git commit `e67e597` - Initial transactions table creation
- Git commit `2ee9174` - Model updated for anonymous payments (no migration)
- Git commit `a529205` - Income categories with duplicate mapping bug
- `../backend/src/models/Transaction.js` - Model definition
- `../backend/src/database/seedIncomeCategories.js` - Seed data with bug

---

**Author:** Generated from root cause analysis  
**Date:** October 10, 2025  
**Status:** Documented for future reference and learning
