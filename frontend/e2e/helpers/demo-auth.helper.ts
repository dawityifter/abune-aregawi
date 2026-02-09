import { type Page } from '@playwright/test';

export const DEMO_ADMIN_PHONE = '4699078229';
export const DEMO_NEW_PHONE = '4699078230';
export const DEMO_OTP = '123456';

export async function loginAsExistingUser(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('(555) 123-4567').fill(DEMO_ADMIN_PHONE);

  const sendOtpButton = page.getByRole('button', { name: /Send OTP/i });
  await sendOtpButton.waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => {
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        if (b.textContent?.includes('Send OTP') && !b.disabled) return true;
      }
      return false;
    },
    { timeout: 15000 }
  );
  await sendOtpButton.click();

  await page.getByPlaceholder('Enter OTP').waitFor({ state: 'visible' });
  await page.getByPlaceholder('Enter OTP').fill(DEMO_OTP);
  await page.getByRole('button', { name: /Verify OTP/i }).click();

  await page.waitForURL('**/dashboard', { timeout: 30000 });
}

export async function loginAsNewUser(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('(555) 123-4567').fill(DEMO_NEW_PHONE);

  const sendOtpButton = page.getByRole('button', { name: /Send OTP/i });
  await sendOtpButton.waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => {
      const buttons = document.querySelectorAll('button');
      for (const b of buttons) {
        if (b.textContent?.includes('Send OTP') && !b.disabled) return true;
      }
      return false;
    },
    { timeout: 15000 }
  );
  await sendOtpButton.click();

  await page.getByPlaceholder('Enter OTP').waitFor({ state: 'visible' });
  await page.getByPlaceholder('Enter OTP').fill(DEMO_OTP);
  await page.getByRole('button', { name: /Verify OTP/i }).click();

  await page.waitForURL('**/register', { timeout: 30000 });
}
