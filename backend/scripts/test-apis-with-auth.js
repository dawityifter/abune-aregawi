require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const BASE_URL = process.env.API_URL || 'http://localhost:5001';

// Get Firebase token from command line or environment variable
const FIREBASE_TOKEN = process.argv[2] || process.env.FIREBASE_TOKEN;

if (!FIREBASE_TOKEN) {
  console.error('\n❌ Error: Firebase token is required!');
  console.log('\nUsage:');
  console.log('  node scripts/test-apis-with-auth.js <firebase-token>');
  console.log('  OR');
  console.log('  FIREBASE_TOKEN=<token> node scripts/test-apis-with-auth.js');
  console.log('\nTo get a Firebase token:');
  console.log('  1. Log in to your frontend application');
  console.log('  2. Open browser console');
  console.log('  3. Run: await window.getIdToken()');
  console.log('  4. Copy the token and use it in this script\n');
  process.exit(1);
}

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
  const { body, headers = {}, description } = options;
  
  try {
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIREBASE_TOKEN}`,
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
      data: responseData
    };

    if (response.ok) {
      logSuccess(`${description || method} ${url} - Status: ${response.status}`);
      if (responseData && responseData.data) {
        logInfo(`Response: ${JSON.stringify(responseData, null, 2).substring(0, 200)}...`);
      }
      return { success: true, ...result };
    } else {
      logError(`${description || method} ${url} - Status: ${response.status}`);
      logInfo(`Response: ${JSON.stringify(responseData, null, 2)}`);
      return { success: false, ...result };
    }
  } catch (error) {
    logError(`Request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testEmployeeAPIs() {
  logSection('EMPLOYEE MANAGEMENT API TESTS (with Authentication)');

  let createdEmployeeId = null;

  // Test 1: List all employees
  logTest('1. GET /api/employees - List all employees');
  const listResult = await testEndpoint('GET', `${BASE_URL}/api/employees`, {
    description: 'List employees'
  });

  // Test 2: Create employee
  logTest('2. POST /api/employees - Create new employee');
  const newEmployee = {
    first_name: 'Test',
    last_name: 'Employee',
    position: 'Test Position',
    employment_type: 'part-time',
    email: `test.employee.${Date.now()}@church.com`,
    phone_number: '(555) 123-4567',
    salary_amount: 30000.00,
    salary_frequency: 'monthly',
    hire_date: '2024-01-15',
    is_active: true
  };
  const createResult = await testEndpoint('POST', `${BASE_URL}/api/employees`, {
    body: newEmployee,
    description: 'Create employee'
  });

  if (createResult.success && createResult.data?.data?.id) {
    createdEmployeeId = createResult.data.data.id;
    logSuccess(`Created employee with ID: ${createdEmployeeId}`);
  }

  // Test 3: Get employee by ID
  if (createdEmployeeId) {
    logTest('3. GET /api/employees/:id - Get employee by ID');
    await testEndpoint('GET', `${BASE_URL}/api/employees/${createdEmployeeId}`, {
      description: 'Get employee by ID'
    });
  }

  // Test 4: Update employee
  if (createdEmployeeId) {
    logTest('4. PUT /api/employees/:id - Update employee');
    const updateData = {
      salary_amount: 35000.00,
      position: 'Updated Test Position'
    };
    await testEndpoint('PUT', `${BASE_URL}/api/employees/${createdEmployeeId}`, {
      body: updateData,
      description: 'Update employee'
    });
  }

  // Test 5: List with filters
  logTest('5. GET /api/employees?is_active=true - Filter active employees');
  await testEndpoint('GET', `${BASE_URL}/api/employees?is_active=true`, {
    description: 'Filter active employees'
  });

  // Test 6: Delete employee (cleanup)
  if (createdEmployeeId) {
    logTest('6. DELETE /api/employees/:id - Delete employee (cleanup)');
    await testEndpoint('DELETE', `${BASE_URL}/api/employees/${createdEmployeeId}`, {
      description: 'Delete employee'
    });
  }

  return createdEmployeeId;
}

async function testVendorAPIs() {
  logSection('VENDOR MANAGEMENT API TESTS (with Authentication)');

  let createdVendorId = null;

  // Test 1: List all vendors
  logTest('1. GET /api/vendors - List all vendors');
  await testEndpoint('GET', `${BASE_URL}/api/vendors`, {
    description: 'List vendors'
  });

  // Test 2: Create vendor
  logTest('2. POST /api/vendors - Create new vendor');
  const newVendor = {
    name: `Test Vendor ${Date.now()}`,
    vendor_type: 'utility',
    contact_person: 'Test Contact',
    email: `test.vendor.${Date.now()}@example.com`,
    phone_number: '(555) 987-6543',
    account_number: 'TEST-001',
    payment_terms: 'Net 30',
    is_active: true
  };
  const createResult = await testEndpoint('POST', `${BASE_URL}/api/vendors`, {
    body: newVendor,
    description: 'Create vendor'
  });

  if (createResult.success && createResult.data?.data?.id) {
    createdVendorId = createResult.data.data.id;
    logSuccess(`Created vendor with ID: ${createdVendorId}`);
  }

  // Test 3: Get vendor by ID
  if (createdVendorId) {
    logTest('3. GET /api/vendors/:id - Get vendor by ID');
    await testEndpoint('GET', `${BASE_URL}/api/vendors/${createdVendorId}`, {
      description: 'Get vendor by ID'
    });
  }

  // Test 4: Update vendor
  if (createdVendorId) {
    logTest('4. PUT /api/vendors/:id - Update vendor');
    const updateData = {
      payment_terms: 'Net 15',
      contact_person: 'Updated Contact'
    };
    await testEndpoint('PUT', `${BASE_URL}/api/vendors/${createdVendorId}`, {
      body: updateData,
      description: 'Update vendor'
    });
  }

  // Test 5: List with filters
  logTest('5. GET /api/vendors?is_active=true - Filter active vendors');
  await testEndpoint('GET', `${BASE_URL}/api/vendors?is_active=true`, {
    description: 'Filter active vendors'
  });

  // Test 6: Delete vendor (cleanup)
  if (createdVendorId) {
    logTest('6. DELETE /api/vendors/:id - Delete vendor (cleanup)');
    await testEndpoint('DELETE', `${BASE_URL}/api/vendors/${createdVendorId}`, {
      description: 'Delete vendor'
    });
  }

  return createdVendorId;
}

async function testExpenseAPIs(employeeId, vendorId) {
  logSection('ENHANCED EXPENSE API TESTS (with Authentication)');

  let createdExpenseId = null;

  // Test 1: Get expense categories
  logTest('1. GET /api/expenses/categories - Get expense categories');
  const categoriesResult = await testEndpoint('GET', `${BASE_URL}/api/expenses/categories`, {
    description: 'Get expense categories'
  });

  // Get first available GL code for testing
  let testGlCode = '6000'; // Default fallback
  if (categoriesResult.success && categoriesResult.data?.data?.length > 0) {
    const activeCategory = categoriesResult.data.data.find(c => c.is_active) || categoriesResult.data.data[0];
    testGlCode = activeCategory.gl_code;
    logInfo(`Using GL code: ${testGlCode} (${activeCategory.name})`);
  }

  // Test 2: Create expense with employee (if employee exists)
  if (employeeId) {
    logTest('2. POST /api/expenses - Create expense linked to employee');
    const expenseWithEmployee = {
      gl_code: testGlCode,
      amount: 100.00,
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: 'check',
      check_number: `TEST-${Date.now()}`,
      memo: 'Test salary payment',
      employee_id: employeeId
    };
    const createResult = await testEndpoint('POST', `${BASE_URL}/api/expenses`, {
      body: expenseWithEmployee,
      description: 'Create expense with employee'
    });
    if (createResult.success && createResult.data?.data?.id) {
      createdExpenseId = createResult.data.data.id;
    }
  }

  // Test 3: Create expense with vendor (if vendor exists)
  if (vendorId) {
    logTest('3. POST /api/expenses - Create expense linked to vendor');
    const expenseWithVendor = {
      gl_code: testGlCode,
      amount: 50.00,
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: 'check',
      check_number: `TEST-V-${Date.now()}`,
      invoice_number: `INV-${Date.now()}`,
      memo: 'Test utility bill',
      vendor_id: vendorId
    };
    await testEndpoint('POST', `${BASE_URL}/api/expenses`, {
      body: expenseWithVendor,
      description: 'Create expense with vendor'
    });
  }

  // Test 4: Create expense with generic payee
  logTest('4. POST /api/expenses - Create expense with generic payee');
  const expenseWithPayee = {
    gl_code: testGlCode,
    amount: 25.00,
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    memo: 'Test one-time payment',
    payee_name: 'Test Contractor'
  };
  await testEndpoint('POST', `${BASE_URL}/api/expenses`, {
    body: expenseWithPayee,
    description: 'Create expense with payee name'
  });

  // Test 5: List expenses
  logTest('5. GET /api/expenses - List all expenses');
  await testEndpoint('GET', `${BASE_URL}/api/expenses`, {
    description: 'List expenses'
  });

  // Test 6: Get expense stats
  logTest('6. GET /api/expenses/stats - Get expense statistics');
  await testEndpoint('GET', `${BASE_URL}/api/expenses/stats?year=${new Date().getFullYear()}`, {
    description: 'Get expense stats'
  });

  // Test 7: Update expense (if created)
  if (createdExpenseId) {
    logTest('7. PUT /api/expenses/:id - Update expense');
    const updateData = {
      amount: 110.00,
      memo: 'Updated test expense'
    };
    await testEndpoint('PUT', `${BASE_URL}/api/expenses/${createdExpenseId}`, {
      body: updateData,
      description: 'Update expense'
    });
  }

  // Test 8: Delete expense (cleanup)
  if (createdExpenseId) {
    logTest('8. DELETE /api/expenses/:id - Delete expense (cleanup)');
    await testEndpoint('DELETE', `${BASE_URL}/api/expenses/${createdExpenseId}`, {
      description: 'Delete expense'
    });
  }
}

async function runAllTests() {
  console.clear();
  log('\n🧪 AUTHENTICATED API TEST SUITE', 'bright');
  log('Testing Employee, Vendor, and Enhanced Expense Management APIs with Firebase Auth\n', 'gray');
  logInfo(`Using Firebase token: ${FIREBASE_TOKEN.substring(0, 20)}...`);

  // Test employees
  const employeeId = await testEmployeeAPIs();
  
  // Test vendors
  const vendorId = await testVendorAPIs();
  
  // Test expenses (with created employee/vendor if available)
  await testExpenseAPIs(employeeId, vendorId);

  // Summary
  logSection('TEST SUMMARY');
  logSuccess('All authenticated tests completed!');
  logInfo('\nNote: Test data created during this run has been cleaned up.');
  logInfo('If any tests failed, check:');
  log('  - Your user role (admin/treasurer required for most operations)', 'gray');
  log('  - Token validity (tokens expire after 1 hour)', 'gray');
  log('  - Backend server logs for detailed error messages', 'gray');
  log('\n✅ Test suite completed!\n', 'green');
}

// Run tests
runAllTests().catch(error => {
  logError(`\n❌ Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});



