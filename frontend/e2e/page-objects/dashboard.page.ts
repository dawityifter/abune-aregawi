import { type Page, type Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly profileButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // The profile card uses a <button> with i18n text "Dashboard Profile View"
    this.profileButton = page.getByRole('button', { name: /profile/i }).first();
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async waitForLoad() {
    // Wait for dashboard content to render
    await this.page.waitForLoadState('domcontentloaded');
    // Wait a bit for React to hydrate and cards to render
    await this.page.locator('main, [class*="dashboard"], [class*="Dashboard"], .bg-white').first().waitFor({ state: 'visible', timeout: 15000 });
  }
}
