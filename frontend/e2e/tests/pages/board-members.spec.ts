import { test, expect } from '@playwright/test';

test.describe('Board Members Page', () => {
  test('board members page loads without error', async ({ page }) => {
    await page.goto('/board-members');
    await page.waitForLoadState('domcontentloaded');
    // Wait for some content to render
    await page.locator('body').waitFor({ state: 'visible' });

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
