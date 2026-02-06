const asyncHandler = require('express-async-handler');
const { BankTransaction, Member, LedgerEntry, IncomeCategory, Transaction, ZelleMemoMatch, sequelize } = require('../models');
const { parseChaseCSV } = require('../services/bankParserService');

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
        if (toCreate.length > 0) {
            // Use chunks to avoid too large SQL queries if necessary, though 1000s is usually fine.
            // SQLite/Postgres can handle moderate batch sizes.
            await BankTransaction.bulkCreate(toCreate);
            results.imported += toCreate.length;
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

        res.status(200).json({
            success: true,
            message: `Processed ${parsedTransactions.length} rows`,
            data: results
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
exports.getBankTransactions = asyncHandler(async (req, res) => {
    const { status, type, startDate, endDate, description, page = 1, limit = 50 } = req.query;
    const { Op } = require('sequelize');

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date[Op.gte] = new Date(startDate);
        if (endDate) where.date[Op.lte] = new Date(endDate);
    }

    if (description) {
        where.description = { [Op.iLike]: `%${description}%` };
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await BankTransaction.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['date', 'DESC']],
        include: [{
            model: Member,
            as: 'member',
            attributes: ['id', 'first_name', 'last_name', 'phone_number']
        }]
    });

    const { suggestMatch } = require('../services/reconciliationService');

    // Enrich with suggestions for Pending items
    const enrichedRows = await Promise.all(rows.map(async (txn) => {
        const plain = txn.get({ plain: true });
        if (txn.status === 'PENDING') {
            try {
                // 1. Suggest Member Match
                const suggestion = await suggestMatch(plain);
                if (suggestion) {
                    plain.suggested_match = suggestion;
                }

                // 2. Find Potential System Duplicates (Matches)
                const { findPotentialMatches } = require('../services/reconciliationService');
                const potentialMatches = await findPotentialMatches(plain);
                if (potentialMatches && potentialMatches.length > 0) {
                    plain.potential_matches = potentialMatches;
                }
            } catch (err) {
                console.error(`Error enriching transaction ${txn.id}:`, err.message);
                // Continue without enrichment to avoid blocking list loading
            }
        }
        return plain;
    }));

    // Get current balance (balance of the most recent transaction with a valid balance)
    const latestTxn = await BankTransaction.findOne({
        where: { balance: { [Op.ne]: null } },
        order: [['date', 'DESC'], ['id', 'DESC']],
        attributes: ['balance']
    });

    res.status(200).json({
        success: true,
        data: {
            current_balance: latestTxn ? latestTxn.balance : 0,
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
    const { transaction_id, member_id, payment_type, action, existing_transaction_id } = req.body;
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
            forYear: req.body.for_year // Pass year override if provided
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
                forYear: req.body.for_year // Pass year override
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

