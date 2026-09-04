const { parseChaseCSV, generateTransactionHash, extractAchIndividualName } = require('../src/services/bankParserService');

describe('Bank Parser Service', () => {
    // Chase CSV already encodes correct sign in Amount column:
    //   - Expenses (DEBIT): Amount is negative
    //   - Refunds (DEBIT): Amount is positive
    const CSV_CONTENT = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,12/12/2025,Zelle payment from ALMAZ G TESFAY 27250625041,-100.00,W_DRA,,
CREDIT,12/13/2025,CHECK 1234,50.00,CHECK,1000.00,1234
DEBIT,12/14/2025,GODADDY.COM REFUND,25.00,W_DRA,,
`;

    const buffer = Buffer.from(CSV_CONTENT);

    test('should parse CSV correctly', () => {
        const results = parseChaseCSV(buffer);
        expect(results.length).toBe(3);

        // Normal DEBIT expense: negative amount from CSV stays negative
        expect(results[0].type).toBe('ZELLE');
        expect(results[0].payer_name).toBe('ALMAZ G TESFAY');
        expect(results[0].amount).toBe(-100.00);
        expect(results[0].balance).toBe(null);

        expect(results[1].type).toBe('CHECK');
        expect(results[1].check_number).toBe('1234');
        expect(results[1].amount).toBe(50.00);
        expect(results[1].balance).toBe(1000.00);

        // DEBIT refund: positive amount from CSV must remain positive
        expect(results[2].amount).toBe(25.00);
    });

    describe('returned deposited items', () => {
        // A member's check that the church deposited has bounced. Chase reports
        // the bounced check's own serial as "CHK SER# <n>", which is the only
        // thread back to the gift it reverses.
        const RETURN_ROW = 'DEBIT,09/02/2026,DEPOSITED ITEM RETURNED RETURN ITEM REF# 99007994 CHK SER# 1397 DEP REF: 5380734149 CHARGEBACK RTN REASON: UnableTo Locate TRN: 9007994245RI,-200.00,DEPOSIT_RETURN,,';

        function parseOne(row) {
            const csv = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\n${row}\n`;
            return parseChaseCSV(Buffer.from(csv))[0];
        }

        test('captures the bounced check serial', () => {
            expect(parseOne(RETURN_ROW).check_number).toBe('1397');
        });

        test('does not mistake the returned item for one of the church own checks', () => {
            // The serial belongs to the donor, not the church checkbook, so the
            // row must not be classified as a CHECK debit and matched against
            // church expenses.
            expect(parseOne(RETURN_ROW).is_returned_item).toBe(true);
        });

        test('leaves an ordinary check debit unflagged', () => {
            const txn = parseOne('DEBIT,09/02/2026,CHECK #1601,-50.00,CHECK_PAID,,1601');
            expect(txn.is_returned_item).toBe(false);
            expect(txn.check_number).toBe('1601');
        });

        test('handles a return with no parseable serial', () => {
            const txn = parseOne('DEBIT,09/02/2026,DEPOSITED ITEM RETURNED CHARGEBACK,-75.00,DEPOSIT_RETURN,,');
            expect(txn.is_returned_item).toBe(true);
            expect(txn.check_number).toBeNull();
        });
    });

    describe('repeated identical transactions', () => {
        // Two genuinely distinct charges — same merchant, same amount, same day —
        // differ only in the running balance, which the hash deliberately ignores.
        // They used to collapse to one hash, and the upload discarded the second
        // as a duplicate: real money silently missing from the ledger.
        const TWICE = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,08/28/2026,SOME MERCHANT 1234,-171.46,DEBIT_CARD,900.00,
DEBIT,08/28/2026,SOME MERCHANT 1234,-171.46,DEBIT_CARD,728.54,
`;

        test('keeps both charges instead of collapsing them into one', () => {
            const results = parseChaseCSV(Buffer.from(TWICE));

            expect(results).toHaveLength(2);
            expect(results[0].transaction_hash).not.toBe(results[1].transaction_hash);
        });

        test('leaves the first occurrence hash unchanged, so ingested rows are not re-imported', () => {
            const results = parseChaseCSV(Buffer.from(TWICE));
            const legacyHash = generateTransactionHash({
                'Posting Date': '08/28/2026',
                'Description': 'SOME MERCHANT 1234',
                'Amount': '-171.46'
            });

            expect(results[0].transaction_hash).toBe(legacyHash);
        });

        test('produces the same hashes when the same file is uploaded again', () => {
            const first = parseChaseCSV(Buffer.from(TWICE)).map(t => t.transaction_hash);
            const second = parseChaseCSV(Buffer.from(TWICE)).map(t => t.transaction_hash);

            expect(second).toEqual(first);
        });

        test('matches occurrence 1 when a later statement adds a second identical charge', () => {
            const once = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,08/28/2026,SOME MERCHANT 1234,-171.46,DEBIT_CARD,900.00,
`;
            const earlier = parseChaseCSV(Buffer.from(once));
            const later = parseChaseCSV(Buffer.from(TWICE));

            // The already-ingested row still matches, so only the new one is created.
            expect(later[0].transaction_hash).toBe(earlier[0].transaction_hash);
        });

        test('does not disturb hashes of rows that are merely similar', () => {
            const similar = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,08/28/2026,SOME MERCHANT 1234,-171.46,DEBIT_CARD,900.00,
DEBIT,08/28/2026,SOME MERCHANT 1234,-171.47,DEBIT_CARD,728.53,
`;
            const results = parseChaseCSV(Buffer.from(similar));

            expect(results[0].transaction_hash).toBe(generateTransactionHash({
                'Posting Date': '08/28/2026', 'Description': 'SOME MERCHANT 1234', 'Amount': '-171.46'
            }));
            expect(results[1].transaction_hash).toBe(generateTransactionHash({
                'Posting Date': '08/28/2026', 'Description': 'SOME MERCHANT 1234', 'Amount': '-171.47'
            }));
        });
    });

    describe('check number extraction', () => {
        function parseOne(row) {
            const csv = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #\n${row}\n`;
            return parseChaseCSV(Buffer.from(csv))[0];
        }

        test('reads a hashed check number from the description', () => {
            const txn = parseOne('DEBIT,12/13/2025,CHECK #1593,-50.00,CHECK,,');
            expect(txn.check_number).toBe('1593');
            expect(txn.type).toBe('CHECK');
        });

        test('reads a check number from a CHECK_PAID description', () => {
            const txn = parseOne('DEBIT,12/13/2025,CHECK PAID 1593,-50.00,CHECK_PAID,,');
            expect(txn.check_number).toBe('1593');
        });

        test('canonicalizes a padded check number from the slip column', () => {
            const txn = parseOne('DEBIT,12/13/2025,CHECK 01593,-50.00,CHECK,,01593');
            expect(txn.check_number).toBe('1593');
        });

        test('leaves the check number null when the row carries no number', () => {
            const txn = parseOne('DEBIT,12/13/2025,CHECK PAID,-50.00,CHECK_PAID,,');
            expect(txn.check_number).toBeNull();
        });

        test('ignores a non-numeric slip column value', () => {
            const txn = parseOne('DEBIT,12/13/2025,SOME DEBIT,-50.00,W_DRA,,n/a');
            expect(txn.check_number).toBeNull();
        });
    });

    test('should generate stable hash ignoring balance', () => {
        const row1 = {
            'Posting Date': '12/12/2025',
            'Description': 'Test Transaction',
            'Amount': '100.00',
            'Balance': ''
        };
        const row2 = {
            'Posting Date': '12/12/2025',
            'Description': 'Test Transaction',
            'Amount': '100.00',
            'Balance': '500.00' // Changed balance
        };

        const hash1 = generateTransactionHash(row1);
        const hash2 = generateTransactionHash(row2);

        expect(hash1).toBe(hash2);
    });

    test('should extract full ACH individual names before bank metadata markers', () => {
        expect(extractAchIndividualName('ORIG CO NAME:PAYPAL IND NAME:BERHE,SELAMAWIT WEB ID:123456'))
            .toBe('BERHE, SELAMAWIT');
        expect(extractAchIndividualName('ORIG CO NAME:STRIPE IND NAME:SELAMAWIT BERHE CO ID:999'))
            .toBe('SELAMAWIT BERHE');
    });
});
