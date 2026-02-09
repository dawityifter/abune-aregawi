import { type Page, type Locator } from '@playwright/test';

export class DonatePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly onlineDonationHeading: Locator;
  readonly amountInput: Locator;
  readonly oneTimeRadio: Locator;
  readonly recurringRadio: Locator;
  readonly zelleHeading: Locator;
  readonly zelleEmail: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByText('Support Our Church');
    this.onlineDonationHeading = page.getByText('Online Donation');
    this.amountInput = page.getByPlaceholder('0.00');
    // Radio inputs wrapped in <label><input/>Text</label> - use label text to locate
    this.oneTimeRadio = page.getByLabel('One-Time');
    this.recurringRadio = page.getByLabel('Recurring');
    // Zelle section - use the h3 heading specifically
    this.zelleHeading = page.getByRole('heading', { name: 'Donate via Zelle', exact: true });
    this.zelleEmail = page.getByText('abunearegawitx@gmail.com').first();
  }

  async goto() {
    await this.page.goto('/donate');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Get the donor info input by label text.
   * The labels have format "First Name *" / "Last Name *" with no for/id association,
   * so we locate the label text then find the input sibling.
   */
  getDonorInput(labelText: string): Locator {
    // Find the container div that holds both label and input
    return this.page.locator(`label:has-text("${labelText}") + input, label:has-text("${labelText}") ~ input`).first();
  }
}
