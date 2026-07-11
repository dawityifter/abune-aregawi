/**
 * Shared Zelle transaction logic used by both the manual review flow
 * (zelleController) and the automated Gmail sync (gmailZelleIngest).
 *
 * Responsibilities:
 * - Extract payer name from Chase Zelle email text
 * - Match a Zelle sender to a member (learned keys first, then legacy memo, then fuzzy)
 * - Create Transaction + LedgerEntry (insert-only by external_id)
 * - Learn payer->member associations (bank_memo_matches + legacy zelle_memo_matches)
 * - Remember a member's last-used payment type
 */
const { Op } = require('sequelize');
const {
  Member,
  Transaction,
  ZelleMemoMatch,
  IncomeCategory,
  LedgerEntry,
  sequelize
} = require('../models');
const {
  findSuggestionCandidates,
  learnBankMemoMatch
} = require('./bankMemoMatchService');
const { validateReceiptNumber } = require('../utils/receiptNumber');

// Sanitize boilerplate phrases commonly present in Zelle emails from Chase
function sanitizeNote(input) {
  if (!input) return input;
  let out = String(input);
  out = out.replace(/You received money with Zelle(?:®)?/gi, '');
  out = out.replace(/(\s*\|\s*)?Memo N\/A/gi, '');
  out = out.replace(/\s*is registered with a Zelle(?:®)?/gi, '');
  out = out.replace(/\s{2,}/g, ' ').replace(/\s*\|\s*/g, ' ').trim();
  return out;
}

/**
 * Extract the payer (sender) name from Chase Zelle email subject/body.
 * Known Chase formats:
 *   "JOHN DOE sent you $50.00"
 *   "You received $50.00 from JOHN DOE"
 *   "Zelle payment from JOHN DOE 123456"
 */
function extractPayerName(text) {
  if (!text) return null;
  const raw = String(text).replace(/\s+/g, ' ');

  const patterns = [
    /([A-Za-z][A-Za-z'’.\- ]{1,60}?)\s+sent you\s+\$/i,
    /received\s+\$[\d,.]+\s+from\s+([A-Za-z][A-Za-z'’.\- ]{1,60}?)(?=\s*(?:[.,|\n]|$|is registered))/i,
    /Zelle payment from\s+([A-Za-z][A-Za-z'’.\- ]{1,60}?)(?=\s*(?:[.,|\n]|\d|$))/i
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    if (m && m[1]) {
      const name = m[1].replace(/\s{2,}/g, ' ').trim();
      // Reject obviously non-name captures
      if (name.length >= 3 && /[a-z]/i.test(name) && !/^(you|memo|zelle)$/i.test(name)) {
        return name;
      }
    }
  }
  return null;
}

/**
 * Extract the Zelle transaction/confirmation number from Chase email text.
 * This is the payment-level identifier — unique per PAYMENT, unlike the
 * Gmail message id which is unique per EMAIL (Chase can send several emails
 * about the same payment). Known formats:
 *   "Transaction number: 25891237323"
 *   "Transaction number| CMB0K6P5R3MF"
 *   "Confirmation number: 123456789"
 */
function extractZelleReference(text) {
  if (!text) return null;
  const raw = String(text).replace(/\s+/g, ' ');

  const patterns = [
    /transaction\s*(?:number|#|no\.?)\s*[:|\-]?\s*([A-Z0-9]{6,24})/i,
    /confirmation\s*(?:number|#|no\.?)\s*[:|\-]?\s*([A-Z0-9]{6,24})/i,
    /reference\s*(?:number|#|no\.?)\s*[:|\-]?\s*([A-Z0-9]{6,24})/i
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    if (m && m[1]) {
      return m[1].toUpperCase();
    }
  }
  return null;
}

/**
 * The canonical external_id for a Zelle payment: keyed by the payment-level
 * Zelle reference when available, falling back to the Gmail message id.
 */
function buildZelleExternalId({ zelleReference, messageId }) {
  if (zelleReference) return `zelle:${zelleReference}`;
  return messageId ? `gmail:${messageId}` : null;
}

/**
 * Produce a stable, amount-free memo string for the legacy zelle_memo_matches
 * table. Prefer the payer name; otherwise strip amounts/boilerplate from note.
 */
function cleanLegacyMemo(note, payerName) {
  if (payerName) return payerName.trim();
  let out = sanitizeNote(note || '');
  out = out.replace(/sent you\s+\$[\d,.]+/gi, ' ');
  out = out.replace(/\$[\d,]+(?:\.\d{2})?/g, ' ');
  out = out.replace(/\s{2,}/g, ' ').trim();
  return out || null;
}

/**
 * Match a Zelle sender to a member.
 * Order:
 *  1. Learned keys in bank_memo_matches / legacy zelle_memo_matches (high confidence)
 *  2. Exact legacy memo match on the cleaned note (high confidence)
 *  3. Fuzzy name-token match (medium if unique, low otherwise)
 *
 * Returns { member_id, member_name, confidence, source, candidates }
 */
async function matchZelleSender({ payerName, note }) {
  const result = { member_id: null, member_name: null, confidence: null, source: null, candidates: [] };

  // 1 + 3. Reuse the bank reconciliation suggestion engine by shaping a
  // pseudo bank transaction. It checks learned keys, then fuzzy names.
  // The trailing "0000000" mimics the bank CSV's Zelle reference ID so the
  // description normalizer (which strips a trailing id token) produces the
  // exact same DESCRIPTION key as bank-side learning.
  const pseudoTxn = {
    type: 'ZELLE',
    payer_name: payerName || null,
    description: payerName ? `Zelle payment from ${payerName} 0000000` : sanitizeNote(note || '')
  };
  const suggestions = await findSuggestionCandidates(pseudoTxn);

  result.candidates = suggestions
    .filter(s => s?.member?.id)
    .map(s => ({
      id: s.member.id,
      name: `${s.member.first_name || ''} ${s.member.last_name || ''}`.trim(),
      confidence: s.confidence,
      source: s.source
    }));

  const learned = suggestions.find(s => s.confidence === 'high' && String(s.source || '').startsWith('LEARNED'));
  if (learned?.member?.id) {
    result.member_id = learned.member.id;
    result.member_name = `${learned.member.first_name || ''} ${learned.member.last_name || ''}`.trim();
    result.confidence = 'high';
    result.source = learned.source;
    return result;
  }

  // 2. Exact legacy memo match on cleaned note
  const cleaned = cleanLegacyMemo(note, payerName);
  if (cleaned) {
    const legacy = await ZelleMemoMatch.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('memo')), cleaned.toLowerCase())
    });
    if (legacy) {
      const member = await Member.findByPk(legacy.member_id, { attributes: ['id', 'first_name', 'last_name'] });
      if (member) {
        result.member_id = member.id;
        result.member_name = `${member.first_name || ''} ${member.last_name || ''}`.trim();
        result.confidence = 'high';
        result.source = 'LEARNED_LEGACY_MEMO';
        return result;
      }
    }
  }

  // 3. Fall back to a unique fuzzy suggestion (medium confidence: suggest, don't auto-create)
  const fuzzy = result.candidates.filter(c => !String(c.source || '').startsWith('LEARNED'));
  if (fuzzy.length === 1) {
    result.member_id = fuzzy[0].id;
    result.member_name = fuzzy[0].name;
    result.confidence = 'medium';
    result.source = fuzzy[0].source;
  }
  return result;
}

/**
 * Learn payer->member association from a confirmed transaction.
 * Writes both the new bank_memo_matches keys and the legacy memo table
 * so the Bank Reconciliation screen and the email flow share knowledge.
 */
async function learnZelleAssociation({ payerName, note, memberId }) {
  if (!memberId) return;

  const pseudoTxn = {
    id: null,
    type: 'ZELLE',
    payer_name: payerName || null,
    description: payerName ? `Zelle payment from ${payerName} 0000000` : sanitizeNote(note || '')
  };
  try {
    await learnBankMemoMatch(pseudoTxn, memberId);
  } catch (e) {
    console.warn('learnBankMemoMatch warning:', e.message || e);
  }

  try {
    const memo = cleanLegacyMemo(note, payerName);
    if (!memo || memo.length < 3) return;
    const existing = await ZelleMemoMatch.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('memo')), memo.toLowerCase())
    });
    const m = await Member.findByPk(memberId, { attributes: ['first_name', 'last_name'] });
    const first_name = m?.first_name || null;
    const last_name = m?.last_name || null;
    if (!existing) {
      await ZelleMemoMatch.create({ member_id: memberId, first_name, last_name, memo });
    } else if (String(existing.member_id) !== String(memberId)) {
      await existing.update({ member_id: memberId, first_name, last_name });
    }
  } catch (e) {
    console.warn('Zelle legacy memo upsert warning:', e.message || e);
  }
}

/**
 * A member's last-used payment type (for defaulting automated entries).
 * Returns { payment_type, for_year }.
 */
async function getDefaultPaymentType(memberId, paymentDate) {
  const fallback = { payment_type: 'donation', for_year: null };
  if (!memberId) return fallback;

  const last = await Transaction.findOne({
    where: { member_id: memberId, status: 'succeeded' },
    order: [['payment_date', 'DESC'], ['id', 'DESC']],
    attributes: ['payment_type']
  });
  if (!last?.payment_type) return fallback;

  const payment_type = last.payment_type;
  const for_year = payment_type === 'membership_due'
    ? new Date(paymentDate || Date.now()).getFullYear()
    : null;
  return { payment_type, for_year };
}

async function resolveIncomeCategory(paymentType) {
  let incomeCategory = await IncomeCategory.findOne({
    where: { payment_type_mapping: paymentType }
  });
  if (!incomeCategory) {
    const fallbackMappings = {
      'tithe': 'offering',      // tithe -> INC002 (Weekly Offering)
      'building_fund': 'event'  // building_fund -> INC003 (Fundraising)
    };
    const fallbackType = fallbackMappings[paymentType];
    if (fallbackType) {
      incomeCategory = await IncomeCategory.findOne({
        where: { payment_type_mapping: fallbackType }
      });
    }
  }
  return incomeCategory;
}

/**
 * Create a Zelle Transaction + LedgerEntry (insert-only by external_id) and
 * learn the payer association. Used by manual review and the automated sync.
 *
 * Returns { success, id, data } or { success:false, code:'EXISTS', id }.
 */
async function createZelleTransaction({
  external_id,
  amount,
  payment_date,
  note,
  member_id,
  payment_type,
  for_year,
  receipt_number,
  payer_name
}, collectedBy) {
  if (!external_id || !amount || !payment_date) {
    throw new Error('external_id, amount, and payment_date are required');
  }
  if (!collectedBy) {
    throw new Error('Missing collector context');
  }

  // Insert-only semantics
  const existing = await Transaction.findOne({ where: { external_id } });
  if (existing) {
    return { success: false, message: 'Transaction already exists for this external_id', id: existing.id, code: 'EXISTS' };
  }

  const receiptValidation = validateReceiptNumber(receipt_number);
  if (!receiptValidation.valid) {
    throw new Error(receiptValidation.message);
  }
  const normalizedReceiptNumber = receiptValidation.normalized;
  if (normalizedReceiptNumber && normalizedReceiptNumber !== '000') {
    const duplicateReceipt = await Transaction.findOne({ where: { receipt_number: normalizedReceiptNumber } });
    if (duplicateReceipt) {
      throw new Error(`Receipt number "${normalizedReceiptNumber}" has already been used. Please use a unique receipt number.`);
    }
  }

  const finalPaymentType = payment_type || 'donation';
  const incomeCategory = await resolveIncomeCategory(finalPaymentType);

  const tx = await Transaction.create({
    member_id: member_id || null,
    collected_by: collectedBy,
    payment_date,
    amount,
    payment_type: finalPaymentType,
    payment_method: 'zelle',
    status: 'succeeded',
    receipt_number: normalizedReceiptNumber || null,
    note: note || null,
    external_id,
    donation_id: null,
    income_category_id: incomeCategory?.id || null,
    for_year: for_year || null
  });

  // Learn payer -> member association (never fails the transaction)
  if (member_id) {
    await learnZelleAssociation({ payerName: payer_name, note, memberId: member_id });
  }

  // Ledger entry
  try {
    const glCode = incomeCategory?.gl_code || 'INC999';
    await LedgerEntry.create({
      type: finalPaymentType,
      category: glCode,
      amount: parseFloat(amount),
      entry_date: payment_date,
      member_id: member_id || null,
      payment_method: 'zelle',
      receipt_number: normalizedReceiptNumber || null,
      memo: `${glCode} - Zelle payment ${external_id}`,
      transaction_id: tx.id
    });
  } catch (ledgerErr) {
    console.error('⚠️ Failed to create ledger entry for Zelle transaction:', ledgerErr.message);
  }

  return { success: true, id: tx.id, data: tx };
}

module.exports = {
  sanitizeNote,
  extractPayerName,
  extractZelleReference,
  buildZelleExternalId,
  cleanLegacyMemo,
  matchZelleSender,
  learnZelleAssociation,
  getDefaultPaymentType,
  createZelleTransaction
};
