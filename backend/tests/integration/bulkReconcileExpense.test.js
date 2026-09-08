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

/**
 * Recording several bank debits as expenses in one pass.
 *
 * The treasurer's real case is a backlog of charges from one merchant — twelve
 * months of the same subscription — that would otherwise be categorized one at
 * a time. Each row keeps its own amount, date and description; only the
 * category and payee are shared.
 *
 * Merchant descriptions follow the real Chase format. Card purchases run
 * church -> merchant, so no member appears in them.
 */
describe('Bulk expense reconciliation', () => {
    const CABLE = 'EXP006';
    const SUPPLIES = 'EXP104';

    beforeAll(async () => {
        await ExpenseMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
        await Member.destroy({ where: {} });

        await Member.create({
            first_name: 'Test',
            last_name: 'Admin',
            email: 'test@example.com',        // matches the Firebase mock in setup.js
            firebase_uid: 'test-firebase-uid',
            phone_number: '+1234567890',
            role: 'admin',
            is_active: true
        });

        await ExpenseCategory.findOrCreate({
            where: { gl_code: CABLE },
            defaults: { gl_code: CABLE, name: 'Cable', is_active: true }
        });
        await ExpenseCategory.findOrCreate({
            where: { gl_code: SUPPLIES },
            defaults: { gl_code: SUPPLIES, name: 'Supplies', is_active: true }
        });
        await ExpenseCategory.findOrCreate({
            where: { gl_code: 'EXP999' },
            defaults: { gl_code: 'EXP999', name: 'Retired', is_active: false }
        });
    });

    beforeEach(async () => {
        await ExpenseMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
    });

    const debit = (overrides) => BankTransaction.create({
        date: new Date('2025-07-28'),
        amount: -189.99,
        description: 'Spectrum 855-707-7328 MO                     07/28',
        type: 'DEBIT_CARD',
        status: 'PENDING',
        raw_data: {},
        ...overrides
    });

    const bulkExpense = (body) => request(app)
        .post('/api/bank/reconcile-expense-bulk')
        .set('Authorization', 'Bearer valid-token')
        .send(body);

    describe('recording', () => {
        it('records one expense per debit, each keeping its own amount and date', async () => {
            const july = await debit({ transaction_hash: 'sp-07' });
            const august = await debit({
                transaction_hash: 'sp-08',
                date: new Date('2025-08-28'),
                amount: -194.99,
                description: 'Spectrum 855-707-7328 MO                     08/28'
            });

            const res = await bulkExpense({
                transaction_ids: [july.id, august.id],
                gl_code: CABLE,
                payee_name: 'Spectrum'
            });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);

            const expenses = await LedgerEntry.findAll({
                where: { type: 'expense' },
                order: [['entry_date', 'ASC']]
            });
            expect(expenses).toHaveLength(2);
            expect(Number(expenses[0].amount)).toBe(189.99);
            expect(Number(expenses[1].amount)).toBe(194.99);
            expect(expenses.every((e) => e.category === CABLE)).toBe(true);
            expect(expenses.every((e) => e.payee_name === 'Spectrum')).toBe(true);
        });

        it('links each expense to its bank row so nothing is counted twice', async () => {
            const july = await debit({ transaction_hash: 'sp-07' });

            await bulkExpense({ transaction_ids: [july.id], gl_code: CABLE });

            const expense = await LedgerEntry.findOne({ where: { external_id: 'sp-07' } });
            expect(expense).not.toBeNull();
            await july.reload();
            expect(july.status).toBe('MATCHED');
        });

        it('keeps each row own description as the memo', async () => {
            const july = await debit({ transaction_hash: 'sp-07' });

            await bulkExpense({ transaction_ids: [july.id], gl_code: CABLE });

            const expense = await LedgerEntry.findOne({ where: { external_id: 'sp-07' } });
            expect(expense.memo).toContain('Spectrum');
        });

        it('records a card debit as debit_card, not as a check', async () => {
            const july = await debit({ transaction_hash: 'sp-07' });

            await bulkExpense({ transaction_ids: [july.id], gl_code: CABLE });

            const expense = await LedgerEntry.findOne({ where: { external_id: 'sp-07' } });
            expect(expense.payment_method).toBe('debit_card');
            expect(expense.check_number).toBeNull();
        });
    });

    describe('refusing a batch', () => {
        it('refuses a credit and files nothing at all', async () => {
            const spend = await debit({ transaction_hash: 'sp-07' });
            const gift = await debit({
                transaction_hash: 'gift-1',
                amount: 75.00,
                description: 'Zelle payment from A DONOR 123',
                type: 'ZELLE'
            });

            const res = await bulkExpense({
                transaction_ids: [spend.id, gift.id],
                gl_code: CABLE
            });

            expect(res.status).toBe(400);
            // All or nothing: the valid debit must not be filed either.
            expect(await LedgerEntry.count()).toBe(0);
            await spend.reload();
            expect(spend.status).toBe('PENDING');
        });

        it('names the row that caused the refusal', async () => {
            const spend = await debit({ transaction_hash: 'sp-07' });
            const gift = await debit({
                transaction_hash: 'gift-1', amount: 75.00, type: 'ZELLE',
                description: 'Zelle payment from A DONOR 123'
            });

            const res = await bulkExpense({
                transaction_ids: [spend.id, gift.id], gl_code: CABLE
            });

            expect(res.body.message).toContain(String(gift.id));
        });

        it('refuses a row that is already reconciled', async () => {
            const done = await debit({ transaction_hash: 'sp-07', status: 'MATCHED' });

            const res = await bulkExpense({ transaction_ids: [done.id], gl_code: CABLE });

            expect(res.status).toBe(400);
            expect(await LedgerEntry.count()).toBe(0);
        });

        it('refuses an inactive category', async () => {
            const july = await debit({ transaction_hash: 'sp-07' });

            const res = await bulkExpense({ transaction_ids: [july.id], gl_code: 'EXP999' });

            expect(res.status).toBe(400);
            expect(await LedgerEntry.count()).toBe(0);
        });

        it('requires a category', async () => {
            const july = await debit({ transaction_hash: 'sp-07' });

            const res = await bulkExpense({ transaction_ids: [july.id] });

            expect(res.status).toBe(400);
        });
    });

    describe('learning', () => {
        it('learns once when every row is the same merchant', async () => {
            const july = await debit({ transaction_hash: 'sp-07' });
            const august = await debit({
                transaction_hash: 'sp-08',
                date: new Date('2025-08-28'),
                description: 'Spectrum 855-707-7328 MO                     08/28'
            });

            await bulkExpense({
                transaction_ids: [july.id, august.id],
                gl_code: CABLE,
                payee_name: 'Spectrum'
            });

            const learned = await ExpenseMemoMatch.findAll();
            expect(learned).toHaveLength(1);
            expect(learned[0].gl_code).toBe(CABLE);
            expect(learned[0].payee_name).toBe('Spectrum');
        });

        // Teaching one category for a batch of unrelated merchants would drive
        // every later suggestion off a classification nobody chose per merchant.
        it('teaches nothing when the merchants differ', async () => {
            const spectrum = await debit({ transaction_hash: 'sp-07' });
            const depot = await debit({
                transaction_hash: 'hd-07',
                description: 'THE HOME DEPOT #0550 DALLAS TX       002096  07/15'
            });

            const res = await bulkExpense({
                transaction_ids: [spectrum.id, depot.id],
                gl_code: SUPPLIES
            });

            // The expenses are still filed — only the learning is withheld.
            expect(res.status).toBe(201);
            expect(await LedgerEntry.count()).toBe(2);
            expect(await ExpenseMemoMatch.count()).toBe(0);
        });

        it('says whether it learned, so the screen can tell the treasurer', async () => {
            const july = await debit({ transaction_hash: 'sp-07' });
            const august = await debit({
                transaction_hash: 'sp-08', date: new Date('2025-08-28'),
                description: 'Spectrum 855-707-7328 MO                     08/28'
            });

            const res = await bulkExpense({
                transaction_ids: [july.id, august.id], gl_code: CABLE, payee_name: 'Spectrum'
            });

            expect(res.body.data.learned).toBe(true);
            expect(res.body.data.recorded).toBe(2);
        });
    });
});
