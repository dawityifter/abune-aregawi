import { test, expect } from '@playwright/test';

test.describe('Dependents', () => {
  test('dependents page loads without error', async ({ page }) => {
    await page.goto('/dependents');
    await page.waitForLoadState('networkidle');

    // Page should render without crashing
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    // Should not show an error page
    await expect(page.getByText(/error|crash|something went wrong/i)).not.toBeVisible();
  });
});
