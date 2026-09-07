const request = require('supertest');
const app = require('../../src/server');
const {
    Member,
    BankTransaction,
    Transaction,
    LedgerEntry,
    BankMemoMatch,
    ZelleMemoMatch,
    IncomeCategory
} = require('../../src/models');

/**
 * Bulk member-linking is for deposits. A debit is money the church spent, and
 * belongs to an expense with a GL code and a payee — not to a member with a
 * payment type.
 *
 * Without an explicit refusal a selected debit reached processReconciliation,
 * which passed its NEGATIVE amount into a member donation. Only
 * Transaction.amount's $1.00 minimum stopped it — a validator about how small
 * a gift may be, which happens to also reject a negative one. Nothing was
 * actually guarding the direction of the money, and the failure surfaced to
 * the treasurer as an unexplained "N failed".
 *
 * Names here are invented; no real member appears in this file.
 */
describe('Bulk reconcile refuses debits', () => {
    let member;
    let credit;
    let debit;

    beforeAll(async () => {
        await BankMemoMatch.destroy({ where: {} });
        await ZelleMemoMatch.destroy({ where: {} });
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

        member = await Member.create({
            first_name: 'Selam',
            last_name: 'Gebre',
            phone_number: '+1555444333',
            is_active: true
        });

        await IncomeCategory.findOrCreate({
            where: { gl_code: 'INC001' },
            defaults: { gl_code: 'INC001', name: 'Donation', payment_type_mapping: 'donation' }
        });
    });

    beforeEach(async () => {
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });

        credit = await BankTransaction.create({
            date: new Date('2025-09-20'),
            amount: 75.00,
            description: 'Zelle payment from SELAM GEBRE 5566778899',
            type: 'ZELLE',
            status: 'PENDING',
            payer_name: 'SELAM GEBRE',
            transaction_hash: 'bulk-credit-1',
            raw_data: {}
        });

        debit = await BankTransaction.create({
            date: new Date('2025-09-28'),
            amount: -194.99,
            description: 'Spectrum 855-707-7328 MO                     09/28',
            type: 'DEBIT_CARD',
            status: 'PENDING',
            transaction_hash: 'bulk-debit-1',
            raw_data: {}
        });
    });

    const bulkLink = (ids) => request(app)
        .post('/api/bank/reconcile-bulk')
        .set('Authorization', 'Bearer valid-token')
        .send({ transaction_ids: ids, member_id: member.id, payment_type: 'donation' });

    it('refuses outright rather than reporting a partial success', async () => {
        const res = await bulkLink([debit.id]);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('says the money went the wrong way, not that the amount is too small', async () => {
        const res = await bulkLink([debit.id]);

        // The old failure blamed the donation minimum, which told the
        // treasurer nothing about what they had actually selected.
        expect(res.body.message).toMatch(/debit/i);
        expect(res.body.message).not.toMatch(/\$1\.00/);
    });

    it('leaves the debit untouched', async () => {
        await bulkLink([debit.id]);

        await debit.reload();
        expect(debit.status).toBe('PENDING');
        expect(await Transaction.count()).toBe(0);
    });

    it('refuses the whole batch when debits are mixed in with deposits', async () => {
        const res = await bulkLink([credit.id, debit.id]);

        expect(res.status).toBe(400);
        // All or nothing: reconciling half a selection and reporting it as
        // success is how the debits went unnoticed in the first place.
        await credit.reload();
        expect(credit.status).toBe('PENDING');
        expect(await Transaction.count()).toBe(0);
    });

    it('names the offending rows so the treasurer can find them', async () => {
        const res = await bulkLink([credit.id, debit.id]);

        expect(res.body.message).toContain(String(debit.id));
        expect(res.body.message).not.toContain(String(credit.id));
    });

    it('still links a deposit-only batch', async () => {
        const res = await bulkLink([credit.id]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        await credit.reload();
        expect(credit.status).toBe('MATCHED');
        expect(await Transaction.count()).toBe(1);
    });
});
