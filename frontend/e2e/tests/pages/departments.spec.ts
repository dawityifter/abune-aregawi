import { test, expect } from '@playwright/test';

test.describe('Departments Page', () => {
  test('departments page loads without error', async ({ page }) => {
    await page.goto('/departments');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
