import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects/login.page';
import { RegistrationPage } from '../../page-objects/registration.page';
import { DEMO_NEW_PHONE } from '../../helpers/demo-auth.helper';

async function dismissFirstLoginModal(page: import('@playwright/test').Page) {
  // The FirstLoginModal appears for new/temp users on /register.
  // Click the OK/Continue button to dismiss it.
  const modal = page.getByRole('dialog');
  const isVisible = await modal.isVisible().catch(() => false);
  if (isVisible) {
    // Click the primary action button (Complete Registration / OK)
    const okButton = modal.getByRole('button').last();
    await okButton.click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });
  }
}

test.describe('Registration Flow', () => {
  test('new user login redirects to registration page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsDemoUser(DEMO_NEW_PHONE, '**/register');

    await dismissFirstLoginModal(page);

    const regPage = new RegistrationPage(page);
    await expect(regPage.heading).toBeVisible();
  });

  test('navigate through all 5 registration steps', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsDemoUser(DEMO_NEW_PHONE, '**/register');

    await dismissFirstLoginModal(page);

    const regPage = new RegistrationPage(page);
    await expect(regPage.heading).toBeVisible();

    // Step 1: Personal Info - fill required fields
    await regPage.fillStep1('TestFirst', 'TestLast');
    await regPage.nextButton.click();

    // Step 2: Contact & Address - fill required fields
    await regPage.waitForStep('Contact');
    await regPage.fillStep2('123 Test St', 'Dallas', '75001');
    await regPage.nextButton.click();

    // Step 3: Family Info - fill emergency contact
    await regPage.waitForStep('Family');
    await regPage.fillStep3('Emergency Person', '5551234567');
    await regPage.nextButton.click();

    // Step 4: Spiritual Info - all optional, just click Next
    await regPage.waitForStep('Spiritual');
    await regPage.nextButton.click();

    // Step 5: Contribution & Giving - verify Submit button appears
    await regPage.waitForStep('Contribution');
    await expect(regPage.submitButton).toBeVisible();
  });

  test('step 1 validation shows errors when required fields are empty', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsDemoUser(DEMO_NEW_PHONE, '**/register');

    await dismissFirstLoginModal(page);

    const regPage = new RegistrationPage(page);
    await expect(regPage.heading).toBeVisible();

    // Click Next without filling any fields
    await regPage.nextButton.click();

    // Validation errors should appear
    await expect(page.getByText(/first name.*required/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/last name.*required/i).first()).toBeVisible({ timeout: 5000 });
  });
});
