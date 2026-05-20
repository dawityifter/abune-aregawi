const { Op } = require('sequelize');
const { Member, ZelleMemoMatch, Transaction, sequelize } = require('../models');
const {
    extractAchIndividualName,
    findSuggestionCandidates,
    learnBankMemoMatch,
    normalizeWords,
    sourceTypeFor
} = require('./bankMemoMatchService');

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
    const candidates = await findSuggestionCandidates(transaction);
    if (candidates.length > 0) {
        return candidates[0];
    }

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

exports.suggestMatches = async (transaction) => findSuggestionCandidates(transaction);

function inferPaymentMethodFromBankTxn(bankTxn) {
    const sourceType = sourceTypeFor(bankTxn);
    const type = String(bankTxn?.type || '').toUpperCase();

    if (sourceType === 'ZELLE') return 'zelle';
    if (sourceType === 'ACH') return 'ach';
    if (sourceType === 'CHECK') return 'check';
    if (type.includes('DEBIT')) return 'debit_card';
    if (type.includes('CREDIT_CARD') || type.includes('CARD')) return 'credit_card';
    return null;
}

function getBankDuplicateNameText(bankTxn) {
    const sourceType = sourceTypeFor(bankTxn);
    if (bankTxn?.payer_name) return bankTxn.payer_name;
    if (sourceType === 'ACH') return extractAchIndividualName(bankTxn?.description);
    if (sourceType === 'ZELLE') return normalizeDescription(bankTxn?.description, bankTxn?.type);
    return null;
}

function tokenSet(value) {
    return new Set(normalizeWords(value).split(' ').filter(token => token.length > 2));
}

function memberNameLooksLikeBankName(bankName, member) {
    if (!bankName || !member) return false;

    const bankTokens = tokenSet(bankName);
    const memberTokens = Array.from(tokenSet(`${member.first_name || ''} ${member.last_name || ''}`));
    if (bankTokens.size === 0 || memberTokens.length === 0) return false;

    const matchingMemberTokens = memberTokens.filter(token => bankTokens.has(token)).length;

    // Two-token member names should both be present. For longer names, two strong
    // token hits are enough because bank descriptions often omit middle names.
    const requiredMatches = memberTokens.length <= 2 ? memberTokens.length : 2;
    return matchingMemberTokens >= requiredMatches;
}

function isBankReconciliationHash(externalId) {
    return /^[a-f0-9]{32}$/i.test(String(externalId || ''));
}

/**
 * Find potential existing system transactions that match a bank transaction.
 * Criteria: same amount, same inferred payment method, date +/- 2 days, and
 * payer/member name token match. If no usable bank-side name exists, return no
 * candidates to avoid noisy duplicate warnings.
 */
exports.findPotentialMatches = async (bankTxn) => {
    const { amount, date, transaction_hash } = bankTxn;
    const paymentMethod = inferPaymentMethodFromBankTxn(bankTxn);
    const bankName = getBankDuplicateNameText(bankTxn);

    if (!paymentMethod || !bankName) {
        return [];
    }

    // Date range: +/- 2 days
    const txnDate = new Date(date);
    const startDate = new Date(txnDate);
    startDate.setDate(startDate.getDate() - 2);
    const endDate = new Date(txnDate);
    endDate.setDate(endDate.getDate() + 2);

    // Search for transactions
    const potentials = await Transaction.findAll({
        where: {
            amount: amount, // Exact amount match
            payment_method: paymentMethod,
            payment_date: {
                [Op.between]: [startDate, endDate]
            },
            status: { [Op.ne]: 'failed' }
        },
        include: [{
            model: Member,
            as: 'member',
            attributes: ['id', 'first_name', 'last_name']
        }],
        attributes: [
            'id',
            'amount',
            'payment_date',
            'payment_type',
            'payment_method',
            'receipt_number',
            'note',
            'external_id'
        ],
        order: [['payment_date', 'DESC'], ['id', 'DESC']]
    });

    return potentials.filter((t) => {
        if (t.external_id === transaction_hash || isBankReconciliationHash(t.external_id)) {
            return false;
        }
        return memberNameLooksLikeBankName(bankName, t.member);
    });
};

/**
 * Process a single bank transaction reconciliation.
 * - Creates/Links Transaction (Donation)
 * - Updates BankTransaction status
 * - Updates LedgerEntry
 * - Learns Zelle Match
 */
exports.processReconciliation = async ({ bankTxnId, memberId, paymentType, user, existingTransactionId, forYear, receiptNumber }) => {
    const { BankTransaction, Transaction, LedgerEntry, IncomeCategory, ZelleMemoMatch, sequelize } = require('../models');

    const txn = await BankTransaction.findByPk(bankTxnId);
    if (!txn) {
        throw new Error(`Bank transaction ${bankTxnId} not found`);
    }

    if (txn.status === 'MATCHED' || txn.status === 'IGNORED') {
        throw new Error(`Transaction ${txn.description} already processed`);
    }

    const normalizedReceiptNumber = typeof receiptNumber === 'string' ? receiptNumber.trim() : receiptNumber;

    if (normalizedReceiptNumber && normalizedReceiptNumber !== '000') {
        const duplicateReceipt = await Transaction.findOne({
            where: {
                receipt_number: normalizedReceiptNumber,
                ...(existingTransactionId ? { id: { [Op.ne]: existingTransactionId } } : {})
            }
        });

        if (duplicateReceipt) {
            throw new Error(`Receipt number "${normalizedReceiptNumber}" has already been used. Please use a unique receipt number.`);
        }
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
        donation.receipt_number = normalizedReceiptNumber || donation.receipt_number || null;
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
            receipt_number: normalizedReceiptNumber || receiptNumber,
            for_year: forYear || null
        });
    }

    // 2. Link BankTransaction
    txn.status = 'MATCHED';
    txn.member_id = memberId || donation.member_id; // Use existing donation member_id if linking
    await txn.save();

    // 3. Learn memo/description associations for future suggestions.
    // Only learn if we have a direct member association and it's not a generic manual link.
    let cleanMemo = normalizeDescription(txn.description, txn.type);

    if (memberId) {
        await learnBankMemoMatch(txn, memberId);
    }

    if (sourceTypeFor(txn) === 'ZELLE' && cleanMemo && cleanMemo.length > 2 && memberId) {
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
                receipt_number: donation.receipt_number || null,
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
                receipt_number: donation.receipt_number || null,
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
