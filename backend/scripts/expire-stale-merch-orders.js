/**
 * One-time cleanup: expires merchandise orders stuck in `pending` because the
 * Stripe `checkout.session.expired` webhook never reached us (the event was not
 * subscribed on the merch endpoint).
 *
 * Asks Stripe about each order's Checkout Session and only acts when Stripe
 * itself reports the session `expired`. Anything else is listed and left alone:
 *   - `complete` — the purchaser PAID; the order needs the paid webhook
 *     replayed from the Stripe dashboard, not expiring.
 *   - `open`     — still a live checkout.
 *   - no session id, or Stripe cannot find it — needs a human look.
 *
 * Expiring goes through merchInventoryService.releasePendingOrder, the same
 * path the webhook uses, so held shirts go back into stock and a second run
 * (or a late webhook) is a no-op.
 *
 * Dry run by default. From backend/:
 *   node scripts/expire-stale-merch-orders.js            # report only
 *   node scripts/expire-stale-merch-orders.js --apply    # actually expire
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Op } = require('sequelize');
const { MerchOrder, sequelize } = require('../src/models');
const inventory = require('../src/services/merchInventoryService');

// Stripe's own hold is 31 minutes; an hour leaves no doubt the session is over.
const MIN_AGE_MS = 60 * 60 * 1000;

async function main() {
  const apply = process.argv.includes('--apply');

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set');
    process.exit(1);
  }
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  const orders = await MerchOrder.findAll({
    where: {
      status: 'pending',
      created_at: { [Op.lt]: new Date(Date.now() - MIN_AGE_MS) }
    },
    order: [['created_at', 'ASC']]
  });

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${orders.length} pending order(s) older than 1 hour\n`);

  let expired = 0;
  for (const order of orders) {
    const label = `order ${order.id} (created ${order.created_at.toISOString()})`;

    if (!order.stripe_checkout_session_id) {
      console.log(`SKIP ${label}: no Stripe session id — check by hand`);
      continue;
    }

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
    } catch (err) {
      console.log(`SKIP ${label}: Stripe lookup failed — ${err.message}`);
      continue;
    }

    if (session.status !== 'expired') {
      const hint = session.status === 'complete'
        ? ' — PAID at Stripe; resend checkout.session.completed from the dashboard'
        : '';
      console.log(`SKIP ${label}: Stripe session is ${session.status}${hint}`);
      continue;
    }

    if (!apply) {
      console.log(`WOULD EXPIRE ${label}`);
      continue;
    }

    const released = await inventory.releasePendingOrder(order.id, 'expired');
    console.log(released
      ? `EXPIRED ${label}; its shirts are back in stock`
      : `SKIP ${label}: no longer pending (a webhook got there first)`);
    if (released) expired += 1;
  }

  if (apply) console.log(`\nDone: ${expired} order(s) expired.`);
  else console.log('\nNothing changed. Re-run with --apply to expire the orders marked WOULD EXPIRE.');
}

main()
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
