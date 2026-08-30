// Chase Zelle notification fixture. Synthetic payer — never use real member data.
const MOCK_MESSAGE = {
    id: 'msg-1',
    internalDate: String(Date.parse('2026-08-20T15:00:00Z')),
    snippet: 'SYNTHETIC PAYER sent you $75.00',
    payload: {
        headers: [
            // The ® is required: extractPayerName's character class stops at it, which is
            // what prevents the subject bleeding into the captured payer name.
            { name: 'Subject', value: 'You received money with Zelle®' },
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
        // server.js also loads youtubeRoutes, which calls google.youtube('v3') at
        // require time; stub it so requiring the app doesn't throw. Nothing here
        // exercises YouTube behavior.
        youtube: () => ({}),
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
const { learnBankMemoMatch, findSuggestionCandidates } = require('../../src/services/bankMemoMatchService');
const request = require('supertest');
const app = require('../../src/server');

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
            email: 'test@example.com',
            firebase_uid: 'test-firebase-uid',
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

    describe('create endpoints while the flag is off', () => {
        test('POST /api/zelle/reconcile/create-transaction returns 403', async () => {
            const res = await request(app)
                .post('/api/zelle/reconcile/create-transaction')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    external_id: 'zelle:BLOCKED1',
                    amount: 40.00,
                    payment_date: '2026-08-20',
                    member_id: member.id,
                    payment_type: 'donation'
                })
                .expect(403);

            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('CREATE_DISABLED');
            expect(await Transaction.count()).toBe(0);
        });

        test('POST /api/zelle/reconcile/batch-create returns 403', async () => {
            const res = await request(app)
                .post('/api/zelle/reconcile/batch-create')
                .set('Authorization', 'Bearer valid-token')
                .send({ items: [{
                    external_id: 'zelle:BLOCKED2',
                    amount: 40.00,
                    payment_date: '2026-08-20',
                    member_id: member.id,
                    payment_type: 'donation'
                }] })
                .expect(403);

            expect(res.body.code).toBe('CREATE_DISABLED');
            expect(await Transaction.count()).toBe(0);
        });
    });

    describe('POST /api/zelle/queue/:id/match', () => {
        let queueRow;

        beforeEach(async () => {
            queueRow = await ZelleEmailQueue.create({
                external_id: 'zelle:MATCHME1',
                payer_name: 'SYNTHETIC PAYER',
                amount: 75.00,
                payment_date: '2026-08-20',
                note: 'SYNTHETIC PAYER sent you $75.00',
                status: 'NEEDS_REVIEW'
            });
        });

        test('learns keys a real bank CSV row will hit — the crux of the design', async () => {
            await request(app)
                .post(`/api/zelle/queue/${queueRow.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id })
                .expect(200);

            // A real Chase CSV Zelle row, as bankParserService would produce it
            const bankRow = {
                type: 'ZELLE',
                payer_name: 'SYNTHETIC PAYER',
                description: 'Zelle payment from SYNTHETIC PAYER 27250625041'
            };
            const suggestions = await findSuggestionCandidates(bankRow);
            const learned = suggestions.find(s => String(s.source || '').startsWith('LEARNED'));

            expect(learned).toBeDefined();
            expect(learned.confidence).toBe('high');
            expect(String(learned.member.id)).toBe(String(member.id));
        });

        test('stamps the queue row and creates no transaction', async () => {
            const res = await request(app)
                .post(`/api/zelle/queue/${queueRow.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id })
                .expect(200);

            expect(res.body.success).toBe(true);
            await queueRow.reload();
            expect(queueRow.status).toBe('MATCHED');
            expect(String(queueRow.matched_member_id)).toBe(String(member.id));
            expect(String(queueRow.matched_by)).toBe(String(member.id));
            expect(queueRow.matched_at).not.toBeNull();
            expect(await Transaction.count()).toBe(0);
        });

        test('is idempotent and re-matching moves the learned key to the new member', async () => {
            const other = await Member.create({
                first_name: 'Other', last_name: 'Member',
                phone_number: '+15550004444', is_active: true
            });

            await request(app).post(`/api/zelle/queue/${queueRow.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id }).expect(200);
            await request(app).post(`/api/zelle/queue/${queueRow.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: other.id }).expect(200);

            const suggestions = await findSuggestionCandidates({
                type: 'ZELLE',
                payer_name: 'SYNTHETIC PAYER',
                description: 'Zelle payment from SYNTHETIC PAYER 27250625041'
            });
            const learned = suggestions.filter(s => String(s.source || '').startsWith('LEARNED'));
            expect(learned).toHaveLength(1);
            expect(String(learned[0].member.id)).toBe(String(other.id));
        });

        test('accepts a payer_name override when the email could not be parsed', async () => {
            const unparsed = await ZelleEmailQueue.create({
                external_id: 'zelle:NOPAYER1',
                payer_name: null,
                amount: 60.00,
                payment_date: '2026-08-21',
                note: 'You received money with Zelle',
                status: 'NEEDS_REVIEW'
            });

            await request(app)
                .post(`/api/zelle/queue/${unparsed.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id, payer_name: 'OVERRIDE PAYER' })
                .expect(200);

            await unparsed.reload();
            expect(unparsed.payer_name).toBe('OVERRIDE PAYER');

            const suggestions = await findSuggestionCandidates({
                type: 'ZELLE',
                payer_name: 'OVERRIDE PAYER',
                description: 'Zelle payment from OVERRIDE PAYER 99887766'
            });
            expect(suggestions.some(s => String(s.source || '').startsWith('LEARNED'))).toBe(true);
        });

        test('refuses to re-match a row that already posted a transaction', async () => {
            // A real Transaction, not a literal id: ZelleEmailQueue.belongsTo(Transaction)
            // yields a foreign key under sequelize.sync(), and the sqlite dialect enforces
            // it — a dangling id would throw on insert instead of reaching the 409 path.
            const postedTxn = await Transaction.create({
                member_id: member.id,
                collected_by: member.id,
                payment_date: '2026-08-20',
                amount: 75.00,
                payment_type: 'donation',
                payment_method: 'zelle',
                status: 'succeeded',
                external_id: 'zelle:POSTEDTXN1'
            });
            const posted = await ZelleEmailQueue.create({
                external_id: 'zelle:POSTED1',
                payer_name: 'SYNTHETIC PAYER',
                status: 'AUTO_CREATED',
                transaction_id: postedTxn.id
            });

            const res = await request(app)
                .post(`/api/zelle/queue/${posted.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id })
                .expect(409);

            expect(res.body.code).toBe('ALREADY_POSTED');
        });

        test('404s for an unknown queue row and 400s for an unknown member', async () => {
            await request(app)
                .post('/api/zelle/queue/00000000-0000-0000-0000-000000000000/match')
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: member.id })
                .expect(404);

            await request(app)
                .post(`/api/zelle/queue/${queueRow.id}/match`)
                .set('Authorization', 'Bearer valid-token')
                .send({ member_id: 987654321 })
                .expect(400);
        });
    });
});
