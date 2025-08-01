# Testing Guide

This directory contains comprehensive test suites for the Abune Aregawi Church backend API.

## Test Structure

```
tests/
├── setup.js                 # Global test setup and mocks
├── integration/             # Integration tests
│   ├── health.test.js      # Health endpoint tests
│   └── auth.test.js        # Authentication flow tests
└── unit/                   # Unit tests
    ├── middleware/         # Middleware tests
    │   └── auth.test.js   # Authentication middleware
    └── validation.test.js # Validation middleware
```

## Running Tests

### Prerequisites

1. **Test Database Setup**
   ```bash
   # Create test database
   createdb abune_aregawi_test
   
   # Or use Docker
   docker run --name test-db -e POSTGRES_DB=abune_aregawi_test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -p 5433:5432 -d postgres:13
   ```

2. **Environment Variables**
   Create a `.env.test` file in the backend directory:
   ```env
   NODE_ENV=test
   DATABASE_URL=postgresql://test:test@localhost:5432/abune_aregawi_test
   JWT_SECRET=test-jwt-secret
   FIREBASE_PROJECT_ID=test-project
   ```

### Test Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- auth.test.js

# Run tests in watch mode
npm test -- --watch

# Run integration tests only
npm test -- --testPathPattern=integration

# Run unit tests only
npm test -- --testPathPattern=unit
```

## Test Categories

### 1. Unit Tests
- **Authentication Middleware**: Tests JWT token validation, error handling
- **Validation Middleware**: Tests input validation and sanitization
- **Utility Functions**: Tests helper functions and utilities

### 2. Integration Tests
- **Health Endpoint**: Tests basic API functionality and server status
- **Authentication Flow**: Tests complete registration, login, and profile management
- **API Endpoints**: Tests all major API endpoints with real database operations

### 3. Database Tests
- **Model Operations**: Tests Sequelize models and relationships
- **Data Validation**: Tests database constraints and validations
- **Migration Tests**: Tests database schema changes

## Test Coverage

The test suite covers:

### ✅ Authentication & Authorization
- User registration with validation
- User login with credential verification
- JWT token generation and validation
- Password hashing and verification
- Role-based access control
- Firebase integration

### ✅ API Endpoints
- Health check endpoint
- Member registration endpoint
- Member login endpoint
- Profile management endpoints
- Error handling and status codes

### ✅ Data Validation
- Input sanitization
- Email format validation
- Password strength validation
- Phone number formatting
- Required field validation

### ✅ Error Handling
- Invalid credentials
- Missing required fields
- Database connection errors
- Network errors
- Firebase configuration errors

### ✅ Security
- JWT token security
- Password security
- Input sanitization
- SQL injection prevention
- Rate limiting

## Mocking Strategy

### External Services
- **Firebase Admin**: Mocked to avoid external dependencies
- **Email Service**: Mocked to prevent actual emails during testing
- **Database**: Uses test database with isolated data

### Internal Dependencies
- **Middleware**: Tested in isolation with mocked request/response objects
- **Controllers**: Tested with mocked database operations
- **Models**: Tested with real database operations in test environment

## Best Practices

### Test Data Management
- Each test creates its own test data
- Test data is cleaned up after each test
- No test depends on data from other tests

### Isolation
- Tests run in isolation
- Database is reset between test suites
- No shared state between tests

### Performance
- Tests use minimal database operations
- Mock external services to avoid network calls
- Use test-specific configuration

## Continuous Integration

The test suite is designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    cd backend
    npm install
    npm test -- --coverage --ci
```

## Debugging Tests

### Common Issues

1. **Database Connection**
   ```bash
   # Check if test database exists
   psql -l | grep abune_aregawi_test
   
   # Create if missing
   createdb abune_aregawi_test
   ```

2. **Environment Variables**
   ```bash
   # Check test environment
   echo $NODE_ENV
   
   # Set test environment
   export NODE_ENV=test
   ```

3. **Firebase Mocks**
   ```bash
   # Check if Firebase mocks are working
   npm test -- --verbose
   ```

### Debug Mode
```bash
# Run tests with debug output
DEBUG=* npm test

# Run specific test with debug
DEBUG=* npm test -- auth.test.js
```

## Adding New Tests

### Unit Test Template
```javascript
describe('Component Name', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    // Test implementation
  });
});
```

### Integration Test Template
```javascript
describe('API Endpoint', () => {
  it('should handle request correctly', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send(testData)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
  });
});
```

## Coverage Goals

- **Statements**: 90%+
- **Branches**: 85%+
- **Functions**: 90%+
- **Lines**: 90%+

Run coverage report:
```bash
npm test -- --coverage --watchAll=false
``` 