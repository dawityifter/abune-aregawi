const { syncZelleFromGmail, previewZelleFromGmail } = require('../services/gmailZelleIngest');
const {
  createZelleTransaction,
  extractPayerName,
  matchQueueRowToMember
} = require('../services/zelleTransactionService');
const { ZelleEmailQueue, Member, Transaction, sequelize } = require('../models');
const { isZelleGmailCreateEnabled } = require('../config/featureFlags');
const { Op } = require('sequelize');

async function syncFromGmail(req, res) {
  try {
    const dryRun = String(req.query.dryRun || 'false').toLowerCase() === 'true';
    const stats = await syncZelleFromGmail({ dryRun });
    return res.json({ success: true, dryRun, stats });
  } catch (error) {
    console.error('Zelle Gmail sync error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function previewFromGmail(req, res) {
  try {
    const limit = Number(req.query.limit || 5);
    const data = await previewZelleFromGmail({ limit });
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('Zelle Gmail preview error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// Helper to process a single transaction creation (delegates to shared service)
async function processTransactionCreation(item, user) {
  const {
    external_id, amount, payment_date, note,
    member_id, payment_type, for_year, receipt_number, payer_name
  } = item || {};

  const collected_by = user?.id || null;
  if (!collected_by) {
    throw new Error('Missing collector context');
  }

  const result = await createZelleTransaction({
    external_id,
    amount,
    payment_date,
    note,
    member_id,
    payment_type,
    for_year,
    receipt_number,
    // Fall back to extracting the payer from the note so learning still
    // produces stable keys when the client doesn't send payer_name
    payer_name: payer_name || extractPayerName(note || '')
  }, collected_by);

  // Keep the email queue in sync when the treasurer creates manually.
  // UPSERT (not update): the preview flow never persists queue rows, and this
  // row is the rename-immune record that blocks double-posting the same
  // payment after bank reconciliation renames the transaction's external_id.
  if (result.success && external_id) {
    try {
      const queueFields = {
        status: 'CREATED',
        transaction_id: result.id,
        matched_member_id: member_id || null,
        processed_at: new Date(),
        error: null
      };
      const [row, created] = await ZelleEmailQueue.findOrCreate({
        where: { external_id },
        defaults: {
          ...queueFields,
          amount: amount || null,
          payment_date: payment_date || null,
          note: note || null,
          payer_name: payer_name || extractPayerName(note || '') || null
        }
      });
      if (!created) {
        await row.update(queueFields);
      }
    } catch (e) {
      console.warn('Zelle queue update warning:', e.message || e);
    }
  }

  return result;
}

// Match-only mode: transaction creation from the Gmail screen is disabled;
// bank reconciliation is the only path that posts money.
function creationDisabledResponse(res) {
  return res.status(403).json({
    success: false,
    code: 'CREATE_DISABLED',
    message: 'Creating transactions from Zelle emails is disabled. Match the payer to a member here, then approve the payment in Bank Reconciliation.'
  });
}

// POST /api/zelle/reconcile/create-transaction
// Body: { external_id, amount, payment_date, note, member_id, payment_type }
// Insert-only: if external_id exists, do not modify existing
async function createTransactionFromPreview(req, res) {
  if (!isZelleGmailCreateEnabled()) return creationDisabledResponse(res);
  try {
    const result = await processTransactionCreation(req.body || {}, req.user);
    if (!result.success && result.code === 'EXISTS') {
      return res.status(409).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error('Zelle reconcile create-transaction error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/zelle/reconcile/batch-create
// Body: { items: [{ external_id, amount, payment_date, note, member_id, payment_type }, ...] }
async function createBatchTransactions(req, res) {
  if (!isZelleGmailCreateEnabled()) return creationDisabledResponse(res);
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'items array is required' });
    }

    const results = [];
    for (const item of items) {
      try {
        const result = await processTransactionCreation(item, req.user);
        results.push({ ...result, external_id: item.external_id });
      } catch (e) {
        results.push({ success: false, message: e.message, external_id: item.external_id });
      }
    }

    return res.json({ success: true, results });
  } catch (error) {
    console.error('Zelle batch create error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/zelle/queue?status=NEEDS_REVIEW&search=smith&page=1&limit=50
// The treasurer's primary Zelle screen: every email the sync has recorded,
// with its current member match.
async function getQueue(req, res) {
  try {
    const { status, search } = req.query;
    // Truncate before clamping: a fractional LIMIT/OFFSET (e.g. from
    // `?page=2.5`) reaches the driver as a non-integer and both Postgres and
    // sqlite reject it (Postgres: "syntax error at or near '.'"; sqlite:
    // SQLITE_MISMATCH datatype mismatch) — this is a real cross-dialect bug,
    // not just a Postgres one, verified against both.
    const page = Math.max(Math.trunc(Number(req.query.page)) || 1, 1);
    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 50, 1), 200);

    const where = {};
    if (status) where.status = String(status).toUpperCase();

    const term = String(search || '').trim();
    if (term) {
      const likeOp = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
      const contains = { [likeOp]: `%${term}%` };
      where[Op.or] = [
        { payer_name: contains },
        { note: contains },
        { subject: contains }
      ];
    }

    const { count, rows } = await ZelleEmailQueue.findAndCountAll({
      where,
      // Unmatched work first, then most recent payments. `matched_member_id IS
      // NULL` sorts DESC in both dialects: Postgres puts TRUE first, sqlite
      // puts 1 first. A CASE expression would need dialect-specific quoting.
      order: [
        [sequelize.literal('matched_member_id IS NULL'), 'DESC'],
        ['payment_date', 'DESC'],
        ['created_at', 'DESC']
      ],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
      include: [
        { model: Member, as: 'matchedMember', attributes: ['id', 'first_name', 'last_name'] },
        { model: Transaction, as: 'transaction', attributes: ['id', 'amount', 'payment_type', 'payment_date', 'receipt_number'] }
      ]
    });

    return res.json({
      success: true,
      count: rows.length,
      items: rows,
      pagination: { total: count, page, pages: Math.ceil(count / limit) }
    });
  } catch (error) {
    console.error('Zelle queue list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/zelle/queue/:id/ignore
async function ignoreQueueItem(req, res) {
  try {
    const row = await ZelleEmailQueue.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Queue item not found' });
    }
    if (['CREATED', 'AUTO_CREATED'].includes(row.status)) {
      return res.status(400).json({ success: false, message: 'Cannot ignore an item that already has a transaction' });
    }
    await row.update({ status: 'IGNORED', processed_at: new Date() });
    return res.json({ success: true });
  } catch (error) {
    console.error('Zelle queue ignore error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/zelle/queue/:id/match
// Body: { member_id, payer_name? }
// Associates a payer with a member for later bank reconciliation.
// Creates NO transaction.
async function matchQueueItem(req, res) {
  try {
    const { member_id, payer_name } = req.body || {};
    if (!member_id) {
      return res.status(400).json({ success: false, message: 'member_id is required' });
    }

    const result = await matchQueueRowToMember({
      queueId: req.params.id,
      memberId: member_id,
      payerName: payer_name,
      userId: req.user?.id || null
    });

    if (!result.success) {
      const statusByCode = { NOT_FOUND: 404, ALREADY_POSTED: 409, MEMBER_NOT_FOUND: 400, PAYER_NAME_REQUIRED: 400 };
      return res.status(statusByCode[result.code] || 400).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error('Zelle queue match error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  syncFromGmail,
  previewFromGmail,
  createTransactionFromPreview,
  createBatchTransactions,
  processTransactionCreation,
  getQueue,
  ignoreQueueItem,
  matchQueueItem
};
