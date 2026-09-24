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
 * `unit_amount`: it is exactly the field a caller would reach for by habit, and
 * a product-wide default would silently misprice any size that later differs.
 * Every size currently costs the same, which is precisely when such a default
 * looks harmless and gets added.
 *
 * AN EVENT CARRIES SEVERAL PRODUCTS. Youth and adult shirts are different
 * garments that happen to share size letters, so a line is identified by
 * product AND size. Keying on size alone would let a youth S be ordered,
 * packed, or counted as an adult S.
 */

const OCTOBER_5K_EVENT_KEY = 'october_5k_fundraiser';

/** Every shirt, both cuts, every size. */
const SHIRT_PRICE_CENTS = 3000; // $30.00

const sizesAt = (price, ...names) =>
  Object.freeze(names.map((size) => Object.freeze({ size, unit_amount: price })));

const CATALOG = Object.freeze({
  [OCTOBER_5K_EVENT_KEY]: Object.freeze({
    event_key: OCTOBER_5K_EVENT_KEY,
    description: 'Debre Tsehay Abune Aregawi 1st Annual 5K Run/Walk t-shirt.',
    currency: 'usd',
    products: Object.freeze([
      Object.freeze({
        // A stable key, not the display name: the name carries a ™ and is the
        // sort of string that gets reworded, and an order line must not change
        // meaning because someone tidied the copy.
        product_key: 'youth_heavy_cotton',
        product_name: 'Youth Heavy Cotton™ T-Shirt',
        // Display only. Order lines, the ledger and Stripe keep the English name.
        product_name_ti: 'ናይ ቆልዑ ማልያ (Heavy Cotton™)',
        // Order matters: the public picker and the admin size summary both
        // render in this order, so it reads as a size run, not alphabetically.
        sizes: sizesAt(SHIRT_PRICE_CENTS, 'S', 'M', 'L'),
        // A per-ORDER ceiling, not a stock count — stock lives in the
        // merch_inventory table (see merchInventoryService). This exists so a
        // typo (or a bot) cannot open a $50,000 checkout session.
        max_quantity_per_size: 20
      }),
      Object.freeze({
        product_key: 'adult_heavy_cotton',
        product_name: 'Heavy Cotton™ T-Shirt',
        product_name_ti: 'ናይ ዓበይቲ ማልያ (Heavy Cotton™)',
        // Small and Large only. The adult cut is genuinely not stocked in a
        // medium, so there is no M here to order — this gap is the catalog
        // telling the truth, not an omission to be helpfully filled in.
        sizes: sizesAt(SHIRT_PRICE_CENTS, 'S', 'L'),
        max_quantity_per_size: 20
      })
    ])
  })
});

/**
 * @returns the event for a key, or null when the key is unknown.
 */
function getEvent(eventKey) {
  return CATALOG[eventKey] || null;
}

/**
 * @returns the product within an event, or null when that event does not carry
 * it. Null is the only signal that a product is unavailable — there is no
 * "first product" fallback to quietly sell instead.
 */
function findProduct(event, productKey) {
  if (!event) return null;
  return event.products.find((p) => p.product_key === productKey) || null;
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

/** Size labels for one product, in catalog order. */
function sizeNames(product) {
  return product ? product.sizes.map((entry) => entry.size) : [];
}

/** Product keys for an event, in catalog order. */
function productKeys(event) {
  return event ? event.products.map((p) => p.product_key) : [];
}

/**
 * Every (product, size) an event sells, in catalog order. The size summary
 * counts against this so a size run reads completely even at zero ordered.
 */
function productSizePairs(event) {
  if (!event) return [];
  return event.products.flatMap((product) =>
    product.sizes.map((entry) => ({
      product_key: product.product_key,
      product_name: product.product_name,
      size: entry.size
    }))
  );
}

module.exports = {
  OCTOBER_5K_EVENT_KEY,
  SHIRT_PRICE_CENTS,
  getEvent,
  findProduct,
  findSize,
  sizeNames,
  productKeys,
  productSizePairs
};
