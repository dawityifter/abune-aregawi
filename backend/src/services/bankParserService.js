const crypto = require('crypto');
const csv = require('csv-parse/sync');

/**
 * Service to parse bank export files (specifically Chase CSV)
 * and extract meaningful entities like Donor Names from Zelle descriptions.
 */

// Regex patterns for extracting data
const PATTERNS = {
    // "Zelle payment from ALMAZ G TESFAY 27250625041"
    ZELLE: /^Zelle payment from (?<name>.*?) (?<id>\w+)$/i,

    // "ORIG CO NAME:RAYTHEON COMPANY ... IND NAME:BERHE,SELAMAWIT ..."
    ACH_IND_NAME: /IND NAME:(?<name>[^ ]+)/i,

    // "CHECK 1582"
    CHECK: /^CHECK (?<number>\d+)/i
};

/**
 * Generates a unique hash for a transaction to prevent duplicates.
 * Hash source: Date + Description + Amount + Balance
 */
const generateTransactionHash = (row) => {
    // Note: We exclude 'Balance' from the hash because 'Pending' transactions often have no balance,
    // but 'Posted' ones do. Including it would cause duplicates.
    const data = `${row['Posting Date']}|${row['Description']}|${row['Amount']}`;
    return crypto.createHash('md5').update(data).digest('hex');
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

    return rows.map(row => {
        const rawDesc = row['Description'];
        let payerName = null;
        let externalRefId = null;
        let checkNumber = row['Check or Slip #'] || null;
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
            const achMatch = rawDesc.match(PATTERNS.ACH_IND_NAME);
            if (achMatch) {
                // ACH names often come as "LAST,FIRST". We might want to normalize later, 
                // but for now storing as is.
                payerName = achMatch.groups.name.replace(',', ', ').trim();
            }
        }

        // 3. Extract Check Number if missing from column but present in desc
        if (!checkNumber) {
            const checkMatch = rawDesc.match(PATTERNS.CHECK);
            if (checkMatch) {
                checkNumber = checkMatch.groups.number;
                type = 'CHECK';
            }
        }

        return {
            transaction_hash: generateTransactionHash(row),
            date: new Date(row['Posting Date']), // Ensure correct date format
            amount: (row['Details'] === 'DEBIT' || row['Details'] === 'CHKS P' || row['Amount'].startsWith('-'))
                ? -Math.abs(parseFloat(row['Amount']))
                : parseFloat(row['Amount']),
            balance: row['Balance'] ? parseFloat(row['Balance']) : null,
            description: rawDesc,
            type: type,
            status: 'PENDING',
            payer_name: payerName,
            external_ref_id: externalRefId,
            check_number: checkNumber,
            raw_data: row
        };
    });
};

module.exports = {
    parseChaseCSV,
    generateTransactionHash
};
