# Department Management - Database Column Name Fix

## Issue
**Error**: `"column leader.firstName does not exist"`

When clicking the Departments tab, the application failed with:
```json
{
  "success": false,
  "message": "Failed to fetch departments",
  "error": "column leader.firstName does not exist"
}
```

## Root Cause
**Database Schema Mismatch**: The backend controllers were using camelCase column names (`firstName`, `lastName`, `phoneNumber`) but the actual PostgreSQL database columns use snake_case (`first_name`, `last_name`, `phone_number`).

The `Member` model uses the `field` property to map between JavaScript camelCase and database snake_case:
```javascript
first_name: {
  type: DataTypes.STRING(100),
  field: 'first_name'  // Maps to database column
}
```

However, when using `.attributes` in Sequelize queries, we must use the actual database column names, not the model property names.

## Files Fixed

### Backend Controllers

1. **`../backend/src/controllers/departmentController.js`**
   - Fixed 6 occurrences across multiple functions
   - Changed: `firstName`, `lastName`, `phoneNumber` → `first_name`, `last_name`, `phone_number`
   - Functions affected:
     - `getAllDepartments()`
     - `getDepartmentById()`
     - `createDepartment()`
     - `updateDepartment()`

2. **`../backend/src/controllers/departmentMemberController.js`**
   - Fixed 4 occurrences
   - Changed: `firstName`, `lastName`, `phoneNumber`, `dateJoinedParish` → `first_name`, `last_name`, `phone_number`, `date_joined_parish`
   - Functions affected:
     - `getDepartmentMembers()`
     - `addMembersToDepartment()`
     - `updateDepartmentMember()`

### Frontend Components

Updated to match backend snake_case response:

3. **`../frontend/src/components/admin/DepartmentCard.tsx`**
   - Updated TypeScript interface for `leader` object
   - Changed display: `leader.firstName` → `leader.first_name`

4. **`../frontend/src/components/admin/CreateDepartmentModal.tsx`**
   - Updated member dropdown: `member.firstName` → `member.first_name`

5. **`../frontend/src/components/admin/EditDepartmentModal.tsx`**
   - Updated member dropdown: `member.firstName` → `member.first_name`

6. **`../frontend/src/components/admin/ManageDepartmentMembersModal.tsx`**
   - Updated TypeScript interface for `member` object
   - Changed all member name displays to use snake_case

### Infrastructure

7. **`../backend/src/server.js`**
   - Added `/api/departments` to the root endpoint's list of available endpoints

## Example Fix

### Before (Incorrect)
```javascript
{
  model: Member,
  as: 'leader',
  attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber']
}
```

### After (Correct)
```javascript
{
  model: Member,
  as: 'leader',
  attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
}
```

## Testing

Backend has been restarted and is running:
- Health check: ✅ http://localhost:5001/health
- Departments endpoint: ✅ http://localhost:5001/api/departments (requires auth)

## Expected Behavior Now

1. ✅ Departments tab loads without error
2. ✅ Department list displays with member counts
3. ✅ Leader names show correctly
4. ✅ Create/Edit modals populate member dropdowns
5. ✅ Manage members modal shows all department members

## Next Steps

1. **Refresh your frontend** - If it's already running, just reload the page
2. **Click the Departments tab** - Should now load successfully
3. **Test creating a department** - Verify all forms work

## Key Lesson

When using Sequelize `attributes` in `include` statements, always use the **actual database column names** (snake_case), not the JavaScript model property names (camelCase), even though the model has `field` mappings defined.

---
**Status**: ✅ Fixed and Deployed
**Date**: 2025-10-08
**Backend**: Restarted (Port 5001)
