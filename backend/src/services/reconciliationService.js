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
