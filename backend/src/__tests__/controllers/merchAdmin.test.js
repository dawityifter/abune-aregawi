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

const { sequelize, MerchOrder, MerchOrderItem } = require('../../models');
const merchController = require('../../controllers/merchController');
const merchRoutes = require('../../routes/merchRoutes');
const { OCTOBER_5K_EVENT_KEY, getEventProduct, findSize } = require('../../config/merchCatalog');

// Dollars, matching the DECIMAL columns. Sizes cost different amounts.
const priceFor = (size) => findSize(getEventProduct(OCTOBER_5K_EVENT_KEY), size).unit_amount / 100;

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
  return app;
}

/** Synthetic purchasers only — never real member data. */
async function seedOrder({ status, sizes, name = 'Test Purchaser', email = 'buyer@example.org' }) {
  const order = await MerchOrder.create({
    purchaser_name: name,
    purchaser_email: email,
    status,
    fulfillment_status: 'unfulfilled',
    subtotal: sizes.reduce((n, s) => n + priceFor(s.size) * s.quantity, 0),
    tax: 0,
    total: sizes.reduce((n, s) => n + priceFor(s.size) * s.quantity, 0),
    currency: 'usd',
    event_key: OCTOBER_5K_EVENT_KEY,
    stripe_checkout_session_id: `cs_${status}_${Math.random().toString(36).slice(2)}`
  });
  await MerchOrderItem.bulkCreate(sizes.map((s) => ({
    order_id: order.id,
    product_name: '5K Fundraiser T-Shirt',
    size: s.size,
    quantity: s.quantity,
    unit_amount: priceFor(s.size),
    total_amount: priceFor(s.size) * s.quantity
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
  it('leaves the catalog public', async () => {
    const res = await request(buildGuardedApp()).get('/api/merch/catalog');
    expect(res.status).toBe(200);
    expect(res.body.product.sizes.length).toBeGreaterThan(0);
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
    expect(res.body.sizes.find((s) => s.size === 'S').quantity).toBe(2);
    expect(res.body.total_shirts).toBe(2);
  });

  it('adds up the same size across several orders', async () => {
    await seedOrder({ status: 'paid', sizes: [{ size: 'L', quantity: 1 }] });
    await seedOrder({ status: 'paid', sizes: [{ size: 'L', quantity: 3 }, { size: 'S', quantity: 2 }] });

    const res = await request(buildStaffApp()).get('/orders/size-summary');

    expect(res.body.sizes.find((s) => s.size === 'L').quantity).toBe(4);
    expect(res.body.sizes.find((s) => s.size === 'S').quantity).toBe(2);
    expect(res.body.total_shirts).toBe(6);
  });

  // Whoever places the print order wants a complete size run to read down, not
  // just the sizes that happened to sell.
  it('lists every catalog size, including those with no orders', async () => {
    await seedOrder({ status: 'paid', sizes: [{ size: 'S', quantity: 1 }] });

    const res = await request(buildStaffApp()).get('/orders/size-summary');

    expect(res.body.sizes.map((s) => s.size)).toEqual(['S', 'L']);
    expect(res.body.sizes.find((s) => s.size === 'L').quantity).toBe(0);
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
