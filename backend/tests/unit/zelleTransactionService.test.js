const {
    Member,
    Transaction,
    LedgerEntry,
    ZelleMemoMatch,
    BankMemoMatch,
    IncomeCategory
} = require('../../src/models');
const {
    extractPayerName,
    extractZelleReference,
    buildZelleExternalId,
    cleanLegacyMemo,
    matchZelleSender,
    getDefaultPaymentType,
    createZelleTransaction
} = require('../../src/services/zelleTransactionService');
const { learnBankMemoMatch } = require('../../src/services/bankMemoMatchService');
const { startZelleSyncScheduler, stopZelleSyncScheduler } = require('../../src/jobs/zelleSyncScheduler');

describe('Zelle Transaction Service', () => {
    let member;
    let collector;

    beforeAll(async () => {
        await BankMemoMatch.destroy({ where: {} });
        await ZelleMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
        await Member.destroy({ where: {} });

        collector = await Member.create({
            first_name: 'Treasurer',
            last_name: 'Admin',
            email: 'treasurer@example.com',
            phone_number: '+15550001111',
            role: 'treasurer',
            is_active: true
        });
        member = await Member.create({
            first_name: 'Tekea',
            last_name: 'Beyene',
            phone_number: '+15550002222',
            is_active: true
        });

        await IncomeCategory.findOrCreate({
            where: { gl_code: 'INC001' },
            defaults: { name: 'Donation', payment_type_mapping: 'donation', gl_code: 'INC001' }
        });
    });

    beforeEach(async () => {
        await BankMemoMatch.destroy({ where: {} });
        await ZelleMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
    });

    describe('extractPayerName (Phase 1)', () => {
        test('parses "X sent you $" Chase format', () => {
            expect(extractPayerName('TEKEA BEYENE sent you $50.00')).toBe('TEKEA BEYENE');
        });

        test('parses "received $ from X" format', () => {
            expect(extractPayerName('You received $125.50 from ALMAZ G TESFAY.')).toBe('ALMAZ G TESFAY');
        });

        test('parses bank CSV style "Zelle payment from X"', () => {
            expect(extractPayerName('Zelle payment from TEKEA BEYENE 12345678')).toBe('TEKEA BEYENE');
        });

        test('returns null for text without a payer', () => {
            expect(extractPayerName('Your statement is ready')).toBeNull();
            expect(extractPayerName('')).toBeNull();
        });
    });

    describe('extractZelleReference + buildZelleExternalId (payment-level dedupe)', () => {
        test('parses "Transaction number:" format', () => {
            expect(extractZelleReference('Transaction number: 25891237323')).toBe('25891237323');
        });

        test('parses "Transaction number|" table format and alphanumeric refs', () => {
            expect(extractZelleReference('Transaction number| CMB0K6P5R3MF')).toBe('CMB0K6P5R3MF');
        });

        test('parses "Confirmation number" format', () => {
            expect(extractZelleReference('Confirmation number: 987654321')).toBe('987654321');
        });

        test('returns null when no reference present', () => {
            expect(extractZelleReference('TEKEA BEYENE sent you $50.00')).toBeNull();
        });

        test('external_id uses the payment-level key when reference exists, gmail fallback otherwise', () => {
            expect(buildZelleExternalId({ zelleReference: 'CMB0K6P5R3MF', messageId: 'msg-1' })).toBe('zelle:CMB0K6P5R3MF');
            expect(buildZelleExternalId({ zelleReference: null, messageId: 'msg-1' })).toBe('gmail:msg-1');
            expect(buildZelleExternalId({ zelleReference: null, messageId: null })).toBeNull();
        });

        test('two emails about the same payment produce the SAME external_id', () => {
            const email1 = buildZelleExternalId({ zelleReference: extractZelleReference('You received $50.00. Transaction number: 25891237323'), messageId: 'msg-aaa' });
            const email2 = buildZelleExternalId({ zelleReference: extractZelleReference('Reminder: money is available. Transaction number: 25891237323'), messageId: 'msg-bbb' });
            expect(email1).toBe(email2);
        });
    });

    describe('cleanLegacyMemo (Phase 1)', () => {
        test('prefers payer name when available', () => {
            expect(cleanLegacyMemo('anything', 'TEKEA BEYENE')).toBe('TEKEA BEYENE');
        });

        test('strips amounts so memos stay stable across payments', () => {
            const cleaned = cleanLegacyMemo('TEKEA BEYENE sent you $50.00', null);
            expect(cleaned).not.toMatch(/\$|50\.00/);
            expect(cleaned).toContain('TEKEA BEYENE');
        });
    });

    describe('matchZelleSender (Phase 1: unified matching)', () => {
        test('learned association from bank reconciliation is found by the email flow (high confidence)', async () => {
            // Learned on the Bank Reconciliation side
            await learnBankMemoMatch({
                id: null,
                type: 'ZELLE',
                payer_name: 'TEKEA BEYENE',
                description: 'Zelle payment from TEKEA BEYENE 99887766'
            }, member.id);

            // Looked up from the email side
            const match = await matchZelleSender({ payerName: 'TEKEA BEYENE', note: 'ignored' });
            expect(String(match.member_id)).toBe(String(member.id));
            expect(match.confidence).toBe('high');
        });

        test('unique fuzzy name match is only medium confidence (no auto-create)', async () => {
            const match = await matchZelleSender({ payerName: 'TEKEA BEYENE', note: null });
            expect(String(match.member_id)).toBe(String(member.id));
            expect(match.confidence).toBe('medium');
        });

        test('unknown payer yields no match', async () => {
            const match = await matchZelleSender({ payerName: 'TOTAL STRANGER', note: null });
            expect(match.member_id).toBeNull();
        });
    });

    describe('getDefaultPaymentType (Phase 2: last-used type)', () => {
        test('returns the member\'s most recent payment type', async () => {
            await Transaction.create({
                member_id: member.id,
                collected_by: collector.id,
                payment_date: '2025-11-01',
                amount: 100,
                payment_type: 'membership_due',
                payment_method: 'zelle',
                status: 'succeeded',
                external_id: 'gmail:prev-1'
            });

            const result = await getDefaultPaymentType(member.id, '2026-01-15');
            expect(result.payment_type).toBe('membership_due');
            expect(result.for_year).toBe(2026); // year of the NEW payment
        });

        test('defaults to donation when no history', async () => {
            const result = await getDefaultPaymentType(member.id, '2026-01-15');
            expect(result).toEqual({ payment_type: 'donation', for_year: null });
        });
    });

    describe('createZelleTransaction (Phase 2: creation + learning)', () => {
        test('creates transaction + ledger entry and learns the payer', async () => {
            const result = await createZelleTransaction({
                external_id: 'gmail:new-1',
                amount: 75.00,
                payment_date: '2026-01-10',
                note: 'TEKEA BEYENE sent you $75.00',
                member_id: member.id,
                payment_type: 'donation',
                payer_name: 'TEKEA BEYENE'
            }, collector.id);

            expect(result.success).toBe(true);

            const tx = await Transaction.findOne({ where: { external_id: 'gmail:new-1' } });
            expect(tx).not.toBeNull();
            expect(tx.payment_method).toBe('zelle');

            const ledger = await LedgerEntry.findOne({ where: { transaction_id: tx.id } });
            expect(ledger).not.toBeNull();

            // Learned in BOTH systems (email flow + bank reconciliation share keys)
            expect(await BankMemoMatch.count({ where: { member_id: member.id } })).toBeGreaterThan(0);
            expect(await ZelleMemoMatch.count({ where: { member_id: member.id } })).toBeGreaterThan(0);
        });

        test('is insert-only: duplicate external_id returns EXISTS', async () => {
            await createZelleTransaction({
                external_id: 'gmail:dup-1',
                amount: 10,
                payment_date: '2026-01-10',
                member_id: member.id
            }, collector.id);

            const second = await createZelleTransaction({
                external_id: 'gmail:dup-1',
                amount: 10,
                payment_date: '2026-01-10',
                member_id: member.id
            }, collector.id);

            expect(second.success).toBe(false);
            expect(second.code).toBe('EXISTS');
            expect(await Transaction.count({ where: { external_id: 'gmail:dup-1' } })).toBe(1);
        });
    });

    describe('zelleSyncScheduler (Phase 3)', () => {
        afterEach(() => {
            stopZelleSyncScheduler();
            delete process.env.ZELLE_SYNC_ENABLED;
        });

        test('does not start when ZELLE_SYNC_ENABLED is not true', () => {
            delete process.env.ZELLE_SYNC_ENABLED;
            expect(startZelleSyncScheduler({ log: () => {}, warn: () => {}, error: () => {} })).toBeNull();
        });

        test('does not start without Gmail credentials even when enabled', () => {
            process.env.ZELLE_SYNC_ENABLED = 'true';
            delete process.env.GMAIL_CLIENT_ID;
            expect(startZelleSyncScheduler({ log: () => {}, warn: () => {}, error: () => {} })).toBeNull();
        });
    });
});
