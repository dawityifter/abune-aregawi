import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../page-objects/dashboard.page';

test.describe('Dashboard', () => {
  test('dashboard loads and displays content', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForLoad();

    // Verify the page is on dashboard
    expect(page.url()).toContain('/dashboard');
    // Verify some content is rendered (cards, links, etc.)
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('navigate to profile from dashboard', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForLoad();

    await dashboard.profileButton.click();
    await page.waitForURL('**/profile', { timeout: 10000 });
    expect(page.url()).toContain('/profile');
  });
});
