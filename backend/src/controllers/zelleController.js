const { syncZelleFromGmail, previewZelleFromGmail } = require('../services/gmailZelleIngest');
const { Transaction, ZelleMemoMatch, Member, IncomeCategory } = require('../models');

// Keep memo normalization consistent with the ingest service
function sanitizeNote(input) {
  if (!input) return input;
  let out = String(input);
  out = out.replace(/You received money with Zelle(?:®)?/gi, '');
  out = out.replace(/(\s*\|\s*)?Memo N\/A/gi, '');
  out = out.replace(/\s*is registered with a Zelle(?:®)?/gi, '');
  out = out.replace(/\s{2,}/g, ' ').replace(/\s*\|\s*/g, ' ').trim();
  return out;
}

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

    // Auto-assign income category based on payment_type
    const finalPaymentType = payment_type || 'donation';
    let income_category_id = null;
    let incomeCategory = await IncomeCategory.findOne({
      where: { payment_type_mapping: finalPaymentType }
    });
    
    // Fallback mappings for payment types without direct mapping
    if (!incomeCategory) {
      const fallbackMappings = {
        'tithe': 'offering',        // tithe → INC002 (Weekly Offering)
        'building_fund': 'event'    // building_fund → INC003 (Fundraising)
      };
      
      const fallbackType = fallbackMappings[finalPaymentType];
      if (fallbackType) {
        incomeCategory = await IncomeCategory.findOne({
          where: { payment_type_mapping: fallbackType }
        });
      }
    }
    
    if (incomeCategory) {
      income_category_id = incomeCategory.id;
    }

    const tx = await Transaction.create({
      member_id,
      collected_by,
      payment_date,
      amount,
      payment_type: finalPaymentType,
      payment_method: 'zelle',
      status: 'succeeded',
      receipt_number: null,
      note: note || null,
      external_id,
      donation_id: null,
      income_category_id
    });

    // Persist memo -> member mapping to enable future automatic matches
    try {
      const memo = sanitizeNote(note || '');
      if (memo) {
        const existing = await ZelleMemoMatch.findOne({ where: { memo } });
        let first_name = null;
        let last_name = null;
        const m = await Member.findByPk(member_id, { attributes: ['first_name', 'last_name'] });
        if (m) {
          first_name = m.first_name || null;
          last_name = m.last_name || null;
        }
        if (!existing) {
          await ZelleMemoMatch.create({ member_id, first_name, last_name, memo });
        } else if (existing.member_id !== member_id || existing.first_name !== first_name || existing.last_name !== last_name) {
          existing.member_id = member_id;
          existing.first_name = first_name;
          existing.last_name = last_name;
          await existing.save();
        }
      }
    } catch (memoErr) {
      console.warn('Zelle memo match upsert warning:', memoErr.message || memoErr);
      // Do not fail the transaction creation if memo upsert fails
    }

    return res.json({ success: true, id: tx.id, data: tx });
  } catch (error) {
    console.error('Zelle reconcile create-transaction error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports.createTransactionFromPreview = createTransactionFromPreview;
