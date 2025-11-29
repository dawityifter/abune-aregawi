# API Testing Quick Start

## 🚀 Quick Test Commands

### 1. Basic Connectivity Test (No Auth Required)
Tests that all endpoints are registered and protected:
```bash
cd backend
node scripts/test-employee-vendor-expense-apis.js
```

**Expected Result:** All endpoints should return `401 Unauthorized` ✅

---

### 2. Authenticated Test (Requires Firebase Token)

#### Step 1: Get Firebase Token
Open browser console in your frontend app and run:
```javascript
await window.getIdToken()
```

#### Step 2: Run Authenticated Tests
```bash
# Option A: Command line argument
node scripts/test-apis-with-auth.js <your-firebase-token>

# Option B: Environment variable
FIREBASE_TOKEN=<your-token> node scripts/test-apis-with-auth.js
```

**Expected Result:** Creates test data, tests all CRUD operations, then cleans up ✅

---

## 📋 Test Coverage

### ✅ Employee APIs
- [x] List employees (with filters)
- [x] Get employee by ID
- [x] Create employee
- [x] Update employee
- [x] Delete employee

### ✅ Vendor APIs
- [x] List vendors (with filters)
- [x] Get vendor by ID
- [x] Create vendor
- [x] Update vendor
- [x] Delete vendor

### ✅ Expense APIs
- [x] Get expense categories
- [x] List expenses (with filters)
- [x] Get expense by ID
- [x] Create expense with employee
- [x] Create expense with vendor
- [x] Create expense with generic payee
- [x] Update expense
- [x] Get expense statistics
- [x] Delete expense

---

## 🔑 Required Roles

| Operation | Required Role |
|-----------|--------------|
| View Employees/Vendors | `treasurer`, `admin` |
| Create/Update Employees/Vendors | `admin` only |
| Delete Employees/Vendors | `admin` only |
| View Expenses | `admin`, `treasurer`, `church_leadership` |
| Create/Update Expenses | `admin`, `treasurer` |
| Delete Expenses | `admin` only |

---

## 📝 Example API Calls

### Create Employee
```bash
curl -X POST http://localhost:5001/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "first_name": "John",
    "last_name": "Priest",
    "position": "Priest",
    "employment_type": "full-time",
    "email": "john@church.com",
    "salary_amount": 50000.00,
    "salary_frequency": "monthly"
  }'
```

### Create Expense with Employee
```bash
curl -X POST http://localhost:5001/api/expenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "gl_code": "6000",
    "amount": 5000.00,
    "expense_date": "2024-01-15",
    "payment_method": "check",
    "check_number": "1001",
    "employee_id": "EMPLOYEE_UUID"
  }'
```

---

## 📚 Full Documentation

See `API_TESTING_GUIDE.md` for complete API documentation and examples.

---

## ⚠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| `401 Unauthorized` | Get a fresh Firebase token |
| `403 Forbidden` | Check user role (need admin/treasurer) |
| `400 Bad Request` | Verify request body matches API spec |
| `404 Not Found` | Check if resource ID exists |
| Server not responding | Ensure backend is running: `cd backend && npm start` |

---

## ✅ Success Checklist

- [ ] Basic connectivity test passes (401 responses)
- [ ] Authenticated test creates employees
- [ ] Authenticated test creates vendors
- [ ] Authenticated test creates expenses with employees
- [ ] Authenticated test creates expenses with vendors
- [ ] Authenticated test creates expenses with generic payees
- [ ] All test data is cleaned up after tests
- [ ] Verify data in database matches API responses



