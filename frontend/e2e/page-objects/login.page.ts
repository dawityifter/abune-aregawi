import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly phoneInput: Locator;
  readonly sendOtpButton: Locator;
  readonly otpInput: Locator;
  readonly verifyOtpButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.phoneInput = page.getByPlaceholder('(555) 123-4567');
    this.sendOtpButton = page.getByRole('button', { name: /Send OTP/i });
    this.otpInput = page.getByPlaceholder('Enter OTP');
    this.verifyOtpButton = page.getByRole('button', { name: /Verify OTP/i });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async loginAsDemoUser(phone: string, expectedUrl: string) {
    await this.goto();
    await this.phoneInput.fill(phone);

    await this.sendOtpButton.waitFor({ state: 'visible' });
    await this.page.waitForFunction(
      () => {
        const buttons = document.querySelectorAll('button');
        for (const b of buttons) {
          if (b.textContent?.includes('Send OTP') && !b.disabled) return true;
        }
        return false;
      },
      { timeout: 15000 }
    );
    await this.sendOtpButton.click();

    await this.otpInput.waitFor({ state: 'visible' });
    await this.otpInput.fill('123456');
    await this.verifyOtpButton.click();

    await this.page.waitForURL(expectedUrl, { timeout: 30000 });
  }
}
