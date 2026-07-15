const { syncZelleFromGmail, previewZelleFromGmail } = require('../services/gmailZelleIngest');
const {
  createZelleTransaction,
  extractPayerName
} = require('../services/zelleTransactionService');
const { ZelleEmailQueue, Member, Transaction } = require('../models');

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

// POST /api/zelle/reconcile/create-transaction
// Body: { external_id, amount, payment_date, note, member_id, payment_type }
// Insert-only: if external_id exists, do not modify existing
async function createTransactionFromPreview(req, res) {
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

// GET /api/zelle/queue?status=AUTO_CREATED&limit=50
// Audit/review list of processed Zelle emails
async function getQueue(req, res) {
  try {
    const { status } = req.query;
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const where = {};
    if (status) where.status = String(status).toUpperCase();

    const rows = await ZelleEmailQueue.findAll({
      where,
      order: [['payment_date', 'DESC'], ['created_at', 'DESC']],
      limit,
      include: [
        { model: Member, as: 'matchedMember', attributes: ['id', 'first_name', 'last_name'] },
        { model: Transaction, as: 'transaction', attributes: ['id', 'amount', 'payment_type', 'payment_date', 'receipt_number'] }
      ]
    });

    return res.json({ success: true, count: rows.length, items: rows });
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

module.exports = {
  syncFromGmail,
  previewFromGmail,
  createTransactionFromPreview,
  createBatchTransactions,
  processTransactionCreation,
  getQueue,
  ignoreQueueItem
};
