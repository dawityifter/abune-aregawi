module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/src/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/database/**',
    '!tests/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  // This suite is NOT parallel-safe. Run in parallel it fails
  // nondeterministically — a different file each run, with error modes that
  // don't match the test's subject (a survey submission returning Express's
  // 404 because the request never reached a route that is mounted
  // unconditionally). Every one of those files passes on its own, and the
  // whole suite is green serially across repeated runs.
  //
  // Ruled out as the cause: port binding (server.js guards app.listen behind
  // `require.main === module`), a file-backed DB (tests force
  // sqlite::memory:), swallowed route-registration errors (routes mount
  // unconditionally at module scope), and the DONATION_RATE_LIMIT_MAX leak
  // from donationRateLimit.test.js into shared process.env (real, but not
  // sufficient — forcing that order still passes). The actual shared resource
  // is still unidentified.
  //
  // Serialising costs nothing: ~30s serial against 28-33s parallel, because
  // the suite is dominated by per-file setup rather than by test execution.
  // The failures also disable the pre-commit member-PII guard in practice,
  // since a red suite makes --no-verify the only way to commit.
  //
  // Do NOT raise this without first finding and fixing the shared state.
  maxWorkers: 1,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
}; 