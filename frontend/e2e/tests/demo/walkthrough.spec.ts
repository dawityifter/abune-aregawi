/**
 * Human-paced visual walkthrough of the church application.
 *
 * Run with:
 *   npm run test:e2e:demo
 *
 * This is NOT a fast automated test — it deliberately pauses between steps
 * so you can follow along and record the screen.
 */
import { test, expect, type Page } from '@playwright/test';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Pause so the viewer can see what just happened */
const pause = (page: Page, ms = 2000) => page.waitForTimeout(ms);

/** Type one character at a time so input is visible */
async function humanType(page: Page, locator: ReturnType<Page['locator']>, text: string) {
  await locator.click();
  await locator.fill('');
  for (const ch of text) {
    await locator.pressSequentially(ch, { delay: 80 });
  }
}

/** Dismiss the FirstLoginModal that appears for new users */
async function dismissModal(page: Page) {
  const modal = page.getByRole('dialog');
  if (await modal.isVisible().catch(() => false)) {
    await modal.getByRole('button').last().click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
    await pause(page, 500);
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe.serial('Application Walkthrough', () => {

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  1. REGISTRATION — New member signs up step by step                     ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  test('1 · New Member Registration', async ({ page }) => {
    test.setTimeout(180_000);

    // -- Login as a new user (magic demo phone) --
    await page.goto('/login');
    await pause(page, 1500);

    const phoneInput = page.getByPlaceholder('(555) 123-4567');
    await humanType(page, phoneInput, '4699078230');
    await pause(page, 1500);

    // Wait for Send OTP to become active
    await page.waitForFunction(() => {
      for (const b of document.querySelectorAll('button'))
        if (b.textContent?.includes('Send OTP') && !b.disabled) return true;
      return false;
    }, { timeout: 15000 });
    await page.getByRole('button', { name: /Send OTP/i }).click();
    await pause(page, 1500);

    // Enter OTP
    await page.getByPlaceholder('Enter OTP').fill('123456');
    await pause(page, 1000);
    await page.getByRole('button', { name: /Verify OTP/i }).click();

    // Wait for redirect to /register
    await page.waitForURL('**/register', { timeout: 30000 });
    await pause(page, 1500);

    // Dismiss first-login modal
    await dismissModal(page);
    await pause(page, 1000);

    // ── Step 1: Personal Information ──
    await expect(page.getByText('Member Registration')).toBeVisible();
    await pause(page, 1000);

    await humanType(page, page.getByPlaceholder('Enter First Name'), 'Abebe');
    await pause(page, 500);
    await humanType(page, page.getByPlaceholder('Enter Middle Name'), 'Kebede');
    await pause(page, 500);
    await humanType(page, page.getByPlaceholder('Enter Last Name'), 'Tessema');
    await pause(page, 1500);

    await page.getByRole('button', { name: /next/i }).click();
    await pause(page, 2000);

    // ── Step 2: Contact & Address ──
    await page.getByRole('heading', { name: /contact/i }).first().waitFor({ state: 'visible' });

    await humanType(page, page.getByPlaceholder('Address Line1 Placeholder'), '1234 Main Street');
    await pause(page, 500);
    await humanType(page, page.getByPlaceholder('City Placeholder'), 'Dallas');
    await pause(page, 500);
    await humanType(page, page.getByPlaceholder('Postal Code Placeholder'), '75201');
    await pause(page, 1500);

    await page.getByRole('button', { name: /next/i }).click();
    await pause(page, 2000);

    // ── Step 3: Family Information ──
    await page.getByRole('heading', { name: /family/i }).first().waitFor({ state: 'visible' });

    const emergencyName = page.locator('label:has-text("Emergency Contact Name") + input, label:has-text("Emergency Contact Name") ~ input').first();
    const emergencyPhone = page.locator('label:has-text("Emergency Contact Phone") + input, label:has-text("Emergency Contact Phone") ~ input').first();
    await humanType(page, emergencyName, 'Kidane Mariam');
    await pause(page, 500);
    await humanType(page, emergencyPhone, '2145551234');
    await pause(page, 1500);

    await page.getByRole('button', { name: /next/i }).click();
    await pause(page, 2000);

    // ── Step 4: Spiritual Information (all optional) ──
    await page.getByRole('heading', { name: /spiritual/i }).first().waitFor({ state: 'visible' });
    await pause(page, 1500);

    await page.getByRole('button', { name: /next/i }).click();
    await pause(page, 2000);

    // ── Step 5: Contribution & Giving ──
    await page.getByRole('heading', { name: /contribution/i }).first().waitFor({ state: 'visible' });
    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
    await pause(page, 3000);

    // Don't actually submit — just show that we reached the final step
  });

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  2. LOGIN — Existing member signs in                                    ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  test('2 · Existing Member Login', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/login');
    await pause(page, 1500);

    const phoneInput = page.getByPlaceholder('(555) 123-4567');
    await humanType(page, phoneInput, '4699078229');
    await pause(page, 1500);

    await page.waitForFunction(() => {
      for (const b of document.querySelectorAll('button'))
        if (b.textContent?.includes('Send OTP') && !b.disabled) return true;
      return false;
    }, { timeout: 15000 });
    await page.getByRole('button', { name: /Send OTP/i }).click();
    await pause(page, 1500);

    await page.getByPlaceholder('Enter OTP').fill('123456');
    await pause(page, 1000);
    await page.getByRole('button', { name: /Verify OTP/i }).click();

    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await pause(page, 3000);

    // Verify dashboard loaded
    expect(page.url()).toContain('/dashboard');
  });

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  3. PROFILE — View and edit profile                                     ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  test('3 · View & Edit Profile', async ({ page }) => {
    test.setTimeout(120_000);

    // Login first
    await page.goto('/login');
    const phoneInput = page.getByPlaceholder('(555) 123-4567');
    await phoneInput.fill('4699078229');
    await page.waitForFunction(() => {
      for (const b of document.querySelectorAll('button'))
        if (b.textContent?.includes('Send OTP') && !b.disabled) return true;
      return false;
    }, { timeout: 15000 });
    await page.getByRole('button', { name: /Send OTP/i }).click();
    await page.getByPlaceholder('Enter OTP').waitFor({ state: 'visible' });
    await page.getByPlaceholder('Enter OTP').fill('123456');
    await page.getByRole('button', { name: /Verify OTP/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });

    // Navigate to profile
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await pause(page, 2000);

    // Scroll through profile information
    await expect(page.getByText(/first name/i).first()).toBeVisible();
    await pause(page, 1500);

    // Scroll down to see more fields
    await page.evaluate(() => window.scrollBy(0, 300));
    await pause(page, 1500);
    await page.evaluate(() => window.scrollBy(0, 300));
    await pause(page, 1500);

    // Scroll back up and click Edit
    await page.evaluate(() => window.scrollTo(0, 0));
    await pause(page, 1000);

    const editButton = page.getByRole('button', { name: /edit/i });
    await editButton.click();
    await pause(page, 2000);

    // Show that Save and Cancel are now available
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await pause(page, 2000);

    // Cancel editing
    await page.getByRole('button', { name: /cancel/i }).click();
    await pause(page, 2000);
  });

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  4. DUES — View membership dues                                         ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  test('4 · View Membership Dues', async ({ page }) => {
    test.setTimeout(120_000);

    // Login first
    await page.goto('/login');
    await page.getByPlaceholder('(555) 123-4567').fill('4699078229');
    await page.waitForFunction(() => {
      for (const b of document.querySelectorAll('button'))
        if (b.textContent?.includes('Send OTP') && !b.disabled) return true;
      return false;
    }, { timeout: 15000 });
    await page.getByRole('button', { name: /Send OTP/i }).click();
    await page.getByPlaceholder('Enter OTP').waitFor({ state: 'visible' });
    await page.getByPlaceholder('Enter OTP').fill('123456');
    await page.getByRole('button', { name: /Verify OTP/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });

    // Navigate to dues
    await page.goto('/dues');
    await page.waitForLoadState('domcontentloaded');
    await pause(page, 2000);

    // Scroll through the dues page
    await page.evaluate(() => window.scrollBy(0, 400));
    await pause(page, 2000);
    await page.evaluate(() => window.scrollBy(0, 400));
    await pause(page, 2000);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await pause(page, 2000);
  });

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  5. DONATION — Fill form, enter card, pay, see confirmation             ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  test('5 · Make a Donation via Stripe', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/donate');
    await page.waitForLoadState('domcontentloaded');
    await pause(page, 2000);

    // Verify page heading
    await expect(page.getByText('Support Our Church')).toBeVisible();
    await expect(page.getByText('Online Donation')).toBeVisible();
    await pause(page, 1500);

    // ── Select One-Time donation ──
    await expect(page.getByLabel('One-Time')).toBeChecked();
    await pause(page, 1000);

    // ── Enter donation amount ──
    const amountInput = page.getByPlaceholder('0.00');
    await humanType(page, amountInput, '25');
    await pause(page, 1500);

    // ── Fill card details in Stripe iframe ──
    // Wait for Stripe to load its iframe
    const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first();

    // The CardElement has combined card number, expiry, cvc inputs
    const cardInput = stripeFrame.locator('[name="cardnumber"], [placeholder="Card number"]').first();
    await cardInput.waitFor({ state: 'visible', timeout: 15000 });

    // Type card number slowly
    await cardInput.click();
    await cardInput.pressSequentially('4242424242424242', { delay: 100 });
    await pause(page, 1000);

    // Expiry date
    const expiryInput = stripeFrame.locator('[name="exp-date"], [placeholder="MM / YY"]').first();
    await expiryInput.pressSequentially('1228', { delay: 100 });
    await pause(page, 800);

    // CVC
    const cvcInput = stripeFrame.locator('[name="cvc"], [placeholder="CVC"]').first();
    await cvcInput.pressSequentially('123', { delay: 100 });
    await pause(page, 1500);

    // Scroll down to see donor info & button
    await page.evaluate(() => window.scrollBy(0, 300));
    await pause(page, 1000);

    // ── Fill donor information ──
    const firstNameInput = page.locator('text=First Name *').locator('..').locator('input');
    const lastNameInput = page.locator('text=Last Name *').locator('..').locator('input');

    await firstNameInput.fill('');
    await humanType(page, firstNameInput, 'Abebe');
    await pause(page, 500);
    await lastNameInput.fill('');
    await humanType(page, lastNameInput, 'Tessema');
    await pause(page, 1500);

    // Scroll to the submit button
    await page.evaluate(() => window.scrollBy(0, 300));
    await pause(page, 1000);

    // ── Click "Continue to Payment" ──
    const submitButton = page.getByRole('button', { name: /Continue to Payment/i });
    await expect(submitButton).toBeVisible();
    await pause(page, 1500);

    // Set up dialog handler BEFORE clicking (alert fires after Stripe processes)
    page.on('dialog', async (dialog) => {
      // Let the success alert stay visible for a moment, then dismiss
      await page.waitForTimeout(3000);
      await dialog.accept();
    });

    await submitButton.click();
    await pause(page, 2000);

    // Wait for Stripe to process — button shows "Processing..."
    // Then the backend confirms and an alert + green banner appears
    await page.waitForTimeout(15000);

    // Check for success banner
    const successVisible = await page.getByText(/payment successful|thank you/i).isVisible().catch(() => false);
    if (successVisible) {
      await pause(page, 3000);
    }

    // Scroll to see the Zelle section too
    await page.evaluate(() => window.scrollBy(0, 500));
    await pause(page, 2000);
    await expect(page.getByRole('heading', { name: 'Donate via Zelle', exact: true })).toBeVisible();
    await pause(page, 3000);
  });

});
