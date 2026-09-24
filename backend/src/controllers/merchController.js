'use strict';

// Initialize Stripe with proper error handling (mirrors donationController).
let stripe;
try {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️  STRIPE_SECRET_KEY not found in environment variables. Merchandise checkout will be disabled.');
    stripe = null;
  } else {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch (error) {
  console.error('❌ Error initializing Stripe for merchandise:', error.message);
  stripe = null;
}

const {
  MerchOrder, MerchOrderItem, Transaction, LedgerEntry, IncomeCategory, sequelize
} = require('../models');
const { validationResult } = require('express-validator');
const { buildOrderDraft, MerchValidationError } = require('../services/merchPricingService');
const { getTaxConfig, computeTaxCents } = require('../config/merchTax');
const {
  OCTOBER_5K_EVENT_KEY, getEvent, findProduct, findSize, productSizePairs
} = require('../config/merchCatalog');
const inventory = require('../services/merchInventoryService');

/**
 * How long a checkout holds its shirts. Stripe's minimum, plus a minute of
 * slack for clock skew — Stripe rejects anything under 30 minutes. The default
 * would be 24 hours, which on the last few of a size means a single abandoned
 * tab keeps them off sale for a day.
 */
const CHECKOUT_HOLD_SECONDS = 31 * 60;

/**
 * Marks a Checkout Session as ours. The donation webhook and this one are
 * separate endpoints with separate signing secrets, but a misconfigured Stripe
 * dashboard can still point both at the same URL — this is the second check
 * that keeps a donation from being booked as a t-shirt, or the reverse.
 */
const MERCH_PURPOSE = 'merchandise_sale';

// Not 'religious_item_sales': that category is the Bibles and candles sold from
// the church year-round. Event merchandise is a fundraiser's own inventory and
// the treasurer needs the two separable without reading transaction notes.
const MERCH_PAYMENT_TYPE = 'event_merchandise';

const centsToDollars = (cents) => Math.round(cents) / 100;

/**
 * Pre-filled on the Stripe page when the purchaser gave no email, so they are
 * not asked for one there either. Stripe locks a pre-filled email, so the
 * receipt for such an order goes to this parish inbox rather than to the
 * purchaser. Never stored on the order as the purchaser's own address.
 */
const FALLBACK_RECEIPT_EMAIL = (process.env.MERCH_FALLBACK_EMAIL || 'abunearegawitx@gmail.com').trim();
const isFallbackEmail = (email) =>
  Boolean(email) && String(email).trim().toLowerCase() === FALLBACK_RECEIPT_EMAIL.toLowerCase();

/**
 * The email Stripe Checkout collected, whichever field it lands in. Null rather
 * than '' when there is none, so it can be OR'd against a stored address
 * without blanking one.
 */
function stripeEmail(session) {
  const email = (session.customer_details && session.customer_details.email)
    || session.customer_email
    || null;
  return email ? String(email).trim() || null : null;
}

function frontendBaseUrl() {
  // FRONTEND_URL may be a comma-separated allow-list (see server.js CORS).
  const first = String(process.env.FRONTEND_URL || '').split(',')[0].trim();
  return first || 'http://localhost:3000';
}

/**
 * POST /api/merch/checkout-session
 *
 * Public. Validates and prices the order server-side, writes it as `pending`,
 * then opens a Stripe Checkout Session. Nothing is booked here — the money is
 * not real until the webhook says so.
 */
const createCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: 'Online ordering is currently unavailable. Please try again later.'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      event_key: eventKey = OCTOBER_5K_EVENT_KEY,
      items,
      purchaser_name: purchaserName,
      purchaser_email: purchaserEmail,
      purchaser_phone: purchaserPhone
    } = req.body;

    // Everything that can reject the order happens before a row is written or
    // Stripe is called, so a bad request costs nothing.
    let draft;
    try {
      draft = buildOrderDraft({ eventKey, items });
    } catch (err) {
      if (err instanceof MerchValidationError) {
        return res.status(400).json({ success: false, message: err.message });
      }
      throw err;
    }

    const { event, lineItems, subtotalCents } = draft;
    const taxCents = computeTaxCents(subtotalCents);
    const { mode: taxMode, rateBps } = getTaxConfig();
    const totalCents = subtotalCents + taxCents;

    // The order, its lines and the stock they take all commit together: a header
    // with no sizes on it is useless to whoever is packing shirts, and a shirt
    // taken off the shelf for an order that was never written is lost for good.
    let order;
    try {
      order = await sequelize.transaction(async (t) => {
        await inventory.reserve(event.event_key, lineItems, t);

        const created = await MerchOrder.create({
          purchaser_name: purchaserName.trim(),
          purchaser_email: purchaserEmail ? String(purchaserEmail).trim() : null,
          purchaser_phone: String(purchaserPhone).trim(),
          status: 'pending',
          fulfillment_status: 'unfulfilled',
          subtotal: centsToDollars(subtotalCents),
          tax: centsToDollars(taxCents),
          total: centsToDollars(totalCents),
          currency: event.currency,
          event_key: event.event_key
        }, { transaction: t });

        await MerchOrderItem.bulkCreate(lineItems.map((line) => ({
          order_id: created.id,
          product_name: line.product_name,
          product_key: line.product_key,
          size: line.size,
          quantity: line.quantity,
          unit_amount: centsToDollars(line.unit_amount),
          total_amount: centsToDollars(line.total_amount)
        })), { transaction: t });

        return created;
      });
    } catch (err) {
      if (err instanceof inventory.MerchOutOfStockError) {
        return res.status(409).json({
          success: false,
          message: err.message,
          product_key: err.product_key,
          size: err.size,
          available: err.available
        });
      }
      throw err;
    }

    const stripeLineItems = lineItems.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: event.currency,
        unit_amount: line.unit_amount,
        product_data: {
          name: `${line.product_name} — Size ${line.size}`,
          description: event.description
        }
      }
    }));

    // Manual mode bills tax as its own visible line rather than via a Stripe
    // TaxRate object, so the parish needs no Stripe Tax setup and the purchaser
    // still sees what they are being charged. In automatic mode Stripe adds its
    // own tax line and computeTaxCents returns 0, so nothing is charged twice.
    if (taxMode === 'manual' && taxCents > 0) {
      stripeLineItems.push({
        quantity: 1,
        price_data: {
          currency: event.currency,
          unit_amount: taxCents,
          product_data: { name: `Sales Tax (${(rateBps / 100).toFixed(2)}%)` }
        }
      });
    }

    const sessionParams = {
      mode: 'payment',
      line_items: stripeLineItems,
      // Cards only, and stated explicitly.
      //
      // Omitting this hands the decision to Stripe's DYNAMIC payment methods,
      // which render whatever the dashboard has enabled — Klarna, Affirm, Cash
      // App, Link. That put buy-now-pay-later financing on a $25 parish
      // fundraiser shirt, which the church does not offer, and it meant a
      // dashboard toggle could change the checkout page with no deploy.
      //
      // The donation flow has always pinned cards the same way (see
      // donationController's paymentIntents.create), so this keeps the two
      // consistent. ACH is deliberately not offered here: it settles days
      // later, and these shirts are collected in person.
      payment_method_types: ['card'],
      // No Link, and therefore no "Save my information for faster checkout"
      // opt-in — that prompt asks someone buying one t-shirt to create a
      // Stripe-wide account, which is not what a parish fundraiser should be
      // pushing. The donation and pledge pages use a plain CardElement and show
      // neither, so this keeps merch consistent with them.
      //
      // This is the only lever hosted Checkout gives: there is no parameter to
      // move wallets BELOW the card form. Apple Pay has no per-session control
      // at all and is turned off in the Stripe Dashboard (Checkout settings →
      // Use Apple Pay), since it rides along with the `card` type.
      wallet_options: { link: { display: 'never' } },
      // The purchaser's own email when they gave one, otherwise the parish
      // inbox — see FALLBACK_RECEIPT_EMAIL.
      customer_email: purchaserEmail ? String(purchaserEmail).trim() : FALLBACK_RECEIPT_EMAIL,
      // Pickup only — no shipping_address_collection, deliberately. The parish
      // hands these over at the church or at the event.
      success_url: `${frontendBaseUrl()}/merch/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendBaseUrl()}/merch?canceled=1`,
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_HOLD_SECONDS,
      metadata: {
        order_id: String(order.id),
        event_key: event.event_key,
        purpose: MERCH_PURPOSE
      }
    };

    if (taxMode === 'automatic') {
      sessionParams.automatic_tax = { enabled: true };
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (stripeErr) {
      // The pending row would otherwise sit in the admin list forever looking
      // like an order someone abandoned at the payment screen — and, worse,
      // keep its shirts off sale with no Stripe session ever coming to expire.
      await inventory.releasePendingOrder(order.id, 'canceled').catch((releaseErr) => {
        console.error(`❌ Could not return stock for merch order ${order.id}:`, releaseErr.message);
      });
      throw stripeErr;
    }

    await order.update({ stripe_checkout_session_id: session.id });

    return res.status(200).json({
      success: true,
      url: session.url,
      session_id: session.id,
      order_id: order.id
    });
  } catch (error) {
    console.error('❌ Error creating merchandise checkout session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start checkout',
      error: error.message
    });
  }
};

/**
 * POST /api/merch/webhook  (mounted raw in server.js, before the body parsers)
 *
 * Its own endpoint with its own signing secret, so donation webhook behaviour is
 * untouched by anything here.
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_MERCH_WEBHOOK_SECRET;

  if (!stripe) {
    return res.status(503).send('Stripe is not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Merch webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'checkout.session.expired':
        await handleCheckoutExpired(event.data.object);
        break;
      default:
        console.log(`Unhandled merch event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    // A non-2xx is the only thing that makes Stripe redeliver. The write below
    // is idempotent, so a retry is always safe and is strictly better than
    // losing a paid order.
    console.error('Error handling merch webhook:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
};

/**
 * Books a paid Checkout Session.
 *
 * Idempotent on three independent levels, because Stripe delivers at least once
 * and redelivers on every non-2xx:
 *   1. an order already marked `paid` returns immediately;
 *   2. the Transaction is looked up by `external_id` (the payment intent),
 *      which carries a UNIQUE index;
 *   3. the LedgerEntry is looked up by `transaction_id`.
 */
async function handleCheckoutCompleted(session) {
  const metadata = session.metadata || {};

  // Not ours. Never touch an order — or a donation — we did not create.
  if (metadata.purpose !== MERCH_PURPOSE) {
    console.log(`ℹ️  Ignoring checkout session ${session.id}: purpose is not ${MERCH_PURPOSE}`);
    return;
  }

  // 'unpaid' is a session that completed with the money still in flight. It is
  // not revenue yet; async_payment_succeeded will arrive when it is.
  if (session.payment_status !== 'paid') {
    console.log(`ℹ️  Merch session ${session.id} completed with payment_status=${session.payment_status}; not booking it.`);
    return;
  }

  const order = await MerchOrder.findByPk(metadata.order_id, {
    include: [{ model: MerchOrderItem, as: 'items' }]
  });

  // Acknowledged on purpose: retrying cannot conjure up an order row, so a 500
  // here would just make Stripe redeliver for three days and alert on nothing.
  if (!order) {
    console.error(`❌ Merch webhook: no order ${metadata.order_id} for session ${session.id}`);
    return;
  }

  if (order.status === 'paid') {
    console.log(`ℹ️  Merch order ${order.id} is already paid; ignoring redelivery of ${session.id}`);
    return;
  }

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent && session.payment_intent.id) || null;

  // The TOTAL always comes from Stripe — that is what the parish was actually
  // paid, and no local arithmetic outranks it.
  const total = Number.isFinite(session.amount_total)
    ? centsToDollars(session.amount_total) : Number(order.total);

  // The SPLIT is a different question, and Stripe is only authoritative on it
  // when Stripe computed the tax.
  //
  // In manual mode we bill tax as one of our own line items, so Stripe folds it
  // into `amount_subtotal` and reports `total_details.amount_tax: 0` — it has no
  // idea that line is tax. Taking Stripe's split there (as this once did) zeroed
  // the tax on every paid order and inflated the subtotal to the gross, leaving
  // the treasurer no way to see what sales tax was collected.
  //
  // Keyed off the reported tax rather than MERCH_TAX_MODE so that an order
  // checked out under one mode still books correctly if the mode is changed
  // before the webhook arrives: a non-zero amount_tax means Stripe itemised the
  // tax itself and its split is the real one.
  const stripeTaxCents = session.total_details && Number.isFinite(session.total_details.amount_tax)
    ? session.total_details.amount_tax
    : 0;

  let subtotal;
  let tax;
  if (stripeTaxCents > 0) {
    subtotal = centsToDollars(session.amount_subtotal);
    tax = centsToDollars(stripeTaxCents);
  } else {
    subtotal = Number(order.subtotal);
    tax = Number(order.tax);
  }

  // A split that does not add up to what was charged means the catalog price
  // changed between checkout and payment, or the tax config moved. The money is
  // still recorded correctly (total wins); this is for whoever reconciles.
  if (Math.abs((subtotal + tax) - total) > 0.005) {
    console.warn(
      `⚠️  Merch order ${order.id}: subtotal ${subtotal} + tax ${tax} != charged total ${total}. ` +
      'Recording the charged total; the split may need review.'
    );
  }

  const paidAt = new Date((session.created || Math.floor(Date.now() / 1000)) * 1000);
  const sizeSummary = (order.items || [])
    .map((item) => `${item.size}×${item.quantity}`)
    .join(', ');

  const note = [
    `Event merchandise sale — ${order.event_key}`,
    sizeSummary ? `(${sizeSummary})` : null,
    `Stripe checkout ${session.id}`,
    `subtotal $${subtotal.toFixed(2)}, sales tax $${tax.toFixed(2)}`
  ].filter(Boolean).join(' | ');

  // The order and the transaction commit together: an order marked paid with
  // no transaction behind it is money the treasurer's reports cannot see, and
  // a transaction with no paid order is a shirt nobody knows to hand over.
  const transaction = await sequelize.transaction(async (t) => {
    let txn = paymentIntentId
      ? await Transaction.findOne({ where: { external_id: paymentIntentId }, transaction: t })
      : null;

    if (!txn) {
      txn = await Transaction.create({
        member_id: null,
        // A purchase, not a gift. Leaving member_id null is what keeps this out
        // of giving statements and away from pledge allocation.
        collected_by: null,
        payment_date: paidAt,
        amount: total,
        payment_type: MERCH_PAYMENT_TYPE,
        payment_method: 'credit_card',
        note,
        donor_name: order.purchaser_name,
        external_id: paymentIntentId,
        status: 'succeeded'
      }, { transaction: t });
    }

    await order.update({
      status: 'paid',
      stripe_payment_intent_id: paymentIntentId,
      stripe_checkout_session_id: order.stripe_checkout_session_id || session.id,
      // Email is optional on the order form, but Stripe Checkout collects one
      // of its own before taking payment. Keeping it means a phone-only order
      // still leaves the parish a way to reach the purchaser, and the admin
      // list shows the address the receipt actually went to.
      //
      // Only ever fills a blank — an address the purchaser typed on our form is
      // the one they chose to give the church, and Stripe's must not overwrite it.
      //
      // Nor is the parish's own fallback address: that is what Stripe reports
      // back for an order whose purchaser gave no email, and it is not theirs.
      purchaser_email: order.purchaser_email
        || (isFallbackEmail(stripeEmail(session)) ? null : stripeEmail(session)),
      subtotal,
      tax,
      total,
      paid_at: paidAt,
      transaction_id: txn.id
    }, { transaction: t });

    return txn;
  });

  // Best-effort, exactly as the donation path treats it: a ledger failure must
  // not un-record a payment Stripe already captured, and ledger entries can be
  // backfilled from transactions. It is logged loudly instead.
  try {
    const existingLedger = await LedgerEntry.findOne({ where: { transaction_id: transaction.id } });
    if (existingLedger) return;

    const incomeCategory = await IncomeCategory.findOne({
      where: { payment_type_mapping: MERCH_PAYMENT_TYPE }
    });
    const glCode = incomeCategory ? incomeCategory.gl_code : 'INC999';
    if (!incomeCategory) {
      console.warn(`⚠️  No income category mapped to ${MERCH_PAYMENT_TYPE}; filing under INC999.`);
    }

    await LedgerEntry.create({
      type: MERCH_PAYMENT_TYPE,
      category: glCode,
      amount: total,
      entry_date: paidAt,
      member_id: null,
      donor_name: order.purchaser_name,
      payment_method: 'credit_card',
      // The amount is gross, tax included, so the ledger ties to the Stripe
      // payout. The tax portion is called out here for the treasurer.
      memo: `${glCode} - Event merchandise sale ${session.id} (incl. sales tax $${tax.toFixed(2)})`,
      transaction_id: transaction.id,
      external_id: paymentIntentId
    });
  } catch (ledgerErr) {
    console.error('⚠️ Failed to create ledger entry for merchandise sale:', ledgerErr.message);
  }
}

async function handleCheckoutExpired(session) {
  const metadata = session.metadata || {};
  if (metadata.purpose !== MERCH_PURPOSE) return;

  // Only a pending order expires, and only then do its shirts go back on sale.
  // A paid one that Stripe later calls expired is not something to un-pay.
  const released = await inventory.releasePendingOrder(metadata.order_id, 'expired');
  if (released) {
    console.log(`ℹ️  Merch order ${metadata.order_id} expired; its shirts are back on sale.`);
  }
}

/**
 * GET /api/merch/orders — staff only. The fulfillment worklist.
 */
const listOrders = async (req, res) => {
  try {
    const {
      status, fulfillment_status: fulfillmentStatus,
      event_key: eventKey, page = 1, limit = 50
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (fulfillmentStatus) where.fulfillment_status = fulfillmentStatus;
    if (eventKey) where.event_key = eventKey;

    const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);

    const { count, rows } = await MerchOrder.findAndCountAll({
      where,
      include: [{ model: MerchOrderItem, as: 'items' }],
      order: [['created_at', 'DESC']],
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
      distinct: true
    });

    return res.status(200).json({
      success: true,
      orders: rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: count,
        pages: Math.ceil(count / safeLimit)
      }
    });
  } catch (error) {
    console.error('Error listing merchandise orders:', error);
    return res.status(500).json({ success: false, message: 'Failed to list orders' });
  }
};

/**
 * GET /api/merch/orders/size-summary — staff only.
 *
 * The "how many of each size do we order?" question. Counts PAID orders only:
 * a pending order is a browser tab someone left open, and printing shirts for
 * it is a real cost.
 */
const getSizeSummary = async (req, res) => {
  try {
    const eventKey = req.query.event_key || OCTOBER_5K_EVENT_KEY;

    // Grouped by product as well as size. Youth and adult shirts share size
    // letters, so summing on size alone would tell whoever places the supplier
    // order to buy the wrong garments — in exactly the right quantities.
    const rows = await MerchOrderItem.findAll({
      attributes: [
        'product_name',
        'size',
        [sequelize.fn('SUM', sequelize.col('MerchOrderItem.quantity')), 'total_quantity']
      ],
      include: [{
        model: MerchOrder,
        as: 'order',
        attributes: [],
        where: { status: 'paid', event_key: eventKey },
        required: true
      }],
      group: ['MerchOrderItem.product_name', 'MerchOrderItem.size'],
      raw: true
    });

    const keyOf = (productName, size) => `${productName}|${size}`;
    const counts = new Map(
      rows.map((r) => [keyOf(r.product_name, r.size), Number(r.total_quantity) || 0])
    );

    // Catalog order, not alphabetical, and every size present even at zero —
    // whoever places the order wants a complete, readable size run.
    const sizes = productSizePairs(getEvent(eventKey)).map(({ product_name: productName, size }) => ({
      product_name: productName,
      size,
      quantity: counts.get(keyOf(productName, size)) || 0
    }));

    // Anything sold before it left the catalog still has to be produced.
    const listed = new Set(sizes.map((s) => keyOf(s.product_name, s.size)));
    for (const row of rows) {
      if (!listed.has(keyOf(row.product_name, row.size))) {
        sizes.push({
          product_name: row.product_name,
          size: row.size,
          quantity: Number(row.total_quantity) || 0
        });
      }
    }

    return res.status(200).json({
      success: true,
      event_key: eventKey,
      sizes,
      total_shirts: sizes.reduce((sum, s) => sum + s.quantity, 0)
    });
  } catch (error) {
    console.error('Error building merchandise size summary:', error);
    return res.status(500).json({ success: false, message: 'Failed to build size summary' });
  }
};

/**
 * PATCH /api/merch/orders/:id/fulfillment — staff only.
 */
const updateFulfillment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false, message: 'Validation failed', errors: errors.array()
      });
    }

    const order = await MerchOrder.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const { fulfillment_status: fulfillmentStatus } = req.body;

    // Handing over shirts for an order that was never paid is a giveaway, not a
    // sale. Make the admin deal with the payment first.
    if (fulfillmentStatus === 'fulfilled' && order.status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: `Cannot fulfil an order that is ${order.status}.`
      });
    }

    await order.update({
      fulfillment_status: fulfillmentStatus,
      fulfilled_at: fulfillmentStatus === 'fulfilled' ? new Date() : null
    });

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Error updating merchandise fulfillment:', error);
    return res.status(500).json({ success: false, message: 'Failed to update fulfillment' });
  }
};

/**
 * GET /api/merch/catalog — public. Lets the page render sizes and price
 * without hardcoding them in the frontend.
 */
const getCatalog = async (req, res) => {
  const eventKey = req.query.event_key || OCTOBER_5K_EVENT_KEY;
  const event = getEvent(eventKey);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Unknown event' });
  }
  const { mode } = getTaxConfig();
  let available;
  try {
    available = await inventory.getAvailability(eventKey);
  } catch (error) {
    console.error('Error reading merchandise inventory:', error);
    return res.status(500).json({ success: false, message: 'Failed to load the catalog' });
  }
  return res.status(200).json({
    success: true,
    event_key: event.event_key,
    description: event.description,
    currency: event.currency,
    // Every garment the event sells. The order page renders one picker per
    // product, because a youth S and an adult S are different shirts.
    products: event.products.map((product) => ({
      product_key: product.product_key,
      product_name: product.product_name,
      product_name_ti: product.product_name_ti || null,
      // Each size carries its own price; there is no product-wide unit_amount.
      // `available` lets the page grey out a sold-out size and stop the
      // quantity box at what is left. The server still re-checks at checkout:
      // this number can be stale by the time the purchaser presses the button.
      sizes: product.sizes.map((s) => ({
        size: s.size,
        unit_amount: s.unit_amount,
        available: available.get(inventory.cellKey(product.product_key, s.size)) || 0
      })),
      max_quantity_per_size: product.max_quantity_per_size
    })),
    // The page says "tax calculated at checkout" rather than showing a number
    // it would have to keep in step with the server.
    tax_applies: mode !== 'none'
  });
};

/**
 * GET /api/merch/inventory — staff only.
 *
 * Every catalog size with what is left to sell and what open checkouts are
 * holding. Catalog order, and every size present even at zero.
 */
const listInventory = async (req, res) => {
  try {
    const eventKey = req.query.event_key || OCTOBER_5K_EVENT_KEY;
    const event = getEvent(eventKey);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Unknown event' });
    }

    const [available, held] = await Promise.all([
      inventory.getAvailability(eventKey),
      inventory.getHeld(eventKey)
    ]);

    const items = productSizePairs(event).map(({ product_key: productKey, product_name: productName, size }) => {
      const key = inventory.cellKey(productKey, size);
      return {
        product_key: productKey,
        product_name: productName,
        size,
        quantity: available.get(key) || 0,
        held: held.get(key) || 0
      };
    });

    return res.status(200).json({ success: true, event_key: eventKey, items });
  } catch (error) {
    console.error('Error listing merchandise inventory:', error);
    return res.status(500).json({ success: false, message: 'Failed to load inventory' });
  }
};

/**
 * PUT /api/merch/inventory/:product_key/:size — staff only.
 *
 * Body: { quantity, expected_quantity }. Sets the count outright — after cash
 * sales or a recount. `expected_quantity` is the number the admin was looking
 * at; if an online sale moved it since, the write is refused with a 409 and the
 * current count, so a cash-sale adjustment never silently undoes a card sale.
 */
const updateInventory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false, message: 'Validation failed', errors: errors.array()
      });
    }

    const eventKey = req.body.event_key || OCTOBER_5K_EVENT_KEY;
    const { product_key: productKey, size } = req.params;
    const event = getEvent(eventKey);
    const product = findProduct(event, productKey);
    if (!product || !findSize(product, size)) {
      return res.status(404).json({ success: false, message: 'That product and size is not in the catalog.' });
    }

    const result = await inventory.setQuantity({
      eventKey,
      productKey,
      size,
      quantity: Number(req.body.quantity),
      expectedQuantity: req.body.expected_quantity,
      updatedBy: (req.user && (req.user.email || req.user.phone_number || String(req.user.id))) || null
    });

    if (!result.ok) {
      return res.status(409).json({
        success: false,
        message: `The count changed to ${result.current} while you were editing — an online order came in. Check the number and save again.`,
        current: result.current
      });
    }

    return res.status(200).json({
      success: true,
      item: {
        product_key: productKey,
        product_name: product.product_name,
        size,
        quantity: result.row.quantity
      }
    });
  } catch (error) {
    console.error('Error updating merchandise inventory:', error);
    return res.status(500).json({ success: false, message: 'Failed to update inventory' });
  }
};

module.exports = {
  createCheckoutSession,
  listInventory,
  updateInventory,
  handleWebhook,
  listOrders,
  getSizeSummary,
  updateFulfillment,
  getCatalog
};
