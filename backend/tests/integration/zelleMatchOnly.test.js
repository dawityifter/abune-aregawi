// Chase Zelle notification fixture. Synthetic payer — never use real member data.
const MOCK_MESSAGE = {
    id: 'msg-1',
    internalDate: String(Date.parse('2026-08-20T15:00:00Z')),
    snippet: 'SYNTHETIC PAYER sent you $75.00',
    payload: {
        headers: [
            { name: 'Subject', value: 'You received money with Zelle:' },
            { name: 'From', value: 'Chase <no.reply.alerts@chase.com>' },
            { name: 'Date', value: 'Thu, 20 Aug 2026 15:00:00 +0000' },
            { name: 'Message-Id', value: '<abc123@chase.com>' }
        ],
        parts: [{
            mimeType: 'text/plain',
            body: {
                data: Buffer.from(
                    'SYNTHETIC PAYER sent you $75.00 Transaction number: TESTREF123456 Memo N/A'
                ).toString('base64')
            }
        }]
    }
};

jest.mock('googleapis', () => ({
    google: {
        auth: { OAuth2: class { setCredentials() {} } },
        gmail: () => ({
            users: {
                labels: {
                    list: async () => ({ data: { labels: [] } }),
                    create: async () => ({ data: { id: 'label-1' } })
                },
                messages: {
                    list: async () => ({ data: { messages: [{ id: 'msg-1' }] } }),
                    get: async () => ({ data: MOCK_MESSAGE }),
                    modify: async () => ({})
                }
            }
        })
    }
}));

const {
    Member, Transaction, LedgerEntry, ZelleEmailQueue, ZelleMemoMatch, BankMemoMatch, IncomeCategory
} = require('../../src/models');
const { syncZelleFromGmail } = require('../../src/services/gmailZelleIngest');
const { learnBankMemoMatch } = require('../../src/services/bankMemoMatchService');

describe('Zelle match-only mode', () => {
    let member;

    beforeAll(async () => {
        process.env.GMAIL_CLIENT_ID = 'test-client-id';
        process.env.GMAIL_CLIENT_SECRET = 'test-client-secret';
        process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token';

        await Member.destroy({ where: {} });
        member = await Member.create({
            first_name: 'Synthetic',
            last_name: 'Payer',
            phone_number: '+15550003333',
            role: 'admin',
            is_active: true
        });
        await IncomeCategory.findOrCreate({
            where: { gl_code: 'INC001' },
            defaults: { name: 'Donation', payment_type_mapping: 'donation', gl_code: 'INC001' }
        });
    });

    beforeEach(async () => {
        delete process.env.ZELLE_GMAIL_CREATE_ENABLED;
        await ZelleEmailQueue.destroy({ where: {} });
        await BankMemoMatch.destroy({ where: {} });
        await ZelleMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
    });

    test('creates no transaction and queues the email for review when the flag is off', async () => {
        // A learned association that WOULD have triggered auto-create before
        await learnBankMemoMatch({
            type: 'ZELLE',
            payer_name: 'SYNTHETIC PAYER',
            description: 'Zelle payment from SYNTHETIC PAYER 0000000'
        }, member.id);

        const stats = await syncZelleFromGmail({ dryRun: false });

        expect(stats.autoCreated).toBe(0);
        expect(stats.needsReview).toBe(1);
        expect(await Transaction.count()).toBe(0);
        expect(await LedgerEntry.count()).toBe(0);

        const row = await ZelleEmailQueue.findOne({ where: { external_id: 'zelle:TESTREF123456' } });
        expect(row).not.toBeNull();
        expect(row.status).toBe('NEEDS_REVIEW');
        expect(row.payer_name).toBe('SYNTHETIC PAYER');
        expect(Number(row.amount)).toBe(75);
        // The suggestion is still recorded, so the UI can pre-select it
        expect(String(row.matched_member_id)).toBe(String(member.id));
        expect(row.match_confidence).toBe('high');
    });

    test('still auto-creates when the flag is explicitly enabled', async () => {
        process.env.ZELLE_GMAIL_CREATE_ENABLED = 'true';
        await learnBankMemoMatch({
            type: 'ZELLE',
            payer_name: 'SYNTHETIC PAYER',
            description: 'Zelle payment from SYNTHETIC PAYER 0000000'
        }, member.id);

        const stats = await syncZelleFromGmail({ dryRun: false });

        expect(stats.autoCreated).toBe(1);
        expect(await Transaction.count()).toBe(1);
        const row = await ZelleEmailQueue.findOne({ where: { external_id: 'zelle:TESTREF123456' } });
        expect(row.status).toBe('AUTO_CREATED');
    });
});
