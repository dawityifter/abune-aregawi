import { type Page, type Locator } from '@playwright/test';

export class NavigationPage {
  readonly page: Page;
  readonly signOutButton: Locator;
  readonly dashboardLink: Locator;
  readonly hamburgerMenu: Locator;

  constructor(page: Page) {
    this.page = page;
    this.signOutButton = page.getByRole('button', { name: /sign out|logout/i });
    this.dashboardLink = page.getByRole('link', { name: /dashboard/i }).first();
    this.hamburgerMenu = page.getByRole('button', { name: /menu|toggle/i }).first();
  }
}
