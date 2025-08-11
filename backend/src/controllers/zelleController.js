const { syncZelleFromGmail, previewZelleFromGmail } = require('../services/gmailZelleIngest');
const { Transaction } = require('../models');

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

module.exports = { syncFromGmail };
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

module.exports.previewFromGmail = previewFromGmail;

// POST /api/zelle/reconcile/create-transaction
// Body: { external_id, amount, payment_date, note, member_id, payment_type }
// Insert-only: if external_id exists, do not modify existing
async function createTransactionFromPreview(req, res) {
  try {
    const { external_id, amount, payment_date, note, member_id, payment_type } = req.body || {};
    if (!external_id || !member_id || !amount || !payment_date) {
      return res.status(400).json({ success: false, message: 'external_id, member_id, amount, and payment_date are required' });
    }

    // Ensure insert-only semantics
    const existing = await Transaction.findOne({ where: { external_id } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Transaction already exists for this external_id', id: existing.id });
    }

    const collected_by = req.user?.id || null;
    if (!collected_by) {
      return res.status(403).json({ success: false, message: 'Missing collector context' });
    }

    const tx = await Transaction.create({
      member_id,
      collected_by,
      payment_date,
      amount,
      payment_type: payment_type || 'donation',
      payment_method: 'zelle',
      status: 'succeeded',
      receipt_number: null,
      note: note || null,
      external_id,
      donation_id: null,
    });

    return res.json({ success: true, id: tx.id, data: tx });
  } catch (error) {
    console.error('Zelle reconcile create-transaction error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports.createTransactionFromPreview = createTransactionFromPreview;
