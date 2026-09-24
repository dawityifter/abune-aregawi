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
  sequelize, MerchOrder, MerchOrderItem, MerchInventory, Transaction, LedgerEntry, IncomeCategory, Donation
} = require('../../models');
const merchController = require('../../controllers/merchController');
const merchRoutes = require('../../routes/merchRoutes');
const { OCTOBER_5K_EVENT_KEY, getEvent, findProduct, findSize } = require('../../config/merchCatalog');

const EVENT = getEvent(OCTOBER_5K_EVENT_KEY);
// Cases below order the adult shirt unless they say otherwise; the youth one is
// used where the point is that the two are distinct garments.
const product = findProduct(EVENT, 'adult_heavy_cotton');
const YOUTH = findProduct(EVENT, 'youth_heavy_cotton');
// Every expected total is derived from the catalog, never restated.
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
  await MerchInventory.destroy({ where: {}, truncate: true });
  // Plenty of every size, so the cases below are about what they say they are
  // about and not about stock. The inventory cases set their own counts.
  await MerchInventory.bulkCreate(EVENT.products.flatMap((p) => p.sizes.map((s) => ({
    event_key: OCTOBER_5K_EVENT_KEY, product_key: p.product_key, size: s.size, quantity: 100
  }))));
  mockSessionCreate.mockResolvedValue({
    id: 'cs_test_merch_1',
    url: 'https://checkout.stripe.com/c/pay/cs_test_merch_1'
  });
});

describe('POST /api/merch/checkout-session — validation', () => {
  it('rejects a missing purchaser name', async () => {
    const res = await post({ purchaser_name: '', items: [{ product_key: product.product_key, size: 'S', quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(mockSessionCreate).not.toHaveBeenCalled();
    expect(await MerchOrder.count()).toBe(0);
  });

  it('rejects a malformed email', async () => {
    const res = await post({ purchaser_email: 'not-an-email', items: [{ product_key: product.product_key, size: 'S', quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(await MerchOrder.count()).toBe(0);
  });

  // Pickup is arranged by phone, so that is the detail the parish cannot do
  // without — the mandatory contact swapped from email to phone.
  it('rejects a missing phone number', async () => {
    const res = await post({
      purchaser_phone: '',
      items: [{ product_key: product.product_key, size: 'S', quantity: 1 }]
    });

    expect(res.status).toBe(400);
    expect(mockSessionCreate).not.toHaveBeenCalled();
    expect(await MerchOrder.count()).toBe(0);
  });

  it('rejects a malformed phone number', async () => {
    const res = await post({
      purchaser_phone: 'not-a-phone',
      items: [{ product_key: product.product_key, size: 'S', quantity: 1 }]
    });

    expect(res.status).toBe(400);
    expect(await MerchOrder.count()).toBe(0);
  });

  it('takes an order with no email at all', async () => {
    const res = await post({
      purchaser_email: '',
      items: [{ product_key: product.product_key, size: 'S', quantity: 1 }]
    });

    expect(res.status).toBe(200);
    const order = await MerchOrder.findOne();
    expect(order.purchaser_email).toBeNull();
    expect(order.purchaser_phone).toBe('+12145550000');
  });

  // No email on the form: the Stripe page is pre-filled with the parish's own
  // address, so the purchaser is not asked for one there either.
  it('pre-fills Stripe with the parish address when no email was given', async () => {
    await post({
      purchaser_email: '',
      items: [{ product_key: product.product_key, size: 'S', quantity: 1 }]
    });

    const args = mockSessionCreate.mock.calls[0][0];
    expect(args.customer_email).toBe('abunearegawitx@gmail.com');
  });

  it('pre-fills Stripe with the email the purchaser gave', async () => {
    await post({
      purchaser_email: 'buyer@example.org',
      items: [{ product_key: product.product_key, size: 'S', quantity: 1 }]
    });

    const args = mockSessionCreate.mock.calls[0][0];
    expect(args.customer_email).toBe('buyer@example.org');
  });

  it('does not record the parish address as the purchaser\'s email', async () => {
    await post({
      purchaser_email: '',
      items: [{ product_key: product.product_key, size: 'S', quantity: 1 }]
    });

    expect((await MerchOrder.findOne()).purchaser_email).toBeNull();
  });

  it('rejects an order with no items', async () => {
    const res = await post({ items: [] });

    expect(res.status).toBe(400);
    expect(await MerchOrder.count()).toBe(0);
  });

  // The whole order is refused, so nothing half-valid reaches Stripe and no
  // pending row is orphaned.
  it('rejects a size the catalog does not carry and writes nothing', async () => {
    const res = await post({ items: [{ product_key: product.product_key, size: 'XXXXL', quantity: 1 }] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockSessionCreate).not.toHaveBeenCalled();
    expect(await MerchOrder.count()).toBe(0);
    expect(await MerchOrderItem.count()).toBe(0);
  });

  it('rejects a quantity above the per-size maximum', async () => {
    const res = await post({
      items: [{ product_key: product.product_key, size: 'S', quantity: product.max_quantity_per_size + 1 }]
    });

    expect(res.status).toBe(400);
    expect(await MerchOrder.count()).toBe(0);
  });
});

describe('POST /api/merch/checkout-session — order creation', () => {
  it('creates a pending order with its items and returns the checkout url', async () => {
    const res = await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 2 }, { product_key: product.product_key, size: 'L', quantity: 1 }] });

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
    await post({ items: [{ product_key: product.product_key, size: 'L', quantity: 1, unit_amount: 1 }] });

    const order = await MerchOrder.findOne();
    expect(Number(order.subtotal)).toBeCloseTo(priceOf('L') / 100, 2);

    const args = mockSessionCreate.mock.calls[0][0];
    const shirtLine = args.line_items.find((l) => l.price_data.unit_amount === priceOf('L'));
    expect(shirtLine).toBeDefined();
  });

  it('opens the session in payment mode and carries the merchandise metadata', async () => {
    await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 1 }] });

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
    await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 1 }] });

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
    await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 1 }] });

    const args = mockSessionCreate.mock.calls[0][0];
    expect(args.wallet_options).toEqual({ link: { display: 'never' } });
  });

  it('does not enable the buy-now-pay-later methods', async () => {
    await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 1 }] });

    const methods = mockSessionCreate.mock.calls[0][0].payment_method_types;
    ['klarna', 'affirm', 'afterpay_clearpay', 'cashapp', 'link'].forEach((m) => {
      expect(methods).not.toContain(m);
    });
  });

  // Pickup at the church or the event only — collecting a shipping address
  // would promise a service the parish is not offering.
  it('does not collect a shipping address', async () => {
    await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 1 }] });

    const args = mockSessionCreate.mock.calls[0][0];
    expect(args.shipping_address_collection).toBeUndefined();
  });

  it('adds a tax line and records the tax on the order in manual mode', async () => {
    await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 2 }] });

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
    await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 2 }] });
    return MerchOrder.findOne();
  }

  // Only reachable if a session is ever opened without customer_email; kept so
  // a phone-only order still ends up with the address the receipt went to.
  it('stores the email Stripe collected when the purchaser gave none', async () => {
    await post({
      purchaser_email: '',
      items: [{ product_key: product.product_key, size: 'S', quantity: 1 }]
    });
    const order = await MerchOrder.findOne();
    expect(order.purchaser_email).toBeNull();

    await deliver(completedEvent(order, {
      customer_details: { name: order.purchaser_name, email: 'collected.at.stripe@example.org' }
    }));

    await order.reload();
    expect(order.status).toBe('paid');
    expect(order.purchaser_email).toBe('collected.at.stripe@example.org');
  });

  // The session was pre-filled with the parish's address, so that is what
  // Stripe reports back. It is not the purchaser's, and the admin list must not
  // show it as though it were.
  it('does not store the parish fallback address as the purchaser\'s', async () => {
    await post({
      purchaser_email: '',
      items: [{ product_key: product.product_key, size: 'S', quantity: 1 }]
    });
    const order = await MerchOrder.findOne();

    await deliver(completedEvent(order, {
      customer_details: { name: order.purchaser_name, email: 'AbuneAregawiTX@gmail.com' }
    }));

    await order.reload();
    expect(order.status).toBe('paid');
    expect(order.purchaser_email).toBeNull();
  });

  // The address someone typed on the parish's own form is the one they chose to
  // give the church. Stripe's must not quietly replace it.
  it('does not overwrite an email the purchaser gave us', async () => {
    const order = await pendingOrder();
    expect(order.purchaser_email).toBe('test.purchaser@example.org');

    await deliver(completedEvent(order, {
      customer_details: { name: order.purchaser_name, email: 'different.at.stripe@example.org' }
    }));

    await order.reload();
    expect(order.purchaser_email).toBe('test.purchaser@example.org');
  });

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

describe('inventory', () => {
  const stockOf = async (productKey, size) =>
    (await MerchInventory.findOne({
      where: { event_key: OCTOBER_5K_EVENT_KEY, product_key: productKey, size }
    })).quantity;
  const setStock = (productKey, size, quantity) => MerchInventory.update(
    { quantity },
    { where: { event_key: OCTOBER_5K_EVENT_KEY, product_key: productKey, size } }
  );
  const expiredEvent = (order) => ({
    id: 'evt_merch_expired',
    type: 'checkout.session.expired',
    data: {
      object: {
        id: order.stripe_checkout_session_id,
        object: 'checkout.session',
        status: 'expired',
        payment_status: 'unpaid',
        metadata: { order_id: String(order.id), event_key: OCTOBER_5K_EVENT_KEY, purpose: 'merchandise_sale' }
      }
    }
  });

  // Taken when checkout STARTS, not when payment lands: otherwise two people
  // could both be paying for the last shirt of a size.
  it('takes the shirts off the count when checkout starts', async () => {
    await post({ items: [
      { product_key: product.product_key, size: 'S', quantity: 3 },
      { product_key: YOUTH.product_key, size: 'M', quantity: 2 }
    ] });

    expect(await stockOf(product.product_key, 'S')).toBe(97);
    expect(await stockOf(YOUTH.product_key, 'M')).toBe(98);
    expect(await stockOf(product.product_key, 'L')).toBe(100);
  });

  it('records which product each order line is, so its stock can be returned', async () => {
    await post({ items: [{ product_key: YOUTH.product_key, size: 'S', quantity: 1 }] });

    const item = await MerchOrderItem.findOne();
    expect(item.product_key).toBe(YOUTH.product_key);
  });

  it('refuses more than are left, says how many are, and takes nothing', async () => {
    await setStock(product.product_key, 'L', 2);

    const res = await post({ items: [{ product_key: product.product_key, size: 'L', quantity: 3 }] });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/only 2 left/i);
    expect(res.body.available).toBe(2);
    expect(await stockOf(product.product_key, 'L')).toBe(2);
    expect(await MerchOrder.count()).toBe(0);
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('refuses a sold-out size', async () => {
    await setStock(YOUTH.product_key, 'L', 0);

    const res = await post({ items: [{ product_key: YOUTH.product_key, size: 'L', quantity: 1 }] });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/sold out/i);
  });

  it('sells the very last shirt of a size', async () => {
    await setStock(YOUTH.product_key, 'L', 1);

    const res = await post({ items: [{ product_key: YOUTH.product_key, size: 'L', quantity: 1 }] });

    expect(res.status).toBe(200);
    expect(await stockOf(YOUTH.product_key, 'L')).toBe(0);
  });

  // The first line's stock was already taken when the second line failed; the
  // transaction has to put it back, or a refused order still eats shirts.
  it('puts back every line of an order that one sold-out line refused', async () => {
    await setStock(YOUTH.product_key, 'L', 0);

    const res = await post({ items: [
      { product_key: product.product_key, size: 'S', quantity: 4 },
      { product_key: YOUTH.product_key, size: 'L', quantity: 1 }
    ] });

    expect(res.status).toBe(409);
    expect(await stockOf(product.product_key, 'S')).toBe(100);
  });

  it('treats a size with no stock record as sold out, not unlimited', async () => {
    await MerchInventory.destroy({ where: { product_key: product.product_key, size: 'S' } });

    const res = await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 1 }] });

    expect(res.status).toBe(409);
  });

  it('gives the shirts back when Stripe could not open the checkout', async () => {
    mockSessionCreate.mockRejectedValueOnce(new Error('Stripe is down'));

    const res = await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 5 }] });

    expect(res.status).toBe(500);
    expect(await stockOf(product.product_key, 'S')).toBe(100);
    expect((await MerchOrder.findOne()).status).toBe('canceled');
  });

  it('holds the shirts for about half an hour, not Stripe\'s default day', async () => {
    const before = Math.floor(Date.now() / 1000);
    await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 1 }] });

    const { expires_at: expiresAt } = mockSessionCreate.mock.calls[0][0];
    // Stripe refuses anything under 30 minutes.
    expect(expiresAt - before).toBeGreaterThanOrEqual(30 * 60);
    expect(expiresAt - before).toBeLessThanOrEqual(35 * 60);
  });

  it('puts an abandoned checkout\'s shirts back on sale when it expires', async () => {
    await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 3 }] });
    const order = await MerchOrder.findOne();

    const res = await deliver(expiredEvent(order));

    expect(res.status).toBe(200);
    expect((await MerchOrder.findByPk(order.id)).status).toBe('expired');
    expect(await stockOf(product.product_key, 'S')).toBe(100);
  });

  // Stripe delivers at least once. Returning stock twice would conjure shirts.
  it('returns the stock only once when the expiry is delivered twice', async () => {
    await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 3 }] });
    const order = await MerchOrder.findOne();

    await deliver(expiredEvent(order));
    await deliver(expiredEvent(order));

    expect(await stockOf(product.product_key, 'S')).toBe(100);
  });

  it('keeps a paid order\'s shirts sold', async () => {
    await post({ items: [{ product_key: product.product_key, size: 'S', quantity: 3 }] });
    const order = await MerchOrder.findOne();

    await deliver(completedEvent(order));
    await deliver(expiredEvent(order));

    expect((await MerchOrder.findByPk(order.id)).status).toBe('paid');
    expect(await stockOf(product.product_key, 'S')).toBe(97);
  });

  it('tells the order page what is left of every size', async () => {
    await setStock(YOUTH.product_key, 'M', 7);
    await MerchInventory.destroy({ where: { product_key: product.product_key, size: 'L' } });

    const res = await request(buildPublicApp()).get('/api/merch/catalog');

    const sizeOf = (productKey, size) =>
      res.body.products.find((p) => p.product_key === productKey).sizes.find((s) => s.size === size);
    expect(sizeOf(YOUTH.product_key, 'M').available).toBe(7);
    expect(sizeOf(product.product_key, 'S').available).toBe(100);
    expect(sizeOf(product.product_key, 'L').available).toBe(0);
  });
});

describe('GET /api/merch/catalog — Tigrigna', () => {
  it('names every product in Tigrigna as well as English', async () => {
    const res = await request(buildPublicApp()).get('/api/merch/catalog');

    for (const p of res.body.products) {
      expect(p.product_name).toBeTruthy();
      expect(p.product_name_ti).toBeTruthy();
      expect(p.product_name_ti).not.toBe(p.product_name);
    }
  });
});
