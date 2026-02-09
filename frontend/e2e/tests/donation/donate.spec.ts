import { test, expect } from '@playwright/test';
import { DonatePage } from '../../page-objects/donate.page';

test.describe('Donation Page', () => {
  test('donation form displays with correct headings and one-time selected by default', async ({ page }) => {
    const donate = new DonatePage(page);
    await donate.goto();

    await expect(donate.heading).toBeVisible();
    await expect(donate.onlineDonationHeading).toBeVisible();
    await expect(donate.oneTimeRadio).toBeChecked();
  });

  test('selecting recurring shows frequency dropdown with monthly option', async ({ page }) => {
    const donate = new DonatePage(page);
    await donate.goto();

    await donate.recurringRadio.click();
    await expect(donate.recurringRadio).toBeChecked();

    // Frequency select should appear with monthly option
    const frequencySelect = page.getByRole('combobox').first();
    await expect(frequencySelect).toBeVisible();
    // The select should contain "monthly" as default value
    await expect(frequencySelect).toHaveValue('monthly');
  });

  test('zelle section displays with church email', async ({ page }) => {
    const donate = new DonatePage(page);
    await donate.goto();

    await expect(donate.zelleHeading).toBeVisible();
    await expect(donate.zelleEmail).toBeVisible();
  });

  test('donor info fields accept input and amount can be set', async ({ page }) => {
    const donate = new DonatePage(page);
    await donate.goto();

    // Fill amount
    await donate.amountInput.fill('25.00');
    await expect(donate.amountInput).toHaveValue('25.00');

    // Fill donor info using the label-based locator
    // The input is inside a <div> that follows the <label>
    const firstNameInput = page.locator('text=First Name *').locator('..').locator('input');
    const lastNameInput = page.locator('text=Last Name *').locator('..').locator('input');

    await firstNameInput.fill('John');
    await expect(firstNameInput).toHaveValue('John');

    await lastNameInput.fill('Doe');
    await expect(lastNameInput).toHaveValue('Doe');
  });
});
