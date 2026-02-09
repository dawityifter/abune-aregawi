import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  outputDir: 'test-results',
  globalSetup: './global-setup.ts',

  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    // SLOW_MO env var adds delay between actions (ms) for visual debugging
    launchOptions: {
      slowMo: parseInt(process.env.SLOW_MO || '0', 10),
    },
    ...devices['Desktop Chrome'],
  },

  projects: [
    {
      name: 'auth-tests',
      testMatch: /tests\/auth\/.*/,
    },
    {
      name: 'authenticated',
      testMatch: /tests\/(dashboard|profile|dependents|pages)\/.*/,
      dependencies: ['auth-tests'],
      use: {
        storageState: path.join(__dirname, 'auth-state', 'existing-user.json'),
      },
    },
    {
      name: 'public',
      testMatch: /tests\/donation\/.*/,
    },
    {
      name: 'demo',
      testMatch: /tests\/demo\/.*/,
      use: {
        headless: false,
        viewport: { width: 1280, height: 800 },
        video: 'on',
      },
      retries: 0,
    },
  ],

  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    cwd: path.join(__dirname, '..'),
    env: {
      REACT_APP_ENABLE_DEMO_MODE: 'true',
    },
    timeout: 120_000,
  },
});
