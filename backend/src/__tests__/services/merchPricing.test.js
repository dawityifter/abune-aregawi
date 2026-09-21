'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const {
  buildOrderDraft,
  MerchValidationError
} = require('../../services/merchPricingService');
const {
  OCTOBER_5K_EVENT_KEY, SHIRT_PRICE_CENTS, getEvent, findProduct, findSize, sizeNames
} = require('../../config/merchCatalog');

// The catalog is the only place a price lives, so expected totals are derived
// from it rather than restated. A price change should not break these.
const EVENT = getEvent(OCTOBER_5K_EVENT_KEY);
const YOUTH = findProduct(EVENT, 'youth_heavy_cotton');
const ADULT = findProduct(EVENT, 'adult_heavy_cotton');

const priceOf = (product, size) => findSize(product, size).unit_amount;
const line = (product, size, quantity) => ({ product_key: product.product_key, size, quantity });
const draftOf = (...items) => buildOrderDraft({ eventKey: OCTOBER_5K_EVENT_KEY, items });

describe('buildOrderDraft — validation', () => {
  it('rejects an order with no items', () => {
    expect(() => buildOrderDraft({ eventKey: OCTOBER_5K_EVENT_KEY, items: [] }))
      .toThrow(MerchValidationError);
  });

  it('rejects a size no product carries', () => {
    expect(() => draftOf(line(ADULT, 'XXXXL', 1))).toThrow(/size/i);
  });

  // The adult cut is not stocked in a medium. A youth medium exists, so this is
  // not a size that is simply absent from the event — it is absent from THIS
  // garment, and must not be quietly filled from the other one's run.
  it('rejects a size this product does not carry even though the other does', () => {
    expect(sizeNames(YOUTH)).toContain('M');
    expect(() => draftOf(line(ADULT, 'M', 1))).toThrow(/size/i);
  });

  it('accepts that same size on the product that does carry it', () => {
    expect(() => draftOf(line(YOUTH, 'M', 1))).not.toThrow();
  });

  // Without a product a line is just a letter, and the two garments share
  // letters. Guessing would ship the wrong shirt at the right price.
  it('rejects an item with no product', () => {
    expect(() => draftOf({ size: 'S', quantity: 1 })).toThrow(/item/i);
  });

  it('rejects an unknown product', () => {
    expect(() => draftOf({ product_key: 'toddler_heavy_cotton', size: 'S', quantity: 1 }))
      .toThrow(/item/i);
  });

  it('rejects a quantity below one', () => {
    expect(() => draftOf(line(ADULT, 'S', 0))).toThrow(/quantity/i);
  });

  it('rejects a non-integer quantity', () => {
    expect(() => draftOf(line(ADULT, 'S', 1.5))).toThrow(/quantity/i);
  });

  it('rejects a quantity above the per-size maximum', () => {
    expect(() => draftOf(line(ADULT, 'S', ADULT.max_quantity_per_size + 1)))
      .toThrow(/quantity/i);
  });

  it('rejects an unknown event key', () => {
    expect(() => buildOrderDraft({ eventKey: 'some_other_event', items: [line(ADULT, 'S', 1)] }))
      .toThrow(/event/i);
  });

  it('rejects the same product and size listed twice, which would double-charge silently', () => {
    expect(() => draftOf(line(ADULT, 'S', 1), line(ADULT, 'S', 2))).toThrow(/duplicate/i);
  });

  // The duplicate check is keyed on product AND size. A family buying a small
  // for a child and a small for a parent is two lines, not a mistake.
  it('allows the same size on two different products', () => {
    const draft = draftOf(line(YOUTH, 'S', 1), line(ADULT, 'S', 1));
    expect(draft.lineItems).toHaveLength(2);
  });
});

describe('buildOrderDraft — pricing', () => {
  it('prices each line from its own product and size', () => {
    const draft = draftOf(line(YOUTH, 'S', 2));

    expect(draft.lineItems).toHaveLength(1);
    expect(draft.lineItems[0]).toMatchObject({
      product_key: YOUTH.product_key,
      product_name: YOUTH.product_name,
      size: 'S',
      quantity: 2,
      unit_amount: priceOf(YOUTH, 'S'),
      total_amount: priceOf(YOUTH, 'S') * 2
    });
    expect(draft.subtotalCents).toBe(priceOf(YOUTH, 'S') * 2);
  });

  /**
   * Every line is priced from its own size entry rather than from the first
   * line's price or any product-level default.
   *
   * This used to assert two sizes cost DIFFERENT amounts, which no longer
   * holds: every shirt is $30. The invariant is the one that mattered though —
   * the price comes from the line's own entry — and it is asserted here against
   * the catalog rather than against a hardcoded number, so it keeps its teeth
   * if the sizes ever diverge again.
   */
  it('takes every unit price from the line it belongs to', () => {
    const draft = draftOf(line(YOUTH, 'M', 1), line(ADULT, 'L', 1));

    expect(draft.lineItems.map((l) => l.unit_amount))
      .toEqual([priceOf(YOUTH, 'M'), priceOf(ADULT, 'L')]);
    expect(draft.subtotalCents).toBe(priceOf(YOUTH, 'M') + priceOf(ADULT, 'L'));
  });

  it('applies quantity to each line at its own price', () => {
    const draft = draftOf(line(YOUTH, 'S', 3), line(ADULT, 'L', 2));

    expect(draft.subtotalCents)
      .toBe(priceOf(YOUTH, 'S') * 3 + priceOf(ADULT, 'L') * 2);
  });

  it('carries the event, so the order header takes its currency from one place', () => {
    expect(draftOf(line(ADULT, 'S', 1)).event.event_key).toBe(OCTOBER_5K_EVENT_KEY);
  });

  // The price is the whole reason this runs server-side.
  it('ignores a client-supplied price', () => {
    const draft = draftOf({ ...line(ADULT, 'S', 1), unit_amount: 1 });

    expect(draft.lineItems[0].unit_amount).toBe(priceOf(ADULT, 'S'));
    expect(draft.subtotalCents).toBe(priceOf(ADULT, 'S'));
  });
});

describe('the October 5K catalog', () => {
  // Pinned deliberately: these are the shirts and prices the parish advertised,
  // and a silent edit to them is a silent change to what people are charged.
  it('sells a youth shirt in S, M and L', () => {
    expect(YOUTH.product_name).toBe('Youth Heavy Cotton™ T-Shirt');
    expect(sizeNames(YOUTH)).toEqual(['S', 'M', 'L']);
  });

  it('sells an adult shirt in S and L only', () => {
    expect(ADULT.product_name).toBe('Heavy Cotton™ T-Shirt');
    expect(sizeNames(ADULT)).toEqual(['S', 'L']);
  });

  it('charges $30 for every shirt in every size', () => {
    expect(SHIRT_PRICE_CENTS).toBe(3000);
    for (const product of EVENT.products) {
      for (const { unit_amount: unitAmount } of product.sizes) {
        expect(unitAmount).toBe(3000);
      }
    }
  });

  it('does not expose a product-wide unit price', () => {
    // A leftover product.unit_amount is exactly what a caller would reach for
    // by habit. It looks harmless precisely now, while every size costs the
    // same, and would misprice the first size that ever differs.
    for (const product of EVENT.products) {
      expect(product.unit_amount).toBeUndefined();
    }
  });
});
