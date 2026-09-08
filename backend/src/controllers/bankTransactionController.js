const asyncHandler = require('express-async-handler');
const { BankTransaction, Member, LedgerEntry, IncomeCategory, Transaction, ZelleMemoMatch, ExpenseCategory, sequelize } = require('../models');
const { parseChaseCSV } = require('../services/bankParserService');
const { parseCheckNumber } = require('../utils/checkNumber');

/**
 * @desc    Upload and parse bank CSV
 * @route   POST /api/bank/upload
 * @access  Private (Admin/Treasurer)
 */
exports.uploadBankCSV = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('Please upload a CSV file');
    }

    try {
        const parsedTransactions = parseChaseCSV(req.file.buffer);
        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };

        if (parsedTransactions.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No transactions found in CSV',
                data: results
            });
        }

        // 1. Fetch existing transactions by hash
        const hashes = parsedTransactions.map(t => t.transaction_hash);
        const existingRecords = await BankTransaction.findAll({
            where: { transaction_hash: hashes },
            attributes: ['id', 'transaction_hash', 'balance']
        });

        const existingMap = new Map();
        existingRecords.forEach(r => existingMap.set(r.transaction_hash, r));

        // 2. Separate into "To Create" and "To Update"
        const toCreate = [];
        const toUpdate = [];

        for (const txn of parsedTransactions) {
            const existing = existingMap.get(txn.transaction_hash);

            if (!existing) {
                // Ensure we don't add the same hash twice if it appears multiple times in the CSV
                if (!toCreate.some(t => t.transaction_hash === txn.transaction_hash)) {
                    toCreate.push(txn);
                } else {
                    results.skipped++;
                }
            } else {
                // Check if we need to update balance (existing is null, new is not)
                if (existing.balance === null && txn.balance !== null) {
                    toUpdate.push({
                        id: existing.id,
                        balance: txn.balance,
                        raw_data: txn.raw_data
                    });
                }
                results.skipped++;
            }
        }

        // 3. Bulk Create New Transactions
        let createdIds = [];
        if (toCreate.length > 0) {
            // Use chunks to avoid too large SQL queries if necessary, though 1000s is usually fine.
            // SQLite/Postgres can handle moderate batch sizes.
            await BankTransaction.bulkCreate(toCreate);
            results.imported += toCreate.length;
            // Re-query the just-created rows by hash to get their IDs (dialect-agnostic;
            // these hashes were not in the DB before, so they match only the new rows).
            const createdRows = await BankTransaction.findAll({
                where: { transaction_hash: toCreate.map(t => t.transaction_hash) },
                attributes: ['id']
            });
            createdIds = createdRows.map(r => r.id);
        }

        // 4. Update Existing (Parallel Promises)
        // Since we only update balance/raw_data, we can run these in parallel
        if (toUpdate.length > 0) {
            const updatePromises = toUpdate.map(update =>
                BankTransaction.update(
                    { balance: update.balance, raw_data: update.raw_data },
                    { where: { id: update.id } }
                )
            );
            // Process in batches of 50 to avoid connection pool exhaustion
            const batchSize = 50;
            for (let i = 0; i < updatePromises.length; i += batchSize) {
                await Promise.all(updatePromises.slice(i, i + batchSize));
            }
        }

        // 5. Automatic reconciliation pass over ONLY the newly-imported transactions.
        // Re-scanning the entire PENDING backlog on every upload made this request grow
        // unbounded and time out behind nginx (60s upstream read timeout -> 504, surfaced
        // in the browser as a CORS error). Older pending rows are re-checked via the
        // "Auto-reconcile pending" button in Bank Transactions (batched endpoint below).
        // Very large imports skip the inline pass too (each row costs several queries);
        // the response flags this so the UI can point at the button instead.
        const inlineLimit = parseInt(process.env.UPLOAD_AUTO_RECONCILE_LIMIT, 10) || 200;
        let autoStats = null;
        let autoDeferred = false;
        if (createdIds.length > 0 && createdIds.length <= inlineLimit) {
            try {
                const { autoReconcilePending } = require('../services/autoReconcileService');
                autoStats = await autoReconcilePending({ user: req.user, transactionIds: createdIds });
            } catch (autoErr) {
                console.error('Auto-reconcile pass failed (upload still succeeded):', autoErr.message);
            }
        } else if (createdIds.length > inlineLimit) {
            autoDeferred = true;
        }

        res.status(200).json({
            success: true,
            message: `Processed ${parsedTransactions.length} rows`,
            data: { ...results, auto_reconcile: autoStats, auto_reconcile_deferred: autoDeferred }
        });

    } catch (error) {
        console.error('CSV Upload Error:', error);

        // Detailed logging for Sequelize validation errors
        if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
            console.error('Validation Error Details:', error.errors.map(e => ({
                message: e.message,
                path: e.path,
                value: e.value
            })));
        }

        res.status(500);
        throw new Error('Error processing CSV: ' + (error.errors ? error.errors[0].message : error.message));
    }
});

/**
 * @desc    Get all bank transactions
 * @route   GET /api/bank/transactions
 * @access  Private
 */
/**
 * Classify a bank row's check reconciliation for the list UI.
 * Returns null for anything that isn't a check debit, so non-check rows keep
 * their normal pending/matched treatment.
 */
/**
 * Classify a returned deposited item — a check the church deposited that
 * bounced. The serial Chase reports is the DONOR's, so this looks for the
 * income entry it reverses, never the church's own checkbook.
 *
 * Returns null for anything that isn't a return, so ordinary rows are untouched.
 */
async function describeReturnedItem(txn, plain) {
    const { isReturnedItem } = require('../services/bankParserService');
    if (!isReturnedItem(plain)) return null;

    const serialMatch = String(plain.description || '').match(/CHK\s*SER#?\s*(\d+)/i);
    const checkNumber = parseCheckNumber(plain.check_number) || parseCheckNumber(serialMatch && serialMatch[1]);
    const bankAmount = Math.abs(Number(plain.amount));

    const base = { state: 'RETURNED', check_number: checkNumber, bank_amount: bankAmount };
    if (!checkNumber) {
        return { ...base, reverses_ledger_entry_id: null, receipt_number: null, reason: 'NO_CHECK_SERIAL' };
    }

    // Income entries only: this reverses a gift the church received.
    const original = await LedgerEntry.findOne({
        where: { type: { [require('sequelize').Op.ne]: 'expense' }, check_number: checkNumber }
    });

    if (!original) {
        return { ...base, reverses_ledger_entry_id: null, receipt_number: null, reason: 'ORIGINAL_NOT_FOUND' };
    }

    return {
        ...base,
        reverses_ledger_entry_id: original.id,
        receipt_number: original.receipt_number || null,
        original_amount: Number(original.amount),
        reason: Math.abs(Number(original.amount) - bankAmount) < 0.005 ? null : 'AMOUNT_MISMATCH'
    };
}

/**
 * The expense classification a debit's payee was last given, for the reconcile
 * screen to pre-fill.
 *
 * Read-only: it reuses the same learned mapping auto-reconcile consults, so a
 * suggestion and an automatic booking can never disagree about a payee. The
 * category name is resolved here rather than in the UI, which has no GL code
 * lookup on the bank screen.
 *
 * Returns null whenever nothing was learned, or when several learnings for the
 * payee disagree — findLearnedExpense withholds a mapping in that case, and a
 * suggestion the treasurer cannot trust is worse than none.
 */
async function suggestExpenseClassification(plain) {
    const { findLearnedExpense } = require('../services/autoReconcileService');
    const mapping = await findLearnedExpense(plain);
    if (!mapping) return null;

    const category = await ExpenseCategory.findOne({
        where: { gl_code: mapping.gl_code },
        attributes: ['gl_code', 'name', 'is_active']
    });
    // An inactive GL code would fail validation on submit, so do not offer it.
    if (!category || !category.is_active) return null;

    return {
        gl_code: mapping.gl_code,
        category_name: category.name,
        payee_name: mapping.payee_name || null,
        vendor_id: mapping.vendor_id || null,
        employee_id: mapping.employee_id || null,
        reason: 'Previously classified for this payee'
    };
}

async function describeCheckStatus(txn, plain) {
    const { checkNumberFor } = require('../services/autoReconcileService');
    const { sourceTypeFor } = require('../services/bankMemoMatchService');
    const { isReturnedItem } = require('../services/bankParserService');

    // A return carries the donor's serial, not one of the church's own checks.
    if (isReturnedItem(plain)) return null;

    const isDebit = Number(plain.amount) < 0;
    const checkNumber = checkNumberFor(plain);
    if (!isDebit || (sourceTypeFor(plain) !== 'CHECK' && !checkNumber)) return null;

    if (txn.status === 'MATCHED') {
        return {
            state: 'RECONCILED',
            check_number: checkNumber,
            ledger_entry_id: (plain.reconciled_meta || {}).ledger_entry_id || null
        };
    }
    if (txn.status === 'IGNORED') return null;

    const bankAmount = Math.abs(Number(plain.amount));
    if (!checkNumber) {
        return { state: 'NOT_RECONCILED', reason: 'NO_CHECK_NUMBER', check_number: null, bank_amount: bankAmount };
    }

    const candidates = await LedgerEntry.findAll({
        where: { type: 'expense', check_number: checkNumber }
    });

    if (candidates.length === 0) {
        return { state: 'NOT_RECONCILED', reason: 'NO_MANUAL_ENTRY', check_number: checkNumber, bank_amount: bankAmount };
    }

    // The number exists, so the amounts must be what disagree — show both so the
    // treasurer can tell which side was mistyped.
    const mismatched = candidates.find((e) => Math.abs(Number(e.amount) - bankAmount) >= 0.005);
    if (mismatched) {
        return {
            state: 'NOT_RECONCILED',
            reason: 'AMOUNT_MISMATCH',
            check_number: checkNumber,
            bank_amount: bankAmount,
            expense_amount: Number(mismatched.amount),
            ledger_entry_id: mismatched.id
        };
    }

    // Amount agrees but the expense is spoken for by another bank row.
    return {
        state: 'NOT_RECONCILED',
        reason: 'ALREADY_LINKED',
        check_number: checkNumber,
        bank_amount: bankAmount,
        ledger_entry_id: candidates[0].id
    };
}

exports.getBankTransactions = asyncHandler(async (req, res) => {
    const { status, type, startDate, endDate, description, search, page = 1, limit = 50 } = req.query;
    const { Op } = require('sequelize');

    const likeOp = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
    const contains = (value) => ({ [likeOp]: `%${String(value).trim()}%` });

    const where = {};
    if (status) where.status = status;
    if (type) {
        const normalizedType = String(type).trim().toUpperCase();
        if (normalizedType === 'DEBIT') {
            where[Op.or] = [
                { type: contains('DEBIT') },
                { amount: { [Op.lt]: 0 } }
            ];
        } else {
            where.type = contains(normalizedType);
        }
    }

    if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date[Op.gte] = new Date(startDate);
        if (endDate) where.date[Op.lte] = new Date(endDate);
    }

    const searchTerm = String(search || description || '').trim();
    if (searchTerm) {
        const searchClauses = [
            { description: contains(searchTerm) },
            { payer_name: contains(searchTerm) },
            { check_number: contains(searchTerm) },
            { external_ref_id: contains(searchTerm) },
            { '$member.first_name$': contains(searchTerm) },
            { '$member.last_name$': contains(searchTerm) }
        ];

        if (where[Op.or]) {
            where[Op.and] = [
                { [Op.or]: where[Op.or] },
                { [Op.or]: searchClauses }
            ];
            delete where[Op.or];
        } else {
            where[Op.or] = searchClauses;
        }
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await BankTransaction.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['date', 'DESC']],
        distinct: true,
        include: [{
            model: Member,
            as: 'member',
            attributes: ['id', 'first_name', 'last_name', 'phone_number']
        }]
    });

    const { suggestMatch, suggestMatches } = require('../services/reconciliationService');

    // Enrich with suggestions for Pending items, and reconciliation details for Matched items
    const matchedHashes = rows
        .filter(txn => txn.status === 'MATCHED' && txn.transaction_hash)
        .map(txn => txn.transaction_hash);

    const matchedTransactions = matchedHashes.length > 0
        ? await Transaction.findAll({
            where: { external_id: matchedHashes },
            attributes: ['external_id', 'receipt_number']
        })
        : [];

    const receiptByHash = new Map(
        matchedTransactions.map(tx => [tx.external_id, tx.receipt_number])
    );

    // Fetch reconciliation details (payee_name, memo) from LedgerEntry for expense reconciliations
    // Every expense linked to these rows, however it got there. This used to
    // require source_system 'bank_reconciliation', which silently excluded the
    // match-only flow: a cleared check links the expense the treasurer entered
    // BY HAND, whose source_system is 'manual'. Those rows showed no expense
    // detail at all.
    const ledgerEntries = matchedHashes.length > 0
        ? await LedgerEntry.findAll({
            where: {
                external_id: matchedHashes,
                type: 'expense'
            },
            attributes: [
                'id', 'external_id', 'category', 'amount', 'entry_date', 'payment_method',
                'check_number', 'receipt_number', 'payee_name', 'memo', 'source_system'
            ]
        })
        : [];

    // GL code -> display name, so the drawer can say "EXP100 · Utilities"
    // instead of making the treasurer decode the code.
    const expenseGlCodes = [...new Set(ledgerEntries.map(e => e.category).filter(Boolean))];
    const expenseCategories = expenseGlCodes.length > 0
        ? await ExpenseCategory.findAll({ where: { gl_code: expenseGlCodes } })
        : [];
    const categoryNameByGl = new Map(expenseCategories.map(c => [c.gl_code, c.name]));

    const reconcilationByHash = new Map(
        ledgerEntries.map(entry => [entry.external_id, {
            id: entry.id,
            category: entry.category,
            category_name: categoryNameByGl.get(entry.category) || null,
            amount: entry.amount,
            entry_date: entry.entry_date,
            payment_method: entry.payment_method,
            check_number: entry.check_number,
            receipt_number: entry.receipt_number,
            payee_name: entry.payee_name,
            memo: entry.memo,
            source_system: entry.source_system
        }])
    );

    const enrichedRows = await Promise.all(rows.map(async (txn) => {
        const plain = txn.get({ plain: true });
        if (txn.status === 'MATCHED' && txn.transaction_hash) {
            plain.receipt_number = receiptByHash.get(txn.transaction_hash) || null;
            // Include reconciliation details (payee_name, memo) from LedgerEntry if available
            const reconcilationDetails = reconcilationByHash.get(txn.transaction_hash);
            if (reconcilationDetails) {
                plain.reconciled_expense = reconcilationDetails;
                // Kept alongside the fuller object: existing callers read these.
                plain.reconciled_payee_name = reconcilationDetails.payee_name;
                plain.reconciled_memo = reconcilationDetails.memo;
            }
        }
        // A cleared check is only reconciled once it lines up with an expense the
        // treasurer entered by hand. Computed per row rather than stored, so the
        // answer stays true as expenses are added and corrected.
        const returnedItem = await describeReturnedItem(txn, plain);
        if (returnedItem) {
            plain.returned_item = returnedItem;
        }

        const checkStatus = await describeCheckStatus(txn, plain);
        if (checkStatus) {
            plain.check_status = checkStatus;
        }

        if (txn.status === 'PENDING') {
            try {
                // 1. Suggest Member Match
                const suggestions = await suggestMatches(plain);
                if (suggestions.length > 0) {
                    plain.suggested_matches = suggestions;
                    plain.suggested_match = suggestions[0];
                } else {
                    const suggestion = await suggestMatch(plain);
                    if (suggestion) {
                        plain.suggested_match = suggestion;
                        plain.suggested_matches = [suggestion];
                    }
                }

                // 2. Find Potential System Duplicates (Matches)
                const { findPotentialMatches } = require('../services/reconciliationService');
                // Zelle needs a wider window than the ±2 day default: the email
                // arrives when the payment is sent, but the bank can post it
                // several days later over weekends and holidays. Zelle rows are
                // no longer auto-linked, so this list is the treasurer's only
                // view of a possible existing entry.
                const { sourceTypeFor } = require('../services/bankMemoMatchService');
                const dayWindow = sourceTypeFor(plain) === 'ZELLE' ? 5 : 2;
                const potentialMatches = await findPotentialMatches(plain, { dayWindow });
                if (potentialMatches && potentialMatches.length > 0) {
                    plain.potential_matches = potentialMatches;
                }

            } catch (err) {
                console.error(`Error enriching transaction ${txn.id}:`, err.message);
                // Continue without enrichment to avoid blocking list loading
            }

            // 3. Suggest an expense classification for a debit whose payee the
            // treasurer has classified before. Auto-reconcile records these
            // itself for ACH, so in practice this surfaces on card purchases,
            // which are deliberately left for confirmation — one merchant's GL
            // code varies from charge to charge.
            //
            // Deliberately outside the block above: those are member-matching
            // concerns, and a failure in one of them used to take every later
            // enrichment down with it. An expense suggestion does not depend on
            // any of them, so it should not share their fate.
            if (Number(plain.amount) < 0) {
                try {
                    const suggestion = await suggestExpenseClassification(plain);
                    if (suggestion) {
                        plain.suggested_expense = suggestion;
                    }
                } catch (err) {
                    console.error(`Error suggesting expense for transaction ${txn.id}:`, err.message);
                }
            }
        }
        return plain;
    }));

    // Get current balance (balance of the most recent transaction with a valid balance)
    // Since parsed Chase CSVs list newest transactions first, bulkCreate assigns the LOWEST id
    // to the NEWEST transaction on any given day. So id ASC is chronologically newest.
    const latestTxn = await BankTransaction.findOne({
        where: { balance: { [Op.ne]: null } },
        order: [['date', 'DESC'], ['id', 'ASC']],
        attributes: ['balance', 'date']
    });

    let currentBalance = 0;
    if (latestTxn) {
        currentBalance = Number(latestTxn.balance);
        
        // Add pending/newer transactions that don't have a balance but affect current totals
        const newerTxnsSum = await BankTransaction.sum('amount', {
            where: {
                date: { [Op.gt]: latestTxn.date }
            }
        });
        
        if (newerTxnsSum) {
            currentBalance += Number(newerTxnsSum);
        }
    }

    res.status(200).json({
        success: true,
        data: {
            current_balance: Number(currentBalance.toFixed(2)),
            transactions: enrichedRows,
            pagination: {
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit)
            }
        }
    });
});

/**
 * @desc    Reconcile a bank transaction (create donation + link)
 * @route   POST /api/bank/reconcile
 * @access  Private (Treasurer)
 */
exports.reconcileTransaction = asyncHandler(async (req, res) => {
    const { transaction_id, member_id, payment_type, action, existing_transaction_id, receipt_number } = req.body;
    // action: 'MATCH' (default), 'IGNORE'

    const txn = await BankTransaction.findByPk(transaction_id);
    if (!txn) {
        res.status(404);
        throw new Error('Transaction not found');
    }

    if (txn.status === 'MATCHED' || txn.status === 'IGNORED') {
        return res.status(400).json({ success: false, message: 'Transaction already processed' });
    }

    if (action === 'IGNORE') {
        txn.status = 'IGNORED';
        await txn.save();
        return res.json({ success: true, message: 'Transaction ignored' });
    }

    // Default: MATCH
    if (!member_id && !existing_transaction_id) {
        res.status(400);
        throw new Error('Member ID or Existing Transaction ID required for matching');
    }

    try {
        const { processReconciliation } = require('../services/reconciliationService');
        const results = await processReconciliation({
            bankTxnId: transaction_id,
            memberId: member_id,
            paymentType: payment_type,
            user: req.user,
            existingTransactionId: existing_transaction_id,
            forYear: req.body.for_year, // Pass year override if provided
            receiptNumber: receipt_number
        });

        res.json({ success: true, ...results });
    } catch (error) {
        console.error('Reconciliation error:', error);
        res.status(500);
        throw new Error(error.message);
    }
});

/**
 * @desc    Bulk reconcile bank transactions
 * @route   POST /api/bank/reconcile-bulk
 * @access  Private (Treasurer)
 */
exports.reconcileBulkTransactions = asyncHandler(async (req, res) => {
    const { transaction_ids, member_id, payment_type } = req.body;

    if (!Array.isArray(transaction_ids) || transaction_ids.length === 0) {
        res.status(400);
        throw new Error('Transaction IDs array required');
    }

    if (!member_id) {
        res.status(400);
        throw new Error('Member ID required for bulk matching');
    }

    // Bulk member-linking is for deposits. A debit is money the church spent
    // and belongs to an expense with a GL code and a payee, not to a member
    // with a payment type.
    //
    // Checked up front, over the whole batch, for two reasons. A debit that
    // reached processReconciliation had its NEGATIVE amount passed into a
    // member donation, and was stopped only by Transaction.amount's $1.00
    // minimum — a rule about how small a gift may be, which rejects a negative
    // one by coincidence rather than by intent. And rejecting per row inside
    // the loop would leave the deposits in a mixed selection reconciled while
    // the debits failed, reported as a 200 with a bare "N failed" — which is
    // how selected debits went unnoticed to begin with.
    const { Op } = require('sequelize');
    const debits = await BankTransaction.findAll({
        where: { id: transaction_ids, amount: { [Op.lt]: 0 } },
        attributes: ['id']
    });

    if (debits.length > 0) {
        const ids = debits.map((row) => row.id).join(', ');
        // status on the error, not on res: the global handler reads
        // error.status and would otherwise report this as a 500.
        const err = new Error(
            `Selection contains ${debits.length} debit ${debits.length === 1 ? 'transaction' : 'transactions'} `
            + `(${ids}). Debits are money spent and must be recorded as expenses with an expense `
            + 'category, not linked to a member. Select deposits only.'
        );
        err.status = 400;
        throw err;
    }

    const { processReconciliation } = require('../services/reconciliationService');

    const results = {
        success: [],
        errors: []
    };

    for (const id of transaction_ids) {
        try {
            await processReconciliation({
                bankTxnId: id,
                memberId: member_id,
                paymentType: payment_type,
                user: req.user,
                forYear: req.body.for_year, // Pass year override
                receiptNumber: req.body.receipt_number
            });
            results.success.push(id);
        } catch (error) {
            console.error(`Failed to reconcile txn ${id}:`, error);
            results.errors.push({ id, message: error.message });
        }
    }

    res.json({
        success: true,
        message: `Processed ${transaction_ids.length} items. Success: ${results.success.length}, Errors: ${results.errors.length}`,
        data: results
    });
});

/**
 * Record one bank debit as an expense and mark the row matched.
 *
 * Shared by the single-transaction endpoint and the bulk one so both derive the
 * payment method, resolve the check number and link external_id the same way —
 * that link is what keeps a debit from being counted twice by the reports.
 *
 * The caller owns the database transaction, which is what lets the bulk path
 * commit its whole batch or none of it.
 */
async function recordExpenseForBankTxn(bankTxn, {
    gl_code, payee_name, vendor_id, employee_id, memo, check_number, userId
}, t) {
    // Derived from the bank row, not assumed. This used to hardcode 'check',
    // which filed every ACH and card debit as a check with no check number —
    // the same phantom "missing check number" rows the automatic pass used
    // to produce.
    const { paymentMethodForBankTxn, checkNumberFor } = require('../services/autoReconcileService');
    const paymentMethod = paymentMethodForBankTxn(bankTxn);
    const resolvedCheckNumber = paymentMethod === 'check'
        ? (parseCheckNumber(check_number) || checkNumberFor(bankTxn))
        : null;

    const expense = await LedgerEntry.create({
        type:           'expense',
        category:       gl_code,
        amount:         Math.abs(bankTxn.amount),
        entry_date:     bankTxn.date,
        payment_method: paymentMethod,
        check_number:   resolvedCheckNumber,
        memo:           memo || bankTxn.description,
        payee_name:     payee_name || bankTxn.payer_name || null,
        vendor_id:      vendor_id  || null,
        employee_id:    employee_id || null,
        external_id:    bankTxn.transaction_hash,
        collected_by:   userId,
        source_system:  'bank_reconciliation',
    }, { transaction: t });

    bankTxn.status = 'MATCHED';
    bankTxn.reconciled_source = 'MANUAL';
    bankTxn.reconciled_at = new Date();
    await bankTxn.save({ transaction: t });

    return expense;
}

/**
 * @desc    Reconcile a bank debit by recording an expense ledger entry
 * @route   POST /api/bank/reconcile-expense
 * @access  Private (Admin/Treasurer/Bookkeeper)
 */
exports.reconcileExpense = asyncHandler(async (req, res) => {
    const { transaction_id, gl_code, payee_name, vendor_id, employee_id, memo, check_number } = req.body;
    if (!transaction_id || !gl_code) {
        res.status(400); throw new Error('transaction_id and gl_code are required');
    }
    const t = await sequelize.transaction();
    try {
        const bankTxn = await BankTransaction.findByPk(transaction_id, { transaction: t });
        if (!bankTxn) { res.status(404); throw new Error('Bank transaction not found'); }
        if (bankTxn.status !== 'PENDING') { res.status(409); throw new Error('Already reconciled'); }
        if (bankTxn.amount >= 0) { res.status(400); throw new Error('Not a debit transaction'); }

        const category = await ExpenseCategory.findOne({ where: { gl_code, is_active: true }, transaction: t });
        if (!category) { res.status(400); throw new Error('Invalid or inactive GL code'); }

        const expense = await recordExpenseForBankTxn(bankTxn, {
            gl_code, payee_name, vendor_id, employee_id, memo, check_number,
            userId: req.user.id
        }, t);
        await t.commit();

        // Learn payee/description → GL classification for future auto-reconcile
        try {
            const { learnExpenseMemoMatch } = require('../services/autoReconcileService');
            await learnExpenseMemoMatch(bankTxn, { gl_code, payee_name, vendor_id, employee_id });
        } catch (learnErr) {
            console.warn('Expense memo learning warning:', learnErr.message);
        }

        res.status(201).json({ success: true, message: 'Expense recorded and bank transaction matched', data: expense });
    } catch (err) {
        await t.rollback();
        throw err;
    }
});

/**
 * @desc    Record several bank debits as expenses under one category
 * @route   POST /api/bank/reconcile-expense-bulk
 * @access  Private (Admin/Treasurer/Bookkeeper)
 *
 * For a backlog from one merchant — twelve months of the same subscription —
 * that would otherwise be categorized a row at a time. Each row keeps its own
 * amount, date and description; only the category and payee are shared.
 *
 * The whole batch is validated before any row is written and committed in one
 * database transaction, so a selection is either filed completely or not at
 * all. Filing half of it and reporting success is how wrongly-selected rows go
 * unnoticed.
 */
exports.reconcileExpenseBulk = asyncHandler(async (req, res) => {
    const { transaction_ids, gl_code, payee_name, vendor_id, employee_id, memo } = req.body;

    const fail = (message) => {
        const err = new Error(message);
        err.status = 400;
        throw err;
    };

    if (!Array.isArray(transaction_ids) || transaction_ids.length === 0) {
        fail('Transaction IDs array required');
    }
    if (!gl_code) {
        fail('gl_code is required');
    }

    const category = await ExpenseCategory.findOne({ where: { gl_code, is_active: true } });
    if (!category) {
        fail(`Invalid or inactive expense category: ${gl_code}`);
    }

    const rows = await BankTransaction.findAll({ where: { id: transaction_ids } });

    const missing = transaction_ids.filter(
        (id) => !rows.some((row) => String(row.id) === String(id))
    );
    if (missing.length > 0) {
        fail(`Bank transactions not found: ${missing.join(', ')}`);
    }

    // A credit is a gift received, not money spent. Same refusal the
    // single-transaction endpoint makes, applied to the whole selection.
    const credits = rows.filter((row) => Number(row.amount) >= 0);
    if (credits.length > 0) {
        fail(
            `Selection contains ${credits.length} deposit ${credits.length === 1 ? 'transaction' : 'transactions'} `
            + `(${credits.map((r) => r.id).join(', ')}). Deposits are money received and are linked to a member, `
            + 'not recorded as expenses. Select debits only.'
        );
    }

    const settled = rows.filter((row) => row.status !== 'PENDING');
    if (settled.length > 0) {
        fail(
            `Already reconciled: ${settled.map((r) => r.id).join(', ')}. `
            + 'Refresh the list and select only pending transactions.'
        );
    }

    const t = await sequelize.transaction();
    let expenses;
    try {
        expenses = [];
        for (const row of rows) {
            expenses.push(await recordExpenseForBankTxn(row, {
                gl_code, payee_name, vendor_id, employee_id, memo,
                userId: req.user.id
            }, t));
        }
        await t.commit();
    } catch (err) {
        await t.rollback();
        throw err;
    }

    // Learn only when the whole batch is one merchant.
    //
    // A learned mapping drives every later suggestion, so teaching one category
    // for a batch of unrelated merchants would put a classification nobody
    // chose per-merchant in front of the treasurer from then on. Twelve charges
    // from the same payee are a deliberate statement about that payee; twenty
    // assorted charges filed under Supplies are not.
    const { getBankMatchKeys } = require('../services/bankMemoMatchService');
    const keySets = rows.map((row) => getBankMatchKeys(row.get({ plain: true }))
        .map((k) => k.matchKey).sort().join('|'));
    const oneMerchant = keySets.length > 0
        && keySets[0] !== ''
        && keySets.every((keys) => keys === keySets[0]);

    let learned = false;
    if (oneMerchant) {
        try {
            const { learnExpenseMemoMatch } = require('../services/autoReconcileService');
            await learnExpenseMemoMatch(rows[0], { gl_code, payee_name, vendor_id, employee_id });
            learned = true;
        } catch (learnErr) {
            console.warn('Expense memo learning warning:', learnErr.message);
        }
    }

    res.status(201).json({
        success: true,
        message: `Recorded ${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'}`,
        data: {
            recorded: expenses.length,
            learned,
            gl_code,
            expense_ids: expenses.map((e) => e.id)
        }
    });
});

/**
 * @desc    Month-by-month income/expense summary from bank transactions
 * @route   GET /api/bank/summary/monthly
 * @access  Private (Treasurer dashboard)
 *
 * Last 12 calendar months (including the current one). Ending balance is the
 * balance reported by the chronologically last bank transaction of the month.
 * Status reflects reconciliation progress: how many rows are still PENDING.
 */
exports.getMonthlySummary = asyncHandler(async (req, res) => {
    const { Op } = require('sequelize');

    // First day of the month, 11 months ago → 12 months including current.
    // Compared as a plain 'YYYY-MM-DD' string to avoid timezone coercion
    // against the DATEONLY column.
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const start = `${startMonth.getFullYear()}-${String(startMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const rows = await BankTransaction.findAll({
        where: { date: { [Op.gte]: start } },
        attributes: ['id', 'date', 'amount', 'balance', 'status'],
        raw: true
    });

    // IMPORTANT: DATEONLY values come back as 'YYYY-MM-DD' strings. Never
    // parse them with `new Date(str)` for grouping — that treats the string
    // as UTC midnight, which shifts 1st-of-month transactions into the
    // previous month for any timezone west of UTC (e.g. June 1 → May 31 7pm
    // in Central Time).
    const monthKey = (d) => {
        if (d instanceof Date) {
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        }
        return String(d).slice(0, 7); // 'YYYY-MM-DD...' → 'YYYY-MM'
    };
    const dayStamp = (d) => {
        if (d instanceof Date) return d.toISOString().slice(0, 10);
        return String(d).slice(0, 10);
    };

    const byMonth = new Map();
    for (const row of rows) {
        const key = monthKey(row.date);
        if (!byMonth.has(key)) {
            byMonth.set(key, {
                income: 0, expense: 0,
                pending_count: 0, transaction_count: 0,
                endingCandidate: null
            });
        }
        const m = byMonth.get(key);
        const amount = Number(row.amount) || 0;
        if (amount > 0) m.income += amount;
        else m.expense += Math.abs(amount);
        m.transaction_count += 1;
        if (row.status === 'PENDING') m.pending_count += 1;

        // Ending balance: latest date wins; for same-day rows the LOWEST id is
        // the newest (Chase CSVs list newest first, so bulkCreate assigns
        // ascending ids from newest to oldest) — same convention as the
        // current-balance calculation in getBankTransactions.
        if (row.balance !== null && row.balance !== undefined) {
            const c = m.endingCandidate;
            const rowDay = dayStamp(row.date); // 'YYYY-MM-DD' compares lexicographically
            if (!c
                || rowDay > c.day
                || (rowDay === c.day && row.id < c.id)) {
                m.endingCandidate = { day: rowDay, id: row.id, balance: Number(row.balance) };
            }
        }
    }

    // Emit all 12 months, newest first, zero-filled when no data
    const months = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        const m = byMonth.get(key);
        const income = m ? Number(m.income.toFixed(2)) : 0;
        const expense = m ? Number(m.expense.toFixed(2)) : 0;
        months.push({
            month: key,
            label,
            income,
            expense,
            net: Number((income - expense).toFixed(2)),
            ending_balance: m?.endingCandidate ? m.endingCandidate.balance : null,
            pending_count: m ? m.pending_count : 0,
            transaction_count: m ? m.transaction_count : 0
        });
    }

    res.json({ success: true, data: { months } });
});

/**
 * @desc    Run the automatic reconciliation pass on demand
 * @route   POST /api/bank/auto-reconcile
 * @access  Private (Admin/Treasurer/Bookkeeper)
 */
exports.runAutoReconcile = asyncHandler(async (req, res) => {
    const { autoReconcilePending } = require('../services/autoReconcileService');
    // Bounded by default so a large PENDING backlog cannot exceed the proxy's
    // 60s read timeout in a single request. Clients sweep the whole backlog by
    // calling again with afterId = previous response's nextAfterId until done.
    const DEFAULT_BATCH_LIMIT = 200;
    const rawLimit = parseInt(req.body?.limit ?? req.query?.limit, 10);
    const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 500)
        : DEFAULT_BATCH_LIMIT;
    const afterId = req.body?.afterId ?? req.query?.afterId ?? null;

    const stats = await autoReconcilePending({ user: req.user, limit, afterId });
    res.json({ success: true, data: stats });
});

/**
 * @desc    Undo an automatic reconciliation (revert to PENDING)
 * @route   POST /api/bank/transactions/:id/unreconcile
 * @access  Private (Admin/Treasurer/Bookkeeper)
 */
exports.unreconcileTransaction = asyncHandler(async (req, res) => {
    const { undoAutoReconciliation } = require('../services/autoReconcileService');
    try {
        const txn = await undoAutoReconciliation(req.params.id);
        res.json({ success: true, message: 'Reconciliation undone', data: txn });
    } catch (err) {
        err.status = err.status || 400;
        res.status(err.status);
        throw err;
    }
});
