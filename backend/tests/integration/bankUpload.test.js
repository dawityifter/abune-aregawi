process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
const request = require('supertest');
const app = require('../../src/server');
const { BankTransaction, Member } = require('../../src/models');
const { generateTransactionHash } = require('../../src/services/bankParserService');

describe('Bank CSV Upload API', () => {
    // Restore console.error to see failures
    const originalError = console.error;
    beforeAll(() => {
        console.error = (...args) => process.stderr.write(JSON.stringify(args) + '\n');
        process.env.ENABLE_DEMO_MODE = 'true';
    });
    afterAll(() => {
        console.error = jest.fn();
        process.env.ENABLE_DEMO_MODE = 'false';
    });

    beforeEach(async () => {
        await BankTransaction.destroy({ where: {} });
        await Member.destroy({ where: {} });

        // Create matching member for Demo Token
        await Member.create({
            first_name: 'Demo',
            last_name: 'Admin',
            email: 'demo@admin.com',
            phone_number: '+14699078229',
            role: 'treasurer',
            is_active: true
        });
    });

    test('should bulk create transactions from CSV', async () => {
        // Create a simple CSV string
        const csvContent = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,01/01/2024,Payment to Vendor,100.00,ACH_DEBIT,900.00,
CREDIT,01/02/2024,Deposit,200.00,DEPOSIT,1100.00,
CHECK,01/03/2024,Check 123,-50.00,CHECK,,123`;

        const buffer = Buffer.from(csvContent, 'utf-8');

        const response = await request(app)
            .post('/api/bank/upload')
            .set('Authorization', 'Bearer MAGIC_DEMO_TOKEN') // Bypass verification
            .attach('file', buffer, 'bank_statement.csv')
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.imported).toBe(3);
        expect(response.body.data.skipped).toBe(0);

        const txns = await BankTransaction.findAll({ order: [['date', 'ASC']] });
        expect(txns).toHaveLength(3);
        expect(txns[0].amount).toBe(-100.00); // Debit negated
        expect(txns[1].amount).toBe(200.00);
        expect(txns[2].amount).toBe(-50.00); // Check is debit
    });

    test('should update existing transactions with balance if missing', async () => {
        // 1. Create a transaction WITHOUT balance
        const date = new Date('2024-01-01');
        const amount = -100.00;
        const description = 'Payment to Vendor';
        // Generate hash manually to match parser logic
        const hash = generateTransactionHash({
            'Posting Date': '01/01/2024',
            'Description': description,
            'Amount': '100.00' // Note: Hash uses raw amount string usually? Let's check parser service.
        });

        // Wait, parser service uses: `${row['Posting Date']}|${row['Description']}|${row['Amount']}`
        // And the parser service sees '100.00' for the row.

        await BankTransaction.create({
            transaction_hash: hash,
            date: date,
            amount: amount,
            description: description,
            type: 'ACH_DEBIT',
            status: 'PENDING',
            balance: null // Missing balance
        });

        // 2. Upload CSV containing SAME transaction but WITH balance
        const csvContent = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,01/01/2024,Payment to Vendor,100.00,ACH_DEBIT,900.00,`;

        const buffer = Buffer.from(csvContent, 'utf-8');

        const response = await request(app)
            .post('/api/bank/upload')
            .set('Authorization', 'Bearer MAGIC_DEMO_TOKEN')
            .attach('file', buffer, 'bank_statement.csv')
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.imported).toBe(0); // Should be 0 imported
        expect(response.body.data.skipped).toBe(1); // 1 skipped (but updated)

        // 3. Verify balance was updated
        const txn = await BankTransaction.findOne({ where: { transaction_hash: hash } });
        expect(txn.balance).toBe(900.00);
    });
});
