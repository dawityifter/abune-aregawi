'use strict';

const { Op } = require('sequelize');
const { MerchInventory, MerchOrderItem, MerchOrder, sequelize } = require('../models');
const { getEvent, productSizePairs } = require('../config/merchCatalog');

/**
 * Thrown when a checkout asks for more of a size than is left. The controller
 * maps it to a 409 — the purchaser can fix it by ordering fewer.
 */
class MerchOutOfStockError extends Error {
  constructor(message, { productKey, size, available }) {
    super(message);
    this.name = 'MerchOutOfStockError';
    this.product_key = productKey;
    this.size = size;
    this.available = available;
  }
}

const cellKey = (productKey, size) => `${productKey}|${size}`;

/**
 * productKey|size -> quantity on hand, for every catalog cell of an event.
 * A cell with no row reads as 0: see models/MerchInventory.js for why a missing
 * row means sold out rather than unlimited.
 */
async function getAvailability(eventKey, { transaction } = {}) {
  const rows = await MerchInventory.findAll({ where: { event_key: eventKey }, transaction });
  const onHand = new Map(rows.map((r) => [cellKey(r.product_key, r.size), r.quantity]));
  const availability = new Map();
  for (const { product_key: productKey, size } of productSizePairs(getEvent(eventKey))) {
    availability.set(cellKey(productKey, size), Math.max(0, onHand.get(cellKey(productKey, size)) || 0));
  }
  return availability;
}

/**
 * Takes a checkout's shirts off the shelf. Must run inside the transaction that
 * writes the order, so a failure on any line puts every earlier line back.
 *
 * Each line is ONE conditional UPDATE — "subtract n where at least n remain" —
 * rather than read-then-write. Two purchasers racing for the last shirt both
 * read 1 in a read-then-write; here the database lets exactly one of them win.
 */
async function reserve(eventKey, lineItems, transaction) {
  for (const line of lineItems) {
    const [affected] = await MerchInventory.update(
      { quantity: sequelize.literal(`quantity - ${Number(line.quantity)}`) },
      {
        where: {
          event_key: eventKey,
          product_key: line.product_key,
          size: line.size,
          quantity: { [Op.gte]: line.quantity }
        },
        transaction
      }
    );

    if (affected !== 1) {
      const row = await MerchInventory.findOne({
        where: { event_key: eventKey, product_key: line.product_key, size: line.size },
        transaction
      });
      const available = row ? Math.max(0, row.quantity) : 0;
      const message = available === 0
        ? `${line.product_name} size ${line.size} is sold out.`
        : `Only ${available} left of ${line.product_name} size ${line.size}.`;
      throw new MerchOutOfStockError(message, {
        productKey: line.product_key, size: line.size, available
      });
    }
  }
}

/**
 * Puts a pending order's shirts back on the shelf and moves it to `nextStatus`
 * ('expired' or 'canceled'), as one unit.
 *
 * The status change is conditional on the order still being `pending`, and the
 * stock is only returned when that change actually happened. Stripe delivers
 * webhooks at least once, so this WILL be called twice for the same session;
 * the second call finds the order no longer pending and returns nothing.
 *
 * @returns true when stock was returned.
 */
async function releasePendingOrder(orderId, nextStatus) {
  return sequelize.transaction(async (t) => {
    const [changed] = await MerchOrder.update(
      { status: nextStatus },
      { where: { id: orderId, status: 'pending' }, transaction: t }
    );
    if (changed !== 1) return false;

    const order = await MerchOrder.findByPk(orderId, { transaction: t });
    const items = await MerchOrderItem.findAll({ where: { order_id: orderId }, transaction: t });
    for (const item of items) {
      // Lines written before inventory existed carry no product_key and were
      // never reserved, so there is nothing of theirs to give back.
      if (!item.product_key) continue;
      await MerchInventory.update(
        { quantity: sequelize.literal(`quantity + ${Number(item.quantity)}`) },
        {
          where: { event_key: order.event_key, product_key: item.product_key, size: item.size },
          transaction: t
        }
      );
    }
    return true;
  });
}

/**
 * Shirts in checkouts that are open right now: taken off the shelf, not yet
 * paid for. Shown beside the count so staff can see why it dropped without a
 * paid order appearing.
 */
async function getHeld(eventKey) {
  const rows = await MerchOrderItem.findAll({
    attributes: [
      'product_key',
      'size',
      [sequelize.fn('SUM', sequelize.col('MerchOrderItem.quantity')), 'held']
    ],
    include: [{
      model: MerchOrder,
      as: 'order',
      attributes: [],
      where: { status: 'pending', event_key: eventKey },
      required: true
    }],
    where: { product_key: { [Op.ne]: null } },
    group: ['MerchOrderItem.product_key', 'MerchOrderItem.size'],
    raw: true
  });
  return new Map(rows.map((r) => [cellKey(r.product_key, r.size), Number(r.held) || 0]));
}

/**
 * Staff set a count by hand — after cash sales, or after a recount.
 *
 * `expectedQuantity` is the number the admin was looking at when they typed. If
 * an online sale moved the count in the meantime, writing their figure over it
 * would quietly undo that sale, so the write is refused and they are shown the
 * current number to redo their arithmetic against.
 *
 * @returns {{ok: true, row} | {ok: false, current: number}}
 */
async function setQuantity({ eventKey, productKey, size, quantity, expectedQuantity, updatedBy }) {
  return sequelize.transaction(async (t) => {
    const existing = await MerchInventory.findOne({
      where: { event_key: eventKey, product_key: productKey, size },
      transaction: t
    });
    const current = existing ? existing.quantity : 0;

    if (expectedQuantity !== undefined && expectedQuantity !== null && Number(expectedQuantity) !== current) {
      return { ok: false, current };
    }

    if (!existing) {
      const row = await MerchInventory.create({
        event_key: eventKey, product_key: productKey, size, quantity, updated_by: updatedBy
      }, { transaction: t });
      return { ok: true, row };
    }

    // Conditional on the value just read, so an online sale landing between the
    // read and this write is caught rather than overwritten.
    const [changed] = await MerchInventory.update(
      { quantity, updated_by: updatedBy },
      { where: { id: existing.id, quantity: current }, transaction: t }
    );
    if (changed !== 1) {
      const fresh = await MerchInventory.findByPk(existing.id, { transaction: t });
      return { ok: false, current: fresh.quantity };
    }
    return { ok: true, row: await MerchInventory.findByPk(existing.id, { transaction: t }) };
  });
}

module.exports = {
  MerchOutOfStockError,
  getAvailability,
  reserve,
  releasePendingOrder,
  getHeld,
  setQuantity,
  cellKey
};
