const { Op } = require('sequelize');
const {
  isSquareConfigured, verifySquareSignature, listSquarePayments
} = require('../services/squareClient');
const {
  upsertSquarePayment, createSquareTransaction
} = require('../services/squarePaymentService');
const { SquarePayment, Member, Transaction } = require('../models');

// POST /api/square/webhook  (raw body, public, signature-verified)
async function handleWebhook(req, res) {
  const signature = req.headers['x-square-hmacsha256-signature'];
  const rawBody = req.body; // Buffer, thanks to express.raw

  if (!verifySquareSignature(rawBody, signature)) {
    return res.status(400).send('Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  try {
    if (event.type === 'payment.created' || event.type === 'payment.updated') {
      const payment = event?.data?.object?.payment;
      if (payment) await upsertSquarePayment(payment);
    } else {
      // refunds, disputes, etc. — acknowledged, no action in v1
      console.log(`Unhandled Square event type: ${event.type}`);
    }
    return res.json({ received: true });
  } catch (error) {
    console.error('Square webhook handler error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

// POST /api/square/sync  Body: { beginTime?, endTime? }
async function syncFromSquare(req, res) {
  try {
    if (!isSquareConfigured()) {
      return res.status(400).json({ success: false, message: 'Square is not configured' });
    }
    const { beginTime, endTime } = req.body || {};
    const payments = await listSquarePayments({ beginTime, endTime });
    let created = 0, seen = 0;
    for (const p of payments) {
      const { row, created: wasCreated } = await upsertSquarePayment(p);
      if (row) { seen += 1; if (wasCreated) created += 1; }
    }
    return res.json({ success: true, stats: { fetched: payments.length, ingested: seen, created } });
  } catch (error) {
    console.error('Square sync error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/square/queue?status=&limit=
async function getQueue(req, res) {
  try {
    const { status } = req.query;
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const where = {};
    if (status) {
      where.status = String(status).toUpperCase();
    } else {
      // No explicit status requested: default to the review queue (pending
      // items only) rather than returning every row ever ingested.
      where.status = { [Op.in]: ['NEEDS_REVIEW', 'AUTO_MATCHED'] };
    }
    const rows = await SquarePayment.findAll({
      where,
      attributes: { exclude: ['raw'] },
      order: [['square_created_at', 'DESC'], ['created_at', 'DESC']],
      limit,
      include: [
        { model: Member, as: 'matchedMember', attributes: ['id', 'first_name', 'last_name'] },
        { model: Transaction, as: 'transaction', attributes: ['id', 'amount', 'payment_type', 'payment_date', 'receipt_number'] }
      ]
    });
    return res.json({ success: true, count: rows.length, items: rows });
  } catch (error) {
    console.error('Square queue list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function processReview(item, user) {
  const {
    square_payment_id, note,
    member_id, payment_type, for_year, receipt_number, buyer_name
  } = item || {};
  const collected_by = user?.id || null;
  if (!collected_by) throw new Error('Missing collector context');

  // Server-authoritative amount/date: never trust the client's amount or
  // payment_date for what actually gets recorded — pull them from the
  // ingested SquarePayment row instead. This closes the gap where a
  // tampered review-form POST could record a different amount/date than
  // what Square actually reported for the payment.
  const squarePaymentRow = square_payment_id
    ? await SquarePayment.findOne({ where: { square_payment_id } })
    : null;
  if (!squarePaymentRow) {
    return { success: false, message: 'Unknown Square payment' };
  }
  const amount = squarePaymentRow.amount;
  const payment_date = squarePaymentRow.square_created_at
    ? new Date(squarePaymentRow.square_created_at).toISOString().slice(0, 10)
    : null;

  const result = await createSquareTransaction({
    square_payment_id, amount, payment_date, note,
    member_id, payment_type, for_year, receipt_number, buyer_name
  }, collected_by);

  if (result.success) {
    try {
      await squarePaymentRow.update({
        status: 'CREATED',
        transaction_id: result.id,
        matched_member_id: member_id || null,
        processed_at: new Date(),
        error: null
      });
    } catch (e) {
      console.warn('Square queue update warning:', e.message || e);
    }
  }
  return result;
}

// POST /api/square/reconcile/create-transaction
async function createTransactionFromReview(req, res) {
  try {
    const result = await processReview(req.body || {}, req.user);
    if (!result.success && result.code === 'EXISTS') return res.status(409).json(result);
    return res.json(result);
  } catch (error) {
    console.error('Square create-transaction error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/square/reconcile/batch-create  Body: { items: [...] }
async function createBatchTransactions(req, res) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items array is required' });
    }
    const results = [];
    for (const item of items) {
      try {
        const result = await processReview(item, req.user);
        results.push({ ...result, square_payment_id: item.square_payment_id });
      } catch (e) {
        results.push({ success: false, message: e.message, square_payment_id: item.square_payment_id });
      }
    }
    return res.json({ success: true, results });
  } catch (error) {
    console.error('Square batch create error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/square/queue/:id/ignore
async function ignoreQueueItem(req, res) {
  try {
    const row = await SquarePayment.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Queue item not found' });
    if (row.status === 'CREATED') {
      return res.status(400).json({ success: false, message: 'Cannot ignore a payment that already has a transaction' });
    }
    await row.update({ status: 'IGNORED', processed_at: new Date() });
    return res.json({ success: true });
  } catch (error) {
    console.error('Square queue ignore error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  handleWebhook,
  syncFromSquare,
  getQueue,
  createTransactionFromReview,
  createBatchTransactions,
  ignoreQueueItem
};
