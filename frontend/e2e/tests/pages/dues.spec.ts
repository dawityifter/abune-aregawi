import { test, expect } from '@playwright/test';

test.describe('Dues Page', () => {
  test('dues page loads without error', async ({ page }) => {
    await page.goto('/dues');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
