# Church Expense Management System Implementation

## Overview
Implemented a comprehensive expense management system following common church accounting patterns. The system now supports:
- Employee/staff tracking for salary and allowance payments
- Vendor/supplier management for bills and services
- Detailed payee information for all expense types
- Invoice and check number tracking
- Flexible payee selection based on expense category

## Changes Made

### Backend Changes

#### 1. New Models Created

**Employee Model** (`/backend/src/models/Employee.js`)
- Tracks church staff, priests, deacons, and other employees
- Fields include:
  - Personal info: first_name, last_name, email, phone_number, address
  - Employment details: position, employment_type (full-time, part-time, contract, volunteer)
  - Compensation: salary_amount, salary_frequency
  - Tax info: ssn_last_four, tax_id
  - Status tracking: hire_date, termination_date, is_active
  - Notes field for additional information
- Supports soft delete (paranoid: true)

**Vendor Model** (`/backend/src/models/Vendor.js`)
- Tracks vendors, suppliers, and service providers
- Fields include:
  - Basic info: name, contact_person, email, phone_number, address, website
  - Vendor classification: vendor_type (utility, supplier, service-provider, contractor, lender, other)
  - Business details: tax_id, account_number, payment_terms
  - Status: is_active
  - Notes field for additional information
- Supports soft delete (paranoid: true)

#### 2. Updated Models

**LedgerEntry Model** (`/backend/src/models/LedgerEntry.js`)
- Added new fields for payee tracking:
  - `employee_id` (UUID) - Links to Employee for salary/allowance expenses
  - `vendor_id` (UUID) - Links to Vendor for vendor payments
  - `payee_name` (STRING) - Generic payee name for one-off payments
  - `check_number` (STRING) - Check number if paid by check
  - `invoice_number` (STRING) - Invoice or bill number for reference
- Added associations to Employee and Vendor models
- Added indexes for employee_id and vendor_id for query performance

#### 3. New API Routes

**Employee Routes** (`/backend/src/routes/employeeRoutes.js`)
- `GET /api/employees` - List all employees (with filtering)
- `GET /api/employees/:id` - Get employee by ID
- `POST /api/employees` - Create new employee (admin only)
- `PUT /api/employees/:id` - Update employee (admin only)
- `DELETE /api/employees/:id` - Soft delete employee (admin only)
- All routes require authentication (treasurer/admin access)

**Vendor Routes** (`/backend/src/routes/vendorRoutes.js`)
- `GET /api/vendors` - List all vendors (with filtering)
- `GET /api/vendors/:id` - Get vendor by ID
- `POST /api/vendors` - Create new vendor (admin only)
- `PUT /api/vendors/:id` - Update vendor (admin only)
- `DELETE /api/vendors/:id` - Soft delete vendor (admin only)
- All routes require authentication (treasurer/admin access)

#### 4. Updated Controllers

**Expense Controller** (`/backend/src/controllers/expenseController.js`)
- Updated `createExpense` to accept payee-related fields:
  - employee_id
  - vendor_id
  - payee_name
  - check_number
  - invoice_number
- Updated expense fetching to include Employee and Vendor details
- Payee information is now included in expense records

#### 5. Database Migration

**Migration Script** (`/backend/src/database/migrations/addEmployeeVendorSupport.js`)
- Creates `employees` table with all fields and indexes
- Creates `vendors` table with all fields and indexes
- Adds payee-related columns to `ledger_entries` table
- Creates necessary foreign key relationships
- Adds performance indexes

#### 6. Server Configuration

**Updated** `/backend/src/server.js`
- Imported and mounted employee and vendor routes
- Routes available at `/api/employees` and `/api/vendors`

### Database Schema

#### Employees Table
```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  position VARCHAR(100),
  employment_type ENUM('full-time', 'part-time', 'contract', 'volunteer') DEFAULT 'part-time',
  email VARCHAR(255),
  phone_number VARCHAR(20),
  address TEXT,
  ssn_last_four VARCHAR(4),
  hire_date DATE,
  termination_date DATE,
  salary_amount DECIMAL(10,2),
  salary_frequency ENUM('weekly', 'bi-weekly', 'monthly', 'annual', 'per-service'),
  is_active BOOLEAN DEFAULT TRUE,
  tax_id VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

#### Vendors Table
```sql
CREATE TABLE vendors (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  vendor_type ENUM('utility', 'supplier', 'service-provider', 'contractor', 'lender', 'other') DEFAULT 'other',
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone_number VARCHAR(20),
  address TEXT,
  website VARCHAR(255),
  tax_id VARCHAR(50),
  account_number VARCHAR(100),
  payment_terms VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

#### Updated Ledger Entries Table
```sql
ALTER TABLE ledger_entries ADD COLUMN employee_id UUID REFERENCES employees(id);
ALTER TABLE ledger_entries ADD COLUMN vendor_id UUID REFERENCES vendors(id);
ALTER TABLE ledger_entries ADD COLUMN payee_name VARCHAR(255);
ALTER TABLE ledger_entries ADD COLUMN check_number VARCHAR(50);
ALTER TABLE ledger_entries ADD COLUMN invoice_number VARCHAR(100);
```

## Common Church Expense Patterns Supported

### 1. Salary/Allowance Expenses (EXP001)
- Select from list of active employees
- Track regular salary payments
- Support for priests, deacons, staff
- Frequency tracking (monthly, per-service, etc.)

### 2. Vendor Payments
- Utilities (EXP005) - Link to utility vendors
- Mortgage (EXP002) - Link to lender
- Insurance (EXP007) - Link to insurance provider
- Cable/Internet (EXP006) - Link to service provider
- Building Repairs (EXP102) - Link to contractors

### 3. Generic Payees
- One-time payments
- Visiting priests allowances
- Relief assistance
- Miscellaneous expenses

### 4. Check and Invoice Tracking
- Check number for check payments
- Invoice number for bill payments
- Receipt tracking for all expenses

## Usage Examples

### Creating an Employee
```javascript
POST /api/employees
{
  "first_name": "Abba",
  "last_name": "Tekle",
  "position": "Priest",
  "employment_type": "part-time",
  "email": "abba.tekle@church.org",
  "phone_number": "+1234567890",
  "salary_amount": 2000.00,
  "salary_frequency": "monthly",
  "hire_date": "2024-01-01"
}
```

### Creating a Vendor
```javascript
POST /api/vendors
{
  "name": "Texas Power & Light",
  "vendor_type": "utility",
  "contact_person": "Customer Service",
  "phone_number": "+1234567890",
  "account_number": "ACC-123456",
  "payment_terms": "Due on receipt"
}
```

### Recording Salary Expense
```javascript
POST /api/expenses
{
  "gl_code": "EXP001",
  "amount": 2000.00,
  "expense_date": "2024-11-01",
  "payment_method": "check",
  "employee_id": "uuid-of-employee",
  "check_number": "1234",
  "memo": "Monthly salary - November 2024"
}
```

### Recording Utility Bill
```javascript
POST /api/expenses
{
  "gl_code": "EXP005",
  "amount": 450.00,
  "expense_date": "2024-11-05",
  "payment_method": "check",
  "vendor_id": "uuid-of-vendor",
  "check_number": "1235",
  "invoice_number": "INV-2024-11",
  "memo": "November electricity bill"
}
```

## Next Steps (Frontend Implementation Needed)

### 1. Enhanced AddExpenseModal Component
- Add employee selector for EXP001 (Salary/Allowance)
- Add vendor selector for applicable categories
- Add generic payee name field for other expenses
- Add check number field (show when payment_method is 'check')
- Add invoice number field
- Dynamic field display based on selected expense category

### 2. Employee Management UI
- Employee list page with add/edit/delete
- Employee form with all fields
- Active/inactive status toggle
- Search and filter capabilities

### 3. Vendor Management UI
- Vendor list page with add/edit/delete
- Vendor form with all fields
- Vendor type categorization
- Active/inactive status toggle
- Search and filter capabilities

### 4. Enhanced Expense Reporting
- Group expenses by employee (payroll reports)
- Group expenses by vendor (vendor payment reports)
- Include payee information in expense lists
- Check register report
- 1099 preparation support

## Testing Recommendations

1. **Run Migration**:
   ```bash
   cd backend
   node src/database/migrations/addEmployeeVendorSupport.js
   ```

2. **Test Employee API**:
   - Create test employees
   - List employees
   - Update employee information
   - Soft delete and verify

3. **Test Vendor API**:
   - Create test vendors
   - List vendors by type
   - Update vendor information
   - Soft delete and verify

4. **Test Expense Recording**:
   - Record salary expense with employee
   - Record utility expense with vendor
   - Record misc expense with payee name
   - Verify all fields are saved correctly

5. **Test Expense Retrieval**:
   - Verify employee details are included
   - Verify vendor details are included
   - Check payee_name field
   - Verify check and invoice numbers

## Security Considerations

- All employee and vendor routes require authentication
- Only admin users can create/update/delete employees and vendors
- Treasurer and admin can view employee and vendor lists
- Sensitive fields (SSN, tax IDs) should be encrypted in production
- Soft delete preserves data integrity for historical records

## Files Modified/Created

### Backend (15 files)
1. `/backend/src/models/Employee.js` (NEW)
2. `/backend/src/models/Vendor.js` (NEW)
3. `/backend/src/models/LedgerEntry.js` (UPDATED)
4. `/backend/src/models/index.js` (UPDATED)
5. `/backend/src/routes/employeeRoutes.js` (NEW)
6. `/backend/src/routes/vendorRoutes.js` (NEW)
7. `/backend/src/controllers/expenseController.js` (UPDATED)
8. `/backend/src/server.js` (UPDATED)
9. `/backend/src/database/migrations/addEmployeeVendorSupport.js` (NEW)

### Frontend (To be implemented)
- Employee management components
- Vendor management components
- Enhanced AddExpenseModal with dynamic fields
- Expense list with payee information

## Benefits

1. **Better Expense Tracking**: Know exactly who was paid for each expense
2. **Payroll Management**: Track all employee payments in one place
3. **Vendor Management**: Maintain vendor relationships and payment history
4. **Tax Compliance**: Easy 1099 preparation with vendor tracking
5. **Audit Trail**: Complete record of who, what, when, and how much
6. **Reporting**: Generate payroll reports, vendor payment summaries, etc.
7. **Church Accounting Standards**: Follows common church bookkeeping practices
