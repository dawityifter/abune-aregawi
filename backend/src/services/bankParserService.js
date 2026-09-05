const crypto = require('crypto');
const csv = require('csv-parse/sync');
const { parseCheckNumber } = require('../utils/checkNumber');

/**
 * Service to parse bank export files (specifically Chase CSV)
 * and extract meaningful entities like Donor Names from Zelle descriptions.
 */

// Regex patterns for extracting data
const PATTERNS = {
    // "Zelle payment from ALMAZ G TESFAY 27250625041"
    ZELLE: /^Zelle payment from (?<name>.*?) (?<id>\w+)$/i,

    // "ORIG CO NAME:RAYTHEON COMPANY ... IND NAME:BERHE,SELAMAWIT ..."
    ACH_IND_NAME: /IND NAME:(?<name>.*)$/i,

    // "CHECK 1582", "CHECK #1582", "CHECK PAID 1582"
    CHECK: /^CHECK\s*(?:PAID\s*)?#?\s*(?<number>\d+)/i,
    // A deposited check that bounced. Chase reports the bounced check's own
    // serial as "CHK SER# 1397" — the donor's serial, not the church's.
    RETURNED_ITEM: /DEPOSITED ITEM RETURNED|RETURN(?:ED)? ITEM|CHARGEBACK/i,
    RETURNED_SERIAL: /CHK\s*SER#?\s*(?<number>\d+)/i
};

/**
 * Generates a unique hash for a transaction to prevent duplicates.
 * Hash source: Date + Description + Amount + Balance
 */
const generateTransactionHash = (row, occurrence = 0) => {
    // Note: We exclude 'Balance' from the hash because 'Pending' transactions often have no balance,
    // but 'Posted' ones do. Including it would cause duplicates.
    //
    // `occurrence` distinguishes rows that are otherwise byte-identical. A
    // statement can legitimately contain the same charge twice — same merchant,
    // same amount, same day — and those differ only in the running balance the
    // hash ignores. Without this they collapsed to one hash and the upload
    // discarded the second as a duplicate, losing real money from the ledger.
    //
    // Occurrence 0 hashes exactly as it always did, so every row already
    // ingested keeps its hash and is not re-imported.
    const data = `${row['Posting Date']}|${row['Description']}|${row['Amount']}`;
    const keyed = occurrence > 0 ? `${data}|#${occurrence}` : data;
    return crypto.createHash('md5').update(keyed).digest('hex');
};

const extractAchIndividualName = (description) => {
    const match = String(description || '').match(PATTERNS.ACH_IND_NAME);
    if (!match) return null;

    const stopMarkers = [
        ' WEB ID:',
        ' CO ID:',
        ' COMPANY ID:',
        ' IND ID:',
        ' TRACE',
        ' TRN',
        ' ENTRY',
        ' CCD',
        ' PPD',
        ' SEC:'
    ];

    const rawName = match.groups.name;
    const upperName = rawName.toUpperCase();
    const stopAt = stopMarkers
        .map(marker => upperName.indexOf(marker))
        .filter(index => index >= 0)
        .sort((a, b) => a - b)[0];

    const extracted = (stopAt >= 0 ? rawName.slice(0, stopAt) : rawName)
        .replace(/\s{2,}/g, ' ')
        .trim();

    return extracted ? extracted.replace(/\s*,\s*/g, ', ').trim() : null;
};

/**
 * Parses a Chase CSV buffer and returns structured transaction objects.
 * @param {Buffer} fileBuffer 
 * @returns {Array} Array of parsed transaction objects
 */
const parseChaseCSV = (fileBuffer) => {
    const content = fileBuffer.toString('utf-8');

    // Chase CSV headers: Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
    const rows = csv.parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
    });

    // Counts identical rows as they are read, so the second copy of a repeated
    // charge gets occurrence 1, the third 2, and so on. Deterministic for a
    // given file, which keeps re-uploading it idempotent.
    const occurrences = new Map();

    return rows.map(row => {
        const rawDesc = row['Description'];
        let payerName = null;
        let externalRefId = null;
        // The slip column is often blank, padded ("01593") or junk ("n/a").
        // Canonicalize it so it lines up with the check numbers on expenses.
        let checkNumber = parseCheckNumber(row['Check or Slip #']);
        let type = row['Type'] || 'UNKNOWN';

        // 1. Try Zelle Parsing
        const zelleMatch = rawDesc.match(PATTERNS.ZELLE);
        if (zelleMatch) {
            payerName = zelleMatch.groups.name.trim();
            externalRefId = zelleMatch.groups.id;
            type = 'ZELLE';
        }

        // 2. Try ACH Name Parsing (if not Zelle)
        if (!payerName) {
            payerName = extractAchIndividualName(rawDesc);
        }

        // 3a. A returned deposited item carries the bounced check's serial. It
        // is the DONOR's serial, so it must not be treated as one of the
        // church's own outgoing checks — flagged separately, and the CHECK
        // pattern below is skipped for these rows.
        const isReturnedItem = PATTERNS.RETURNED_ITEM.test(rawDesc || '')
            || /RETURN/i.test(String(row['Type'] || ''));
        if (isReturnedItem) {
            const serialMatch = String(rawDesc || '').match(PATTERNS.RETURNED_SERIAL);
            if (serialMatch) {
                checkNumber = parseCheckNumber(serialMatch.groups.number);
            }
        }

        // 3b. Extract Check Number if missing from column but present in desc
        if (!checkNumber && !isReturnedItem) {
            const checkMatch = rawDesc.match(PATTERNS.CHECK);
            if (checkMatch) {
                checkNumber = parseCheckNumber(checkMatch.groups.number);
                type = 'CHECK';
            }
        }

        // 4. Robust Amount Parsing (Remove commas and $ if present)
        // Chase CSV already encodes the correct sign in the Amount column:
        //   - Expenses (DEBIT): negative, e.g. -50.00
        //   - Refunds (DEBIT): positive, e.g. +25.00
        // We trust the raw sign rather than forcing negative by Details type.
        const amountStr = (row['Amount'] || '0').replace(/[$,]/g, '');
        let amount = parseFloat(amountStr);
        if (isNaN(amount)) amount = 0;

        // 5. Robust Balance Parsing
        const balanceStr = (row['Balance'] || '').replace(/[$,]/g, '');
        let balance = balanceStr ? parseFloat(balanceStr) : null;
        if (isNaN(balance)) balance = null;

        // 6. Robust Date Parsing
        const postingDate = row['Posting Date'];
        const date = new Date(postingDate);
        if (isNaN(date.getTime())) {
            console.warn(`Skipping row with invalid date: "${postingDate}"`);
            return null;
        }

        const occurrenceKey = `${row['Posting Date']}|${rawDesc}|${row['Amount']}`;
        const occurrence = occurrences.get(occurrenceKey) || 0;
        occurrences.set(occurrenceKey, occurrence + 1);

        return {
            transaction_hash: generateTransactionHash(row, occurrence),
            date: date,
            amount: amount,
            balance: balance,
            description: rawDesc,
            type: type,
            status: 'PENDING',
            payer_name: payerName,
            external_ref_id: externalRefId,
            check_number: checkNumber,
            is_returned_item: isReturnedItem,
            raw_data: row
        };
    }).filter(t => t !== null); // Remove skipped rows
};

/**
 * True when a bank row is a returned/charged-back deposited item. Works on a
 * stored BankTransaction as well as a freshly parsed row, since the flag itself
 * is not persisted — the description and type are.
 */
const isReturnedItem = (txn) =>
    PATTERNS.RETURNED_ITEM.test(String(txn?.description || ''))
    || /RETURN/i.test(String(txn?.type || ''));

module.exports = {
    isReturnedItem,
    parseChaseCSV,
    generateTransactionHash,
    extractAchIndividualName
};
