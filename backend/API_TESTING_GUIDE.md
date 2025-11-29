# API Testing Guide

## Employee, Vendor, and Expense Management APIs

This guide provides instructions for testing the newly implemented Employee, Vendor, and Enhanced Expense Management APIs.

---

## Quick Start

### 1. Basic Connectivity Test (No Authentication)

Test that all endpoints are properly registered and require authentication:

```bash
cd backend
node scripts/test-employee-vendor-expense-apis.js
```

This will test all endpoints and should return `401 Unauthorized` responses, which confirms the endpoints exist and are protected.

### 2. Authenticated Testing

To test with actual authentication, you need a Firebase token:

#### Getting a Firebase Token

**Option A: From Browser Console**
1. Log in to your frontend application
2. Open browser developer console (F12)
3. Run: `await window.getIdToken()`
4. Copy the returned token

**Option B: From Firebase Admin SDK** (for development)
```javascript
const admin = require('firebase-admin');
const token = await admin.auth().createCustomToken('user-uid');
```

#### Running Authenticated Tests

```bash
# Using command line argument
node scripts/test-apis-with-auth.js <your-firebase-token>

# Or using environment variable
FIREBASE_TOKEN=<your-firebase-token> node scripts/test-apis-with-auth.js
```

---

## API Endpoints

### Employee Management

#### List Employees
```http
GET /api/employees
GET /api/employees?is_active=true
GET /api/employees?employment_type=full-time
```

**Required Role:** `treasurer`, `admin`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Priest",
      "position": "Priest",
      "employment_type": "full-time",
      "email": "john@church.com",
      "phone_number": "(555) 123-4567",
      "salary_amount": 50000.00,
      "salary_frequency": "monthly",
      "hire_date": "2024-01-15",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Employee by ID
```http
GET /api/employees/:id
```

**Required Role:** `treasurer`, `admin`

#### Create Employee
```http
POST /api/employees
Content-Type: application/json
Authorization: Bearer <firebase-token>

{
  "first_name": "John",
  "last_name": "Priest",
  "position": "Priest",
  "employment_type": "full-time",
  "email": "john.priest@church.com",
  "phone_number": "(555) 123-4567",
  "salary_amount": 50000.00,
  "salary_frequency": "monthly",
  "hire_date": "2024-01-15",
  "is_active": true
}
```

**Required Role:** `admin` only

**Valid Values:**
- `employment_type`: `full-time`, `part-time`, `contract`, `volunteer`
- `salary_frequency`: `weekly`, `bi-weekly`, `monthly`, `annual`, `per-service`

#### Update Employee
```http
PUT /api/employees/:id
Content-Type: application/json
Authorization: Bearer <firebase-token>

{
  "salary_amount": 55000.00,
  "position": "Senior Priest"
}
```

**Required Role:** `admin` only

#### Delete Employee
```http
DELETE /api/employees/:id
Authorization: Bearer <firebase-token>
```

**Required Role:** `admin` only

**Note:** This is a soft delete (paranoid mode), so the record is not permanently removed.

---

### Vendor Management

#### List Vendors
```http
GET /api/vendors
GET /api/vendors?is_active=true
GET /api/vendors?vendor_type=utility
```

**Required Role:** `treasurer`, `admin`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "ACME Utilities",
      "vendor_type": "utility",
      "contact_person": "Jane Smith",
      "email": "billing@acme.com",
      "phone_number": "(555) 987-6543",
      "account_number": "CHURCH-001",
      "payment_terms": "Net 30",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Vendor by ID
```http
GET /api/vendors/:id
```

**Required Role:** `treasurer`, `admin`

#### Create Vendor
```http
POST /api/vendors
Content-Type: application/json
Authorization: Bearer <firebase-token>

{
  "name": "ACME Utilities",
  "vendor_type": "utility",
  "contact_person": "Jane Smith",
  "email": "billing@acme-utilities.com",
  "phone_number": "(555) 987-6543",
  "address": "123 Utility St, City, State 12345",
  "website": "https://www.acme-utilities.com",
  "account_number": "CHURCH-001",
  "payment_terms": "Net 30",
  "is_active": true
}
```

**Required Role:** `admin` only

**Valid Values:**
- `vendor_type`: `utility`, `supplier`, `service-provider`, `contractor`, `lender`, `other`

#### Update Vendor
```http
PUT /api/vendors/:id
Content-Type: application/json
Authorization: Bearer <firebase-token>

{
  "payment_terms": "Net 15",
  "contact_person": "John Doe"
}
```

**Required Role:** `admin` only

#### Delete Vendor
```http
DELETE /api/vendors/:id
Authorization: Bearer <firebase-token>
```

**Required Role:** `admin` only

---

### Enhanced Expense Management

#### Get Expense Categories
```http
GET /api/expenses/categories
GET /api/expenses/categories?include_inactive=true
```

**Required Role:** `admin`, `treasurer`, `church_leadership`

#### List Expenses
```http
GET /api/expenses
GET /api/expenses?page=1&limit=20
GET /api/expenses?start_date=2024-01-01&end_date=2024-12-31
GET /api/expenses?gl_code=6000
GET /api/expenses?payment_method=check
```

**Required Role:** `admin`, `treasurer`, `church_leadership`

#### Get Expense by ID
```http
GET /api/expenses/:id
```

**Required Role:** `admin`, `treasurer`, `church_leadership`

#### Create Expense (with Employee)
```http
POST /api/expenses
Content-Type: application/json
Authorization: Bearer <firebase-token>

{
  "gl_code": "6000",
  "amount": 5000.00,
  "expense_date": "2024-01-15",
  "payment_method": "check",
  "check_number": "1001",
  "memo": "Monthly salary payment",
  "employee_id": "employee-uuid-here",
  "receipt_number": "SAL-2024-01"
}
```

**Required Role:** `admin`, `treasurer`

#### Create Expense (with Vendor)
```http
POST /api/expenses
Content-Type: application/json
Authorization: Bearer <firebase-token>

{
  "gl_code": "6100",
  "amount": 250.00,
  "expense_date": "2024-01-20",
  "payment_method": "check",
  "check_number": "1002",
  "invoice_number": "INV-2024-001",
  "memo": "Monthly utility bill",
  "vendor_id": "vendor-uuid-here",
  "receipt_number": "UTIL-2024-01"
}
```

**Required Role:** `admin`, `treasurer`

#### Create Expense (with Generic Payee)
```http
POST /api/expenses
Content-Type: application/json
Authorization: Bearer <firebase-token>

{
  "gl_code": "6200",
  "amount": 150.00,
  "expense_date": "2024-01-25",
  "payment_method": "cash",
  "memo": "One-time payment to contractor",
  "payee_name": "John Contractor",
  "receipt_number": "MISC-2024-01"
}
```

**Required Role:** `admin`, `treasurer`

**Payee Options (use one):**
- `employee_id`: Link to employee record (for salaries)
- `vendor_id`: Link to vendor record (for recurring bills)
- `payee_name`: Generic payee name (for one-off payments)

**Valid Values:**
- `payment_method`: `cash`, `check`

**Optional Fields:**
- `check_number`: Check number (if payment_method is "check")
- `invoice_number`: Vendor invoice number
- `receipt_number`: Receipt number
- `memo`: Additional notes

#### Update Expense
```http
PUT /api/expenses/:id
Content-Type: application/json
Authorization: Bearer <firebase-token>

{
  "amount": 260.00,
  "memo": "Updated utility bill amount"
}
```

**Required Role:** `admin`, `treasurer`

#### Get Expense Statistics
```http
GET /api/expenses/stats?year=2024
```

**Required Role:** `admin`, `treasurer`, `church_leadership`

**Response:**
```json
{
  "success": true,
  "data": {
    "year": 2024,
    "totalExpenses": 50000.00,
    "expenseCount": 150,
    "averageExpense": 333.33,
    "byCategory": [
      {
        "gl_code": "6000",
        "name": "Salaries",
        "total": 30000.00,
        "count": 12
      }
    ],
    "byMonth": [
      {
        "month": 1,
        "monthName": "January",
        "total": 4000.00
      }
    ],
    "byPaymentMethod": {
      "check": 45000.00,
      "cash": 5000.00
    }
  }
}
```

#### Delete Expense
```http
DELETE /api/expenses/:id
Authorization: Bearer <firebase-token>
```

**Required Role:** `admin` only

---

## Testing with cURL

### Example: Create Employee
```bash
curl -X POST http://localhost:5001/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
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

### Example: Create Expense with Employee
```bash
curl -X POST http://localhost:5001/api/expenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "gl_code": "6000",
    "amount": 5000.00,
    "expense_date": "2024-01-15",
    "payment_method": "check",
    "check_number": "1001",
    "memo": "Monthly salary",
    "employee_id": "EMPLOYEE_UUID_HERE"
  }'
```

---

## Testing with Postman/Insomnia

1. **Set Base URL:** `http://localhost:5001` (or your production URL)

2. **Set Authorization Header:**
   - Type: `Bearer Token`
   - Token: Your Firebase token

3. **Set Content-Type Header:**
   - `Content-Type: application/json`

4. **Import the test collection** (if available) or create requests manually using the examples above

---

## Role Requirements Summary

| Endpoint | View | Create/Update | Delete |
|----------|------|---------------|--------|
| Employees | `treasurer`, `admin` | `admin` | `admin` |
| Vendors | `treasurer`, `admin` | `admin` | `admin` |
| Expenses | `admin`, `treasurer`, `church_leadership` | `admin`, `treasurer` | `admin` |

---

## Common Issues

### 401 Unauthorized
- **Cause:** Missing or invalid Firebase token
- **Solution:** Get a fresh token from the frontend or Firebase Admin SDK

### 403 Forbidden
- **Cause:** User doesn't have the required role
- **Solution:** Ensure your user has `admin` or `treasurer` role

### 400 Bad Request
- **Cause:** Invalid request data (missing required fields, invalid enum values, etc.)
- **Solution:** Check the request body against the API documentation above

### 404 Not Found
- **Cause:** Resource doesn't exist (invalid ID)
- **Solution:** Verify the ID exists by listing resources first

### 500 Internal Server Error
- **Cause:** Server-side error (database issue, validation error, etc.)
- **Solution:** Check backend server logs for detailed error messages

---

## Next Steps

1. ✅ Run basic connectivity tests
2. ✅ Test with authentication using the provided scripts
3. ✅ Test through the frontend application
4. ✅ Verify data integrity in the database
5. ✅ Test edge cases and error handling

---

## Additional Resources

- **Backend Server Logs:** Check `backend/logs/` or console output
- **Database:** Verify data in `employees`, `vendors`, and `ledger_entries` tables
- **Migration:** Ensure `addEmployeeVendorSupport.js` migration has been run



