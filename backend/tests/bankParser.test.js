const { parseChaseCSV, generateTransactionHash } = require('../src/services/bankParserService');

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
});
