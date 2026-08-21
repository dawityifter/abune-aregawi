// Transaction creation logic extracted from transactionController.js's
// createTransaction (verbatim — see backend/src/controllers/transactionController.js
// git history for the original inline version). Exists so that other flows
// (e.g. pledge payment allocation) can create a Transaction + LedgerEntry pair
// without duplicating receipt validation, GL/income-category mapping, and
// ledger-entry creation.
//
// NOTE on donor_name: the `payload.donor_name` field is accepted (and Transaction
// has a `donor_name` column) but, matching the original controller's behavior,
// it is NOT written to the Transaction row here — the original code only folds
// donor_name into the free-text `note` (via buildDonorNote, which stays in the
// controller since it needs donor_type/donor_email/donor_phone/donor_memo that
// aren't part of this payload). This looks like a pre-existing gap, not
// something introduced by this extraction; it is deliberately left as-is.

const { Transaction, Member, LedgerEntry, IncomeCategory } = require('../models');
const tz = require('../config/timezone');
const { validateReceiptNumber } = require('../utils/receiptNumber');

class TransactionServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'TransactionServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Validates a transaction payload and resolves its GL code / income category,
 * verifying that the collector (and, if given, the member) exist. Throws a
 * TransactionServiceError (with `.statusCode`) on any failure. Moved verbatim
 * from transactionController.js's createTransaction.
 *
 * @returns {Promise<{normalizedReceiptNumber: string|null, glCode: string, finalIncomeCategoryId: *}>}
 */
async function validateAndResolveTransaction(payload, options = {}) {
  const { transaction } = options;
  const {
    member_id,
    collected_by,
    amount,
    payment_type,
    payment_method,
    receipt_number,
    income_category_id
  } = payload;

  // Validate required fields (member_id is optional for anonymous donations)
  if (!collected_by || !amount || !payment_type || !payment_method) {
    throw new TransactionServiceError(
      'Missing required fields: collected_by, amount, payment_type, payment_method',
      400
    );
  }

  // Validate: membership_due requires a member_id
  if (!member_id && payment_type === 'membership_due') {
    throw new TransactionServiceError(
      'Membership dues cannot be paid anonymously. A member must be selected.',
      400
    );
  }

  // Validate amount (minimum $1)
  if (parseFloat(amount) < 1) {
    throw new TransactionServiceError('Amount must be at least $1.00', 400);
  }

  const receiptValidation = validateReceiptNumber(receipt_number);
  if (!receiptValidation.valid) {
    throw new TransactionServiceError(receiptValidation.message, 400);
  }
  const normalizedReceiptNumber = receiptValidation.normalized;

  // Validate receipt number for cash/check payments
  if (['cash', 'check'].includes(payment_method) && !normalizedReceiptNumber) {
    throw new TransactionServiceError('Receipt number is required for cash and check payments', 400);
  }

  // Check for duplicate receipt number ('000' is allowed as a no-receipt placeholder)
  if (normalizedReceiptNumber && normalizedReceiptNumber !== '000') {
    const existing = await Transaction.findOne({
      where: { receipt_number: normalizedReceiptNumber },
      transaction
    });
    if (existing) {
      throw new TransactionServiceError(
        `Receipt number "${normalizedReceiptNumber}" has already been used. Please use a unique receipt number.`,
        409
      );
    }
  }

  // Determine GL code from income_category_id or auto-assign from payment_type
  let glCode = payment_type; // Fallback to payment_type for backward compatibility
  let finalIncomeCategoryId = income_category_id;

  if (income_category_id) {
    // User explicitly selected an income category
    const incomeCategory = await IncomeCategory.findByPk(income_category_id, { transaction });
    if (incomeCategory) {
      glCode = incomeCategory.gl_code;
    } else {
      throw new TransactionServiceError('Invalid income category ID', 400);
    }
  } else {
    // Auto-assign income category based on payment_type mapping
    let incomeCategory = await IncomeCategory.findOne({
      where: { payment_type_mapping: payment_type },
      transaction
    });

    // Fallback mappings for payment types without direct mapping
    if (!incomeCategory) {
      const fallbackMappings = {
        tithe: 'offering',        // tithe → INC002 (Weekly Offering)
        building_fund: 'event'    // building_fund → INC003 (Fundraising)
      };

      const fallbackType = fallbackMappings[payment_type];
      if (fallbackType) {
        incomeCategory = await IncomeCategory.findOne({
          where: { payment_type_mapping: fallbackType },
          transaction
        });
      }
    }

    if (incomeCategory) {
      finalIncomeCategoryId = incomeCategory.id;
      glCode = incomeCategory.gl_code;
    }
  }

  // Verify that collector exists and member exists (if provided)
  const collector = await Member.findByPk(collected_by, { transaction });
  if (!collector) {
    throw new TransactionServiceError('Collector not found', 400);
  }

  // Verify member exists only if member_id is provided (not anonymous)
  if (member_id) {
    const member = await Member.findByPk(member_id, { transaction });
    if (!member) {
      throw new TransactionServiceError('Member not found', 400);
    }
  }

  return { normalizedReceiptNumber, glCode, finalIncomeCategoryId };
}

/**
 * Creates the LedgerEntry side effect for a transaction. Moved verbatim from
 * transactionController.js's createTransaction. Ledger entries are optional
 * (gradual migration): failures are swallowed, matching original behavior.
 */
async function createLedgerEntryForTransaction(transactionRecord, payload, resolved, options = {}) {
  const { transaction } = options;
  const { payment_type, amount, payment_date, payment_method, note, collected_by, member_id, external_id } = payload;
  const { glCode, normalizedReceiptNumber } = resolved;

  try {
    const entryDate = payment_date ? tz.parseDate(payment_date) : tz.now();
    const memo = `${glCode} - ${note || 'No description'}`;

    await LedgerEntry.create({
      type: payment_type, // Keep payment_type for backward compatibility
      category: glCode, // Use GL code for categorization (INC001, INC002, etc.)
      amount: parseFloat(amount),
      entry_date: entryDate,
      payment_method,
      receipt_number: normalizedReceiptNumber || null,
      memo,
      collected_by,
      member_id,
      transaction_id: transactionRecord.id,
      source_system: 'manual',
      external_id: external_id || null,
      fund: null,
      attachment_url: null,
      statement_date: null
    }, { transaction });
  } catch (ledgerError) {
    // Ledger entries are optional - log error but don't fail transaction
    console.warn('⚠️  Could not create ledger entry (table may not exist):', ledgerError.message);
  }
}

/**
 * Validates a transaction payload, resolves its GL mapping, creates the
 * Transaction row, and creates its LedgerEntry side effect. This is the
 * "plain create" path from transactionController.js's createTransaction,
 * moved verbatim. When `options.transaction` is passed, every create call
 * uses it so the caller can roll both the Transaction and LedgerEntry back
 * together.
 *
 * @param {object} payload { member_id, collected_by, payment_date, amount,
 *   payment_type, payment_method, receipt_number, note, donor_name,
 *   external_id, for_year, donation_id } — plus optional `status` and
 *   `income_category_id` for callers (like the controller) that need them.
 * @param {object} [options] { transaction } — a Sequelize transaction.
 * @returns {Promise<Transaction>}
 */
async function createTransactionRecord(payload, options = {}) {
  const { transaction } = options;
  const {
    member_id,
    collected_by,
    payment_date,
    amount,
    payment_type,
    payment_method,
    note,
    external_id,
    status = 'succeeded', // Default transaction status
    donation_id,
    income_category_id,
    for_year
  } = payload;

  const resolved = await validateAndResolveTransaction(
    { member_id, collected_by, amount, payment_type, payment_method, receipt_number: payload.receipt_number, income_category_id },
    { transaction }
  );
  const { normalizedReceiptNumber, finalIncomeCategoryId } = resolved;

  const created = await Transaction.create({
    member_id,
    collected_by,
    payment_date: payment_date ? tz.parseDate(payment_date) : tz.now(),
    amount: parseFloat(amount),
    payment_type,
    payment_method,
    receipt_number: normalizedReceiptNumber,
    note: note || '',
    external_id: external_id || null,
    status,
    donation_id: donation_id || null,
    income_category_id: finalIncomeCategoryId,
    for_year: for_year || null
  }, { transaction });

  await createLedgerEntryForTransaction(created, payload, resolved, { transaction });

  return created;
}

module.exports = {
  createTransactionRecord,
  validateAndResolveTransaction,
  createLedgerEntryForTransaction,
  TransactionServiceError
};
