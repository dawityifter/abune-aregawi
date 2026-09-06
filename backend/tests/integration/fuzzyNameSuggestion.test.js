const request = require('supertest');
const app = require('../../src/server');
const {
    Member,
    BankTransaction,
    Transaction,
    LedgerEntry,
    ZelleMemoMatch,
    BankMemoMatch
} = require('../../src/models');
const { suggestMatch } = require('../../src/services/reconciliationService');

/**
 * Fuzzy payer-name matching has to run on every dialect the app is used with.
 *
 * ILIKE is Postgres-only: SQLite rejects it outright. Because the name lookup
 * sits inside getBankTransactions' enrichment block, a throw there took every
 * later enrichment down with it, so pending rows came back with no suggestions
 * at all — silently, since the error was caught and logged.
 *
 * Names here are invented; no real member appears in this file.
 */
describe('Fuzzy payer-name suggestions', () => {
    let matchable;

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

        matchable = await Member.create({
            first_name: 'Fikadu',
            last_name: 'Weldemariam',
            phone_number: '+1555000111',
            is_active: true
        });
    });

    it('matches a payer name to a member', async () => {
        const suggestion = await suggestMatch({
            description: 'Zelle payment from FIKADU WELDEMARIAM 1122334455',
            type: 'ZELLE',
            payer_name: 'FIKADU WELDEMARIAM',
            amount: 100,
            date: new Date('2025-03-02')
        });

        expect(suggestion).not.toBeNull();
        expect(suggestion.member.id).toBe(matchable.id);
    });

    it('matches regardless of the case the bank reports', async () => {
        const suggestion = await suggestMatch({
            description: 'Zelle payment from fikadu weldemariam 1122334455',
            type: 'ZELLE',
            payer_name: 'fikadu weldemariam',
            amount: 100,
            date: new Date('2025-03-02')
        });

        expect(suggestion).not.toBeNull();
        expect(suggestion.member.id).toBe(matchable.id);
    });

    // The path the ILIKE fix actually restores.
    //
    // bankMemoMatchService's candidate search runs first and keeps numeric
    // tokens, so a payer string carrying a trailing reference over-constrains
    // it and it returns nothing. Only then does reconciliationService's
    // fallback run — it strips non-letters, so it still finds the member. That
    // fallback is the code that used to throw on SQLite.
    it('falls back to a letters-only match when the payer carries a reference number', async () => {
        const suggestion = await suggestMatch({
            description: 'Zelle payment from FIKADU WELDEMARIAM 998877 1122334455',
            type: 'ZELLE',
            payer_name: 'FIKADU WELDEMARIAM 998877',
            amount: 100,
            date: new Date('2025-03-02')
        });

        expect(suggestion).not.toBeNull();
        expect(suggestion.type).toBe('FUZZY_NAME');
        expect(suggestion.member.id).toBe(matchable.id);
    });

    it('offers nobody when the name matches no member', async () => {
        const suggestion = await suggestMatch({
            description: 'Zelle payment from NOBODY ATALL 9988776655',
            type: 'ZELLE',
            payer_name: 'NOBODY ATALL',
            amount: 100,
            date: new Date('2025-03-02')
        });

        expect(suggestion).toBeNull();
    });

    it('reaches the pending row through the transactions list', async () => {
        const pending = await BankTransaction.create({
            date: new Date('2025-03-02'),
            amount: 100.00,
            description: 'Zelle payment from FIKADU WELDEMARIAM 1122334455',
            type: 'ZELLE',
            status: 'PENDING',
            payer_name: 'FIKADU WELDEMARIAM',
            transaction_hash: 'fuzzyhash-1',
            raw_data: {}
        });

        const res = await request(app)
            .get('/api/bank/transactions?status=PENDING')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);

        const row = res.body.data.transactions.find((t) => t.id === pending.id);
        expect(row).toBeDefined();
        expect(row.suggested_match?.member?.id).toBe(matchable.id);
    });
});
