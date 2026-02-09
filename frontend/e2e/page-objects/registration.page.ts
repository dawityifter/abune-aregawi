import { type Page, type Locator } from '@playwright/test';

export class RegistrationPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nextButton: Locator;
  readonly previousButton: Locator;
  readonly submitButton: Locator;

  // Step 1: Personal Info
  readonly firstName: Locator;
  readonly lastName: Locator;

  // Step 2: Contact & Address
  readonly streetLine1: Locator;
  readonly city: Locator;
  readonly postalCode: Locator;

  // Step 3: Family Info
  readonly emergencyContactName: Locator;
  readonly emergencyContactPhone: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByText('Member Registration');
    this.nextButton = page.getByRole('button', { name: /next/i });
    this.previousButton = page.getByRole('button', { name: /previous/i });
    this.submitButton = page.getByRole('button', { name: /submit/i });

    // Step 1 - i18n fallback: t('enter.first.name') → "Enter First Name"
    this.firstName = page.getByPlaceholder('Enter First Name');
    this.lastName = page.getByPlaceholder('Enter Last Name');

    // Step 2 - i18n fallback: t('address.line1.placeholder') → "Address Line1 Placeholder"
    this.streetLine1 = page.getByPlaceholder('Address Line1 Placeholder');
    this.city = page.getByPlaceholder('City Placeholder');
    this.postalCode = page.getByPlaceholder('Postal Code Placeholder');

    // Step 3 - emergency contact fields (label and input are not associated via for/id)
    this.emergencyContactName = page.locator('label:has-text("Emergency Contact Name") + input, label:has-text("Emergency Contact Name") ~ input').first();
    this.emergencyContactPhone = page.locator('label:has-text("Emergency Contact Phone") + input, label:has-text("Emergency Contact Phone") ~ input').first();
  }

  async waitForStep(stepText: string) {
    // Use heading role to match the step title heading specifically (avoids matching stepper labels)
    await this.page.getByRole('heading', { name: new RegExp(stepText, 'i') }).first().waitFor({ state: 'visible', timeout: 10000 });
  }

  async fillStep1(first: string, last: string) {
    await this.firstName.fill(first);
    await this.lastName.fill(last);
  }

  async fillStep2(street: string, city: string, zip: string) {
    await this.streetLine1.fill(street);
    await this.city.fill(city);
    await this.postalCode.fill(zip);
  }

  async fillStep3(contactName: string, contactPhone: string) {
    await this.emergencyContactName.fill(contactName);
    await this.emergencyContactPhone.fill(contactPhone);
  }
}
