'use strict';

const { getEventProduct, findSize, sizeNames } = require('../config/merchCatalog');

/**
 * A caller's fault, not ours: every throw from buildOrderDraft is something the
 * purchaser can fix by changing their order. The controller maps it to a 400.
 */
class MerchValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MerchValidationError';
  }
}

/**
 * Validates a requested merchandise order and prices it from the catalog.
 *
 * Deliberately pure and synchronous: no DB, no Stripe, no clock. Everything
 * that can reject an order happens here, BEFORE a pending row is written or a
 * Stripe session is opened, so a bad request costs nothing.
 *
 * @param {object} args
 * @param {string} args.eventKey
 * @param {Array<{size: string, quantity: number}>} args.items
 * @returns {{product: object, lineItems: Array, subtotalCents: number}}
 */
function buildOrderDraft({ eventKey, items }) {
  const product = getEventProduct(eventKey);
  if (!product) {
    throw new MerchValidationError(`Unknown event: ${eventKey}`);
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new MerchValidationError('Please choose at least one size.');
  }

  const seenSizes = new Set();
  const lineItems = items.map((item) => {
    const size = String(item && item.size ? item.size : '').trim();

    // The size entry carries this line's price. No entry means no shirt and no
    // price — never a fallback to some other size's cost.
    const sizeEntry = findSize(product, size);
    if (!sizeEntry) {
      throw new MerchValidationError(
        `Unavailable size "${size}". Available sizes: ${sizeNames(product).join(', ')}.`
      );
    }

    // Two lines for one size would each be priced correctly and then billed
    // together, so the purchaser sees a total they never chose. Reject rather
    // than silently merge: we cannot tell which of the two they meant.
    if (seenSizes.has(size)) {
      throw new MerchValidationError(`Duplicate size in order: ${size}.`);
    }
    seenSizes.add(size);

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new MerchValidationError(`Quantity for size ${size} must be a whole number of at least 1.`);
    }
    if (quantity > product.max_quantity_per_size) {
      throw new MerchValidationError(
        `Quantity for size ${size} may not exceed ${product.max_quantity_per_size}. ` +
        'For a larger order, please contact the church office.'
      );
    }

    // item.unit_amount is NOT read. See the note in config/merchCatalog.js.
    return {
      product_name: product.product_name,
      size,
      quantity,
      unit_amount: sizeEntry.unit_amount,
      total_amount: sizeEntry.unit_amount * quantity
    };
  });

  const subtotalCents = lineItems.reduce((sum, line) => sum + line.total_amount, 0);

  return { product, lineItems, subtotalCents };
}

module.exports = { buildOrderDraft, MerchValidationError };
