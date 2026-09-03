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
