'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';
process.env.STRIPE_SECRET_KEY = 'sk_test_merch';

const request = require('supertest');
const express = require('express');

// Firebase has to look initialised, or the auth middleware answers 500 for a
// missing-config reason and the guard tests would pass for the wrong one.
// verifyIdToken is never reached: these requests carry no Authorization header.
jest.mock('firebase-admin', () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  credential: { cert: jest.fn(), applicationDefault: jest.fn() },
  auth: () => ({
    verifyIdToken: jest.fn().mockRejectedValue(new Error('should not be called'))
  })
}));

jest.mock('stripe', () => jest.fn(() => ({
  checkout: { sessions: { create: jest.fn() } },
  webhooks: { constructEvent: jest.fn() }
})));

const { sequelize, MerchOrder, MerchOrderItem, MerchInventory } = require('../../models');
const merchController = require('../../controllers/merchController');
const merchRoutes = require('../../routes/merchRoutes');
const {
  OCTOBER_5K_EVENT_KEY, getEvent, findProduct, findSize
} = require('../../config/merchCatalog');

const EVENT = getEvent(OCTOBER_5K_EVENT_KEY);
const YOUTH = EVENT.products[0];
const ADULT = EVENT.products[1];

// Dollars, matching the DECIMAL columns. Price is per product and size.
const priceFor = (product, size) => findSize(product, size).unit_amount / 100;

/** One (product, size) cell out of a size-summary response. */
const qty = (res, product, size) =>
  res.body.sizes.find((s) => s.product_name === product.product_name && s.size === size).quantity;

/** The real router, guards included — used to prove the guards are wired. */
function buildGuardedApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/merch', merchRoutes);
  return app;
}

/**
 * Behaviour tests inject req.user directly rather than exercising firebase, the
 * same way squareController.test.js does for its reconcile routes.
 */
function buildStaffApp(user = { id: 1, role: 'admin' }) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = user; next(); });
  app.get('/orders', merchController.listOrders);
  app.get('/orders/size-summary', merchController.getSizeSummary);
  app.patch('/orders/:id/fulfillment', merchController.updateFulfillment);
  app.get('/inventory', merchController.listInventory);
  app.put('/inventory/:product_key/:size', merchController.updateInventory);
  return app;
}

/** Synthetic purchasers only — never real member data. */
async function seedOrder({
  status, sizes, name = 'Test Purchaser', email = 'buyer@example.org', phone = '+12145550000'
}) {
  // A line defaults to the adult shirt so existing cases read unchanged; the
  // youth/adult cases pass `product` explicitly.
  const lines = sizes.map((s) => ({ product: s.product || ADULT, size: s.size, quantity: s.quantity }));
  const total = lines.reduce((n, l) => n + priceFor(l.product, l.size) * l.quantity, 0);

  const order = await MerchOrder.create({
    purchaser_name: name,
    purchaser_email: email,
    purchaser_phone: phone,
    status,
    fulfillment_status: 'unfulfilled',
    subtotal: total,
    tax: 0,
    total,
    currency: 'usd',
    event_key: OCTOBER_5K_EVENT_KEY,
    stripe_checkout_session_id: `cs_${status}_${Math.random().toString(36).slice(2)}`
  });
  await MerchOrderItem.bulkCreate(lines.map((l) => ({
    order_id: order.id,
    product_name: l.product.product_name,
    product_key: l.product.product_key,
    size: l.size,
    quantity: l.quantity,
    unit_amount: priceFor(l.product, l.size),
    total_amount: priceFor(l.product, l.size) * l.quantity
  })));
  return order;
}

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => {
  try { await sequelize.close(); } catch (e) { /* already closed */ }
});
beforeEach(async () => {
  await MerchOrderItem.destroy({ where: {}, truncate: true });
  await MerchOrder.destroy({ where: {}, truncate: true });
  await MerchInventory.destroy({ where: {}, truncate: true });
});

describe('merchandise admin routes are not public', () => {
  it('refuses an anonymous request for the order list', async () => {
    const res = await request(buildGuardedApp()).get('/api/merch/orders');
    expect(res.status).toBe(401);
  });

  it('refuses an anonymous request for the size summary', async () => {
    const res = await request(buildGuardedApp()).get('/api/merch/orders/size-summary');
    expect(res.status).toBe(401);
  });

  it('refuses an anonymous fulfillment update', async () => {
    const res = await request(buildGuardedApp())
      .patch('/api/merch/orders/1/fulfillment')
      .send({ fulfillment_status: 'fulfilled' });
    expect(res.status).toBe(401);
  });

  // The catalog has no purchaser data in it and the order page needs it before
  // anyone signs in.
  it('refuses an anonymous request for the inventory', async () => {
    const res = await request(buildGuardedApp()).get('/api/merch/inventory');
    expect(res.status).toBe(401);
  });

  it('refuses an anonymous inventory change', async () => {
    const res = await request(buildGuardedApp())
      .put('/api/merch/inventory/youth_heavy_cotton/S')
      .send({ quantity: 0 });
    expect(res.status).toBe(401);
  });

  it('leaves the catalog public', async () => {
    const res = await request(buildGuardedApp()).get('/api/merch/catalog');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
  });
});

describe('GET /orders/size-summary', () => {
  // Printing shirts costs money. A pending order is a browser tab someone left
  // open, not a commitment.
  it('counts paid orders only', async () => {
    await seedOrder({ status: 'paid', sizes: [{ size: 'S', quantity: 2 }] });
    await seedOrder({ status: 'pending', sizes: [{ size: 'S', quantity: 5 }] });
    await seedOrder({ status: 'canceled', sizes: [{ size: 'S', quantity: 9 }] });

    const res = await request(buildStaffApp()).get('/orders/size-summary');

    expect(res.status).toBe(200);
    expect(qty(res, ADULT, 'S')).toBe(2);
    expect(res.body.total_shirts).toBe(2);
  });

  it('adds up the same size across several orders', async () => {
    await seedOrder({ status: 'paid', sizes: [{ size: 'L', quantity: 1 }] });
    await seedOrder({ status: 'paid', sizes: [{ size: 'L', quantity: 3 }, { size: 'S', quantity: 2 }] });

    const res = await request(buildStaffApp()).get('/orders/size-summary');

    expect(qty(res, ADULT, 'L')).toBe(4);
    expect(qty(res, ADULT, 'S')).toBe(2);
    expect(res.body.total_shirts).toBe(6);
  });

  // The whole reason the summary is keyed on product: these are different
  // garments that share a letter. Summed together, whoever places the supplier
  // order buys three adult smalls and no youth shirts at all.
  it('counts a youth small apart from an adult small', async () => {
    await seedOrder({ status: 'paid', sizes: [{ product: YOUTH, size: 'S', quantity: 2 }] });
    await seedOrder({ status: 'paid', sizes: [{ product: ADULT, size: 'S', quantity: 1 }] });

    const res = await request(buildStaffApp()).get('/orders/size-summary');

    expect(qty(res, YOUTH, 'S')).toBe(2);
    expect(qty(res, ADULT, 'S')).toBe(1);
    expect(res.body.total_shirts).toBe(3);
  });

  // Whoever places the print order wants a complete size run to read down, not
  // just the sizes that happened to sell.
  it('lists every catalog product and size, including those with no orders', async () => {
    await seedOrder({ status: 'paid', sizes: [{ size: 'S', quantity: 1 }] });

    const res = await request(buildStaffApp()).get('/orders/size-summary');

    expect(res.body.sizes.map((s) => `${s.product_name} ${s.size}`)).toEqual([
      `${YOUTH.product_name} S`,
      `${YOUTH.product_name} M`,
      `${YOUTH.product_name} L`,
      `${ADULT.product_name} S`,
      `${ADULT.product_name} L`
    ]);
    expect(qty(res, ADULT, 'L')).toBe(0);
    expect(qty(res, YOUTH, 'M')).toBe(0);
  });

  it('reports zero for an event with no paid orders', async () => {
    const res = await request(buildStaffApp()).get('/orders/size-summary');

    expect(res.status).toBe(200);
    expect(res.body.total_shirts).toBe(0);
  });
});

describe('GET /orders', () => {
  it('returns orders with their sizes', async () => {
    await seedOrder({ status: 'paid', sizes: [{ size: 'S', quantity: 2 }] });

    const res = await request(buildStaffApp()).get('/orders');

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].items[0]).toMatchObject({ size: 'S', quantity: 2 });
    expect(res.body.pagination.total).toBe(1);
  });

  it('filters by payment status', async () => {
    await seedOrder({ status: 'paid', sizes: [{ size: 'S', quantity: 1 }] });
    await seedOrder({ status: 'pending', sizes: [{ size: 'L', quantity: 1 }] });

    const res = await request(buildStaffApp()).get('/orders?status=paid');

    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].status).toBe('paid');
  });

  it('filters by fulfillment status', async () => {
    const paid = await seedOrder({ status: 'paid', sizes: [{ size: 'S', quantity: 1 }] });
    await paid.update({ fulfillment_status: 'fulfilled' });
    await seedOrder({ status: 'paid', sizes: [{ size: 'L', quantity: 1 }] });

    const res = await request(buildStaffApp()).get('/orders?fulfillment_status=unfulfilled');

    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0].fulfillment_status).toBe('unfulfilled');
  });
});

describe('PATCH /orders/:id/fulfillment', () => {
  it('marks a paid order fulfilled and stamps the time', async () => {
    const order = await seedOrder({ status: 'paid', sizes: [{ size: 'S', quantity: 1 }] });

    const res = await request(buildStaffApp())
      .patch(`/orders/${order.id}/fulfillment`)
      .send({ fulfillment_status: 'fulfilled' });

    expect(res.status).toBe(200);
    await order.reload();
    expect(order.fulfillment_status).toBe('fulfilled');
    expect(order.fulfilled_at).toBeTruthy();
  });

  // Handing over shirts for an order that was never paid is a giveaway.
  it('refuses to fulfil an unpaid order', async () => {
    const order = await seedOrder({ status: 'pending', sizes: [{ size: 'S', quantity: 1 }] });

    const res = await request(buildStaffApp())
      .patch(`/orders/${order.id}/fulfillment`)
      .send({ fulfillment_status: 'fulfilled' });

    expect(res.status).toBe(400);
    await order.reload();
    expect(order.fulfillment_status).toBe('unfulfilled');
  });

  it('can undo a fulfillment marked by mistake', async () => {
    const order = await seedOrder({ status: 'paid', sizes: [{ size: 'S', quantity: 1 }] });
    await order.update({ fulfillment_status: 'fulfilled', fulfilled_at: new Date() });

    await request(buildStaffApp())
      .patch(`/orders/${order.id}/fulfillment`)
      .send({ fulfillment_status: 'unfulfilled' })
      .expect(200);

    await order.reload();
    expect(order.fulfillment_status).toBe('unfulfilled');
    expect(order.fulfilled_at).toBeNull();
  });

  it('404s for an order that does not exist', async () => {
    const res = await request(buildStaffApp())
      .patch('/orders/999999/fulfillment')
      .send({ fulfillment_status: 'fulfilled' });

    expect(res.status).toBe(404);
  });
});

describe('inventory', () => {
  const stock = (product, size, quantity) => MerchInventory.create({
    event_key: OCTOBER_5K_EVENT_KEY, product_key: product.product_key, size, quantity
  });
  const row = (res, product, size) =>
    res.body.items.find((i) => i.product_key === product.product_key && i.size === size);
  const put = (product, size, body, user) =>
    request(buildStaffApp(user)).put(`/inventory/${product.product_key}/${size}`).send(body);

  it('lists every catalog size with what is left, in catalog order', async () => {
    await stock(YOUTH, 'M', 100);
    await stock(ADULT, 'S', 150);

    const res = await request(buildStaffApp()).get('/inventory');

    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => `${i.product_key}|${i.size}`)).toEqual([
      'youth_heavy_cotton|S', 'youth_heavy_cotton|M', 'youth_heavy_cotton|L',
      'adult_heavy_cotton|S', 'adult_heavy_cotton|L'
    ]);
    expect(row(res, YOUTH, 'M').quantity).toBe(100);
    expect(row(res, ADULT, 'S').quantity).toBe(150);
    // No record yet reads as none, not as a missing row.
    expect(row(res, YOUTH, 'S').quantity).toBe(0);
  });

  // Shirts in open checkouts are already off the count; showing them explains
  // a drop that no paid order accounts for yet.
  it('shows what open checkouts are holding, and nothing for paid orders', async () => {
    await stock(ADULT, 'S', 140);
    await seedOrder({ status: 'pending', sizes: [{ size: 'S', quantity: 2 }] });
    await seedOrder({ status: 'paid', sizes: [{ size: 'S', quantity: 5 }] });
    await seedOrder({ status: 'pending', sizes: [{ product: YOUTH, size: 'S', quantity: 1 }] });

    const res = await request(buildStaffApp()).get('/inventory');

    expect(row(res, ADULT, 'S').held).toBe(2);
    expect(row(res, YOUTH, 'S').held).toBe(1);
    expect(row(res, ADULT, 'L').held).toBe(0);
  });

  it('sets a count after cash sales, and records who set it', async () => {
    await stock(YOUTH, 'M', 100);

    const res = await put(YOUTH, 'M', { quantity: 94, expected_quantity: 100 },
      { id: 7, role: 'treasurer', email: 'treasurer@example.org' });

    expect(res.status).toBe(200);
    expect(res.body.item.quantity).toBe(94);
    const saved = await MerchInventory.findOne({ where: { product_key: YOUTH.product_key, size: 'M' } });
    expect(saved.quantity).toBe(94);
    expect(saved.updated_by).toBe('treasurer@example.org');
  });

  it('can set a size to zero, which takes it off sale', async () => {
    await stock(ADULT, 'L', 3);

    const res = await put(ADULT, 'L', { quantity: 0, expected_quantity: 3 });

    expect(res.status).toBe(200);
    expect((await MerchInventory.findOne({ where: { product_key: ADULT.product_key, size: 'L' } })).quantity).toBe(0);
  });

  it('creates the record for a size that had none', async () => {
    const res = await put(YOUTH, 'L', { quantity: 12, expected_quantity: 0 });

    expect(res.status).toBe(200);
    expect((await MerchInventory.findOne({ where: { product_key: YOUTH.product_key, size: 'L' } })).quantity).toBe(12);
  });

  // The admin typed their figure while looking at 100; an online order took
  // two in the meantime. Writing 94 over 98 would silently undo that sale.
  it('refuses a change made against a count that has since moved', async () => {
    await stock(YOUTH, 'M', 98);

    const res = await put(YOUTH, 'M', { quantity: 94, expected_quantity: 100 });

    expect(res.status).toBe(409);
    expect(res.body.current).toBe(98);
    expect((await MerchInventory.findOne({ where: { product_key: YOUTH.product_key, size: 'M' } })).quantity).toBe(98);
  });

  it('404s for a size the catalog does not sell', async () => {
    // The adult cut is not stocked in a medium.
    const res = await put(ADULT, 'M', { quantity: 5 });
    expect(res.status).toBe(404);
  });
});
