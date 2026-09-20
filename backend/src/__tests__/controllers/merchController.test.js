'use strict';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'sqlite::memory:';
process.env.STRIPE_SECRET_KEY = 'sk_test_merch';
process.env.STRIPE_MERCH_WEBHOOK_SECRET = 'whsec_test_merch';
process.env.MERCH_TAX_MODE = 'manual';
process.env.MERCH_TAX_RATE_BPS = '825';
process.env.FRONTEND_URL = 'https://example.org';

const request = require('supertest');
const express = require('express');

// Only the Stripe SDK is faked. Everything else — validation, the DB writes,
// the ledger — runs for real against sqlite, because those are what we are
// actually testing.
const mockSessionCreate = jest.fn();
const mockConstructEvent = jest.fn();
jest.mock('stripe', () => jest.fn(() => ({
  checkout: { sessions: { create: mockSessionCreate } },
  webhooks: { constructEvent: mockConstructEvent }
})));

const {
  sequelize, MerchOrder, MerchOrderItem, Transaction, LedgerEntry, IncomeCategory, Donation
} = require('../../models');
const merchController = require('../../controllers/merchController');
const merchRoutes = require('../../routes/merchRoutes');
const { OCTOBER_5K_EVENT_KEY, getEventProduct, findSize } = require('../../config/merchCatalog');

const product = getEventProduct(OCTOBER_5K_EVENT_KEY);
// Sizes cost different amounts, so every expected total is derived per size.
const priceOf = (size) => findSize(product, size).unit_amount;

function buildPublicApp() {
  const app = express();
  // Mirrors server.js: the webhook takes a raw body, mounted before json().
  app.post('/api/merch/webhook', express.raw({ type: 'application/json' }), merchController.handleWebhook);
  app.use(express.json());
  app.use('/api/merch', merchRoutes);
  return app;
}

function validPurchaser() {
  return {
    purchaser_name: 'Test Purchaser',
    purchaser_email: 'test.purchaser@example.org',
    purchaser_phone: '+12145550000'
  };
}

function post(body) {
  return request(buildPublicApp()).post('/api/merch/checkout-session').send({
    event_key: OCTOBER_5K_EVENT_KEY,
    ...validPurchaser(),
    ...body
  });
}

/**
 * A checkout.session.completed event for an order already in the DB, shaped the
 * way Stripe really reports a MANUAL-tax session.
 *
 * This is the detail an earlier version of this fixture got wrong, and the bug
 * it hid cost a live order its tax breakdown: in manual mode the tax is one of
 * our own line items, so Stripe folds it into `amount_subtotal` and reports
 * `total_details.amount_tax: 0` — it has no idea that line is tax. Modelling it
 * as though Stripe had itemised the tax made a broken handler look correct.
 */
function completedEvent(order, overrides = {}) {
  // Everything charged is "subtotal" as far as Stripe is concerned.
  const subtotal = Math.round(Number(order.total) * 100);
  const tax = 0;
  return {
    id: 'evt_merch_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: order.stripe_checkout_session_id,
        object: 'checkout.session',
        payment_intent: 'pi_merch_1',
        payment_status: 'paid',
        status: 'complete',
        currency: 'usd',
        amount_subtotal: subtotal,
        amount_total: subtotal + tax,
        total_details: { amount_tax: tax },
        created: 1758240000,
        customer_details: { name: order.purchaser_name, email: order.purchaser_email },
        metadata: {
          order_id: String(order.id),
          event_key: OCTOBER_5K_EVENT_KEY,
          purpose: 'merchandise_sale'
        },
        ...overrides
      }
    }
  };
}

function deliver(event, signature = 'good') {
  mockConstructEvent.mockImplementation(() => {
    if (signature !== 'good') throw new Error('Invalid signature');
    return event;
  });
  return request(buildPublicApp())
    .post('/api/merch/webhook')
    .set('stripe-signature', signature)
    .set('Content-Type', 'application/json')
    .send(Buffer.from(JSON.stringify(event)));
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await IncomeCategory.create({
    gl_code: 'INC012',
    name: 'Event Merchandise Sales',
    payment_type_mapping: 'event_merchandise',
    is_active: true
  });
});

afterAll(async () => {
  try { await sequelize.close(); } catch (e) { /* already closed */ }
});

beforeEach(async () => {
  jest.clearAllMocks();
  await MerchOrderItem.destroy({ where: {}, truncate: true });
  await MerchOrder.destroy({ where: {}, truncate: true });
  await LedgerEntry.destroy({ where: {}, truncate: true });
  await Transaction.destroy({ where: {}, truncate: true });
  mockSessionCreate.mockResolvedValue({
    id: 'cs_test_merch_1',
    url: 'https://checkout.stripe.com/c/pay/cs_test_merch_1'
  });
});

describe('POST /api/merch/checkout-session — validation', () => {
  it('rejects a missing purchaser name', async () => {
    const res = await post({ purchaser_name: '', items: [{ size: 'S', quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(mockSessionCreate).not.toHaveBeenCalled();
    expect(await MerchOrder.count()).toBe(0);
  });

  it('rejects a malformed email', async () => {
    const res = await post({ purchaser_email: 'not-an-email', items: [{ size: 'S', quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(await MerchOrder.count()).toBe(0);
  });

  it('rejects an order with no items', async () => {
    const res = await post({ items: [] });

    expect(res.status).toBe(400);
    expect(await MerchOrder.count()).toBe(0);
  });

  // The whole order is refused, so nothing half-valid reaches Stripe and no
  // pending row is orphaned.
  it('rejects a size the catalog does not carry and writes nothing', async () => {
    const res = await post({ items: [{ size: 'XXXXL', quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockSessionCreate).not.toHaveBeenCalled();
    expect(await MerchOrder.count()).toBe(0);
    expect(await MerchOrderItem.count()).toBe(0);
  });

  it('rejects a quantity above the per-size maximum', async () => {
    const res = await post({
      items: [{ size: 'S', quantity: product.max_quantity_per_size + 1 }]
    });

    expect(res.status).toBe(400);
    expect(await MerchOrder.count()).toBe(0);
  });
});

describe('POST /api/merch/checkout-session — order creation', () => {
  it('creates a pending order with its items and returns the checkout url', async () => {
    const res = await post({ items: [{ size: 'S', quantity: 2 }, { size: 'L', quantity: 1 }] });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/c/pay/cs_test_merch_1');
    expect(res.body.session_id).toBe('cs_test_merch_1');

    const order = await MerchOrder.findOne({ include: [{ model: MerchOrderItem, as: 'items' }] });
    expect(order.status).toBe('pending');
    expect(order.fulfillment_status).toBe('unfulfilled');
    expect(order.stripe_checkout_session_id).toBe('cs_test_merch_1');
    expect(order.event_key).toBe(OCTOBER_5K_EVENT_KEY);
    expect(order.items).toHaveLength(2);
    expect(Number(order.subtotal)).toBeCloseTo((priceOf('S') * 2 + priceOf('L')) / 100, 2);
  });

  // The endpoint is public; trusting a posted price is how a $25 shirt gets
  // bought for a penny.
  it('prices from the catalog, ignoring a price posted by the caller', async () => {
    await post({ items: [{ size: 'L', quantity: 1, unit_amount: 1 }] });

    const order = await MerchOrder.findOne();
    expect(Number(order.subtotal)).toBeCloseTo(priceOf('L') / 100, 2);

    const args = mockSessionCreate.mock.calls[0][0];
    const shirtLine = args.line_items.find((l) => l.price_data.unit_amount === priceOf('L'));
    expect(shirtLine).toBeDefined();
  });

  it('opens the session in payment mode and carries the merchandise metadata', async () => {
    await post({ items: [{ size: 'S', quantity: 1 }] });

    const args = mockSessionCreate.mock.calls[0][0];
    const order = await MerchOrder.findOne();

    expect(args.mode).toBe('payment');
    expect(args.metadata).toMatchObject({
      order_id: String(order.id),
      event_key: OCTOBER_5K_EVENT_KEY,
      purpose: 'merchandise_sale'
    });
  });

  /**
   * Without an explicit list, Stripe falls back to DYNAMIC payment methods and
   * renders whatever the dashboard happens to have enabled — Klarna, Affirm,
   * Cash App, Link. Buy-now-pay-later financing on a $25 parish fundraiser
   * shirt is not something the church offers, and the donation flow has always
   * pinned cards (donationController's paymentIntents.create). This keeps the
   * two consistent and stops a dashboard toggle from changing the checkout
   * page underneath us.
   */
  it('offers card payment only, matching the donation flow', async () => {
    await post({ items: [{ size: 'S', quantity: 1 }] });

    const args = mockSessionCreate.mock.calls[0][0];
    expect(args.payment_method_types).toEqual(['card']);
  });

  /**
   * Link brings a "Save my information for faster checkout" opt-in with it,
   * which asks a parishioner buying one t-shirt to create a Stripe-wide
   * account. The donation and pledge pages use a plain CardElement and show
   * neither Link nor its checkbox, so this keeps merch consistent with them.
   *
   * Note this is the only lever that exists: hosted Checkout has no parameter
   * to move wallets below the card form, so a wallet is either shown above it
   * or not shown.
   */
  it('does not display Link, or the save-my-information prompt it brings', async () => {
    await post({ items: [{ size: 'S', quantity: 1 }] });

    const args = mockSessionCreate.mock.calls[0][0];
    expect(args.wallet_options).toEqual({ link: { display: 'never' } });
  });

  it('does not enable the buy-now-pay-later methods', async () => {
    await post({ items: [{ size: 'S', quantity: 1 }] });

    const methods = mockSessionCreate.mock.calls[0][0].payment_method_types;
    ['klarna', 'affirm', 'afterpay_clearpay', 'cashapp', 'link'].forEach((m) => {
      expect(methods).not.toContain(m);
    });
  });

  // Pickup at the church or the event only — collecting a shipping address
  // would promise a service the parish is not offering.
  it('does not collect a shipping address', async () => {
    await post({ items: [{ size: 'S', quantity: 1 }] });

    const args = mockSessionCreate.mock.calls[0][0];
    expect(args.shipping_address_collection).toBeUndefined();
  });

  it('adds a tax line and records the tax on the order in manual mode', async () => {
    await post({ items: [{ size: 'S', quantity: 2 }] });

    const subtotalCents = priceOf('S') * 2;
    const expectedTaxCents = Math.round((subtotalCents * 825) / 10000);

    const order = await MerchOrder.findOne();
    expect(Number(order.tax)).toBeCloseTo(expectedTaxCents / 100, 2);
    expect(Number(order.total)).toBeCloseTo((subtotalCents + expectedTaxCents) / 100, 2);

    const args = mockSessionCreate.mock.calls[0][0];
    const taxLine = args.line_items.find((l) => /tax/i.test(l.price_data.product_data.name));
    expect(taxLine.price_data.unit_amount).toBe(expectedTaxCents);
  });
});

describe('POST /api/merch/webhook', () => {
  async function pendingOrder() {
    await post({ items: [{ size: 'S', quantity: 2 }] });
    return MerchOrder.findOne();
  }

  it('rejects a bad signature and leaves the order pending', async () => {
    const order = await pendingOrder();

    const res = await deliver(completedEvent(order), 'bad');

    expect(res.status).toBe(400);
    await order.reload();
    expect(order.status).toBe('pending');
    expect(await Transaction.count()).toBe(0);
  });

  /**
   * In manual mode WE computed the tax and billed it as a line item, so our
   * split is the only correct one — Stripe reports the whole charge as subtotal
   * with zero tax. Overwriting our figures with Stripe's (as this once did)
   * silently zeroes the tax on every paid order, leaving the treasurer with no
   * way to work out what sales tax was collected and a ledger memo claiming
   * "incl. sales tax $0.00" on an order that really did collect it.
   */
  it('keeps our tax breakdown when we billed the tax ourselves', async () => {
    const order = await pendingOrder();
    const expectedSubtotal = Number(order.subtotal);
    const expectedTax = Number(order.tax);
    const expectedTotal = Number(order.total);

    expect(expectedTax).toBeGreaterThan(0); // guards the fixture itself

    await deliver(completedEvent(order)).expect(200);

    await order.reload();
    expect(Number(order.subtotal)).toBeCloseTo(expectedSubtotal, 2);
    expect(Number(order.tax)).toBeCloseTo(expectedTax, 2);
    expect(Number(order.total)).toBeCloseTo(expectedTotal, 2);
  });

  /**
   * The other branch. Under Stripe Tax the tax is a real itemised amount rather
   * than one of our line items, so Stripe's split is the authoritative one and
   * must replace whatever we guessed at checkout time.
   */
  it('takes Stripe\'s split when Stripe itemised the tax itself', async () => {
    const order = await pendingOrder();

    // Shaped like an automatic_tax session: tax broken out, subtotal net of it.
    const event = completedEvent(order, {
      amount_subtotal: 5000,
      amount_total: 5450,
      total_details: { amount_tax: 450 }
    });

    await deliver(event).expect(200);

    await order.reload();
    expect(Number(order.subtotal)).toBeCloseTo(50.0, 2);
    expect(Number(order.tax)).toBeCloseTo(4.5, 2);
    expect(Number(order.total)).toBeCloseTo(54.5, 2);
  });

  it('records the tax actually collected in the ledger memo', async () => {
    const order = await pendingOrder();

    await deliver(completedEvent(order)).expect(200);

    const ledger = await LedgerEntry.findOne();
    expect(ledger.memo).toContain(`$${Number(order.tax).toFixed(2)}`);
    expect(ledger.memo).not.toContain('$0.00');
  });

  it('marks the order paid and records the payment intent', async () => {
    const order = await pendingOrder();

    await deliver(completedEvent(order)).expect(200);

    await order.reload();
    expect(order.status).toBe('paid');
    expect(order.stripe_payment_intent_id).toBe('pi_merch_1');
    expect(order.paid_at).toBeTruthy();
  });

  it('books the sale as event merchandise, not as a donation', async () => {
    const order = await pendingOrder();

    await deliver(completedEvent(order)).expect(200);

    const txn = await Transaction.findOne();
    expect(txn.payment_type).toBe('event_merchandise');
    expect(txn.payment_method).toBe('credit_card');
    expect(txn.status).toBe('succeeded');
    expect(txn.external_id).toBe('pi_merch_1');
    expect(txn.donor_name).toBe('Test Purchaser');
    expect(Number(txn.amount)).toBeCloseTo(Number(order.total), 2);

    const ledger = await LedgerEntry.findOne();
    expect(ledger.type).toBe('event_merchandise');
    expect(ledger.category).toBe('INC012');
    expect(ledger.transaction_id).toBe(txn.id);

    // A shirt is a purchase. Nothing here may look like charitable giving.
    expect(await Donation.count()).toBe(0);
    expect(txn.member_id).toBeNull();
  });

  it('links the order to the transaction it produced', async () => {
    const order = await pendingOrder();

    await deliver(completedEvent(order)).expect(200);

    const txn = await Transaction.findOne();
    await order.reload();
    expect(String(order.transaction_id)).toBe(String(txn.id));
  });

  // Stripe redelivers on any non-2xx, and at-least-once delivery is normal even
  // on success. A second delivery must not double the church's books.
  it('is idempotent: a redelivered event creates no second transaction', async () => {
    const order = await pendingOrder();
    const event = completedEvent(order);

    await deliver(event).expect(200);
    await deliver(event).expect(200);

    expect(await Transaction.count()).toBe(1);
    expect(await LedgerEntry.count()).toBe(1);
    expect(await MerchOrder.count()).toBe(1);

    await order.reload();
    expect(order.status).toBe('paid');
  });

  it('acknowledges an event whose order is unknown rather than retrying forever', async () => {
    const order = await pendingOrder();
    const event = completedEvent(order);
    event.data.object.metadata.order_id = '999999';

    await deliver(event).expect(200);

    expect(await Transaction.count()).toBe(0);
  });

  it('ignores an unrelated event type', async () => {
    const order = await pendingOrder();
    const event = completedEvent(order);
    event.type = 'payment_intent.succeeded';

    await deliver(event).expect(200);

    await order.reload();
    expect(order.status).toBe('pending');
    expect(await Transaction.count()).toBe(0);
  });

  // An unpaid session (a bank debit still clearing) is not money in the bank.
  it('does not book a session that completed without payment', async () => {
    const order = await pendingOrder();

    await deliver(completedEvent(order, { payment_status: 'unpaid' })).expect(200);

    await order.reload();
    expect(order.status).toBe('pending');
    expect(await Transaction.count()).toBe(0);
  });
});
