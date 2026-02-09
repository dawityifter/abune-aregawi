import { type Page, type Locator } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;
  readonly editButton: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.editButton = page.getByRole('button', { name: /edit/i });
    this.saveButton = page.getByRole('button', { name: /save/i });
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
  }

  async goto() {
    await this.page.goto('/profile');
    await this.page.waitForLoadState('networkidle');
  }
}
