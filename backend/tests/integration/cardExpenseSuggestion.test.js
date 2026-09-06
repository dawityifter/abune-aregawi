const request = require('supertest');
const app = require('../../src/server');
const {
    Member,
    BankTransaction,
    Transaction,
    LedgerEntry,
    ExpenseMemoMatch,
    ExpenseCategory
} = require('../../src/models');
const { learnExpenseMemoMatch } = require('../../src/services/autoReconcileService');

/**
 * A card purchase the treasurer has classified before should arrive at the
 * reconcile screen carrying that classification as a suggestion — never as a
 * booked expense, because one merchant's GL code varies charge to charge.
 *
 * Merchant descriptions follow the real Chase format. Card purchases run
 * church -> merchant, so no member appears in them.
 */
describe('Card expense suggestions on pending debits', () => {
    let adminUser;

    beforeAll(async () => {
        await ExpenseMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
        await Member.destroy({ where: {} });

        adminUser = await Member.create({
            first_name: 'Test',
            last_name: 'Admin',
            email: 'test@example.com',   // matches the Firebase mock in setup.js
            firebase_uid: 'test-firebase-uid',
            phone_number: '+1234567890',
            role: 'admin',
            is_active: true
        });

        await ExpenseCategory.findOrCreate({
            where: { gl_code: 'EXP006' },
            defaults: { gl_code: 'EXP006', name: 'Cable', is_active: true }
        });
    });

    beforeEach(async () => {
        await ExpenseMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
    });

    const listPending = async () => {
        const res = await request(app)
            .get('/api/bank/transactions?status=PENDING')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);
        return res.body.data.transactions;
    };

    async function teachSpectrum() {
        const prior = await BankTransaction.create({
            date: new Date('2025-08-28'),
            amount: -189.99,
            description: 'Spectrum 855-707-7328 MO                     08/28',
            type: 'DEBIT_CARD',
            status: 'MATCHED',
            transaction_hash: 'card-prior',
            raw_data: {}
        });
        await learnExpenseMemoMatch(prior.get({ plain: true }), {
            gl_code: 'EXP006',
            payee_name: 'Spectrum'
        });
    }

    it('suggests the learned classification for a repeat charge', async () => {
        await teachSpectrum();

        const repeat = await BankTransaction.create({
            date: new Date('2025-09-28'),
            amount: -194.99,
            description: 'Spectrum 855-707-7328 MO                     09/28',
            type: 'DEBIT_CARD',
            status: 'PENDING',
            transaction_hash: 'card-repeat',
            raw_data: {}
        });

        const row = (await listPending()).find((t) => t.id === repeat.id);
        expect(row).toBeDefined();
        expect(row.suggested_expense).toMatchObject({
            gl_code: 'EXP006',
            category_name: 'Cable',
            payee_name: 'Spectrum'
        });
    });

    it('leaves the row pending and books nothing', async () => {
        await teachSpectrum();

        const repeat = await BankTransaction.create({
            date: new Date('2025-09-28'),
            amount: -194.99,
            description: 'Spectrum 855-707-7328 MO                     09/28',
            type: 'DEBIT_CARD',
            status: 'PENDING',
            transaction_hash: 'card-repeat-2',
            raw_data: {}
        });

        const row = (await listPending()).find((t) => t.id === repeat.id);
        expect(row.status).toBe('PENDING');
        expect(await LedgerEntry.count({ where: { external_id: 'card-repeat-2' } })).toBe(0);
    });

    it('offers nothing for a merchant never classified before', async () => {
        const unknown = await BankTransaction.create({
            date: new Date('2025-09-14'),
            amount: -63.20,
            description: 'AN UNSEEN MERCHANT 555-000-1111 TX         09/14',
            type: 'DEBIT_CARD',
            status: 'PENDING',
            transaction_hash: 'card-unknown',
            raw_data: {}
        });

        const row = (await listPending()).find((t) => t.id === unknown.id);
        expect(row.suggested_expense).toBeUndefined();
    });

    it('offers nothing on a credit, which is never an expense', async () => {
        await teachSpectrum();

        const refund = await BankTransaction.create({
            date: new Date('2025-09-30'),
            amount: 194.99,
            description: 'Spectrum 855-707-7328 MO                     09/30',
            type: 'DEBIT_CARD',
            status: 'PENDING',
            transaction_hash: 'card-refund',
            raw_data: {}
        });

        const row = (await listPending()).find((t) => t.id === refund.id);
        expect(row.suggested_expense).toBeUndefined();
    });
});
