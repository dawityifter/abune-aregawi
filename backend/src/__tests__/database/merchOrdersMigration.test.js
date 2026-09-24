'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';

const { Sequelize, DataTypes } = require('sequelize');
// Both migrations, in order. Running only the first would build a schema no
// environment actually has, and the notNull the second adds would go untested.
const createMerchOrders = require('../../../migrations/20260919000002-create-merch-orders');
const phoneRequired = require('../../../migrations/20260921000001-merch-phone-required-email-optional');
const defineMerchOrder = require('../../models/MerchOrder');
const defineMerchOrderItem = require('../../models/MerchOrderItem');

/**
 * Every other merch test builds its schema with sequelize.sync(), which always
 * matches the model by construction and therefore cannot notice the migration
 * disagreeing with it. This one builds the schema from the MIGRATION and then
 * drives the real model against it.
 *
 * The bug it exists for: `stripe_checkout_session_id` has to be nullable,
 * because the order row is written before Stripe returns a session id — the row
 * id is what travels in the session metadata. A migration declaring it NOT NULL
 * passes every other test in this suite and then fails on the first real
 * checkout with "null value in column ... violates not-null constraint".
 */
describe('merch_orders migration matches what the code writes', () => {
  let sequelize;
  let MerchOrder;
  let MerchOrderItem;

  beforeAll(async () => {
    sequelize = new Sequelize('sqlite::memory:', { logging: false });

    // The migration references transactions(id) for the FK, so a minimal stand-in
    // has to exist first. Only the column the FK points at matters here.
    await sequelize.getQueryInterface().createTable('transactions', {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true }
    });

    await createMerchOrders.up(sequelize.getQueryInterface(), Sequelize);
    await phoneRequired.up(sequelize.getQueryInterface(), Sequelize);

    // A real Model, not a stand-in object: MerchOrder.associate calls belongsTo,
    // which rejects anything that is not a Model subclass.
    const Transaction = sequelize.define('Transaction', {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true }
    }, { tableName: 'transactions', timestamps: false });

    MerchOrder = defineMerchOrder(sequelize);
    MerchOrderItem = defineMerchOrderItem(sequelize);
    MerchOrder.associate({ MerchOrderItem, Transaction });
    MerchOrderItem.associate({ MerchOrder });
  });

  afterAll(async () => {
    try { await sequelize.close(); } catch (e) { /* already closed */ }
  });

  // The exact write createCheckoutSession makes before it has called Stripe.
  it('accepts a pending order that has no checkout session id yet', async () => {
    const order = await MerchOrder.create({
      purchaser_name: 'Test Purchaser',
      purchaser_email: 'buyer@example.org',
      purchaser_phone: '+12145550000',
      status: 'pending',
      fulfillment_status: 'unfulfilled',
      subtotal: 25.0,
      tax: 2.06,
      total: 27.06,
      currency: 'usd',
      event_key: 'october_5k_fundraiser'
      // stripe_checkout_session_id deliberately absent
    });

    expect(order.id).toBeTruthy();
    expect(order.stripe_checkout_session_id).toBeFalsy();
  });

  it('accepts the session id once Stripe returns one', async () => {
    const order = await MerchOrder.create({
      purchaser_name: 'Test Purchaser',
      purchaser_phone: '+12145550000',
      purchaser_email: 'buyer2@example.org',
      status: 'pending',
      fulfillment_status: 'unfulfilled',
      subtotal: 25.0,
      tax: 2.06,
      total: 27.06,
      currency: 'usd',
      event_key: 'october_5k_fundraiser'
    });

    await order.update({ stripe_checkout_session_id: 'cs_test_migration_1' });
    await order.reload();

    expect(order.stripe_checkout_session_id).toBe('cs_test_migration_1');
  });

  // Two pending orders coexist with NULL session ids: NULLs are distinct under a
  // unique index. If they were not, a second shopper could not start checkout
  // while a first one's order sat unpaid.
  it('allows several pending orders to hold a null session id at once', async () => {
    const base = {
      purchaser_name: 'Test Purchaser',
      purchaser_phone: '+12145550000',
      status: 'pending',
      fulfillment_status: 'unfulfilled',
      subtotal: 25.0,
      tax: 2.06,
      total: 27.06,
      currency: 'usd',
      event_key: 'october_5k_fundraiser'
    };

    await MerchOrder.create({ ...base, purchaser_email: 'a@example.org' });
    await MerchOrder.create({ ...base, purchaser_email: 'b@example.org' });

    const pending = await MerchOrder.count({ where: { stripe_checkout_session_id: null } });
    expect(pending).toBeGreaterThanOrEqual(2);
  });

  // The webhook idempotency guarantee rests on this index.
  it('refuses two orders sharing one checkout session id', async () => {
    const base = {
      purchaser_name: 'Test Purchaser',
      purchaser_phone: '+12145550000',
      status: 'pending',
      fulfillment_status: 'unfulfilled',
      subtotal: 25.0,
      tax: 2.06,
      total: 27.06,
      currency: 'usd',
      event_key: 'october_5k_fundraiser',
      stripe_checkout_session_id: 'cs_test_duplicate'
    };

    await MerchOrder.create({ ...base, purchaser_email: 'c@example.org' });

    await expect(
      MerchOrder.create({ ...base, purchaser_email: 'd@example.org' })
    ).rejects.toThrow();
  });

  // The point of 20260921000001: pickup is arranged by phone, so that column is
  // the one the schema insists on. Asserted against a migration-built table
  // because sync() would agree with the model no matter what the migration says.
  it('takes an order with no email, because email is optional', async () => {
    const order = await MerchOrder.create({
      purchaser_name: 'Test Purchaser',
      purchaser_phone: '+12145550000',
      status: 'pending',
      fulfillment_status: 'unfulfilled',
      subtotal: 30, tax: 0, total: 30,
      currency: 'usd',
      event_key: 'october_5k_fundraiser'
    });

    expect(order.id).toBeDefined();
    // Reloaded, not the in-memory instance: an attribute never set reads back
    // as undefined there, which would pass whatever the column allows.
    const stored = await MerchOrder.findByPk(order.id);
    expect(stored.purchaser_email).toBeNull();
  });

  it('refuses an order with no phone', async () => {
    await expect(MerchOrder.create({
      purchaser_name: 'Test Purchaser',
      purchaser_email: 'buyer@example.org',
      status: 'pending',
      fulfillment_status: 'unfulfilled',
      subtotal: 30, tax: 0, total: 30,
      currency: 'usd',
      event_key: 'october_5k_fundraiser'
    })).rejects.toThrow(/purchaser_phone/i);
  });

  it('cascades items from the migration-built schema', async () => {
    const order = await MerchOrder.create({
      purchaser_name: 'Test Purchaser',
      purchaser_phone: '+12145550000',
      purchaser_email: 'items@example.org',
      status: 'pending',
      fulfillment_status: 'unfulfilled',
      subtotal: 50.0,
      tax: 4.13,
      total: 54.13,
      currency: 'usd',
      event_key: 'october_5k_fundraiser'
    });

    await MerchOrderItem.create({
      order_id: order.id,
      product_name: '5K Fundraiser T-Shirt',
      size: 'M',
      quantity: 2,
      unit_amount: 25.0,
      total_amount: 50.0
    });

    const withItems = await MerchOrder.findByPk(order.id, {
      include: [{ model: MerchOrderItem, as: 'items' }]
    });
    expect(withItems.items).toHaveLength(1);
    expect(withItems.items[0].size).toBe('M');
  });
});
