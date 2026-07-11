const request = require('supertest');
const app = require('../../src/server');
const { Member, BankTransaction } = require('../../src/models');

describe('Monthly Bank Summary API', () => {
    beforeAll(async () => {
        await BankTransaction.destroy({ where: {} });
        await Member.destroy({ where: {} });

        await Member.create({
            first_name: 'Test',
            last_name: 'Admin',
            email: 'test@example.com', // Matches setup.js firebase mock
            firebase_uid: 'test-firebase-uid',
            phone_number: '+1234567890',
            role: 'admin',
            is_active: true
        });
    });

    beforeEach(async () => {
        await BankTransaction.destroy({ where: {} });
    });

    // Helper: a date inside the month `offset` months before now
    const dateInMonth = (monthsAgo, day) => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
    };
    const keyForMonthsAgo = (monthsAgo) => {
        const now = new Date();
        const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    test('aggregates income, expense, net and ending balance per month', async () => {
        await BankTransaction.bulkCreate([
            // Last month: two credits, one debit. Newest (day 25) carries the ending balance.
            { date: dateInMonth(1, 5), amount: 500.00, balance: 10500.00, description: 'Zelle payment from A B 111', type: 'ZELLE_CREDIT', status: 'MATCHED', transaction_hash: 'ms-1' },
            { date: dateInMonth(1, 12), amount: 250.00, balance: 10750.00, description: 'Zelle payment from C D 222', type: 'ZELLE_CREDIT', status: 'MATCHED', transaction_hash: 'ms-2' },
            { date: dateInMonth(1, 25), amount: -100.00, balance: 10650.00, description: 'CHECK 1001', type: 'CHECK_PAID', status: 'PENDING', transaction_hash: 'ms-3' },
            // Two months ago: one credit, no balance data
            { date: dateInMonth(2, 10), amount: 300.00, balance: null, description: 'ACH credit', type: 'ACH_CREDIT', status: 'MATCHED', transaction_hash: 'ms-4' }
        ]);

        const res = await request(app)
            .get('/api/bank/summary/monthly')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);

        expect(res.body.success).toBe(true);
        const months = res.body.data.months;
        expect(months).toHaveLength(12);

        const lastMonth = months.find(m => m.month === keyForMonthsAgo(1));
        expect(lastMonth.income).toBe(750);
        expect(lastMonth.expense).toBe(100);
        expect(lastMonth.net).toBe(650);
        expect(lastMonth.ending_balance).toBe(10650); // newest transaction's balance
        expect(lastMonth.pending_count).toBe(1);
        expect(lastMonth.transaction_count).toBe(3);

        const twoAgo = months.find(m => m.month === keyForMonthsAgo(2));
        expect(twoAgo.income).toBe(300);
        expect(twoAgo.expense).toBe(0);
        expect(twoAgo.ending_balance).toBeNull(); // no balance data that month
        expect(twoAgo.pending_count).toBe(0);
    });

    test('same-day ending balance follows the lowest-id-is-newest convention', async () => {
        // Chase CSVs list newest first, so on the same day the LOWER id is newer
        const day = dateInMonth(1, 20);
        const first = await BankTransaction.create({
            date: day, amount: 50.00, balance: 9000.00,
            description: 'newer same-day row', type: 'ZELLE_CREDIT', status: 'MATCHED', transaction_hash: 'ms-sd-1'
        });
        await BankTransaction.create({
            date: day, amount: 25.00, balance: 8950.00,
            description: 'older same-day row', type: 'ZELLE_CREDIT', status: 'MATCHED', transaction_hash: 'ms-sd-2'
        });
        expect(first.id).toBeLessThan(first.id + 1); // sanity

        const res = await request(app)
            .get('/api/bank/summary/monthly')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);

        const lastMonth = res.body.data.months.find(m => m.month === keyForMonthsAgo(1));
        expect(lastMonth.ending_balance).toBe(9000); // lower id = newest
    });

    test('attributes 1st-of-month transactions to the correct month (timezone regression)', async () => {
        // Bug: parsing 'YYYY-MM-01' with new Date() treats it as UTC midnight,
        // which in timezones west of UTC lands on the last day of the PREVIOUS
        // month — mortgage/payroll debits on the 1st were shifted a month back.
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth(); // current month, day 1 — pass as DATEONLY string
        const firstOfMonth = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;

        await BankTransaction.create({
            date: firstOfMonth, amount: -8000.00, balance: 100000.00,
            description: 'MORTGAGE PAYMENT', type: 'ACH_DEBIT', status: 'MATCHED', transaction_hash: 'ms-first'
        });

        const res = await request(app)
            .get('/api/bank/summary/monthly')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);

        const thisMonth = res.body.data.months.find(mm => mm.month === monthKey);
        expect(thisMonth.expense).toBe(8000); // NOT attributed to the previous month
        const prevKey = keyForMonthsAgo(1);
        const prevMonth = res.body.data.months.find(mm => mm.month === prevKey);
        expect(prevMonth.expense).toBe(0);
    });

    test('excludes transactions older than 12 months', async () => {
        await BankTransaction.create({
            date: dateInMonth(14, 10), amount: 999.00, balance: 5000.00,
            description: 'ancient credit', type: 'ZELLE_CREDIT', status: 'MATCHED', transaction_hash: 'ms-old'
        });

        const res = await request(app)
            .get('/api/bank/summary/monthly')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);

        const months = res.body.data.months;
        expect(months).toHaveLength(12);
        const totalIncome = months.reduce((s, m) => s + m.income, 0);
        expect(totalIncome).toBe(0); // the 14-month-old credit is not included
    });
});
