require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BASE_URL = process.env.API_URL || 'http://localhost:5001';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

function logTest(testName) {
  log(`\n📋 ${testName}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Test helper function
async function testEndpoint(method, url, options = {}) {
  const { body, headers = {}, expectedStatus, description } = options;
  
  try {
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    const result = {
      status: response.status,
      ok: response.ok,
      data: responseData,
      headers: Object.fromEntries(response.headers.entries())
    };

    if (expectedStatus) {
      if (response.status === expectedStatus) {
        logSuccess(`${description || method} ${url} - Status: ${response.status}`);
        return { success: true, ...result };
      } else {
        logError(`${description || method} ${url} - Expected ${expectedStatus}, got ${response.status}`);
        logInfo(`Response: ${JSON.stringify(responseData, null, 2)}`);
        return { success: false, ...result };
      }
    }

    // Auto-detect success
    if (response.ok) {
      logSuccess(`${description || method} ${url} - Status: ${response.status}`);
    } else if (response.status === 401) {
      logWarning(`${description || method} ${url} - Status: 401 (Authentication required - this is expected)`);
    } else if (response.status === 403) {
      logWarning(`${description || method} ${url} - Status: 403 (Authorization required - check user role)`);
    } else {
      logError(`${description || method} ${url} - Status: ${response.status}`);
      logInfo(`Response: ${JSON.stringify(responseData, null, 2)}`);
    }

    return result;
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testEmployeeAPIs() {
  logSection('EMPLOYEE MANAGEMENT API TESTS');

  const employeeId = 'test-employee-id'; // Will be replaced with actual ID if creation succeeds

  // Test 1: List all employees
  logTest('1. GET /api/employees - List all employees');
  await testEndpoint('GET', `${BASE_URL}/api/employees`, {
    description: 'List employees',
    expectedStatus: 401 // Expected without auth
  });

  // Test 2: List employees with filters
  logTest('2. GET /api/employees?is_active=true - Filter active employees');
  await testEndpoint('GET', `${BASE_URL}/api/employees?is_active=true`, {
    description: 'Filter active employees',
    expectedStatus: 401
  });

  logTest('3. GET /api/employees?employment_type=full-time - Filter by employment type');
  await testEndpoint('GET', `${BASE_URL}/api/employees?employment_type=full-time`, {
    description: 'Filter by employment type',
    expectedStatus: 401
  });

  // Test 3: Get employee by ID
  logTest('4. GET /api/employees/:id - Get employee by ID');
  await testEndpoint('GET', `${BASE_URL}/api/employees/${employeeId}`, {
    description: 'Get employee by ID',
    expectedStatus: 401
  });

  // Test 4: Create employee
  logTest('5. POST /api/employees - Create new employee');
  const newEmployee = {
    first_name: 'John',
    last_name: 'Priest',
    position: 'Priest',
    employment_type: 'full-time',
    email: 'john.priest@church.com',
    phone_number: '(555) 123-4567',
    salary_amount: 50000.00,
    salary_frequency: 'monthly',
    hire_date: '2024-01-15',
    is_active: true
  };
  await testEndpoint('POST', `${BASE_URL}/api/employees`, {
    body: newEmployee,
    description: 'Create employee',
    expectedStatus: 401
  });

  // Test 5: Update employee
  logTest('6. PUT /api/employees/:id - Update employee');
  const updateData = {
    salary_amount: 55000.00,
    position: 'Senior Priest'
  };
  await testEndpoint('PUT', `${BASE_URL}/api/employees/${employeeId}`, {
    body: updateData,
    description: 'Update employee',
    expectedStatus: 401
  });

  // Test 6: Delete employee
  logTest('7. DELETE /api/employees/:id - Delete employee');
  await testEndpoint('DELETE', `${BASE_URL}/api/employees/${employeeId}`, {
    description: 'Delete employee',
    expectedStatus: 401
  });

  logInfo('\n📝 Employee API Test Data Examples:');
  console.log(JSON.stringify({
    create: newEmployee,
    update: updateData,
    valid_employment_types: ['full-time', 'part-time', 'contract', 'volunteer'],
    valid_salary_frequencies: ['weekly', 'bi-weekly', 'monthly', 'annual', 'per-service']
  }, null, 2));
}

async function testVendorAPIs() {
  logSection('VENDOR MANAGEMENT API TESTS');

  const vendorId = 'test-vendor-id'; // Will be replaced with actual ID if creation succeeds

  // Test 1: List all vendors
  logTest('1. GET /api/vendors - List all vendors');
  await testEndpoint('GET', `${BASE_URL}/api/vendors`, {
    description: 'List vendors',
    expectedStatus: 401
  });

  // Test 2: List vendors with filters
  logTest('2. GET /api/vendors?is_active=true - Filter active vendors');
  await testEndpoint('GET', `${BASE_URL}/api/vendors?is_active=true`, {
    description: 'Filter active vendors',
    expectedStatus: 401
  });

  logTest('3. GET /api/vendors?vendor_type=utility - Filter by vendor type');
  await testEndpoint('GET', `${BASE_URL}/api/vendors?vendor_type=utility`, {
    description: 'Filter by vendor type',
    expectedStatus: 401
  });

  // Test 3: Get vendor by ID
  logTest('4. GET /api/vendors/:id - Get vendor by ID');
  await testEndpoint('GET', `${BASE_URL}/api/vendors/${vendorId}`, {
    description: 'Get vendor by ID',
    expectedStatus: 401
  });

  // Test 4: Create vendor
  logTest('5. POST /api/vendors - Create new vendor');
  const newVendor = {
    name: 'ACME Utilities',
    vendor_type: 'utility',
    contact_person: 'Jane Smith',
    email: 'billing@acme-utilities.com',
    phone_number: '(555) 987-6543',
    address: '123 Utility St, City, State 12345',
    website: 'https://www.acme-utilities.com',
    account_number: 'CHURCH-001',
    payment_terms: 'Net 30',
    is_active: true
  };
  await testEndpoint('POST', `${BASE_URL}/api/vendors`, {
    body: newVendor,
    description: 'Create vendor',
    expectedStatus: 401
  });

  // Test 5: Update vendor
  logTest('6. PUT /api/vendors/:id - Update vendor');
  const updateData = {
    payment_terms: 'Net 15',
    contact_person: 'John Doe'
  };
  await testEndpoint('PUT', `${BASE_URL}/api/vendors/${vendorId}`, {
    body: updateData,
    description: 'Update vendor',
    expectedStatus: 401
  });

  // Test 6: Delete vendor
  logTest('7. DELETE /api/vendors/:id - Delete vendor');
  await testEndpoint('DELETE', `${BASE_URL}/api/vendors/${vendorId}`, {
    description: 'Delete vendor',
    expectedStatus: 401
  });

  logInfo('\n📝 Vendor API Test Data Examples:');
  console.log(JSON.stringify({
    create: newVendor,
    update: updateData,
    valid_vendor_types: ['utility', 'supplier', 'service-provider', 'contractor', 'lender', 'other']
  }, null, 2));
}

async function testExpenseAPIs() {
  logSection('ENHANCED EXPENSE API TESTS (with Employee/Vendor/Payee support)');

  const expenseId = 'test-expense-id';

  // Test 1: Get expense categories
  logTest('1. GET /api/expenses/categories - Get expense categories');
  await testEndpoint('GET', `${BASE_URL}/api/expenses/categories`, {
    description: 'Get expense categories',
    expectedStatus: 401
  });

  // Test 2: List all expenses
  logTest('2. GET /api/expenses - List all expenses');
  await testEndpoint('GET', `${BASE_URL}/api/expenses`, {
    description: 'List expenses',
    expectedStatus: 401
  });

  // Test 3: List expenses with filters
  logTest('3. GET /api/expenses?start_date=2024-01-01&end_date=2024-12-31 - Filter by date range');
  await testEndpoint('GET', `${BASE_URL}/api/expenses?start_date=2024-01-01&end_date=2024-12-31`, {
    description: 'Filter expenses by date',
    expectedStatus: 401
  });

  // Test 4: Get expense by ID
  logTest('4. GET /api/expenses/:id - Get expense by ID');
  await testEndpoint('GET', `${BASE_URL}/api/expenses/${expenseId}`, {
    description: 'Get expense by ID',
    expectedStatus: 401
  });

  // Test 5: Create expense with employee (salary payment)
  logTest('5. POST /api/expenses - Create expense linked to employee (salary)');
  const expenseWithEmployee = {
    gl_code: '6000', // Example GL code - adjust based on your categories
    amount: 5000.00,
    expense_date: '2024-01-15',
    payment_method: 'check',
    check_number: '1001',
    memo: 'Monthly salary payment',
    employee_id: 'employee-uuid-here', // Replace with actual employee ID
    receipt_number: 'SAL-2024-01'
  };
  await testEndpoint('POST', `${BASE_URL}/api/expenses`, {
    body: expenseWithEmployee,
    description: 'Create expense with employee',
    expectedStatus: 401
  });

  // Test 6: Create expense with vendor (utility bill)
  logTest('6. POST /api/expenses - Create expense linked to vendor (utility bill)');
  const expenseWithVendor = {
    gl_code: '6100', // Example GL code - adjust based on your categories
    amount: 250.00,
    expense_date: '2024-01-20',
    payment_method: 'check',
    check_number: '1002',
    invoice_number: 'INV-2024-001',
    memo: 'Monthly utility bill',
    vendor_id: 'vendor-uuid-here', // Replace with actual vendor ID
    receipt_number: 'UTIL-2024-01'
  };
  await testEndpoint('POST', `${BASE_URL}/api/expenses`, {
    body: expenseWithVendor,
    description: 'Create expense with vendor',
    expectedStatus: 401
  });

  // Test 7: Create expense with generic payee (one-off payment)
  logTest('7. POST /api/expenses - Create expense with generic payee name');
  const expenseWithPayee = {
    gl_code: '6200', // Example GL code - adjust based on your categories
    amount: 150.00,
    expense_date: '2024-01-25',
    payment_method: 'cash',
    memo: 'One-time payment to contractor',
    payee_name: 'John Contractor',
    receipt_number: 'MISC-2024-01'
  };
  await testEndpoint('POST', `${BASE_URL}/api/expenses`, {
    body: expenseWithPayee,
    description: 'Create expense with payee name',
    expectedStatus: 401
  });

  // Test 8: Update expense
  logTest('8. PUT /api/expenses/:id - Update expense');
  const updateData = {
    amount: 260.00,
    memo: 'Updated utility bill amount'
  };
  await testEndpoint('PUT', `${BASE_URL}/api/expenses/${expenseId}`, {
    body: updateData,
    description: 'Update expense',
    expectedStatus: 401
  });

  // Test 9: Get expense statistics
  logTest('9. GET /api/expenses/stats - Get expense statistics');
  await testEndpoint('GET', `${BASE_URL}/api/expenses/stats?year=2024`, {
    description: 'Get expense stats',
    expectedStatus: 401
  });

  // Test 10: Delete expense
  logTest('10. DELETE /api/expenses/:id - Delete expense');
  await testEndpoint('DELETE', `${BASE_URL}/api/expenses/${expenseId}`, {
    description: 'Delete expense',
    expectedStatus: 401
  });

  logInfo('\n📝 Expense API Test Data Examples:');
  console.log(JSON.stringify({
    expense_with_employee: expenseWithEmployee,
    expense_with_vendor: expenseWithVendor,
    expense_with_payee: expenseWithPayee,
    update: updateData,
    valid_payment_methods: ['cash', 'check'],
    payee_options: {
      employee_id: 'Link to employee record (for salaries)',
      vendor_id: 'Link to vendor record (for recurring bills)',
      payee_name: 'Generic payee name (for one-off payments)'
    },
    optional_fields: ['check_number', 'invoice_number', 'receipt_number', 'memo']
  }, null, 2));
}

async function testServerHealth() {
  logSection('SERVER HEALTH CHECK');

  logTest('Checking if server is running...');
  const healthResult = await testEndpoint('GET', `${BASE_URL}/health`, {
    description: 'Health check',
    expectedStatus: 200
  });

  if (!healthResult.ok) {
    logError('\n❌ Server is not responding!');
    logWarning('Make sure the backend server is running:');
    logInfo('  cd backend && npm start');
    return false;
  }

  logSuccess('Server is running and healthy!');
  return true;
}

async function runAllTests() {
  console.clear();
  log('\n🧪 COMPREHENSIVE API TEST SUITE', 'bright');
  log('Testing Employee, Vendor, and Enhanced Expense Management APIs\n', 'gray');

  // Check server health first
  const serverHealthy = await testServerHealth();
  if (!serverHealthy) {
    process.exit(1);
  }

  // Run all test suites
  await testEmployeeAPIs();
  await testVendorAPIs();
  await testExpenseAPIs();

  // Summary
  logSection('TEST SUMMARY');
  logInfo('All endpoints have been tested for basic connectivity.');
  logWarning('\n⚠️  IMPORTANT NOTES:');
  log('1. Most endpoints returned 401 (Unauthorized) - this is EXPECTED without authentication', 'yellow');
  log('2. To test with actual data, you need to:', 'yellow');
  log('   a. Get a Firebase authentication token from your frontend', 'gray');
  log('   b. Include it in the Authorization header: Bearer <token>', 'gray');
  log('   c. Ensure your user has the required role (admin/treasurer)', 'gray');
  log('\n3. Required Roles:', 'yellow');
  log('   - Employee/Vendor LIST/GET: treasurer, admin', 'gray');
  log('   - Employee/Vendor CREATE/UPDATE/DELETE: admin only', 'gray');
  log('   - Expense LIST/GET: admin, treasurer, church_leadership', 'gray');
  log('   - Expense CREATE/UPDATE: admin, treasurer', 'gray');
  log('   - Expense DELETE: admin only', 'gray');
  log('\n4. Next Steps:', 'yellow');
  log('   - Test endpoints manually using Postman/Insomnia with Firebase token', 'gray');
  log('   - Or test through the frontend application', 'gray');
  log('   - Check backend logs for detailed error messages', 'gray');
  log('\n✅ Test suite completed!\n', 'green');
}

// Run tests
runAllTests().catch(error => {
  logError(`\n❌ Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});



