import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects/login.page';
import { DEMO_ADMIN_PHONE } from '../../helpers/demo-auth.helper';

test.describe('Login Flow', () => {
  test('login with magic demo phone navigates to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginAsDemoUser(DEMO_ADMIN_PHONE, '**/dashboard');

    expect(page.url()).toContain('/dashboard');
  });

  test('phone input has correct placeholder and type', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(loginPage.phoneInput).toHaveAttribute('placeholder', '(555) 123-4567');
    await expect(loginPage.phoneInput).toHaveAttribute('type', 'tel');
  });

  test('phone number auto-formats on input', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.phoneInput.fill('4699078229');
    await expect(loginPage.phoneInput).toHaveValue('(469) 907-8229');
  });
});
