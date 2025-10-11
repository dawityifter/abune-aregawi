# Payment Type to Income Category Mappings

## Overview

This document describes how payment types map to income categories (GL codes) in the system.

---

## Direct Mappings (via database)

These payment types have direct mappings in the `income_categories.payment_type_mapping` field:

| Payment Type | GL Code | Category Name | Description |
|-------------|---------|---------------|-------------|
| `membership_due` | INC001 | Membership | Membership dues and fees |
| `offering` | INC002 | Weekly Offering | Regular weekly offerings |
| `event` | INC003 | Fundraising | Fundraising events and activities |
| `donation` | INC004 | Special Donation | Special donations, holidays, one-time gifts |
| `vow` | INC008 | Vow (Selet) & Tselot | Vows and Tselot offerings |
| `other` | INC999 | Other Income | Miscellaneous income |

---

## Fallback Mappings (code-level)

These payment types don't have direct database mappings but use fallback logic in the code:

| Payment Type | Maps To | GL Code | Category Name |
|-------------|---------|---------|---------------|
| `tithe` | `offering` | INC002 | Weekly Offering |
| `building_fund` | `event` | INC003 | Fundraising |

### Why Fallback Mappings?

The database field `payment_type_mapping` can only hold one value per category. Since:
- Both `offering` and `tithe` should map to INC002
- Both `event` and `building_fund` should map to INC003

We use fallback logic in the code to handle multiple payment types mapping to the same category.

---

## Implementation Locations

### Backend

**1. Transaction Controller**
`/backend/src/controllers/transactionController.js` (lines 229-253)
```javascript
// Auto-assign income category based on payment_type mapping
let incomeCategory = await IncomeCategory.findOne({
  where: { payment_type_mapping: payment_type }
});

// Fallback mappings for payment types without direct mapping
if (!incomeCategory) {
  const fallbackMappings = {
    'tithe': 'offering',        // tithe → INC002
    'building_fund': 'event'    // building_fund → INC003
  };
  
  const fallbackType = fallbackMappings[payment_type];
  if (fallbackType) {
    incomeCategory = await IncomeCategory.findOne({
      where: { payment_type_mapping: fallbackType }
    });
  }
}
```

**2. Zelle Controller**
`/backend/src/controllers/zelleController.js` (lines 61-85)
- Same fallback logic applied

**3. Gmail Zelle Ingest**
`/backend/src/services/gmailZelleIngest.js`
- Only handles 'donation' type, no fallback needed

### Frontend

**Income Category API Utility**
`/frontend/src/utils/incomeCategoryApi.ts` (lines 86-111)
```typescript
export function getIncomeCategoryByPaymentType(
  categories: IncomeCategory[],
  paymentType: string
): IncomeCategory | undefined {
  // First try direct mapping
  let category = categories.find(cat => 
    cat.payment_type_mapping === paymentType
  );
  
  // Fallback mappings
  if (!category) {
    const fallbackMappings = {
      'tithe': 'offering',
      'building_fund': 'event'
    };
    
    const fallbackType = fallbackMappings[paymentType];
    if (fallbackType) {
      category = categories.find(cat => 
        cat.payment_type_mapping === fallbackType
      );
    }
  }
  
  return category;
}
```

---

## Complete Payment Type List

All payment types available in the system:

1. ✅ **membership_due** → INC001 (Membership)
2. ✅ **tithe** → INC002 (Weekly Offering) via fallback
3. ✅ **offering** → INC002 (Weekly Offering)
4. ✅ **building_fund** → INC003 (Fundraising) via fallback
5. ✅ **event** → INC003 (Fundraising)
6. ✅ **donation** → INC004 (Special Donation)
7. ✅ **vow** → INC008 (Vow & Tselot)
8. ✅ **other** → INC999 (Other Income)

---

## Categories Without Payment Type Mapping

These categories require manual selection (no auto-assignment):

- **INC005**: Sacramental Services
- **INC006**: Newayat Kedesat & Sebkete Wongel
- **INC007**: Event Hall & Church Item Rental

---

## Testing

### Test Tithe Auto-Assignment

1. Create transaction with `payment_type: 'tithe'`
2. Should auto-assign to `income_category_id: 2` (INC002)
3. Ledger entry should have `category: 'INC002'`

### Test Building Fund Auto-Assignment

1. Create transaction with `payment_type: 'building_fund'`
2. Should auto-assign to `income_category_id: 3` (INC003)
3. Ledger entry should have `category: 'INC003'`

### Frontend Test

1. Open Add Payment modal
2. Select "Tithe (አስራት)" from Payment Type
3. Income Category dropdown should auto-select "INC002 - Weekly Offering"
4. Select "Building Fund (ንሕንጻ ቤተክርስቲያን)"
5. Income Category dropdown should auto-select "INC003 - Fundraising"

---

## Database Verification

```sql
-- Verify tithe transactions map to INC002
SELECT 
  t.id,
  t.payment_type,
  t.income_category_id,
  ic.gl_code,
  ic.name
FROM transactions t
LEFT JOIN income_categories ic ON t.income_category_id = ic.id
WHERE t.payment_type = 'tithe'
ORDER BY t.created_at DESC
LIMIT 5;

-- Expected: income_category_id = 2, gl_code = 'INC002'

-- Verify building_fund transactions map to INC003
SELECT 
  t.id,
  t.payment_type,
  t.income_category_id,
  ic.gl_code,
  ic.name
FROM transactions t
LEFT JOIN income_categories ic ON t.income_category_id = ic.id
WHERE t.payment_type = 'building_fund'
ORDER BY t.created_at DESC
LIMIT 5;

-- Expected: income_category_id = 3, gl_code = 'INC003'
```

---

## Maintenance

### Adding New Fallback Mappings

To add a new fallback mapping:

1. **Backend** - Update both controllers:
   - `/backend/src/controllers/transactionController.js`
   - `/backend/src/controllers/zelleController.js`
   
   Add to the `fallbackMappings` object:
   ```javascript
   const fallbackMappings = {
     'tithe': 'offering',
     'building_fund': 'event',
     'new_type': 'existing_mapping'  // Add here
   };
   ```

2. **Frontend** - Update utility:
   - `/frontend/src/utils/incomeCategoryApi.ts`
   
   Add to the `fallbackMappings` object:
   ```typescript
   const fallbackMappings: { [key: string]: string } = {
     'tithe': 'offering',
     'building_fund': 'event',
     'new_type': 'existing_mapping'  // Add here
   };
   ```

3. **Update this documentation**

---

## Database Fixes

### 2025-10-10 - Fixed INC007 Duplicate Mapping

**Issue**: INC007 (Event Hall & Church Item Rental) had `payment_type_mapping: 'event'`, which conflicted with INC003 (Fundraising). This caused the frontend to always select INC003 when selecting payment types, preventing other categories from being auto-selected.

**Fix**: 
- Updated seed data to set INC007 `payment_type_mapping` to `null`
- Created migration `fixINC007Mapping.js` to update existing database records
- INC007 now requires manual selection (as intended per design)

**Result**: 
- Only INC003 maps to 'event' payment type
- 'building_fund' correctly maps to INC003 via fallback
- All payment type auto-selections now work correctly

---

## Last Updated

2025-10-10 - Fixed INC007 duplicate mapping issue
2025-10-03 - Added tithe and building_fund fallback mappings
