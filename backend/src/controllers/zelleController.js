const { syncZelleFromGmail, previewZelleFromGmail } = require('../services/gmailZelleIngest');
const { Transaction, ZelleMemoMatch, Member, IncomeCategory, LedgerEntry } = require('../models');

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

// Helper to process a single transaction creation
async function processTransactionCreation({ external_id, amount, payment_date, note, member_id, payment_type }, user) {
  if (!external_id || !amount || !payment_date) {
    throw new Error('external_id, amount, and payment_date are required');
  }

  // Ensure insert-only semantics
  const existing = await Transaction.findOne({ where: { external_id } });
  if (existing) {
    return { success: false, message: 'Transaction already exists for this external_id', id: existing.id, code: 'EXISTS' };
  }

  const collected_by = user?.id || null;
  if (!collected_by) {
    throw new Error('Missing collector context');
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

  // Persist memo -> member mapping if a member is matched
  try {
    const memo = sanitizeNote(note || '');
    if (memo && member_id) {
      const existingMemo = await ZelleMemoMatch.findOne({ where: { memo } });
      let first_name = null;
      let last_name = null;
      const m = await Member.findByPk(member_id, { attributes: ['first_name', 'last_name'] });
      if (m) {
        first_name = m.first_name || null;
        last_name = m.last_name || null;
      }
      if (!existingMemo) {
        await ZelleMemoMatch.create({ member_id, first_name, last_name, memo });
      } else if (existingMemo.member_id !== member_id || existingMemo.first_name !== first_name || existingMemo.last_name !== last_name) {
        existingMemo.member_id = member_id;
        existingMemo.first_name = first_name;
        existingMemo.last_name = last_name;
        await existingMemo.save();
      }
    }
  } catch (memoErr) {
    console.warn('Zelle memo match upsert warning:', memoErr.message || memoErr);
    // Do not fail the transaction creation if memo upsert fails
  }

  // Create corresponding ledger entry
  try {
    const glCode = incomeCategory?.gl_code || 'INC999';
    const memo = `${glCode} - Zelle payment ${external_id}`;

    await LedgerEntry.create({
      type: finalPaymentType,
      category: glCode,
      amount: parseFloat(amount),
      entry_date: payment_date,
      member_id: member_id || null,
      payment_method: 'zelle',
      memo: memo,
      transaction_id: tx.id
    });
    console.log(`✅ Created ledger entry for Zelle transaction ${tx.id} with GL code ${glCode}`);
  } catch (ledgerErr) {
    console.error('⚠️ Failed to create ledger entry for Zelle reconciliation:', ledgerErr.message);
  }

  return { success: true, id: tx.id, data: tx };
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

module.exports = {
  syncFromGmail,
  previewFromGmail,
  createTransactionFromPreview,
  createBatchTransactions,
  processTransactionCreation
};
