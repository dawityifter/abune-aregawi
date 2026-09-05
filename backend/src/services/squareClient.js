/**
 * Square integration helpers: config guard, webhook signature verification,
 * payment normalization, and the ListPayments backfill fetch. No SDK — uses
 * Node's built-in crypto and global fetch against the Square REST API.
 */
const crypto = require('crypto');

function isSquareConfigured() {
  return Boolean(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY && process.env.SQUARE_WEBHOOK_URL);
}

/**
 * Square signs (notification URL + raw request body) with HMAC-SHA256 using the
 * webhook signature key, base64-encoded, sent in the
 * `x-square-hmacsha256-signature` header. Constant-time compare.
 */
function verifySquareSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const url = process.env.SQUARE_WEBHOOK_URL;
  if (!key || !url) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = crypto.createHmac('sha256', key).update(url + body).digest('base64');

  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Map a Square payment object to square_payments column values.
 * Returns null when there is no payment id.
 */
function normalizeSquarePayment(payment) {
  if (!payment || !payment.id) return null;
  const amountMoney = payment.amount_money || {};
  const cardDetails = payment.card_details || {};
  const card = cardDetails.card || {};
  const buyerName =
    (payment.shipping_address && payment.shipping_address.name) ||
    (payment.billing_address && payment.billing_address.name) ||
    null;

  return {
    square_payment_id: payment.id,
    order_id: payment.order_id || null,
    location_id: payment.location_id || null,
    amount: typeof amountMoney.amount === 'number' ? amountMoney.amount / 100.0 : null,
    currency: amountMoney.currency || null,
    square_created_at: payment.created_at ? new Date(payment.created_at) : null,
    buyer_name: buyerName,
    buyer_email: payment.buyer_email_address || null,
    note: payment.note || null,
    card_brand: card.card_brand || null,
    card_last4: card.last_4 || null,
    status: payment.status || null
  };
}

function squareApiBase() {
  return process.env.SQUARE_ENV === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

/**
 * Fetch payments in a time window via the Square REST API (paginated).
 * Throws if SQUARE_ACCESS_TOKEN is not set.
 */
async function listSquarePayments({ beginTime, endTime }) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN is not configured');

  const MAX_PAGES = 50; // safety cap against an unbounded loop if Square keeps returning a cursor

  const results = [];
  let cursor = null;
  let page = 0;
  do {
    const params = new URLSearchParams();
    if (beginTime) params.set('begin_time', beginTime);
    if (endTime) params.set('end_time', endTime);
    if (cursor) params.set('cursor', cursor);

    const resp = await fetch(`${squareApiBase()}/v2/payments?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Square-Version': '2024-01-18',
        'Content-Type': 'application/json'
      }
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Square ListPayments failed: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    if (Array.isArray(data.payments)) results.push(...data.payments);
    cursor = data.cursor || null;
    page += 1;
  } while (cursor && page < MAX_PAGES);

  return results;
}

module.exports = {
  isSquareConfigured,
  verifySquareSignature,
  normalizeSquarePayment,
  listSquarePayments
};
