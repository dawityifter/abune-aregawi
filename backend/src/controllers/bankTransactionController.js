const asyncHandler = require('express-async-handler');
const { BankTransaction, Member } = require('../models');
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

        // Upsert transactions (skip duplicates based on hash, but update metadata like balance)
        for (const txn of parsedTransactions) {
            const [record, created] = await BankTransaction.findOrCreate({
                where: { transaction_hash: txn.transaction_hash },
                defaults: txn
            });

            if (created) {
                results.imported++;
            } else {
                // If it exists but has no balance, and the new one does, update it!
                if (record.balance === null && txn.balance !== null) {
                    record.balance = txn.balance;
                    // Also update raw_data if we want to keep the latest snapshot
                    record.raw_data = txn.raw_data;
                    await record.save();
                }
                results.skipped++;
            }
        }

        res.status(200).json({
            success: true,
            message: `Processed ${parsedTransactions.length} rows`,
            data: results
        });

    } catch (error) {
        res.status(500);
        throw new Error('Error processing CSV: ' + error.message);
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
            const suggestion = await suggestMatch(plain);
            if (suggestion) {
                plain.suggested_match = suggestion;
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
    const { transaction_id, member_id, action, payment_type } = req.body;
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
    if (!member_id) {
        res.status(400);
        throw new Error('Member ID required for matching');
    }

    // 1. Create Donation (Transaction record)
    const { Transaction: DonationModel, ZelleMemoMatch, sequelize } = require('../models');

    // Create Donation
    const donation = await DonationModel.create({
        member_id,
        collected_by: req.user.id,
        amount: txn.amount,
        payment_date: txn.date,
        payment_type: payment_type || 'donation', // Default to donation
        payment_method: txn.type.includes('ZELLE') ? 'zelle' : (txn.type.includes('CHECK') ? 'check' : 'ach'),
        status: 'succeeded',
        note: txn.description,
        external_id: txn.transaction_hash
    });

    // 2. Link BankTransaction
    txn.status = 'MATCHED';
    txn.member_id = member_id;
    await txn.save();

    // 3. Learn (Save to ZelleMemoMatch, now serving as Generic TransactionMatch)
    // We learn from ANY manual match.
    // If the description has a stable pattern (e.g. "Google Payroll" from "Google Payroll 12/12/25"), we save it.

    // Import helper locally or at top
    // Note: normalizeDescription is not exported? It is internal helper in reconciliationService.
    // Wait, reconciliationService only exports suggestMatch.
    // I should probably export normalizeDescription OR replicate the logic here.
    // Better: Replicate logic or move it to a shared helper. 
    // Given the constraints, I'll move/export it or just replicate the simple regex here to avoid circular dep issues or extensive refactoring.
    // Actually, I can require it if I export it.

    // Let's replicate the simple generic logic here to be safe and quick.
    let cleanMemo = txn.description;

    if (txn.type.includes('ZELLE') || txn.description.startsWith('Zelle')) {
        cleanMemo = txn.description.replace(/^Zelle payment from\s+/i, '').replace(/\s+\d+$/, '').trim();
    } else {
        // Generic cleanup
        cleanMemo = cleanMemo.replace(/^CHECK\s+\d+\s+/i, '')
            .replace(/ORIG CO NAME:/i, '').replace(/IND NAME:/i, '')
            .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, '')
            .replace(/\s+\d{6,}$/, '')
            .trim();
    }

    if (cleanMemo && cleanMemo.length > 2) { // Only learn if meaningful length
        // Upsert ZelleMemoMatch
        const existingMatch = await ZelleMemoMatch.findOne({
            where: sequelize.where(sequelize.fn('lower', sequelize.col('memo')), cleanMemo.toLowerCase())
        });

        if (!existingMatch) {
            await ZelleMemoMatch.create({
                member_id,
                memo: cleanMemo
            });
        }
    }

    res.json({ success: true, txn, donation });
});
