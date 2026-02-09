import { test, expect } from '@playwright/test';
import { ProfilePage } from '../../page-objects/profile.page';

test.describe('Profile', () => {
  test('profile page displays user information labels', async ({ page }) => {
    const profile = new ProfilePage(page);
    await profile.goto();

    // Check that common profile labels are visible (i18n fallback: "First Name", etc.)
    await expect(page.getByText(/first name/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/last name/i).first()).toBeVisible();
    await expect(page.getByText(/phone/i).first()).toBeVisible();
    await expect(page.getByText(/email/i).first()).toBeVisible();
  });

  test('edit mode toggle shows save/cancel and reverts on cancel', async ({ page }) => {
    const profile = new ProfilePage(page);
    await profile.goto();

    // Wait for Edit button and click it
    await expect(profile.editButton).toBeVisible({ timeout: 10000 });
    await profile.editButton.click();

    // Save and Cancel buttons should appear
    await expect(profile.saveButton).toBeVisible();
    await expect(profile.cancelButton).toBeVisible();

    // Click Cancel to go back to view mode
    await profile.cancelButton.click();

    // Edit button should reappear
    await expect(profile.editButton).toBeVisible();
  });
});
