'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const {
  buildOrderDraft,
  MerchValidationError
} = require('../../services/merchPricingService');
const {
  OCTOBER_5K_EVENT_KEY, getEventProduct, findSize, sizeNames
} = require('../../config/merchCatalog');

// The catalog is the only place a price lives, so expected totals are derived
// from it rather than restated. A price change should not break these.
const product = getEventProduct(OCTOBER_5K_EVENT_KEY);
const priceOf = (size) => findSize(product, size).unit_amount;
const [firstSize, secondSize] = sizeNames(product);

describe('buildOrderDraft — validation', () => {
  it('rejects an order with no items', () => {
    expect(() => buildOrderDraft({ eventKey: OCTOBER_5K_EVENT_KEY, items: [] }))
      .toThrow(MerchValidationError);
  });

  it('rejects a size the catalog does not carry', () => {
    expect(() => buildOrderDraft({
      eventKey: OCTOBER_5K_EVENT_KEY,
      items: [{ size: 'XXXXL', quantity: 1 }]
    })).toThrow(/size/i);
  });

  // The size run shrank to S and L. A medium is not a typo to be coerced — it
  // is a shirt the parish does not have.
  it('rejects a size that was dropped from the run', () => {
    expect(() => buildOrderDraft({
      eventKey: OCTOBER_5K_EVENT_KEY,
      items: [{ size: 'M', quantity: 1 }]
    })).toThrow(/size/i);
  });

  it('rejects a quantity below one', () => {
    expect(() => buildOrderDraft({
      eventKey: OCTOBER_5K_EVENT_KEY,
      items: [{ size: firstSize, quantity: 0 }]
    })).toThrow(/quantity/i);
  });

  it('rejects a non-integer quantity', () => {
    expect(() => buildOrderDraft({
      eventKey: OCTOBER_5K_EVENT_KEY,
      items: [{ size: firstSize, quantity: 1.5 }]
    })).toThrow(/quantity/i);
  });

  it('rejects a quantity above the per-size maximum', () => {
    expect(() => buildOrderDraft({
      eventKey: OCTOBER_5K_EVENT_KEY,
      items: [{ size: firstSize, quantity: product.max_quantity_per_size + 1 }]
    })).toThrow(/quantity/i);
  });

  it('rejects an unknown event key', () => {
    expect(() => buildOrderDraft({
      eventKey: 'some_other_event',
      items: [{ size: firstSize, quantity: 1 }]
    })).toThrow(/event/i);
  });

  it('rejects the same size listed twice, which would double-charge silently', () => {
    expect(() => buildOrderDraft({
      eventKey: OCTOBER_5K_EVENT_KEY,
      items: [{ size: firstSize, quantity: 1 }, { size: firstSize, quantity: 2 }]
    })).toThrow(/duplicate/i);
  });
});

describe('buildOrderDraft — pricing', () => {
  it('prices each line from its own size, not from a product-wide price', () => {
    const draft = buildOrderDraft({
      eventKey: OCTOBER_5K_EVENT_KEY,
      items: [{ size: firstSize, quantity: 2 }]
    });

    expect(draft.lineItems).toHaveLength(1);
    expect(draft.lineItems[0]).toMatchObject({
      product_name: product.product_name,
      size: firstSize,
      quantity: 2,
      unit_amount: priceOf(firstSize),
      total_amount: priceOf(firstSize) * 2
    });
    expect(draft.subtotalCents).toBe(priceOf(firstSize) * 2);
  });

  /**
   * The load-bearing test for per-size pricing. Sizes cost different amounts
   * (S $25, L $30), so a subtotal computed from any single unit price — the
   * first line's, or a product-level default — is wrong for every mixed order.
   */
  it('sums sizes that cost different amounts', () => {
    const draft = buildOrderDraft({
      eventKey: OCTOBER_5K_EVENT_KEY,
      items: [{ size: firstSize, quantity: 1 }, { size: secondSize, quantity: 1 }]
    });

    expect(priceOf(firstSize)).not.toBe(priceOf(secondSize));
    expect(draft.subtotalCents).toBe(priceOf(firstSize) + priceOf(secondSize));
    expect(draft.lineItems.map((l) => l.unit_amount))
      .toEqual([priceOf(firstSize), priceOf(secondSize)]);
  });

  it('applies quantity to each size at its own price', () => {
    const draft = buildOrderDraft({
      eventKey: OCTOBER_5K_EVENT_KEY,
      items: [{ size: firstSize, quantity: 3 }, { size: secondSize, quantity: 2 }]
    });

    expect(draft.subtotalCents).toBe(priceOf(firstSize) * 3 + priceOf(secondSize) * 2);
  });

  // The price is the whole reason this runs server-side.
  it('ignores a client-supplied price', () => {
    const draft = buildOrderDraft({
      eventKey: OCTOBER_5K_EVENT_KEY,
      items: [{ size: firstSize, quantity: 1, unit_amount: 1 }]
    });

    expect(draft.lineItems[0].unit_amount).toBe(priceOf(firstSize));
    expect(draft.subtotalCents).toBe(priceOf(firstSize));
  });
});

describe('the October 5K catalog', () => {
  // Pinned deliberately: these are the prices the parish advertised, and a
  // silent edit to them is a silent change to what people are charged.
  it('carries exactly the S and L sizes at $25 and $30', () => {
    expect(sizeNames(product)).toEqual(['S', 'L']);
    expect(findSize(product, 'S').unit_amount).toBe(2500);
    expect(findSize(product, 'L').unit_amount).toBe(3000);
  });

  it('does not expose a product-wide unit price', () => {
    // A leftover product.unit_amount is exactly what a caller would reach for
    // by habit, and it would quietly misprice every L.
    expect(product.unit_amount).toBeUndefined();
  });
});
