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
        // Chase CSV encodes sign in Amount: expenses are negative, refunds positive
        const csvContent = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,01/01/2024,Payment to Vendor,-100.00,ACH_DEBIT,900.00,
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
        expect(txns[0].amount).toBe(-100.00); // Expense: negative in CSV, stays negative
        expect(txns[1].amount).toBe(200.00);
        expect(txns[2].amount).toBe(-50.00);
    });

    test('should update existing transactions with balance if missing', async () => {
        // 1. Create a transaction WITHOUT balance
        const date = new Date('2024-01-01');
        const amount = -100.00;
        const description = 'Payment to Vendor';
        // Generate hash manually to match parser logic.
        // Chase CSV expenses have negative amounts, so the hash key uses '-100.00'.
        const hash = generateTransactionHash({
            'Posting Date': '01/01/2024',
            'Description': description,
            'Amount': '-100.00'
        });

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
DEBIT,01/01/2024,Payment to Vendor,-100.00,ACH_DEBIT,900.00,`;

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

    test('auto-reconcile only examines newly-imported rows, not the whole PENDING backlog', async () => {
        // Pre-existing unrelated PENDING transaction (simulates the accumulated backlog).
        await BankTransaction.create({
            transaction_hash: generateTransactionHash({
                'Posting Date': '12/01/2023',
                'Description': 'Old Pending Item',
                'Amount': '-25.00'
            }),
            date: new Date('2023-12-01'),
            amount: -25.00,
            description: 'Old Pending Item',
            type: 'ACH_DEBIT',
            status: 'PENDING',
            balance: null
        });

        // Upload a single NEW row.
        const csvContent = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
CREDIT,01/05/2024,Fresh Deposit,200.00,DEPOSIT,1300.00,`;

        const response = await request(app)
            .post('/api/bank/upload')
            .set('Authorization', 'Bearer MAGIC_DEMO_TOKEN')
            .attach('file', Buffer.from(csvContent, 'utf-8'), 'bank_statement.csv')
            .expect(200);

        expect(response.body.data.imported).toBe(1);
        // The pass must be scoped to the 1 new row — NOT the 2 total PENDING rows.
        expect(response.body.data.auto_reconcile).not.toBeNull();
        expect(response.body.data.auto_reconcile.examined).toBe(1);
        expect(response.body.data.auto_reconcile_deferred).toBe(false);
    });

    test('skips the inline auto-reconcile pass and flags deferred when import exceeds the cap', async () => {
        process.env.UPLOAD_AUTO_RECONCILE_LIMIT = '2';
        try {
            // 3 new rows > cap of 2 → inline pass must be skipped, not run partially.
            const csvContent = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
CREDIT,02/01/2024,Deposit One,100.00,DEPOSIT,1100.00,
CREDIT,02/02/2024,Deposit Two,150.00,DEPOSIT,1250.00,
CREDIT,02/03/2024,Deposit Three,50.00,DEPOSIT,1300.00,`;

            const response = await request(app)
                .post('/api/bank/upload')
                .set('Authorization', 'Bearer MAGIC_DEMO_TOKEN')
                .attach('file', Buffer.from(csvContent, 'utf-8'), 'bank_statement.csv')
                .expect(200);

            expect(response.body.data.imported).toBe(3);
            expect(response.body.data.auto_reconcile).toBeNull();
            expect(response.body.data.auto_reconcile_deferred).toBe(true);
        } finally {
            delete process.env.UPLOAD_AUTO_RECONCILE_LIMIT;
        }
    });
});
