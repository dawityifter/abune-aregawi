// "Paid on behalf of" must be transaction-specific evidence, never a learned
// sender -> member rule. All names synthetic — never use real member data.
jest.mock('googleapis', () => ({
    google: {
        auth: { OAuth2: class { setCredentials() {} } },
        youtube: () => ({}),
        gmail: () => ({ users: { labels: {}, messages: {} } })
    }
}));

const crypto = require('crypto');
const request = require('supertest');
const {
    Member, Transaction, LedgerEntry, ZelleEmailQueue, ZelleMemoMatch, BankMemoMatch,
    BankTransaction, IncomeCategory
} = require('../../src/models');
const {
    learnBankMemoMatch, findSuggestionCandidates, payerResemblesMember
} = require('../../src/services/bankMemoMatchService');
const { matchZelleSender } = require('../../src/services/zelleTransactionService');
const { suggestMatches } = require('../../src/services/reconciliationService');
const app = require('../../src/server');

const hash = (s) => crypto.createHash('md5').update(s).digest('hex');
const AUTH = { Authorization: 'Bearer valid-token' };
const SENDER_NAME = 'ABEL T SENDER';

describe('Sender learning: a payment credit is not a sender identity', () => {
    let sender;   // the member who owns the Zelle account
    let pledger;  // the member the payment was for
    let spouse;
    let refSeq = 0;

    beforeAll(async () => {
        await Member.destroy({ where: {} });
        await Member.create({
            first_name: 'Test', last_name: 'Treasurer', email: 'test@example.com',
            firebase_uid: 'test-firebase-uid', phone_number: '+15555550180', role: 'admin', is_active: true
        });
        sender = await Member.create({ first_name: 'Abel', last_name: 'Sender', phone_number: '+15555550181', is_active: true });
        pledger = await Member.create({ first_name: 'Hana', last_name: 'Pledger', phone_number: '+15555550182', is_active: true });
        spouse = await Member.create({ first_name: 'Mimi', last_name: 'Spouse', phone_number: '+15555550183', is_active: true });
        await IncomeCategory.findOrCreate({
            where: { gl_code: 'INC001' },
            defaults: { name: 'Donation', payment_type_mapping: 'donation', gl_code: 'INC001' }
        });
    });

    beforeEach(async () => {
        await ZelleEmailQueue.destroy({ where: {} });
        await BankMemoMatch.destroy({ where: {} });
        await ZelleMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
    });

    const bankRow = (over = {}) => {
        refSeq += 1;
        const ref = String(30000000000 + refSeq);
        const payer = over.payer_name || SENDER_NAME;
        return BankTransaction.create({
            transaction_hash: hash(`${ref}-${Math.random()}`),
            date: '2026-09-21',
            amount: 300,
            description: `Zelle payment from ${payer} ${ref}`,
            type: 'ZELLE',
            status: 'PENDING',
            payer_name: payer,
            external_ref_id: ref,
            raw_data: {},
            ...over
        });
    };

    const approve = (row, memberId, extra = {}) => request(app)
        .post('/api/bank/reconcile')
        .set(AUTH)
        .send({ transaction_id: row.id, member_id: memberId, action: 'MATCH', payment_type: 'donation', ...extra });

    // The sender's own earlier payment, remembered as theirs.
    const rememberSenderAsSelf = async () => {
        const own = await bankRow();
        await approve(own, sender.id).expect(200);
        expect(await BankMemoMatch.count({ where: { member_id: sender.id } })).toBe(2);
    };

    const topSuggestion = async (row) => (await suggestMatches(row.get({ plain: true })))[0];

    describe('payerResemblesMember', () => {
        test('first and last name must both appear in the payer name', () => {
            expect(payerResemblesMember('ABEL T SENDER', sender)).toBe(true);
            expect(payerResemblesMember('SENDER, ABEL', sender)).toBe(true);
            expect(payerResemblesMember('ABEL T SENDER', pledger)).toBe(false);
            expect(payerResemblesMember('ABEL KEBEDE', sender)).toBe(false); // first name alone is not enough
            expect(payerResemblesMember(null, sender)).toBe(false);
        });
    });

    describe('the paid-on-behalf incident (a known sender pays another member\'s pledge)', () => {
        test('crediting the payment to the other member leaves the sender\'s keys alone and records the audit', async () => {
            await rememberSenderAsSelf();

            const onBehalf = await bankRow();
            await approve(onBehalf, pledger.id).expect(200);

            // The payment is credited to the pledger...
            const tx = await Transaction.findOne({ where: { external_id: onBehalf.transaction_hash } });
            expect(String(tx.member_id)).toBe(String(pledger.id));

            // ...the sender is still known as themselves, nothing points at the pledger...
            expect(await BankMemoMatch.count({ where: { member_id: pledger.id } })).toBe(0);
            expect(await BankMemoMatch.count({ where: { member_id: sender.id } })).toBe(2);

            // ...and the bank row says who sent it and why nothing was learned.
            await onBehalf.reload();
            expect(onBehalf.payer_name).toBe(SENDER_NAME);
            expect(onBehalf.reconciled_meta).toMatchObject({
                sender_link: 'THIS_PAYMENT_ONLY',
                sender_reason: 'SENDER_KNOWN_AS_OTHER',
                sender_known_as_member_id: String(sender.id)
            });

            // The sender's next payment is evaluated on its own: suggested for the sender.
            const next = await bankRow();
            const suggestion = await topSuggestion(next);
            expect(String(suggestion.member.id)).toBe(String(sender.id));
            expect(suggestion.confidence).toBe('high');
        });

        test('the email flow keeps pre-filling the sender afterwards', async () => {
            await rememberSenderAsSelf();
            await approve(await bankRow(), pledger.id).expect(200);

            const match = await matchZelleSender({ payerName: SENDER_NAME, note: null });
            expect(String(match.member_id)).toBe(String(sender.id));
            expect(match.confidence).toBe('high');
        });

        test('the treasurer can explicitly re-point the sender ("remember")', async () => {
            await rememberSenderAsSelf();
            await approve(await bankRow(), pledger.id, { remember_sender: true }).expect(200);

            expect(await BankMemoMatch.count({ where: { member_id: pledger.id } })).toBe(2);
            const suggestion = await topSuggestion(await bankRow());
            expect(String(suggestion.member.id)).toBe(String(pledger.id));
        });
    });

    describe('edge cases', () => {
        test('a first-ever payment from a sender whose name differs from the member teaches nothing (friend paying a pledge)', async () => {
            const row = await bankRow();
            await approve(row, pledger.id).expect(200);

            expect(await BankMemoMatch.count()).toBe(0);
            expect(await ZelleMemoMatch.count()).toBe(0);
            await row.reload();
            expect(row.reconciled_meta.sender_reason).toBe('NAME_DOES_NOT_MATCH');
        });

        test('"this payment only" teaches nothing even when the name resembles the member', async () => {
            await approve(await bankRow(), sender.id, { remember_sender: false }).expect(200);
            expect(await BankMemoMatch.count()).toBe(0);
        });

        test('a member\'s new Zelle account under their own name is learned without asking', async () => {
            const row = await bankRow({ payer_name: 'ABEL SENDER' });
            await approve(row, sender.id).expect(200);

            expect(await BankMemoMatch.count({ where: { member_id: sender.id } })).toBe(2);
            await row.reload();
            expect(row.reconciled_meta.sender_link).toBe('REMEMBERED');
            expect(row.reconciled_meta.sender_reason).toBe('NAME_MATCHES_MEMBER');
        });

        test('one sender paying for different members on different occasions never moves the sender', async () => {
            await rememberSenderAsSelf();
            await approve(await bankRow(), pledger.id).expect(200);
            await approve(await bankRow(), spouse.id).expect(200);

            expect(await BankMemoMatch.count({ where: { member_id: sender.id } })).toBe(2);
            expect(await BankMemoMatch.count({ where: { member_id: [pledger.id, spouse.id] } })).toBe(0);
        });

        test('a shared/household account is remembered only when the treasurer says so', async () => {
            // The spouse always pays from the sender's account.
            await approve(await bankRow({ payer_name: 'ZED HOUSEHOLD' }), spouse.id).expect(200);
            expect(await BankMemoMatch.count()).toBe(0);

            await approve(await bankRow({ payer_name: 'ZED HOUSEHOLD' }), spouse.id, { remember_sender: true }).expect(200);
            const suggestion = await topSuggestion(await bankRow({ payer_name: 'ZED HOUSEHOLD' }));
            expect(String(suggestion.member.id)).toBe(String(spouse.id));
            expect(suggestion.confidence).toBe('high');
        });

        test('bulk approve follows the safe default (no re-pointing a known sender)', async () => {
            await rememberSenderAsSelf();
            const a = await bankRow();
            const b = await bankRow({ amount: 50 });
            await request(app).post('/api/bank/reconcile-bulk').set(AUTH)
                .send({ transaction_ids: [a.id, b.id], member_id: pledger.id, payment_type: 'donation' })
                .expect(200);

            expect(await BankMemoMatch.count({ where: { member_id: pledger.id } })).toBe(0);
        });

        test('learned records that disagree are shown, but none is high confidence or pre-filled', async () => {
            // Legacy memo says sender; the newer keys were re-pointed to the pledger
            // (the state an old-style on-behalf approval left behind).
            await learnBankMemoMatch({ type: 'ZELLE', payer_name: SENDER_NAME, description: `Zelle payment from ${SENDER_NAME} 0000000` }, pledger.id, { remember: true });
            await ZelleMemoMatch.create({ member_id: sender.id, memo: SENDER_NAME });

            const candidates = await findSuggestionCandidates({ type: 'ZELLE', payer_name: SENDER_NAME, description: `Zelle payment from ${SENDER_NAME} 39990000001` });
            const ids = candidates.map((c) => String(c.member.id));
            expect(ids).toEqual(expect.arrayContaining([String(sender.id), String(pledger.id)]));
            expect(candidates.some((c) => c.confidence === 'high')).toBe(false);
            expect(candidates.filter((c) => c.conflict).length).toBeGreaterThanOrEqual(2);

            const match = await matchZelleSender({ payerName: SENDER_NAME, note: null });
            expect(match.confidence).not.toBe('high');
        });
    });

    describe('Zelle Review', () => {
        const queueRow = (over = {}) => {
            refSeq += 1;
            return ZelleEmailQueue.create({
                external_id: `zelle:${30000000000 + refSeq}`,
                payer_name: SENDER_NAME,
                amount: 300,
                payment_date: '2026-09-20',
                note: `${SENDER_NAME} sent you money`,
                status: 'NEEDS_REVIEW',
                ...over
            });
        };

        test('a "this payment only" Match suggests the member for that payment\'s bank row, and only that row', async () => {
            await rememberSenderAsSelf();
            const email = await queueRow();

            await request(app).post(`/api/zelle/queue/${email.id}/match`).set(AUTH)
                .send({ member_id: pledger.id, remember_sender: false }).expect(200);

            await email.reload();
            expect(email.status).toBe('MATCHED');
            expect(String(email.matched_member_id)).toBe(String(pledger.id));
            expect(email.match_source).toBe('TREASURER_MATCH:THIS_PAYMENT_ONLY');
            expect(await BankMemoMatch.count({ where: { member_id: pledger.id } })).toBe(0);

            // This payment's bank row (same transaction number) is pre-filled for the pledger...
            const thisPayment = await bankRow({ external_ref_id: email.external_id.slice('zelle:'.length) });
            const suggestion = await topSuggestion(thisPayment);
            expect(suggestion.source).toBe('ZELLE_EMAIL_MATCH');
            expect(String(suggestion.member.id)).toBe(String(pledger.id));

            expect(suggestion.sender_known).toBe(false);

            // ...a later, unrelated payment from the same sender is not.
            const later = await bankRow({ date: '2026-10-15' });
            expect(String((await topSuggestion(later)).member.id)).toBe(String(sender.id));
        });

        test('Create "on behalf" credits the pledger, audits it, and leaves the sender known as themselves', async () => {
            await rememberSenderAsSelf();
            // A different amount: the $300 row above is the sender's own, already posted.
            const email = await queueRow({ amount: 120 });

            const res = await request(app).post(`/api/zelle/queue/${email.id}/create-transaction`).set(AUTH)
                .send({ member_id: pledger.id, payment_type: 'donation', remember_sender: false }).expect(201);

            expect(String(res.body.data.member_id)).toBe(String(pledger.id));
            expect(res.body.sender_link).toBe('THIS_PAYMENT_ONLY');
            await email.reload();
            expect(email.match_source).toBe('TREASURER_CREATE:THIS_PAYMENT_ONLY');
            expect(await BankMemoMatch.count({ where: { member_id: pledger.id } })).toBe(0);
            expect(await BankMemoMatch.count({ where: { member_id: sender.id } })).toBe(2);
        });

        test('the queue list says who each sender is already remembered as', async () => {
            await rememberSenderAsSelf();
            await queueRow();
            await queueRow({ payer_name: 'NEW PERSON' });

            const res = await request(app).get('/api/zelle/queue').set(AUTH).expect(200);
            const byPayer = Object.fromEntries(res.body.items.map((i) => [i.payer_name, i.sender_known_as]));
            expect(byPayer[SENDER_NAME].map((m) => String(m.id))).toEqual([String(sender.id)]);
            expect(byPayer['NEW PERSON']).toEqual([]);
        });

        test('Create for the sender themselves keeps the plain audit source', async () => {
            const email = await queueRow();
            const res = await request(app).post(`/api/zelle/queue/${email.id}/create-transaction`).set(AUTH)
                .send({ member_id: sender.id, payment_type: 'donation' }).expect(201);

            expect(res.body.sender_link).toBe('REMEMBERED');
            await email.reload();
            expect(email.match_source).toBe('TREASURER_CREATE');
            expect(await BankMemoMatch.count({ where: { member_id: sender.id } })).toBe(2);
        });
    });
});
