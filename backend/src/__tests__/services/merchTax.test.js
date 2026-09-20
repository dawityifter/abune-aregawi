'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { getTaxConfig, computeTaxCents, DEFAULT_TAX_RATE_BPS } = require('../../config/merchTax');

// The module reads process.env on every call precisely so the deployment can be
// re-pointed without a code change; these tests rely on that.
const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env.MERCH_TAX_MODE = ORIGINAL.MERCH_TAX_MODE;
  process.env.MERCH_TAX_RATE_BPS = ORIGINAL.MERCH_TAX_RATE_BPS;
  delete process.env.MERCH_TAX_MODE;
  delete process.env.MERCH_TAX_RATE_BPS;
});

describe('merch tax configuration', () => {
  // Texas merchandise sales by a nonprofit are not automatically exempt, so the
  // out-of-the-box behaviour must CHARGE tax. A default of "none" would quietly
  // under-collect on every order until someone noticed.
  it('defaults to charging tax rather than assuming exemption', () => {
    delete process.env.MERCH_TAX_MODE;
    delete process.env.MERCH_TAX_RATE_BPS;

    const config = getTaxConfig();

    expect(config.mode).toBe('manual');
    expect(config.rateBps).toBe(DEFAULT_TAX_RATE_BPS);
    expect(config.rateBps).toBeGreaterThan(0);
  });

  it('reads an explicit manual rate', () => {
    process.env.MERCH_TAX_MODE = 'manual';
    process.env.MERCH_TAX_RATE_BPS = '600';

    expect(getTaxConfig()).toMatchObject({ mode: 'manual', rateBps: 600 });
  });

  it('recognises automatic mode, where Stripe Tax computes the amount', () => {
    process.env.MERCH_TAX_MODE = 'automatic';

    expect(getTaxConfig().mode).toBe('automatic');
  });

  it('recognises none, the explicit exemption switch', () => {
    process.env.MERCH_TAX_MODE = 'none';

    expect(getTaxConfig().mode).toBe('none');
  });

  // A typo in the env var must not become a silent tax holiday.
  it('falls back to manual when the mode is not recognised', () => {
    process.env.MERCH_TAX_MODE = 'atuomatic';

    expect(getTaxConfig().mode).toBe('manual');
  });

  it('rejects a nonsensical rate loudly instead of charging nothing', () => {
    process.env.MERCH_TAX_MODE = 'manual';
    process.env.MERCH_TAX_RATE_BPS = '-5';

    expect(() => getTaxConfig()).toThrow(/MERCH_TAX_RATE_BPS/);
  });
});

describe('computeTaxCents', () => {
  it('applies the manual rate to the subtotal', () => {
    process.env.MERCH_TAX_MODE = 'manual';
    process.env.MERCH_TAX_RATE_BPS = '825';

    // $50.00 at 8.25% = $4.125 -> rounds to $4.13
    expect(computeTaxCents(5000)).toBe(413);
  });

  it('rounds to whole cents', () => {
    process.env.MERCH_TAX_MODE = 'manual';
    process.env.MERCH_TAX_RATE_BPS = '825';

    // $25.00 at 8.25% = $2.0625 -> rounds to $2.06
    expect(computeTaxCents(2500)).toBe(206);
  });

  // Stripe Tax owns the number in automatic mode; computing our own here would
  // double-charge, because the tax arrives as its own Checkout line.
  it('returns zero in automatic mode, leaving the amount to Stripe', () => {
    process.env.MERCH_TAX_MODE = 'automatic';

    expect(computeTaxCents(5000)).toBe(0);
  });

  it('returns zero when tax is explicitly switched off', () => {
    process.env.MERCH_TAX_MODE = 'none';

    expect(computeTaxCents(5000)).toBe(0);
  });
});
