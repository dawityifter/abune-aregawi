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
  ZelleEmailQueue,
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
 *   "JOHN DOE sent you money"     <- current notification wording
 *   "JOHN DOE sent you $50.00"
 *   "You received $50.00 from JOHN DOE"
 *   "Zelle payment from JOHN DOE 123456"
 *
 * Two things about the real input shape drive the leading pattern:
 *
 * 1. The amount is NOT next to the name. Chase writes "<NAME> sent you money"
 *    and puts the amount further down in a details table, so a pattern
 *    requiring "sent you $" matches none of the live notifications.
 * 2. There is usually no line structure to lean on. Chase sends these as
 *    text/html with no text/plain part, so parseCandidatesFromMessage falls
 *    back to Gmail's ~200 character snippet: a single line reading
 *    "Zelle ® payment <NAME> sent you money Here are the details: ...".
 *
 * So the name's start is anchored to a line start OR to the "®" that ends
 * Chase's chrome — a character that cannot occur inside a name. Without such
 * an anchor the match runs leftward and swallows whatever preceded it (the
 * subject line, or the word "payment") into the captured name, which would
 * silently corrupt the ZELLE:PAYER:<name> key every match is stored under.
 */
function extractPayerName(text) {
  if (!text) return null;
  // Collapse runs of spaces/tabs, but keep newlines: where they do exist they
  // are a boundary that stops one line bleeding into the next line's name.
  const raw = String(text).replace(/[ \t]+/g, ' ');

  const patterns = [
    /(?:^|®)[ \t]*(?:payment[ \t]+)?([A-Za-z][A-Za-z'’.\- ]{1,60}?)\s+sent you\s+(?:money\b|\$)/im,
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

  // Rename-immune duplicate guard: when bank reconciliation links a Zelle
  // transaction to its bank row, the transaction's external_id is RENAMED to
  // the bank hash — so the lookup above misses on a retry/double-click and
  // would double-post. The email queue row is keyed by the original
  // external_id forever; if it already points at a live transaction, this
  // payment is recorded.
  const queued = await ZelleEmailQueue.findOne({
    where: { external_id, transaction_id: { [Op.ne]: null } }
  });
  if (queued && queued.transaction_id) {
    const linked = await Transaction.findByPk(queued.transaction_id);
    if (linked) {
      return { success: false, message: 'Transaction already exists for this Zelle payment', id: linked.id, code: 'EXISTS' };
    }
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

  // Immediately link any matching PENDING bank rows so the Bank Transactions
  // screen shows MATCHED without waiting for an on-demand auto-reconcile run.
  // (Lazy require: autoReconcileService imports from this module at load time.)
  // Never fails the creation.
  let bankLink = null;
  try {
    const { linkPendingBankRowsForTransaction } = require('./autoReconcileService');
    bankLink = await linkPendingBankRowsForTransaction(tx, { id: collectedBy }, { payerName: payer_name || null });
  } catch (linkErr) {
    console.error('⚠️ Targeted bank-row linking failed for Zelle transaction:', linkErr.message);
  }

  return { success: true, id: tx.id, data: tx, bank_link: bankLink };
}

/**
 * Associate a queued Zelle email with a member WITHOUT creating a transaction.
 *
 * This is the whole point of match-only mode: it writes the learned payer keys
 * (bank_memo_matches + the legacy memo row) that bank reconciliation will find
 * when the corresponding Chase CSV row is uploaded, so the treasurer approves a
 * pre-filled suggestion instead of identifying the giver from scratch.
 *
 * Re-runnable: matching again updates the learned keys, which is how a
 * treasurer corrects a mistake.
 */
async function matchQueueRowToMember({ queueId, memberId, payerName = null, userId = null }) {
  const row = await ZelleEmailQueue.findByPk(queueId);
  if (!row) {
    return { success: false, code: 'NOT_FOUND', message: 'Queue item not found' };
  }
  if (row.transaction_id) {
    return {
      success: false,
      code: 'ALREADY_POSTED',
      message: 'This email already has a transaction; its member association is settled by that transaction.'
    };
  }

  const member = await Member.findByPk(memberId, { attributes: ['id'] });
  if (!member) {
    return { success: false, code: 'MEMBER_NOT_FOUND', message: 'Member not found' };
  }

  // An explicit override wins: when extractPayerName failed, the stored
  // payer_name is null and learning would key off memo text that no bank row
  // ever matches.
  const trimmedOverride = payerName ? String(payerName).trim() : '';
  const trimmedRowPayerName = row.payer_name ? String(row.payer_name).trim() : '';
  const effectivePayerName = trimmedOverride || trimmedRowPayerName || null;

  // With no payer name at all, learnZelleAssociation falls back to keying off
  // the raw note text, which no real bank CSV description ever normalizes
  // to — the match would report success while learning a key that can never
  // be found. Refuse instead of silently doing nothing useful.
  if (!effectivePayerName) {
    return {
      success: false,
      code: 'PAYER_NAME_REQUIRED',
      message: 'This email has no payer name on file. Enter the payer name exactly as it appears on the bank statement so bank reconciliation can find this match.'
    };
  }

  await learnZelleAssociation({
    payerName: effectivePayerName,
    note: row.note,
    memberId: member.id
  });

  await row.update({
    payer_name: effectivePayerName,
    matched_member_id: member.id,
    match_confidence: 'high',
    match_source: 'TREASURER_MATCH',
    status: 'MATCHED',
    matched_by: userId || null,
    matched_at: new Date(),
    error: null
  });

  return { success: true, data: row };
}

// Payments the Zelle Review screen may record. Loans carry their own records
// (member_loans) and are entered from the Loans screen.
const QUEUE_CREATE_PAYMENT_TYPES = new Set([
  'membership_due', 'tithe', 'offering', 'donation', 'vow', 'building_fund', 'event',
  'religious_item_sales', 'event_merchandise', 'tigray_hunger_fundraiser', 'other', 'pledge_drive'
]);

// Window for "this member already has a Zelle payment of this amount"; wide
// enough to cover the email-to-posting delay in either direction.
const DUPLICATE_WINDOW_DAYS = 5;

function shiftDate(dateOnly, days) {
  const d = new Date(`${String(dateOnly).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function describeTransaction(tx, bankRow = null) {
  const { isBankHash } = require('./zelleBankCorrelationService');
  const ext = String(tx.external_id || '');
  return {
    transaction_id: tx.id,
    amount: tx.amount,
    payment_date: tx.payment_date,
    payment_type: tx.payment_type,
    member_id: tx.member_id,
    receipt_number: tx.receipt_number || null,
    origin: isBankHash(ext) ? 'bank' : (ext.startsWith('zelle:') || ext.startsWith('gmail:') ? 'zelle_email' : 'manual'),
    bank_row: bankRow ? { id: bankRow.id, date: bankRow.date, payer_name: bankRow.payer_name, status: bankRow.status } : null
  };
}

/**
 * Other transactions this payment might already be: the member's Zelle
 * payments of the same amount around the email date. Transactions that belong
 * to a different email are a different payment and are left out.
 */
async function findMemberDuplicateCandidates(queueRow, memberId) {
  const txs = await Transaction.findAll({
    where: {
      member_id: memberId,
      amount: queueRow.amount,
      payment_method: 'zelle',
      payment_date: {
        [Op.between]: [shiftDate(queueRow.payment_date, -DUPLICATE_WINDOW_DAYS), shiftDate(queueRow.payment_date, DUPLICATE_WINDOW_DAYS)]
      },
      status: { [Op.ne]: 'failed' }
    },
    order: [['payment_date', 'ASC'], ['id', 'ASC']]
  });
  if (txs.length === 0) return [];

  const owned = await ZelleEmailQueue.findAll({
    where: { transaction_id: txs.map((t) => t.id), id: { [Op.ne]: queueRow.id } },
    attributes: ['transaction_id']
  });
  const ownedIds = new Set(owned.map((q) => String(q.transaction_id)));
  return txs.filter((t) => !ownedIds.has(String(t.id)));
}

/**
 * Record the transaction for a queued Zelle email — the Zelle Review "Create"
 * action. Amount, date and payer come from the queue row, never the client.
 *
 * Duplicate prevention, checked before anything is written:
 *  - the row already has a transaction                        -> ALREADY_POSTED
 *  - the bank already posted this exact payment (reference or
 *    unique payer/amount/date anchor)                          -> the row is
 *    attached to that transaction, POSTED_BY_BANK (not overridable)
 *  - a plausible but uncertain existing transaction            -> POSSIBLE_DUPLICATE,
 *    unless the treasurer re-submits with force
 *
 * On success, a bank row that is already uploaded and certainly this payment
 * is confirmed immediately, so Bank Reconciliation shows it matched.
 *
 * Returns { success, code?, message?, data?, candidates?, bank_link?, pledge_error? }.
 */
async function createTransactionFromQueueRow({
  queueId, memberId, paymentType, forYear = null, receiptNumber = null,
  payerName = null, force = false, pledgeAmount = null, user
}) {
  const { findBankRowsForQueueRow } = require('./zelleBankCorrelationService');
  const fail = (code, message, extra = {}) => ({ success: false, code, message, ...extra });

  if (!user?.id) throw new Error('Missing collector context');
  if (!memberId) return fail('MEMBER_REQUIRED', 'Select the member this payment is from.');
  const finalPaymentType = paymentType || 'donation';
  if (!QUEUE_CREATE_PAYMENT_TYPES.has(finalPaymentType)) {
    return fail('INVALID_PAYMENT_TYPE', `Payment type "${finalPaymentType}" cannot be recorded from a Zelle email.`);
  }
  // Opening a pledge with the payment, as Bank Reconciliation and Add Payment
  // offer when the member has no open pledge in the drive.
  if (pledgeAmount != null) {
    if (finalPaymentType !== 'pledge_drive') {
      return fail('INVALID_PLEDGE', 'A pledge can only be recorded with a Pledge Drive payment.');
    }
    if (!(parseFloat(pledgeAmount) >= 1)) {
      return fail('INVALID_PLEDGE', 'Pledge amount must be at least $1.00');
    }
  }

  const row = await ZelleEmailQueue.findByPk(queueId);
  if (!row) return fail('NOT_FOUND', 'Queue item not found');
  if (row.transaction_id) {
    // The transaction may have been deleted since (e.g. undo of a bank
    // auto-create); the email is then unposted again.
    if (await Transaction.findByPk(row.transaction_id, { attributes: ['id'] })) {
      return fail('ALREADY_POSTED', 'This payment already has a transaction.', { transaction_id: row.transaction_id });
    }
    await row.update({ transaction_id: null, bank_transaction_id: null, status: row.matched_member_id ? 'MATCHED' : 'NEEDS_REVIEW' });
  }
  if (row.status === 'IGNORED') return fail('IGNORED', 'This email was ignored; it cannot be posted.');
  if (row.amount == null || !row.payment_date) {
    return fail('INCOMPLETE', 'This email has no amount or date on file.');
  }

  const member = await Member.findByPk(memberId, { attributes: ['id'] });
  if (!member) return fail('MEMBER_NOT_FOUND', 'Member not found');

  const effectivePayerName = String(payerName || '').trim() || String(row.payer_name || '').trim() || null;
  if (!effectivePayerName) {
    return fail('PAYER_NAME_REQUIRED', 'This email has no payer name on file. Enter the payer name exactly as it appears on the bank statement.');
  }
  if (effectivePayerName !== row.payer_name) {
    // Correlation with the bank row keys off this name.
    await row.update({ payer_name: effectivePayerName });
  }

  const receiptValidation = validateReceiptNumber(receiptNumber);
  if (!receiptValidation.valid) return fail('INVALID_RECEIPT', receiptValidation.message);
  const normalizedReceiptNumber = receiptValidation.normalized || null;
  if (normalizedReceiptNumber && normalizedReceiptNumber !== '000') {
    const dup = await Transaction.findOne({ where: { receipt_number: normalizedReceiptNumber } });
    if (dup) return fail('DUPLICATE_RECEIPT', `Receipt number "${normalizedReceiptNumber}" has already been used.`);
  }

  // A legacy transaction already keyed by this email: adopt it.
  const legacy = await Transaction.findOne({ where: { external_id: row.external_id } });
  if (legacy) {
    await row.update({ transaction_id: legacy.id, status: 'CREATED', matched_member_id: legacy.member_id, processed_at: new Date() });
    return fail('ALREADY_POSTED', 'This payment already has a transaction.', { transaction_id: legacy.id });
  }

  // Bank already posted this payment?
  const bank = await findBankRowsForQueueRow(row);
  const certain = bank.tier === 'EXACT_REF' || bank.tier === 'ANCHORED';
  if (certain && bank.matches[0].transaction) {
    const { bankRow, transaction } = bank.matches[0];
    await row.update({
      transaction_id: transaction.id,
      bank_transaction_id: bankRow.id,
      matched_member_id: transaction.member_id || row.matched_member_id,
      status: 'BANK_POSTED',
      processed_at: new Date()
    });
    return fail('POSTED_BY_BANK', 'Bank reconciliation already recorded this payment; the email is now linked to it.', {
      transaction_id: transaction.id,
      candidates: [describeTransaction(transaction, bankRow)]
    });
  }

  if (!force) {
    const candidates = [];
    const seen = new Set();
    for (const m of bank.matches) {
      if (m.transaction && !seen.has(String(m.transaction.id))) {
        seen.add(String(m.transaction.id));
        candidates.push(describeTransaction(m.transaction, m.bankRow));
      }
    }
    for (const tx of await findMemberDuplicateCandidates(row, member.id)) {
      if (!seen.has(String(tx.id))) {
        seen.add(String(tx.id));
        candidates.push(describeTransaction(tx));
      }
    }
    if (candidates.length > 0) {
      return fail('POSSIBLE_DUPLICATE', 'This payment may already be recorded. Attach the email to the existing entry, or create anyway if it is a separate payment.', { candidates });
    }
  }

  const incomeCategory = await resolveIncomeCategory(finalPaymentType);
  const glCode = incomeCategory?.gl_code || 'INC999';

  let tx;
  try {
    tx = await sequelize.transaction(async (t) => {
      // Re-read under lock: a second click or a second treasurer loses here.
      const locked = await ZelleEmailQueue.findByPk(row.id, { transaction: t, lock: t.LOCK.UPDATE });
      if (locked.transaction_id) {
        const err = new Error('ALREADY_POSTED');
        err.code = 'ALREADY_POSTED';
        err.transactionId = locked.transaction_id;
        throw err;
      }

      const created = await Transaction.create({
        member_id: member.id,
        collected_by: user.id,
        payment_date: row.payment_date,
        amount: row.amount,
        payment_type: finalPaymentType,
        payment_method: 'zelle',
        status: 'succeeded',
        receipt_number: normalizedReceiptNumber,
        note: row.note || null,
        external_id: row.external_id,
        donation_id: null,
        income_category_id: incomeCategory?.id || null,
        for_year: forYear || (finalPaymentType === 'membership_due' ? Number(String(row.payment_date).slice(0, 4)) : null)
      }, { transaction: t });

      await LedgerEntry.create({
        type: finalPaymentType,
        category: glCode,
        amount: parseFloat(row.amount),
        entry_date: row.payment_date,
        member_id: member.id,
        payment_method: 'zelle',
        receipt_number: normalizedReceiptNumber,
        memo: `${glCode} - Zelle payment ${row.external_id}`,
        transaction_id: created.id,
        collected_by: user.id
      }, { transaction: t });

      await locked.update({
        transaction_id: created.id,
        status: 'CREATED',
        matched_member_id: member.id,
        match_confidence: 'high',
        match_source: 'TREASURER_CREATE',
        matched_by: user.id,
        matched_at: new Date(),
        processed_at: new Date(),
        error: null
      }, { transaction: t });

      return created;
    });
  } catch (err) {
    if (err.code === 'ALREADY_POSTED') {
      return fail('ALREADY_POSTED', 'This payment already has a transaction.', { transaction_id: err.transactionId });
    }
    if (err.name === 'SequelizeUniqueConstraintError') {
      return fail('ALREADY_POSTED', 'This payment already has a transaction.');
    }
    throw err;
  }

  // Everything below is best-effort: the payment is recorded.
  await learnZelleAssociation({ payerName: effectivePayerName, note: row.note, memberId: member.id });

  // Pledge side, exactly as Bank Reconciliation does it: a supplied
  // pledgeAmount opens a pledge credited with this payment; otherwise the
  // payment is credited to the member's open pledge, if any. Its own
  // transaction, and never fatal — the payment is recorded either way, and a
  // failure comes back as pledge_error for the treasurer to see.
  let pledgeError = null;
  try {
    await sequelize.transaction(async (t) => {
      if (pledgeAmount != null) {
        const { createPledgeWithPayment } = require('./pledgeFulfillmentService');
        const { findLiveCampaign } = require('./pledgeCampaignService');
        const campaign = await findLiveCampaign();
        if (!campaign) throw new Error('No pledge drive is currently open');
        const pledger = await Member.findByPk(member.id, { transaction: t });
        await createPledgeWithPayment({
          campaignId: campaign.id,
          amount: parseFloat(pledgeAmount),
          paymentAmount: parseFloat(tx.amount),
          transactionId: tx.id,
          memberId: member.id,
          firstName: pledger.first_name,
          lastName: pledger.last_name,
          source: 'treasurer_manual',
          allocatedBy: user.id
        }, { transaction: t });
      } else {
        const { maybeAllocateToPledge } = require('./pledgeAllocationService');
        await maybeAllocateToPledge(tx, { source: 'treasurer_manual', allocatedBy: user.id }, { transaction: t });
      }
    });
  } catch (e) {
    pledgeError = e.message;
    console.error('⚠️ Pledge allocation failed for Zelle transaction:', e.message);
  }

  // Bank row already uploaded and certainly this payment: confirm now.
  let bankLink = null;
  if (certain && bank.matches[0].bankRow.status === 'PENDING') {
    try {
      const { linkEmailPaymentToBankRow } = require('./zelleBankLinkService');
      await row.reload();
      bankLink = await linkEmailPaymentToBankRow({
        queueRow: row, transaction: tx, bankRow: bank.matches[0].bankRow, tier: bank.tier, user
      });
    } catch (e) {
      console.error('⚠️ Bank link failed for Zelle transaction:', e.message);
    }
  }

  await tx.reload();
  return { success: true, data: tx, bank_link: bankLink, pledge_error: pledgeError };
}

/**
 * Attach a queued email to a transaction that already exists — the answer to
 * POSSIBLE_DUPLICATE when the treasurer confirms "this is that payment".
 */
async function attachQueueRowToTransaction({ queueId, transactionId, userId = null }) {
  const { isBankHash } = require('./zelleBankCorrelationService');
  const fail = (code, message, extra = {}) => ({ success: false, code, message, ...extra });

  const row = await ZelleEmailQueue.findByPk(queueId);
  if (!row) return fail('NOT_FOUND', 'Queue item not found');
  if (row.transaction_id) return fail('ALREADY_POSTED', 'This payment already has a transaction.', { transaction_id: row.transaction_id });

  const tx = await Transaction.findByPk(transactionId);
  if (!tx) return fail('TRANSACTION_NOT_FOUND', 'Transaction not found');
  if (row.amount != null && Math.abs(Number(tx.amount) - Number(row.amount)) >= 0.005) {
    return fail('AMOUNT_MISMATCH', 'That transaction is for a different amount.');
  }
  const owner = await ZelleEmailQueue.findOne({ where: { transaction_id: tx.id } });
  if (owner) return fail('TRANSACTION_CLAIMED', 'That transaction already belongs to another Zelle email.');

  let bankRowId = null;
  if (isBankHash(tx.external_id)) {
    const { BankTransaction } = require('../models');
    const bankRow = await BankTransaction.findOne({ where: { transaction_hash: tx.external_id } });
    const claimed = bankRow && await ZelleEmailQueue.findOne({ where: { bank_transaction_id: bankRow.id } });
    if (bankRow && !claimed) bankRowId = bankRow.id;
  }

  await row.update({
    transaction_id: tx.id,
    bank_transaction_id: bankRowId,
    matched_member_id: tx.member_id || row.matched_member_id,
    status: isBankHash(tx.external_id) ? 'BANK_POSTED' : 'CREATED',
    match_source: 'TREASURER_ATTACH',
    matched_by: userId,
    matched_at: new Date(),
    processed_at: new Date(),
    error: null
  });

  if (tx.member_id && row.payer_name) {
    await learnZelleAssociation({ payerName: row.payer_name, note: row.note, memberId: tx.member_id });
  }
  return { success: true, data: row };
}

module.exports = {
  createTransactionFromQueueRow,
  attachQueueRowToTransaction,
  sanitizeNote,
  extractPayerName,
  extractZelleReference,
  buildZelleExternalId,
  cleanLegacyMemo,
  matchZelleSender,
  learnZelleAssociation,
  getDefaultPaymentType,
  createZelleTransaction,
  matchQueueRowToMember,
  resolveIncomeCategory
};
