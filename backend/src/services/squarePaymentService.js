/**
 * Square payment ingest + reconciliation logic. Mirrors zelleTransactionService
 * but for Square: rides on transactions as payment_method='credit_card' with
 * external_id='square:<square_payment_id>'.
 */
const {
  Member, Transaction, SquarePayment, LedgerEntry, sequelize
} = require('../models');
const { normalizeSquarePayment } = require('./squareClient');
const { findSuggestionCandidates, learnBankMemoMatch } = require('./bankMemoMatchService');
const { resolveIncomeCategory } = require('./zelleTransactionService');
const { validateReceiptNumber } = require('../utils/receiptNumber');

function externalIdFor(squarePaymentId) {
  return `square:${squarePaymentId}`;
}

/**
 * Match a Square buyer to a member.
 * 1. Exact (case-insensitive, trimmed) email match on Member.email — only
 *    auto-matched when the email uniquely identifies ONE member; a shared
 *    family email that matches multiple members falls through to the
 *    name-based path instead of guessing (high confidence).
 * 2. Learned/fuzzy name match via the shared bank/Zelle suggestion engine.
 * Returns { member_id, member_name, confidence, source }.
 */
async function matchSquareBuyer({ buyer_name, buyer_email }) {
  const result = { member_id: null, member_name: null, confidence: null, source: null };

  const normalizedEmail = buyer_email ? String(buyer_email).trim().toLowerCase() : null;
  if (normalizedEmail) {
    const byEmail = await Member.findAll({
      where: sequelize.where(sequelize.fn('lower', sequelize.fn('trim', sequelize.col('email'))), normalizedEmail),
      attributes: ['id', 'first_name', 'last_name']
    });
    if (byEmail.length === 1) {
      result.member_id = byEmail[0].id;
      result.member_name = `${byEmail[0].first_name || ''} ${byEmail[0].last_name || ''}`.trim();
      result.confidence = 'high';
      result.source = 'SQUARE_EMAIL';
      return result;
    }
    // Zero or multiple matches (e.g. a shared family email): don't guess —
    // fall through to the name-based fuzzy/learned path below.
  }

  if (buyer_name) {
    const pseudoTxn = {
      type: 'SQUARE',
      payer_name: buyer_name,
      description: `Square payment from ${buyer_name} 0000000`
    };
    const suggestions = await findSuggestionCandidates(pseudoTxn);
    const learned = suggestions.find(
      s => s.confidence === 'high' && String(s.source || '').startsWith('LEARNED') && s.member?.id
    );
    if (learned) {
      result.member_id = learned.member.id;
      result.member_name = `${learned.member.first_name || ''} ${learned.member.last_name || ''}`.trim();
      result.confidence = 'high';
      result.source = learned.source;
      return result;
    }
    const unique = suggestions.filter(s => s.member?.id);
    if (unique.length === 1) {
      result.member_id = unique[0].member.id;
      result.member_name = `${unique[0].member.first_name || ''} ${unique[0].member.last_name || ''}`.trim();
      result.confidence = 'medium';
      result.source = unique[0].source;
    }
  }

  return result;
}

/**
 * Normalize + upsert a Square payment by square_payment_id, then attempt a match.
 * Only COMPLETED payments are stored. Returns { row, created }.
 */
async function upsertSquarePayment(paymentObj) {
  const fields = normalizeSquarePayment(paymentObj);
  if (!fields || fields.status !== 'COMPLETED') {
    console.log(`Square upsert skipped: id=${paymentObj?.id} normalizedStatus=${fields?.status ?? 'null'}`);
    return { row: null, created: false };
  }

  const match = await matchSquareBuyer(fields);
  const statusFromMatch = match.confidence === 'high' ? 'AUTO_MATCHED' : 'NEEDS_REVIEW';

  const [row, created] = await SquarePayment.findOrCreate({
    where: { square_payment_id: fields.square_payment_id },
    defaults: {
      ...fields,
      raw: paymentObj,
      status: statusFromMatch,
      matched_member_id: match.member_id,
      match_confidence: match.confidence,
      match_source: match.source
    }
  });

  // On re-ingest of a not-yet-reconciled row, refresh matchable fields only.
  if (!created && ['NEEDS_REVIEW', 'AUTO_MATCHED'].includes(row.status)) {
    await row.update({
      amount: fields.amount,
      currency: fields.currency,
      square_created_at: fields.square_created_at,
      buyer_name: fields.buyer_name,
      buyer_email: fields.buyer_email,
      note: fields.note,
      card_brand: fields.card_brand,
      card_last4: fields.card_last4,
      raw: paymentObj,
      status: statusFromMatch,
      matched_member_id: match.member_id,
      match_confidence: match.confidence,
      match_source: match.source
    });
  }

  return { row, created };
}

/**
 * Create a Square Transaction + LedgerEntry (insert-only by external_id) and
 * learn the buyer association. Returns { success, id, data } or
 * { success:false, code:'EXISTS', id }.
 */
async function createSquareTransaction({
  square_payment_id, amount, payment_date, note,
  member_id, payment_type, for_year, receipt_number, buyer_name, donor_name
}, collectedBy) {
  if (!square_payment_id || !amount || !payment_date) {
    throw new Error('square_payment_id, amount, and payment_date are required');
  }
  if (!collectedBy) throw new Error('Missing collector context');

  const external_id = externalIdFor(square_payment_id);

  const existing = await Transaction.findOne({ where: { external_id } });
  if (existing) {
    return { success: false, message: 'Transaction already exists for this Square payment', id: existing.id, code: 'EXISTS' };
  }

  const receiptValidation = validateReceiptNumber(receipt_number);
  if (!receiptValidation.valid) throw new Error(receiptValidation.message);
  const normalizedReceiptNumber = receiptValidation.normalized;
  if (normalizedReceiptNumber && normalizedReceiptNumber !== '000') {
    const dupReceipt = await Transaction.findOne({ where: { receipt_number: normalizedReceiptNumber } });
    if (dupReceipt) {
      throw new Error(`Receipt number "${normalizedReceiptNumber}" has already been used. Please use a unique receipt number.`);
    }
  }

  const finalPaymentType = payment_type || 'donation';
  const incomeCategory = await resolveIncomeCategory(finalPaymentType);

  // A member-linked payment is attributed by member_id; storing a name as well
  // would let the two disagree about who gave. Only non-member gifts carry one.
  const resolvedDonorName = member_id ? null : ((donor_name || '').trim() || null);

  let tx;
  try {
    tx = await Transaction.create({
      member_id: member_id || null,
      collected_by: collectedBy,
      payment_date,
      amount,
      payment_type: finalPaymentType,
      payment_method: 'credit_card',
      status: 'succeeded',
      receipt_number: normalizedReceiptNumber || null,
      note: note || null,
      donor_name: resolvedDonorName,
      external_id,
      donation_id: null,
      income_category_id: incomeCategory?.id || null,
      for_year: for_year || null
    });
  } catch (createErr) {
    if (createErr.name === 'SequelizeUniqueConstraintError') {
      // Concurrent double-confirm on the same square_payment_id raced us
      // past the pre-check above; treat it the same as the up-front EXISTS
      // path instead of surfacing a raw 500.
      const dup = await Transaction.findOne({ where: { external_id } });
      return {
        success: false,
        message: 'Transaction already exists for this Square payment',
        id: dup?.id || null,
        code: 'EXISTS'
      };
    }
    throw createErr;
  }

  // Deliberately gated on member_id: a non-member gift must NEVER train the
  // matcher. Learning a buyer_name -> donor association would make future
  // payments from that name auto-attribute themselves, which is exactly the
  // behavior we don't want for named non-member donors. Covered by test
  // "does not learn an association for a non-member donor".
  if (member_id && buyer_name) {
    try {
      await learnBankMemoMatch(
        { id: null, type: 'SQUARE', payer_name: buyer_name, description: `Square payment from ${buyer_name} 0000000` },
        member_id
      );
    } catch (e) {
      console.warn('Square learn association warning:', e.message || e);
    }
  }

  try {
    const glCode = incomeCategory?.gl_code || 'INC999';
    await LedgerEntry.create({
      type: finalPaymentType,
      category: glCode,
      amount: parseFloat(amount),
      entry_date: payment_date,
      member_id: member_id || null,
      payment_method: 'credit_card',
      receipt_number: normalizedReceiptNumber || null,
      donor_name: resolvedDonorName,
      memo: `${glCode} - Square payment ${external_id}`,
      transaction_id: tx.id
    });
  } catch (ledgerErr) {
    console.error('⚠️ Failed to create ledger entry for Square transaction:', ledgerErr.message);
  }

  return { success: true, id: tx.id, data: tx };
}

module.exports = {
  externalIdFor,
  matchSquareBuyer,
  upsertSquarePayment,
  createSquareTransaction
};
