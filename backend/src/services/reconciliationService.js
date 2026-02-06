const { Op } = require('sequelize');
const { Member, ZelleMemoMatch, Transaction, sequelize } = require('../models');

/**
 * Clean up bank description to getting a learning-friendly string.
 * For Zelle: "Zelle payment from ALMAZ G TESFAY 123456" -> "ALMAZ G TESFAY"
 */
function normalizeDescription(description, type) {
    if (!description) return '';
    let clean = description.trim();

    // Specific cleanup for Zelle in CSV
    if (type === 'Zelle' || description.startsWith('Zelle payment from')) {
        clean = clean.replace(/^Zelle payment from\s+/i, '');
        clean = clean.replace(/\s+\d+$/, ''); // Remove trailing Zelle IDs
    } else {
        // Generic cleanup for other types (Checks, ACH)
        // 1. Remove "CHECK ####" prefix
        clean = clean.replace(/^CHECK\s+\d+\s+/i, '');

        // 2. Remove "ORIG CO NAME:" stuff (common in ACH)
        clean = clean.replace(/ORIG CO NAME:/i, '').replace(/IND NAME:/i, '');

        // 3. Remove common trailing IDs or dates (simple heuristic: 8+ digits or dates)
        // Remove MM/DD/YYYY or similar
        clean = clean.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, '');

        // Remove long digit sequences (ids) at end
        clean = clean.replace(/\s+\d{6,}$/, '');
    }

    return clean.trim();
}

/**
 * Reuse token-based fuzzy matching from legacy gmailZelleIngest.js
 */
async function findMemberByFuzzyName(nameText) {
    if (!nameText) return { id: null, confidence: 0 };

    const raw = String(nameText).toLowerCase();
    // Tokenize: letters only, split by space
    const tokens = raw.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);

    if (tokens.length === 0) return { id: null, confidence: 0 };

    // Find members matching ANY token in First, Last, or Middle
    const tokenClauses = tokens.map(t => ({
        [Op.or]: [
            { first_name: { [Op.iLike]: `%${t}%` } },
            { last_name: { [Op.iLike]: `%${t}%` } },
            // { middle_name: { [Op.iLike]: `%${t}%` } } // Add if middle_name exists on model
        ]
    }));

    // We want members that match ALL tokens if possible, or at least highly relevant.
    // The legacy logic did "OR" for each token? No, logical AND of tokens is safer?
    // Legacy `findMemberByMemo`: "AND of tokens across first/middle/last" -> No, it constructed `[Op.or]` for each token, but did it AND them? 
    // Wait, `tokenClauses` is an array. `where: { [Op.and]: tokenClauses }` means match ALL tokens.
    // So "ALMAZ TESFAY" finds someone with "Almaz" AND "Tesfay". Correct.

    const candidates = await Member.findAll({
        where: { [Op.and]: tokenClauses },
        attributes: ['id', 'first_name', 'last_name']
    });

    if (candidates.length === 1) {
        return {
            id: candidates[0].id,
            name: `${candidates[0].first_name} ${candidates[0].last_name}`,
            confidence: 'medium'
        };
    }

    // If multiple candidates, we can't be sure. Return none or list? 
    // For now return null if ambiguous.
    return { id: null, confidence: 0 };
}

/**
 * Main matching strategy
 */
exports.suggestMatch = async (transaction) => {
    // 1. learned match (ZelleMemoMatch)
    // Use the normalized description (e.g. "ALMAZ TESFAY")
    const cleanMemo = normalizeDescription(transaction.description, transaction.type);

    if (cleanMemo) {
        const learned = await ZelleMemoMatch.findOne({
            where: sequelize.where(sequelize.fn('lower', sequelize.col('memo')), cleanMemo.toLowerCase())
        });

        if (learned) {
            const member = await Member.findByPk(learned.member_id);
            if (member) {
                return {
                    type: 'LEARNED',
                    member: { id: member.id, first_name: member.first_name, last_name: member.last_name }
                };
            }
        }
    }

    // 2. Explicit Payer Name (if parsed by parser)
    if (transaction.payer_name) {
        const fuzzy = await findMemberByFuzzyName(transaction.payer_name);
        if (fuzzy.id) {
            const member = await Member.findByPk(fuzzy.id);
            return {
                type: 'FUZZY_NAME',
                member: { id: member.id, first_name: member.first_name, last_name: member.last_name }
            };
        }
    }

    // 3. Fallback: Fuzzy search on the description itself (if no payer_name extracted)
    if (!transaction.payer_name && cleanMemo) {
        const fuzzy = await findMemberByFuzzyName(cleanMemo);
        if (fuzzy.id) {
            const member = await Member.findByPk(fuzzy.id);
            return {
                type: 'FUZZY_DESC',
                member: { id: member.id, first_name: member.first_name, last_name: member.last_name }
            };
        }
    }

    return null;
};

/**
 * Find potential existing system transactions that match a bank transaction.
 * Criteria: Same amount, Date +/- 5 days, Not already linked.
 */
exports.findPotentialMatches = async (bankTxn) => {
    const { amount, date, transaction_hash } = bankTxn;

    // Date range: +/- 5 days
    const txnDate = new Date(date);
    const startDate = new Date(txnDate);
    startDate.setDate(startDate.getDate() - 5);
    const endDate = new Date(txnDate);
    endDate.setDate(endDate.getDate() + 5);

    // Search for transactions
    const potentials = await Transaction.findAll({
        where: {
            amount: amount, // Exact amount match
            payment_date: {
                [Op.between]: [startDate, endDate]
            },
            status: { [Op.ne]: 'failed' },
            // Exclude already linked transactions (heuristic: external_id is a 32-char hex hash)
            // Or better: external_id does not equal THIS bank transaction hash (obviously)
            // And potentially check if external_id looks like a bank hash.
            // For now, let's just return anything that isn't confirmed as linked to another bank txn?
            // Actually, if a transaction was manually entered, external_id is usually null or 'stripe_xxxx'.
            // If it was created from bank reconciliation, external_id IS the hash.
            // So we want transactions where external_id IS NULL or DOES NOT look like a bank hash.
            // Let's filter in code or just return them and let frontend decide?
            // Safer: Returns ones where external_id is NULL or length != 32 (md5 hash length).
            [Op.or]: [
                { external_id: null },
                { external_id: { [Op.notRegexp]: '^[a-f0-9]{32}$' } } // Postgres/Sqlite dependent?
                // Sqlite doesn't support notRegexp easily without plugin.
                // Let's keep it simple: Just get them and filter in JS if needed.
                // Or just don't filter external_id extensively yet.
            ]
        },
        include: [{
            model: Member,
            as: 'member',
            attributes: ['first_name', 'last_name'] // Use member to help identifying
        }]
    });

    // Filter out the one that is ALREADY linked to this hash (if we are re-processing)
    return potentials.filter(t => t.external_id !== transaction_hash);
};

/**
 * Process a single bank transaction reconciliation.
 * - Creates/Links Transaction (Donation)
 * - Updates BankTransaction status
 * - Updates LedgerEntry
 * - Learns Zelle Match
 */
exports.processReconciliation = async ({ bankTxnId, memberId, paymentType, user, existingTransactionId, forYear }) => {
    const { BankTransaction, Transaction, LedgerEntry, IncomeCategory, ZelleMemoMatch, sequelize } = require('../models');

    const txn = await BankTransaction.findByPk(bankTxnId);
    if (!txn) {
        throw new Error(`Bank transaction ${bankTxnId} not found`);
    }

    if (txn.status === 'MATCHED' || txn.status === 'IGNORED') {
        throw new Error(`Transaction ${txn.description} already processed`);
    }

    // 1. Create OR Link Donation (Transaction record)
    let donation;

    if (existingTransactionId) {
        // LINK to existing
        donation = await Transaction.findByPk(existingTransactionId);
        if (!donation) {
            throw new Error(`Existing transaction ${existingTransactionId} not found`);
        }

        // Link them
        donation.external_id = txn.transaction_hash;
        // Optionally update status if it was pending
        if (donation.status !== 'succeeded') {
            donation.status = 'succeeded';
        }
        await donation.save();
    } else {
        // CREATE new
        // Determine payment method from type
        let method = 'other';
        if (txn.type.includes('ZELLE')) method = 'zelle';
        else if (txn.type.includes('CHECK')) method = 'check';
        else if (txn.type.includes('ACH')) method = 'ach';
        else if (txn.type.includes('DEBIT')) method = 'debit_card';

        // Extract receipt number for checks
        let receiptNumber = null;
        if (method === 'check' && txn.check_number) {
            receiptNumber = txn.check_number;
        }

        donation = await Transaction.create({
            member_id: memberId,
            collected_by: user.id, // The admin/user performing the action
            amount: txn.amount,
            payment_date: txn.date,
            payment_type: paymentType || 'donation', // Default to donation
            payment_method: method,
            status: 'succeeded',
            note: txn.description,
            external_id: txn.transaction_hash,
            receipt_number: receiptNumber,
            for_year: forYear || null
        });
    }

    // 2. Link BankTransaction
    txn.status = 'MATCHED';
    txn.member_id = memberId || donation.member_id; // Use existing donation member_id if linking
    await txn.save();

    // 3. Learn (Save to ZelleMemoMatch)
    // Only learn if we have a direct member association and it's not a generic manual link
    let cleanMemo = normalizeDescription(txn.description, txn.type);

    if (cleanMemo && cleanMemo.length > 2 && memberId) {
        const existingMatch = await ZelleMemoMatch.findOne({
            where: sequelize.where(sequelize.fn('lower', sequelize.col('memo')), cleanMemo.toLowerCase())
        });

        if (!existingMatch) {
            await ZelleMemoMatch.create({
                member_id: memberId,
                memo: cleanMemo
            });
        }
    }

    // 4. Create/Sync Ledger Entry
    try {
        const pType = donation.payment_type || paymentType || 'donation';
        const incomeCategory = await IncomeCategory.findOne({
            where: { payment_type_mapping: pType }
        });
        const glCode = incomeCategory?.gl_code || 'INC999';
        const memo = `${glCode} - Bank reconciliation match ${txn.transaction_hash}`;

        // Find existing or create new
        const [ledgerEntry, created] = await LedgerEntry.findOrCreate({
            where: { transaction_id: donation.id },
            defaults: {
                type: pType,
                category: glCode,
                amount: parseFloat(donation.amount),
                entry_date: donation.payment_date,
                member_id: donation.member_id,
                payment_method: donation.payment_method,
                memo: memo,
                transaction_id: donation.id,
                external_id: txn.transaction_hash
            }
        });

        if (!created) {
            await ledgerEntry.update({
                type: pType,
                category: glCode,
                amount: parseFloat(donation.amount),
                entry_date: donation.payment_date,
                member_id: donation.member_id,
                payment_method: donation.payment_method,
                memo: memo,
                external_id: txn.transaction_hash
            });
        }
    } catch (ledgerErr) {
        console.error('⚠️ Failed to sync ledger entry for bank reconciliation:', ledgerErr.message);
        // We don't fail the whole request for ledger sync, just log it
    }

    return { txn, donation };
};
