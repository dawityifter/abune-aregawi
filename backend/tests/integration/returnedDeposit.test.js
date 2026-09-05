const request = require('supertest');
const app = require('../../src/server');
const { BankTransaction, LedgerEntry, Member, Transaction } = require('../../src/models');

describe('Returned deposited items', () => {
    beforeAll(() => { process.env.ENABLE_DEMO_MODE = 'true'; });
    afterAll(() => { process.env.ENABLE_DEMO_MODE = 'false'; });

    beforeEach(async () => {
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
        await Member.destroy({ where: {} });
        await Member.create({
            first_name: 'Demo', last_name: 'Admin', email: 'demo@admin.com',
            phone_number: '+14699078229', role: 'treasurer', is_active: true
        });
    });

    const RETURN_DESC =
        'DEPOSITED ITEM RETURNED RETURN ITEM REF# 99007994 CHK SER# 1397 DEP REF: 5380734149 '
        + 'CHARGEBACK RTN REASON: UnableTo Locate TRN: 9007994245RI';

    async function createReturn() {
        return BankTransaction.create({
            date: new Date('2026-09-02'), amount: -200.00, description: RETURN_DESC,
            type: 'DEPOSIT_RETURN', status: 'PENDING', check_number: '1397',
            transaction_hash: 'hash-returned', raw_data: {}
        });
    }

    async function listRow(id) {
        const res = await request(app)
            .get('/api/bank/transactions?limit=50')
            .set('Authorization', 'Bearer MAGIC_DEMO_TOKEN');
        expect(res.status).toBe(200);
        const rows = res.body.data?.transactions || res.body.data || [];
        return rows.find(r => String(r.id) === String(id));
    }

    it('flags the row as a returned item rather than a pending debit', async () => {
        const txn = await createReturn();

        const row = await listRow(txn.id);

        expect(row.returned_item).toBeTruthy();
        expect(row.returned_item.state).toBe('RETURNED');
        expect(row.returned_item.check_number).toBe('1397');
    });

    it('names the gift it reverses when the donor check serial was recorded', async () => {
        const txn = await createReturn();
        const original = await LedgerEntry.create({
            type: 'donation', category: 'INC004', amount: 200.00,
            entry_date: '2026-08-30', payment_method: 'check',
            check_number: '1397', receipt_number: '6102',
            memo: 'Sunday offering', source_system: 'manual'
        });

        const row = await listRow(txn.id);

        expect(row.returned_item.reverses_ledger_entry_id).toBe(original.id);
        expect(row.returned_item.receipt_number).toBe('6102');
    });

    it('says so plainly when no matching gift was recorded', async () => {
        const txn = await createReturn();

        const row = await listRow(txn.id);

        expect(row.returned_item.reverses_ledger_entry_id).toBeNull();
        expect(row.returned_item.reason).toBe('ORIGINAL_NOT_FOUND');
    });

    it('does not treat the return as one of the church own checks', async () => {
        const txn = await createReturn();
        await LedgerEntry.create({
            type: 'expense', category: 'EXP100', amount: 200.00,
            entry_date: '2026-08-30', payment_method: 'check',
            check_number: '1397', source_system: 'manual'
        });

        const row = await listRow(txn.id);

        expect(row.check_status).toBeUndefined();
        expect(row.returned_item.state).toBe('RETURNED');
    });
});
