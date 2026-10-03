/**
 * Decides whether a Zelle email (zelle_email_queue row) and a Chase bank row
 * (bank_transactions) describe the same payment. Used in both directions:
 * when a treasurer creates a transaction from an email, and when bank
 * reconciliation meets a Zelle credit.
 *
 * Tiers, most certain first:
 *
 *  EXACT_REF  The bank row's reference equals the email's Transaction number.
 *             Chase prints the same 11-digit number on both when the sender
 *             banks with Chase; other senders get a 12-character network id on
 *             the statement that appears nowhere in the email, so this covers
 *             only part of the traffic.
 *
 *  ANCHORED   Same amount, the email's payer name equals the bank's payer name
 *             (both are Chase's rendering of the sender), and the bank posted
 *             between 1 day before and 5 days after the email date. Only when
 *             the pairing is unique in BOTH directions: the bank row fits one
 *             email, and that email fits one bank row. Two payments from one
 *             payer for one amount in the same week are left to the treasurer.
 *
 *  CANDIDATES More than one plausible pairing, or (bank side only) an
 *             email-created transaction of the same amount in the window
 *             whose payer name is missing or differs. Never acted on
 *             automatically; shown to the treasurer and blocks a plain create.
 *
 * Pure lookups: nothing here writes.
 */
const { Op } = require('sequelize');
const { ZelleEmailQueue, BankTransaction, Transaction } = require('../models');
const { normalizeWords, sourceTypeFor } = require('./bankMemoMatchService');

// Bank posting date relative to the email date, in days. Observed pairs posted
// 0-3 days after the email; one day of slack on each side.
const DAYS_BEFORE = 1;
const DAYS_AFTER = 5;

function isBankHash(externalId) {
  return /^[a-f0-9]{32}$/i.test(String(externalId || ''));
}

function refExternalId(ref) {
  return ref ? `zelle:${String(ref).trim().toUpperCase()}` : null;
}

function samePayer(a, b) {
  const na = normalizeWords(a);
  return na.length >= 3 && na === normalizeWords(b);
}

// DATEONLY arithmetic on 'YYYY-MM-DD' strings, in UTC so no timezone shifts it.
function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function addDays(dateOnly, days) {
  const d = new Date(`${dateOnly}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function bankDateRangeForEmail(emailDate) {
  const day = toDateOnly(emailDate);
  return day ? [addDays(day, -DAYS_BEFORE), addDays(day, DAYS_AFTER)] : null;
}

function emailDateRangeForBank(bankDate) {
  const day = toDateOnly(bankDate);
  return day ? [addDays(day, -DAYS_AFTER), addDays(day, DAYS_BEFORE)] : null;
}

function isZelleCredit(bankRow) {
  const plain = bankRow?.get ? bankRow.get({ plain: true }) : bankRow;
  return !!plain && Number(plain.amount) > 0 && sourceTypeFor(plain) === 'ZELLE';
}

/**
 * The transaction a bank row is already reconciled to, if any. Linking sets
 * the transaction's external_id to the row's hash.
 */
async function transactionForBankRow(bankRow) {
  if (!bankRow?.transaction_hash) return null;
  return Transaction.findOne({ where: { external_id: bankRow.transaction_hash } });
}

/**
 * Email-created transactions not yet confirmed by the bank: the queue row
 * points at a live transaction, has no bank pairing, and the transaction
 * still carries its email key rather than a bank hash.
 */
async function unconfirmedEmailPayments(where) {
  const rows = await ZelleEmailQueue.findAll({
    where: { ...where, transaction_id: { [Op.ne]: null }, bank_transaction_id: null },
    include: [{ model: Transaction, as: 'transaction', required: true }]
  });
  return rows.filter((row) => row.transaction && !isBankHash(row.transaction.external_id)
    && row.transaction.status !== 'failed');
}

/**
 * Bank rows that could be this email's payment: Zelle credits for the amount,
 * in the date window, not ignored, and not already paired with another email.
 */
async function bankRowsFittingEmail(queueRow, { excludeQueueId = queueRow.id } = {}) {
  const range = bankDateRangeForEmail(queueRow.payment_date);
  if (!range || queueRow.amount == null || !queueRow.payer_name) return [];

  const rows = await BankTransaction.findAll({
    where: {
      amount: queueRow.amount,
      date: { [Op.between]: range },
      status: { [Op.ne]: 'IGNORED' }
    },
    order: [['date', 'ASC'], ['id', 'ASC']]
  });
  const fitting = rows.filter((b) => isZelleCredit(b) && samePayer(queueRow.payer_name, b.payer_name));
  return withoutClaimedBankRows(fitting, excludeQueueId);
}

async function withoutClaimedBankRows(bankRows, excludeQueueId) {
  if (bankRows.length === 0) return bankRows;
  const claimed = await ZelleEmailQueue.findAll({
    where: {
      bank_transaction_id: bankRows.map((b) => b.id),
      ...(excludeQueueId ? { id: { [Op.ne]: excludeQueueId } } : {})
    },
    attributes: ['bank_transaction_id']
  });
  const taken = new Set(claimed.map((q) => String(q.bank_transaction_id)));
  return bankRows.filter((b) => !taken.has(String(b.id)));
}

/**
 * Emails that could be this bank row's payment, by the anchor rule.
 * `where` narrows which queue rows count (e.g. only unposted ones).
 */
async function emailsFittingBankRow(bankRow, where = {}) {
  const range = emailDateRangeForBank(bankRow.date);
  if (!range || !bankRow.payer_name) return [];
  const rows = await ZelleEmailQueue.findAll({
    where: {
      ...where,
      amount: bankRow.amount,
      payment_date: { [Op.between]: range },
      status: { [Op.ne]: 'IGNORED' },
      [Op.or]: [{ bank_transaction_id: null }, { bank_transaction_id: bankRow.id }]
    },
    include: [{ model: Transaction, as: 'transaction', required: false }]
  });
  return rows.filter((q) => samePayer(q.payer_name, bankRow.payer_name));
}

/**
 * Bank side: which email-created transaction, if any, is this bank row?
 *
 * Returns { tier, matches: [{ queueRow, transaction }] } where tier is
 * 'EXACT_REF' | 'ANCHORED' | 'CANDIDATES' | null.
 */
async function findEmailPaymentsForBankRow(bankRow) {
  const none = { tier: null, matches: [] };
  if (!isZelleCredit(bankRow)) return none;

  const ref = refExternalId(bankRow.external_ref_id);
  if (ref) {
    const exact = await unconfirmedEmailPayments({ external_id: ref });
    if (exact.length === 1) {
      return { tier: 'EXACT_REF', matches: [{ queueRow: exact[0], transaction: exact[0].transaction }] };
    }
  }

  // Every email this row could be, posted or not: a second, unposted email
  // that fits just as well makes the pairing ambiguous even though only one
  // of them has a transaction to link.
  const fitting = await emailsFittingBankRow(bankRow);
  const unconfirmed = fitting.filter((q) => q.transaction_id && q.transaction
    && !isBankHash(q.transaction.external_id) && q.transaction.status !== 'failed');
  if (unconfirmed.length === 0) {
    // No payer anchor: the email has no name (older auto-created rows) or
    // spells it differently. Same amount in the window is still offered, so
    // the treasurer links instead of approving a second transaction.
    const range = emailDateRangeForBank(bankRow.date);
    if (!range) return none;
    const sameAmount = await unconfirmedEmailPayments({
      amount: bankRow.amount,
      payment_date: { [Op.between]: range },
      status: { [Op.ne]: 'IGNORED' }
    });
    return sameAmount.length === 0 ? none : {
      tier: 'CANDIDATES',
      matches: sameAmount.map((q) => ({ queueRow: q, transaction: q.transaction }))
    };
  }

  const matches = unconfirmed.map((q) => ({ queueRow: q, transaction: q.transaction }));
  if (fitting.length > 1) return { tier: 'CANDIDATES', matches };

  // Reverse direction: the email must fit only this bank row.
  const rowsForEmail = await bankRowsFittingEmail(unconfirmed[0]);
  const onlyThisRow = rowsForEmail.length === 1 && String(rowsForEmail[0].id) === String(bankRow.id);
  return { tier: onlyThisRow ? 'ANCHORED' : 'CANDIDATES', matches };
}

/**
 * Email side: which bank row, if any, is this email's payment?
 *
 * Returns { tier, matches: [{ bankRow, transaction }] }; transaction is the
 * one the bank row is already reconciled to (null while PENDING).
 */
async function findBankRowsForQueueRow(queueRow) {
  const none = { tier: null, matches: [] };
  const withTx = async (bankRow) => ({ bankRow, transaction: await transactionForBankRow(bankRow) });

  const ref = String(queueRow.external_id || '').startsWith('zelle:')
    ? queueRow.external_id.slice('zelle:'.length)
    : null;
  if (ref) {
    const exact = await withoutClaimedBankRows(await BankTransaction.findAll({
      where: {
        external_ref_id: { [Op.in]: [ref, ref.toLowerCase()] },
        status: { [Op.ne]: 'IGNORED' }
      }
    }), queueRow.id);
    const credits = exact.filter(isZelleCredit);
    if (credits.length === 1) return { tier: 'EXACT_REF', matches: [await withTx(credits[0])] };
  }

  const fitting = await bankRowsFittingEmail(queueRow);
  if (fitting.length === 0) return none;
  const matches = await Promise.all(fitting.map(withTx));
  if (fitting.length > 1) return { tier: 'CANDIDATES', matches };

  // Reverse direction: the bank row must fit only this email.
  const emails = await emailsFittingBankRow(fitting[0]);
  const onlyThisEmail = emails.length === 1 && String(emails[0].id) === String(queueRow.id);
  return { tier: onlyThisEmail ? 'ANCHORED' : 'CANDIDATES', matches };
}

/**
 * The queued email for a bank row that has NO transaction yet — used when
 * bank reconciliation creates the transaction, so the email can be marked
 * posted and the Zelle Review screen stops offering Create. Certain matches
 * only (exact reference, or a pairing unique in both directions).
 */
async function findUnpostedEmailForBankRow(bankRow) {
  if (!isZelleCredit(bankRow)) return null;

  const ref = refExternalId(bankRow.external_ref_id);
  if (ref) {
    const exact = await ZelleEmailQueue.findOne({
      where: { external_id: ref, transaction_id: null, bank_transaction_id: null, status: { [Op.ne]: 'IGNORED' } }
    });
    if (exact) return exact;
  }

  const fitting = await emailsFittingBankRow(bankRow);
  if (fitting.length !== 1 || fitting[0].transaction_id) return null;
  const rowsForEmail = await bankRowsFittingEmail(fitting[0]);
  return rowsForEmail.length === 1 && String(rowsForEmail[0].id) === String(bankRow.id) ? fitting[0] : null;
}

module.exports = {
  findUnpostedEmailForBankRow,
  findEmailPaymentsForBankRow,
  findBankRowsForQueueRow,
  isBankHash,
  samePayer,
  DAYS_BEFORE,
  DAYS_AFTER
};
