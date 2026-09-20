'use strict';

/**
 * Event merchandise catalog.
 *
 * This is the ONLY place a merchandise price lives. The checkout endpoint is
 * public, so the server prices every line from here and ignores whatever the
 * browser posts — otherwise anyone could buy a shirt for a penny by editing the
 * request body.
 *
 * Prices are in CENTS, to match Stripe's `unit_amount` and to keep the money
 * arithmetic in integers. Converting to dollars happens once, at the DB
 * boundary, where the columns are DECIMAL(10,2).
 *
 * PRICE IS PER SIZE, not per product. There is deliberately no product-level
 * `unit_amount`: sizes cost different amounts, and a product-wide default is
 * exactly the field a caller would reach for by habit and silently misprice
 * every larger shirt with.
 */

const OCTOBER_5K_EVENT_KEY = 'october_5k_fundraiser';

const CATALOG = Object.freeze({
  [OCTOBER_5K_EVENT_KEY]: Object.freeze({
    event_key: OCTOBER_5K_EVENT_KEY,
    product_name: '5K Fundraiser T-Shirt',
    description: 'Debre Tsehay Abune Aregawi 1st Annual 5K Run/Walk t-shirt.',
    currency: 'usd',
    // Order matters: the public picker and the admin size summary both render
    // in this order, so it reads as a size run rather than alphabetically.
    sizes: Object.freeze([
      Object.freeze({ size: 'S', unit_amount: 2500 }), // $25.00
      Object.freeze({ size: 'L', unit_amount: 3000 })  // $30.00
    ]),
    // A per-size ceiling, not a stock count: nothing here reserves inventory.
    // It exists so a typo (or a bot) cannot open a $50,000 checkout session.
    max_quantity_per_size: 20
  })
});

/**
 * @returns the product for an event key, or null when the key is unknown.
 */
function getEventProduct(eventKey) {
  return CATALOG[eventKey] || null;
}

/**
 * @returns the {size, unit_amount} entry, or null when the product does not
 * carry that size. Null is the only signal that a size is unavailable — there
 * is no fallback price to quietly charge instead.
 */
function findSize(product, size) {
  if (!product) return null;
  return product.sizes.find((entry) => entry.size === size) || null;
}

/** Size labels in catalog order. */
function sizeNames(product) {
  return product ? product.sizes.map((entry) => entry.size) : [];
}

module.exports = {
  OCTOBER_5K_EVENT_KEY,
  getEventProduct,
  findSize,
  sizeNames
};
