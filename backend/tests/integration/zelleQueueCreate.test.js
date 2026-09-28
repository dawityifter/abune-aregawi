// Create-from-email on the Zelle Review screen, and its duplicate guards.
// All data synthetic.
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
const { undoAutoReconciliation } = require('../../src/services/autoReconcileService');
const app = require('../../src/server');

const hash = (s) => crypto.createHash('md5').update(s).digest('hex');
const AUTH = { Authorization: 'Bearer valid-token' };

describe('POST /api/zelle/queue/:id/create-transaction', () => {
    let treasurer;
    let giver;

    beforeAll(async () => {
        await Member.destroy({ where: {} });
        treasurer = await Member.create({
            first_name: 'Test', last_name: 'Treasurer', email: 'test@example.com',
            firebase_uid: 'test-firebase-uid', phone_number: '+15555550172', role: 'admin', is_active: true
        });
        giver = await Member.create({
            first_name: 'Giver', last_name: 'Sample', phone_number: '+15555550173', is_active: true
        });
        await IncomeCategory.findOrCreate({
            where: { gl_code: 'INC001' },
            defaults: { name: 'Donation', payment_type_mapping: 'donation', gl_code: 'INC001' }
        });
    });

    beforeEach(async () => {
        await ZelleEmailQueue.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
        await BankMemoMatch.destroy({ where: {} });
        await ZelleMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
    });

    const queueRow = (over = {}) => ZelleEmailQueue.create({
        external_id: 'zelle:11122233344',
        payer_name: 'JANE SAMPLE',
        amount: 75,
        payment_date: '2026-08-20',
        note: 'Zelle payment memo',
        status: 'NEEDS_REVIEW',
        ...over
    });

    const bankRow = (over = {}) => BankTransaction.create({
        transaction_hash: hash(JSON.stringify(over) + Math.random()),
        date: '2026-08-21',
        amount: 75,
        description: 'Zelle payment from JANE SAMPLE ABCDEFGHJKLM',
        type: 'ZELLE',
        status: 'PENDING',
        payer_name: 'JANE SAMPLE',
        external_ref_id: 'ABCDEFGHJKLM',
        ...over
    });

    const create = (row, body = {}) => request(app)
        .post(`/api/zelle/queue/${row.id}/create-transaction`)
        .set(AUTH)
        .send({ member_id: giver.id, payment_type: 'donation', ...body });

    test('records the transaction and ledger entry from the queue row, not the client', async () => {
        const row = await queueRow();
        const res = await create(row, { amount: 9999, payment_date: '2020-01-01', remember_sender: true }).expect(201);

        const tx = await Transaction.findByPk(res.body.data.id);
        expect(Number(tx.amount)).toBe(75);
        expect(tx.payment_date).toBe('2026-08-20');
        expect(tx.external_id).toBe('zelle:11122233344');
        expect(tx.payment_method).toBe('zelle');
        expect(String(tx.member_id)).toBe(String(giver.id));

        const ledger = await LedgerEntry.findOne({ where: { transaction_id: tx.id } });
        expect(Number(ledger.amount)).toBe(75);

        await row.reload();
        expect(row.status).toBe('CREATED');
        expect(String(row.transaction_id)).toBe(String(tx.id));
        expect(row.match_source).toBe('TREASURER_CREATE');

        // The treasurer asked to remember the sender, so the payer is learned.
        expect(await BankMemoMatch.count({ where: { member_id: giver.id } })).toBeGreaterThan(0);
    });

    test('a second create is refused and posts nothing', async () => {
        const row = await queueRow();
        await create(row).expect(201);
        const res = await create(row, { force: true }).expect(409);
        expect(res.body.code).toBe('ALREADY_POSTED');
        expect(await Transaction.count()).toBe(1);
        expect(await LedgerEntry.count()).toBe(1);
    });

    test('email first, bank row already uploaded: the bank row is confirmed in place', async () => {
        const bank = await bankRow();
        const row = await queueRow();
        const res = await create(row).expect(201);

        expect(res.body.bank_link.bank_transaction_id).toBe(bank.id);
        const tx = await Transaction.findByPk(res.body.data.id);
        expect(tx.external_id).toBe(bank.transaction_hash);
        expect(tx.payment_date).toBe('2026-08-20'); // the email date stays

        await bank.reload();
        expect(bank.status).toBe('MATCHED');
        expect(bank.reconciled_source).toBe('AUTO_LINKED');
        expect(bank.reconciled_meta.prev_external_id).toBe('zelle:11122233344');

        await row.reload();
        expect(row.bank_transaction_id).toBe(bank.id);

        const ledger = await LedgerEntry.findOne({ where: { transaction_id: tx.id } });
        expect(ledger.statement_date).toBe('2026-08-21');
        expect(await Transaction.count()).toBe(1);
        expect(await LedgerEntry.count()).toBe(1);

        // Undo returns the email payment to awaiting the bank.
        await undoAutoReconciliation(bank.id);
        await row.reload();
        await tx.reload();
        expect(row.bank_transaction_id).toBeNull();
        expect(tx.external_id).toBe('zelle:11122233344');
    });

    test('bank first: the email is attached to the bank-created transaction, nothing new is posted', async () => {
        const bank = await bankRow({ external_ref_id: '11122233344', description: 'Zelle payment from JANE SAMPLE 11122233344', status: 'MATCHED' });
        const bankTx = await Transaction.create({
            member_id: giver.id, collected_by: treasurer.id, amount: 75, payment_date: '2026-08-21',
            payment_type: 'donation', payment_method: 'zelle', status: 'succeeded', external_id: bank.transaction_hash
        });
        const row = await queueRow();

        const res = await create(row, { force: true }).expect(409);
        expect(res.body.code).toBe('POSTED_BY_BANK');
        expect(await Transaction.count()).toBe(1);

        await row.reload();
        expect(row.status).toBe('BANK_POSTED');
        expect(String(row.transaction_id)).toBe(String(bankTx.id));
        expect(row.bank_transaction_id).toBe(bank.id);
    });

    test('an uncertain existing entry is flagged; force creates a separate payment', async () => {
        await Transaction.create({
            member_id: giver.id, collected_by: treasurer.id, amount: 75, payment_date: '2026-08-18',
            payment_type: 'donation', payment_method: 'zelle', status: 'succeeded', external_id: null
        });
        const row = await queueRow();

        const res = await create(row).expect(409);
        expect(res.body.code).toBe('POSSIBLE_DUPLICATE');
        expect(res.body.candidates).toHaveLength(1);
        expect(res.body.candidates[0].origin).toBe('manual');
        expect(await Transaction.count()).toBe(1);

        await create(row, { force: true }).expect(201);
        expect(await Transaction.count()).toBe(2);
    });

    test('another email\'s transaction is not a duplicate candidate', async () => {
        const first = await queueRow({ external_id: 'zelle:99988877766' });
        await create(first).expect(201);
        const second = await queueRow({ payment_date: '2026-08-22' });
        await create(second).expect(201);
        expect(await Transaction.count()).toBe(2);
    });

    test('requires a payer name and refuses loan payment types', async () => {
        const row = await queueRow({ payer_name: null });
        expect((await create(row).expect(400)).body.code).toBe('PAYER_NAME_REQUIRED');
        expect((await create(row, { payer_name: 'JANE SAMPLE', payment_type: 'loan_received' }).expect(400)).body.code)
            .toBe('INVALID_PAYMENT_TYPE');
        await create(row, { payer_name: 'JANE SAMPLE' }).expect(201);
        await row.reload();
        expect(row.payer_name).toBe('JANE SAMPLE');
    });
});

describe('POST /api/zelle/queue/:id/attach', () => {
    let giver;

    beforeAll(async () => {
        giver = await Member.findOne({ where: { phone_number: '+15555550173' } });
    });

    beforeEach(async () => {
        await ZelleEmailQueue.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
    });

    test('attaches to an existing entry once, and refuses a mismatched amount', async () => {
        const tx = await Transaction.create({
            member_id: giver.id, collected_by: giver.id, amount: 40, payment_date: '2026-08-18',
            payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
        });
        const wrong = await ZelleEmailQueue.create({ external_id: 'zelle:A1', payer_name: 'X Y', amount: 41, payment_date: '2026-08-18' });
        const res1 = await request(app).post(`/api/zelle/queue/${wrong.id}/attach`).set(AUTH).send({ transaction_id: tx.id }).expect(400);
        expect(res1.body.code).toBe('AMOUNT_MISMATCH');

        const a = await ZelleEmailQueue.create({ external_id: 'zelle:A2', payer_name: 'X Y', amount: 40, payment_date: '2026-08-18' });
        await request(app).post(`/api/zelle/queue/${a.id}/attach`).set(AUTH).send({ transaction_id: tx.id }).expect(200);
        await a.reload();
        expect(a.status).toBe('CREATED');
        expect(String(a.transaction_id)).toBe(String(tx.id));

        const b = await ZelleEmailQueue.create({ external_id: 'zelle:A3', payer_name: 'X Y', amount: 40, payment_date: '2026-08-18' });
        const res2 = await request(app).post(`/api/zelle/queue/${b.id}/attach`).set(AUTH).send({ transaction_id: tx.id }).expect(409);
        expect(res2.body.code).toBe('TRANSACTION_CLAIMED');
    });
});

describe('bank reconciliation meets an email-created payment', () => {
    let treasurer;
    let giver;
    const { autoReconcilePending } = require('../../src/services/autoReconcileService');

    beforeAll(async () => {
        treasurer = await Member.findOne({ where: { firebase_uid: 'test-firebase-uid' } });
        giver = await Member.findOne({ where: { phone_number: '+15555550173' } });
    });

    beforeEach(async () => {
        await ZelleEmailQueue.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
    });

    // Treasurer creates from the email before the CSV arrives.
    async function emailCreated({ ref = '55566677788', payer = 'RELATIVE OF GIVER', date = '2026-08-20' } = {}) {
        const row = await ZelleEmailQueue.create({
            external_id: `zelle:${ref}`, payer_name: payer, amount: 60, payment_date: date, status: 'NEEDS_REVIEW'
        });
        const res = await request(app).post(`/api/zelle/queue/${row.id}/create-transaction`).set(AUTH)
            .send({ member_id: giver.id, payment_type: 'donation' }).expect(201);
        return { row, txId: res.body.data.id };
    }

    const upload = (over = {}) => BankTransaction.create({
        transaction_hash: hash(JSON.stringify(over) + Math.random()),
        date: '2026-08-22', amount: 60, type: 'ZELLE', status: 'PENDING',
        description: 'Zelle payment from RELATIVE OF GIVER QWERTYUIOPAS',
        payer_name: 'RELATIVE OF GIVER', external_ref_id: 'QWERTYUIOPAS',
        ...over
    });

    test('Tier 0.5 links the email-created transaction; nothing new is posted', async () => {
        const { row, txId } = await emailCreated();
        const bank = await upload();

        const stats = await autoReconcilePending({ user: treasurer, transactionIds: [bank.id] });
        expect(stats.autoLinked).toBe(1);

        await bank.reload();
        expect(bank.status).toBe('MATCHED');
        expect(bank.reconciled_meta.zelle_queue_id).toBe(row.id);
        const tx = await Transaction.findByPk(txId);
        expect(tx.external_id).toBe(bank.transaction_hash);
        expect(tx.payment_date).toBe('2026-08-20');
        await row.reload();
        expect(row.bank_transaction_id).toBe(bank.id);
        expect(await Transaction.count()).toBe(1);
        expect(await LedgerEntry.count()).toBe(1);
    });

    test('exact transaction number links even when names and dates disagree', async () => {
        const { txId } = await emailCreated({ ref: '12312312312' });
        const bank = await upload({ external_ref_id: '12312312312', payer_name: 'SOMEONE ELSE', date: '2026-08-29',
            description: 'Zelle payment from SOMEONE ELSE 12312312312' });
        await autoReconcilePending({ user: treasurer, transactionIds: [bank.id] });
        expect((await Transaction.findByPk(txId)).external_id).toBe(bank.transaction_hash);
    });

    test('ambiguous: stays pending, refuses a new transaction, links on request', async () => {
        const { row, txId } = await emailCreated();
        const b1 = await upload({ date: '2026-08-21' });
        await upload({ date: '2026-08-22' }); // second plausible bank row

        await autoReconcilePending({ user: treasurer, transactionIds: [b1.id] });
        await b1.reload();
        expect(b1.status).toBe('PENDING');

        const list = await request(app).get('/api/bank/transactions?status=PENDING').set(AUTH).expect(200);
        const listed = list.body.data.transactions.find((t) => t.id === b1.id);
        expect(listed.potential_matches[0]).toMatchObject({ id: txId, source: 'zelle_email' });

        const refused = await request(app).post('/api/bank/reconcile').set(AUTH)
            .send({ transaction_id: b1.id, member_id: giver.id, payment_type: 'donation' }).expect(409);
        expect(refused.body.code).toBe('LINK_EXISTING');
        expect(refused.body.candidates[0].transaction_id).toBe(txId);
        expect(await Transaction.count()).toBe(1);

        await request(app).post('/api/bank/reconcile').set(AUTH)
            .send({ transaction_id: b1.id, existing_transaction_id: txId }).expect(200);
        await row.reload();
        expect(row.bank_transaction_id).toBe(b1.id);
        expect(await Transaction.count()).toBe(1);
    });

    test('force creates a separate payment when the treasurer insists', async () => {
        await emailCreated();
        const b1 = await upload({ date: '2026-08-21' });
        await upload({ date: '2026-08-22' });
        await request(app).post('/api/bank/reconcile').set(AUTH)
            .send({ transaction_id: b1.id, member_id: giver.id, payment_type: 'donation', force: true }).expect(200);
        expect(await Transaction.count()).toBe(2);
    });

    test('bank creates first: the unposted email is marked posted and cannot be created again', async () => {
        const row = await ZelleEmailQueue.create({
            external_id: 'zelle:44455566677', payer_name: 'RELATIVE OF GIVER', amount: 60, payment_date: '2026-08-20', status: 'MATCHED'
        });
        const bank = await upload();
        await request(app).post('/api/bank/reconcile').set(AUTH)
            .send({ transaction_id: bank.id, member_id: giver.id, payment_type: 'donation' }).expect(200);

        await row.reload();
        expect(row.status).toBe('BANK_POSTED');
        expect(row.bank_transaction_id).toBe(bank.id);
        expect(row.transaction_id).not.toBeNull();

        const again = await request(app).post(`/api/zelle/queue/${row.id}/create-transaction`).set(AUTH)
            .send({ member_id: giver.id, payment_type: 'donation', force: true }).expect(409);
        expect(again.body.code).toBe('ALREADY_POSTED');
        expect(await Transaction.count()).toBe(1);
    });
});
