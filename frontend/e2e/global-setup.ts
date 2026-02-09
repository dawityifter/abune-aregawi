import { chromium, type FullConfig } from '@playwright/test';
import path from 'path';

const STORAGE_STATE_PATH = path.join(__dirname, 'auth-state', 'existing-user.json');

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to login
  await page.goto(`${baseURL}/login`);

  // Fill the phone number
  await page.getByPlaceholder('(555) 123-4567').fill('4699078229');

  // Wait for Send OTP button to be enabled (reCAPTCHA auto-solves in demo mode)
  const sendOtpButton = page.getByRole('button', { name: /Send OTP/i });
  await sendOtpButton.waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button');
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        if (b.textContent?.includes('Send OTP') && !b.disabled) return true;
      }
      return false;
    },
    { timeout: 15000 }
  );
  await sendOtpButton.click();

  // Fill OTP
  await page.getByPlaceholder('Enter OTP').waitFor({ state: 'visible' });
  await page.getByPlaceholder('Enter OTP').fill('123456');

  // Click Verify OTP
  await page.getByRole('button', { name: /Verify OTP/i }).click();

  // Wait for navigation to dashboard (handles window.location.reload() transparently)
  await page.waitForURL('**/dashboard', { timeout: 30000 });

  // Save the storage state for reuse by authenticated test projects
  await context.storageState({ path: STORAGE_STATE_PATH });

  await browser.close();
}

export default globalSetup;
