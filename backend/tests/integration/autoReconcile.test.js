const request = require('supertest');
const app = require('../../src/server');
const {
    Member,
    BankTransaction,
    Transaction,
    LedgerEntry,
    ZelleMemoMatch,
    BankMemoMatch,
    ExpenseMemoMatch,
    ExpenseCategory,
    IncomeCategory
} = require('../../src/models');
const { learnBankMemoMatch } = require('../../src/services/bankMemoMatchService');
const {
    autoReconcilePending,
    learnExpenseMemoMatch,
    undoAutoReconciliation
} = require('../../src/services/autoReconcileService');

describe('Automatic Bank Reconciliation', () => {
    let adminUser;
    let member;

    beforeAll(async () => {
        await ExpenseMemoMatch.destroy({ where: {} });
        await BankMemoMatch.destroy({ where: {} });
        await ZelleMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
        await Member.destroy({ where: {} });

        adminUser = await Member.create({
            first_name: 'Test',
            last_name: 'Admin',
            email: 'test@example.com', // Matches setup.js firebase mock
            firebase_uid: 'test-firebase-uid',
            phone_number: '+1234567890',
            role: 'admin',
            is_active: true
        });

        member = await Member.create({
            first_name: 'Almaz',
            last_name: 'Tesfay',
            phone_number: '+1987654321',
            is_active: true
        });

        await IncomeCategory.findOrCreate({
            where: { gl_code: 'INC001' },
            defaults: { name: 'Donation', payment_type_mapping: 'donation', gl_code: 'INC001' }
        });
        await ExpenseCategory.findOrCreate({
            where: { gl_code: 'EXP100' },
            defaults: { gl_code: 'EXP100', name: 'Utilities', is_active: true }
        });
    });

    beforeEach(async () => {
        await ExpenseMemoMatch.destroy({ where: {} });
        await BankMemoMatch.destroy({ where: {} });
        await ZelleMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
    });

    describe('Tier 0: exact Zelle reference match', () => {
        test('links by transaction number even when dates are far apart (no duplicate)', async () => {
            // Email-created transaction keyed by the payment-level reference
            const emailTxn = await Transaction.create({
                member_id: member.id,
                collected_by: adminUser.id,
                payment_date: '2025-01-03', // Friday
                amount: 50.00,
                payment_type: 'donation',
                payment_method: 'zelle',
                status: 'succeeded',
                external_id: 'zelle:CMB0K6P5R3MF'
            });

            // Bank posts 5 days later — outside the ±2 day Tier 1 window
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-01-08'),
                amount: 50.00,
                description: 'Zelle payment from ALMAZ TESFAY CMB0K6P5R3MF',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'ALMAZ TESFAY',
                external_ref_id: 'CMB0K6P5R3MF',
                transaction_hash: 'bankhash-t0',
                raw_data: {}
            });

            const stats = await autoReconcilePending({ user: adminUser });
            expect(stats.autoLinked).toBe(1);
            expect(stats.autoMember).toBe(0); // linked, NOT duplicated

            await bankTxn.reload();
            expect(bankTxn.status).toBe('MATCHED');
            expect(bankTxn.reconciled_source).toBe('AUTO_LINKED');
            expect(bankTxn.reconciled_meta.reason).toMatch(/Zelle transaction number/);
            expect(bankTxn.reconciled_meta.transaction_id).toBe(emailTxn.id);

            expect(await Transaction.count()).toBe(1); // no duplicate created
        });
    });

    describe('Tier 1: link credits to existing transactions', () => {
        test('links a bank credit to an existing transaction that already matches it (ACH)', async () => {
            // Tier 1's mechanism is payment-method agnostic: exactly one
            // existing transaction matches amount/method/date/payer name, so
            // it gets linked instead of duplicated. Zelle is exercised
            // separately in "Zelle credits require approval" below, since
            // Zelle no longer takes this path.
            const priorTxn = await Transaction.create({
                member_id: member.id,
                collected_by: adminUser.id,
                payment_date: '2025-01-02',
                amount: 100.00,
                payment_type: 'donation',
                payment_method: 'ach',
                status: 'succeeded',
                external_id: 'manual:msg-abc'
            });

            const bankTxn = await BankTransaction.create({
                date: new Date('2025-01-03'),
                amount: 100.00,
                description: 'ORIG CO NAME:EXAMPLE EMPLOYER IND NAME:TESFAY,ALMAZ WEB ID:1234',
                type: 'ACH_CREDIT',
                status: 'PENDING',
                transaction_hash: 'bankhash-t1',
                raw_data: {}
            });

            const stats = await autoReconcilePending({ user: adminUser });
            expect(stats.autoLinked).toBe(1);
            expect(stats.autoMember).toBe(0);

            await bankTxn.reload();
            expect(bankTxn.status).toBe('MATCHED');
            expect(bankTxn.reconciled_source).toBe('AUTO_LINKED');
            expect(bankTxn.reconciled_meta.transaction_id).toBe(priorTxn.id);
            expect(bankTxn.reconciled_meta.prev_external_id).toBe('manual:msg-abc');

            await priorTxn.reload();
            expect(priorTxn.external_id).toBe('bankhash-t1');

            // No duplicate transaction was created
            const count = await Transaction.count();
            expect(count).toBe(1);
        });

        test('undo restores the linked transaction and reverts to PENDING', async () => {
            const priorTxn = await Transaction.create({
                member_id: member.id,
                collected_by: adminUser.id,
                payment_date: '2025-01-02',
                amount: 100.00,
                payment_type: 'donation',
                payment_method: 'ach',
                status: 'succeeded',
                external_id: 'manual:msg-abc'
            });
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-01-03'),
                amount: 100.00,
                description: 'ORIG CO NAME:EXAMPLE EMPLOYER IND NAME:TESFAY,ALMAZ WEB ID:1234',
                type: 'ACH_CREDIT',
                status: 'PENDING',
                transaction_hash: 'bankhash-t1u',
                raw_data: {}
            });

            await autoReconcilePending({ user: adminUser });
            await undoAutoReconciliation(bankTxn.id);

            await bankTxn.reload();
            expect(bankTxn.status).toBe('PENDING');
            expect(bankTxn.reconciled_source).toBeNull();

            await priorTxn.reload();
            expect(priorTxn.external_id).toBe('manual:msg-abc'); // restored
            expect(await Transaction.count()).toBe(1); // still exists
        });
    });

    describe('Tier 2: create transactions for learned payers', () => {
        test('creates a transaction for a previously-associated payer using last-used payment type', async () => {
            // Tier 2's mechanism (learned payer lookup + last-used payment
            // type) is payment-method agnostic; Zelle is exercised separately
            // in "Zelle credits require approval" below, since Zelle no
            // longer takes this path.
            // Member's payment history: last payment was a tithe
            await Transaction.create({
                member_id: member.id,
                collected_by: adminUser.id,
                payment_date: '2024-12-01',
                amount: 55.00,
                payment_type: 'tithe',
                payment_method: 'ach',
                status: 'succeeded',
                external_id: 'manual:old-1'
            });

            const bankTxn = await BankTransaction.create({
                date: new Date('2025-01-05'),
                amount: 80.00, // different amount → no Tier 1 link
                description: 'ORIG CO NAME:EXAMPLE EMPLOYER IND NAME:TESFAY,ALMAZ WEB ID:1234',
                type: 'ACH_CREDIT',
                status: 'PENDING',
                transaction_hash: 'bankhash-t2',
                raw_data: {}
            });

            // Learn the association (as if the treasurer reconciled this payer once before)
            await learnBankMemoMatch(bankTxn.get({ plain: true }), member.id);

            const stats = await autoReconcilePending({ user: adminUser });
            expect(stats.autoMember).toBe(1);

            await bankTxn.reload();
            expect(bankTxn.status).toBe('MATCHED');
            expect(bankTxn.reconciled_source).toBe('AUTO_MEMBER');
            expect(String(bankTxn.member_id)).toBe(String(member.id));

            const created = await Transaction.findOne({ where: { external_id: 'bankhash-t2' } });
            expect(created).not.toBeNull();
            expect(String(created.member_id)).toBe(String(member.id));
            expect(created.payment_type).toBe('tithe'); // last-used type
            expect(Number(created.amount)).toBe(80);
        });

        test('leaves unknown payers PENDING', async () => {
            // Tier 2's negative branch (no learned match, or learned keys
            // disagree, -> stay PENDING) is payment-method agnostic; Zelle's
            // own "no auto-create" behavior is covered separately by the
            // guard tests in "Zelle credits require approval".
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-01-06'),
                amount: 42.00,
                description: 'ORIG CO NAME:EXAMPLE EMPLOYER IND NAME:STRANGER,PERSON WEB ID:5555',
                type: 'ACH_CREDIT',
                status: 'PENDING',
                transaction_hash: 'bankhash-t2b',
                raw_data: {}
            });

            const stats = await autoReconcilePending({ user: adminUser });
            expect(stats.autoMember).toBe(0);
            expect(stats.needsReview).toBe(1);

            await bankTxn.reload();
            expect(bankTxn.status).toBe('PENDING');
            expect(await Transaction.count()).toBe(0);
        });

        test('undo removes the auto-created transaction AND the learned association', async () => {
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-01-05'),
                amount: 80.00,
                description: 'ORIG CO NAME:EXAMPLE EMPLOYER IND NAME:TESFAY,ALMAZ WEB ID:1234',
                type: 'ACH_CREDIT',
                status: 'PENDING',
                transaction_hash: 'bankhash-t2u',
                raw_data: {}
            });
            await learnBankMemoMatch(bankTxn.get({ plain: true }), member.id);

            await autoReconcilePending({ user: adminUser });
            await undoAutoReconciliation(bankTxn.id);

            await bankTxn.reload();
            expect(bankTxn.status).toBe('PENDING');
            expect(await Transaction.count({ where: { external_id: 'bankhash-t2u' } })).toBe(0);
            // Learned keys removed so the mistake isn't repeated on next upload
            expect(await BankMemoMatch.count()).toBe(0);

            const stats = await autoReconcilePending({ user: adminUser });
            expect(stats.autoMember).toBe(0); // stays pending now
        });
    });

    describe('Check debits: match a manual expense, never create one', () => {
        async function manualCheckExpense({ checkNumber, amount, externalId = null }) {
            return LedgerEntry.create({
                type: 'expense',
                category: 'EXP100',
                amount,
                entry_date: '2025-01-10',
                payment_method: 'check',
                check_number: checkNumber,
                memo: 'Manually entered check',
                source_system: 'manual',
                external_id: externalId
            });
        }

        async function pendingCheckDebit({ checkNumber, amount, hash, description = null }) {
            return BankTransaction.create({
                date: new Date('2025-01-12'),
                amount,
                description: description || `CHECK #${checkNumber}`,
                type: 'CHECK_PAID',
                status: 'PENDING',
                check_number: checkNumber,
                transaction_hash: hash,
                raw_data: {}
            });
        }

        test('links the bank check to the manual expense with the same number and amount', async () => {
            const expense = await manualCheckExpense({ checkNumber: '1593', amount: 250.00 });
            const debit = await pendingCheckDebit({ checkNumber: '1593', amount: -250.00, hash: 'bankhash-chk-ok' });

            const stats = await autoReconcilePending({ user: adminUser });
            expect(stats.autoExpense).toBe(1);

            await debit.reload();
            expect(debit.status).toBe('MATCHED');
            expect(debit.reconciled_source).toBe('AUTO_CHECK_MATCH');
            expect(debit.reconciled_meta.created).toBe(false);
            expect(debit.reconciled_meta.ledger_entry_id).toBe(expense.id);

            await expense.reload();
            expect(expense.external_id).toBe('bankhash-chk-ok');

            expect(await LedgerEntry.count({ where: { type: 'expense' } })).toBe(1);
        });

        test('never creates an expense for a check debit, even with a learned payee', async () => {
            const priorDebit = await BankTransaction.create({
                date: new Date('2024-12-10'),
                amount: -100.00,
                description: 'CHECK #1500',
                type: 'CHECK_PAID',
                status: 'MATCHED',
                payer_name: 'City Utilities',
                transaction_hash: 'bankhash-chk-prior',
                raw_data: {}
            });
            await learnExpenseMemoMatch(priorDebit.get({ plain: true }), {
                gl_code: 'EXP100',
                payee_name: 'City Utilities'
            });

            const debit = await pendingCheckDebit({ checkNumber: '1594', amount: -175.00, hash: 'bankhash-chk-learned' });
            await debit.update({ payer_name: 'City Utilities' });

            const stats = await autoReconcilePending({ user: adminUser });
            expect(stats.autoExpense).toBe(0);

            await debit.reload();
            expect(debit.status).toBe('PENDING');
            expect(await LedgerEntry.count({ where: { type: 'expense' } })).toBe(0);
        });

        test('leaves the check debit unreconciled when the amounts disagree', async () => {
            const expense = await manualCheckExpense({ checkNumber: '1595', amount: 205.00 });
            const debit = await pendingCheckDebit({ checkNumber: '1595', amount: -250.00, hash: 'bankhash-chk-amt' });

            await autoReconcilePending({ user: adminUser });

            await debit.reload();
            expect(debit.status).toBe('PENDING');

            await expense.reload();
            expect(expense.external_id).toBeNull();
        });

        test('leaves the check debit unreconciled when no manual expense exists', async () => {
            const debit = await pendingCheckDebit({ checkNumber: '1596', amount: -80.00, hash: 'bankhash-chk-none' });

            await autoReconcilePending({ user: adminUser });

            await debit.reload();
            expect(debit.status).toBe('PENDING');
            expect(await LedgerEntry.count({ where: { type: 'expense' } })).toBe(0);
        });

        test('does not reuse an expense already linked to another bank row', async () => {
            await manualCheckExpense({ checkNumber: '1597', amount: 90.00, externalId: 'bankhash-chk-other' });
            const debit = await pendingCheckDebit({ checkNumber: '1597', amount: -90.00, hash: 'bankhash-chk-dupe' });

            await autoReconcilePending({ user: adminUser });

            await debit.reload();
            expect(debit.status).toBe('PENDING');
        });

        test('undo unlinks the manual expense without deleting it', async () => {
            const expense = await manualCheckExpense({ checkNumber: '1599', amount: 310.00 });
            const debit = await pendingCheckDebit({ checkNumber: '1599', amount: -310.00, hash: 'bankhash-chk-undo' });

            await autoReconcilePending({ user: adminUser });
            await debit.reload();
            expect(debit.status).toBe('MATCHED');

            await undoAutoReconciliation(debit.id);

            await debit.reload();
            expect(debit.status).toBe('PENDING');

            const stillThere = await LedgerEntry.findByPk(expense.id);
            expect(stillThere).not.toBeNull();
            expect(stillThere.external_id).toBeNull();
        });

        test('matches when the number is only in the description, not the column', async () => {
            const expense = await manualCheckExpense({ checkNumber: '1598', amount: 45.00 });
            const debit = await BankTransaction.create({
                date: new Date('2025-01-12'),
                amount: -45.00,
                description: 'CHECK PAID 1598',
                type: 'CHECK_PAID',
                status: 'PENDING',
                check_number: null,
                transaction_hash: 'bankhash-chk-desc',
                raw_data: {}
            });

            await autoReconcilePending({ user: adminUser });

            await debit.reload();
            expect(debit.status).toBe('MATCHED');
            await expense.reload();
            expect(expense.external_id).toBe('bankhash-chk-desc');
        });
    });

    describe('Payment method labelling for bank-recorded expenses', () => {
        async function learnedDebit({ type, description, hash, payer }) {
            const prior = await BankTransaction.create({
                date: new Date('2024-12-10'), amount: -100.00,
                description, type, status: 'MATCHED', payer_name: payer,
                transaction_hash: `${hash}-prior`, raw_data: {}
            });
            await learnExpenseMemoMatch(prior.get({ plain: true }), {
                gl_code: 'EXP100', payee_name: payer
            });

            const debit = await BankTransaction.create({
                date: new Date('2025-01-10'), amount: -42.00,
                description, type, status: 'PENDING', payer_name: payer,
                transaction_hash: hash, raw_data: {}
            });
            await autoReconcilePending({ user: adminUser });
            return LedgerEntry.findOne({ where: { external_id: hash } });
        }

        test('records a debit card purchase as debit_card, not other', async () => {
            const expense = await learnedDebit({
                type: 'DEBIT_CARD',
                description: 'SOME MERCHANT PURCHASE',
                hash: 'bankhash-card',
                payer: 'Some Merchant'
            });

            expect(expense).not.toBeNull();
            expect(expense.payment_method).toBe('debit_card');
        });

        test('still records an ACH debit as ach', async () => {
            const expense = await learnedDebit({
                type: 'ACH_DEBIT',
                description: 'ORIG CO NAME:CITY POWER IND NAME:CHURCH',
                hash: 'bankhash-ach-method',
                payer: 'City Power'
            });

            expect(expense.payment_method).toBe('ach');
        });

        test('leaves a genuinely unrecognized debit as other', async () => {
            const expense = await learnedDebit({
                type: 'FEE_TRANSACTION',
                description: 'MONTHLY SERVICE FEE',
                hash: 'bankhash-fee',
                payer: 'Bank Fee'
            });

            expect(expense.payment_method).toBe('other');
        });
    });

    describe('Tier 3: record learned expenses for debits', () => {
        test('auto-records an expense for a previously-classified payee', async () => {
            // The treasurer classified this utility payee once before
            const priorDebit = await BankTransaction.create({
                date: new Date('2024-12-10'),
                amount: -150.00,
                description: 'ORIG CO NAME:CITY UTILITIES CO ID:123 IND NAME:CHURCH ACCT WEB ID:999',
                type: 'ACH_DEBIT',
                status: 'MATCHED',
                transaction_hash: 'bankhash-old-exp',
                raw_data: {}
            });
            await learnExpenseMemoMatch(priorDebit.get({ plain: true }), {
                gl_code: 'EXP100',
                payee_name: 'City Utilities'
            });

            // New month, new amount, same payee
            const newDebit = await BankTransaction.create({
                date: new Date('2025-01-10'),
                amount: -175.50,
                description: 'ORIG CO NAME:CITY UTILITIES CO ID:123 IND NAME:CHURCH ACCT WEB ID:888',
                type: 'ACH_DEBIT',
                status: 'PENDING',
                transaction_hash: 'bankhash-t3',
                raw_data: {}
            });

            const stats = await autoReconcilePending({ user: adminUser });
            expect(stats.autoExpense).toBe(1);

            await newDebit.reload();
            expect(newDebit.status).toBe('MATCHED');
            expect(newDebit.reconciled_source).toBe('AUTO_EXPENSE');

            const expense = await LedgerEntry.findOne({ where: { external_id: 'bankhash-t3' } });
            expect(expense).not.toBeNull();
            expect(expense.type).toBe('expense');
            expect(expense.category).toBe('EXP100');
            expect(Number(expense.amount)).toBe(175.5); // uses the new amount
        });

        test('leaves unclassified debits PENDING', async () => {
            const debit = await BankTransaction.create({
                date: new Date('2025-01-11'),
                amount: -60.00,
                description: 'CHECK 1042',
                type: 'CHECK_PAID',
                status: 'PENDING',
                check_number: '1042',
                transaction_hash: 'bankhash-t3b',
                raw_data: {}
            });

            const stats = await autoReconcilePending({ user: adminUser });
            expect(stats.autoExpense).toBe(0);

            await debit.reload();
            expect(debit.status).toBe('PENDING');
        });

        test('undo removes the auto-created expense and the learned classification', async () => {
            const priorDebit = await BankTransaction.create({
                date: new Date('2024-12-10'),
                amount: -150.00,
                description: 'ORIG CO NAME:CITY UTILITIES CO ID:123 IND NAME:CHURCH ACCT WEB ID:999',
                type: 'ACH_DEBIT',
                status: 'MATCHED',
                transaction_hash: 'bankhash-old-exp-u',
                raw_data: {}
            });
            await learnExpenseMemoMatch(priorDebit.get({ plain: true }), { gl_code: 'EXP100' });

            const newDebit = await BankTransaction.create({
                date: new Date('2025-01-10'),
                amount: -175.50,
                description: 'ORIG CO NAME:CITY UTILITIES CO ID:123 IND NAME:CHURCH ACCT WEB ID:888',
                type: 'ACH_DEBIT',
                status: 'PENDING',
                transaction_hash: 'bankhash-t3u',
                raw_data: {}
            });

            await autoReconcilePending({ user: adminUser });
            await undoAutoReconciliation(newDebit.id);

            await newDebit.reload();
            expect(newDebit.status).toBe('PENDING');
            expect(await LedgerEntry.count({ where: { external_id: 'bankhash-t3u' } })).toBe(0);
            expect(await ExpenseMemoMatch.count()).toBe(0);
        });
    });

    describe('API endpoints', () => {
        test('POST /api/bank/auto-reconcile runs the pass', async () => {
            await BankTransaction.create({
                date: new Date('2025-01-06'),
                amount: 42.00,
                description: 'Zelle payment from STRANGER PERSON 11223344',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'STRANGER PERSON',
                transaction_hash: 'bankhash-api',
                raw_data: {}
            });

            const res = await request(app)
                .post('/api/bank/auto-reconcile')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.examined).toBe(1);
            expect(res.body.data.needsReview).toBe(1);
            expect(res.body.data.done).toBe(true);
        });

        test('POST /api/bank/auto-reconcile sweeps the backlog in bounded batches via afterId cursor', async () => {
            for (let i = 0; i < 3; i++) {
                await BankTransaction.create({
                    date: new Date(`2025-02-0${i + 1}`),
                    amount: 10 + i,
                    description: `Zelle payment from UNKNOWN PAYER ${i} 5566778${i}`,
                    type: 'ZELLE_CREDIT',
                    status: 'PENDING',
                    payer_name: `UNKNOWN PAYER ${i}`,
                    transaction_hash: `bankhash-batch-${i}`,
                    raw_data: {}
                });
            }

            // Batch 1 of 2
            const first = await request(app)
                .post('/api/bank/auto-reconcile')
                .set('Authorization', 'Bearer valid-token')
                .send({ limit: 2 })
                .expect(200);
            expect(first.body.data.examined).toBe(2);
            expect(first.body.data.done).toBe(false);
            expect(first.body.data.nextAfterId).toBeTruthy();

            // Batch 2 continues from the cursor and finishes
            const second = await request(app)
                .post('/api/bank/auto-reconcile')
                .set('Authorization', 'Bearer valid-token')
                .send({ limit: 2, afterId: first.body.data.nextAfterId })
                .expect(200);
            expect(second.body.data.examined).toBe(1);
            expect(second.body.data.done).toBe(true);

            // Total coverage: every backlog row was examined exactly once
            expect(first.body.data.examined + second.body.data.examined).toBe(3);
        });

        test('POST /api/bank/transactions/:id/unreconcile rejects manual reconciliations', async () => {
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-01-06'),
                amount: 42.00,
                description: 'Zelle payment from ALMAZ TESFAY 11223344',
                type: 'ZELLE_CREDIT',
                status: 'MATCHED',
                payer_name: 'ALMAZ TESFAY',
                reconciled_source: 'MANUAL',
                transaction_hash: 'bankhash-api2',
                raw_data: {}
            });

            const res = await request(app)
                .post(`/api/bank/transactions/${bankTxn.id}/unreconcile`)
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
        });

        async function reconcileAsExpense({ type, description, hash, amount = -200.00, checkNumber = null }) {
            const debit = await BankTransaction.create({
                date: new Date('2025-01-12'),
                amount,
                description,
                type,
                status: 'PENDING',
                check_number: checkNumber,
                transaction_hash: hash,
                raw_data: {}
            });

            const res = await request(app)
                .post('/api/bank/reconcile-expense')
                .set('Authorization', 'Bearer valid-token')
                .send({ transaction_id: debit.id, gl_code: 'EXP100', payee_name: 'Some Payee' });

            expect(res.status).toBe(201);
            return LedgerEntry.findOne({ where: { external_id: hash } });
        }

        test('records a manually reconciled card debit as debit_card, not check', async () => {
            const expense = await reconcileAsExpense({
                type: 'DEBIT_CARD',
                description: 'OFFICE SUPPLY STORE PURCHASE',
                hash: 'bankhash-manual-card'
            });

            expect(expense.payment_method).toBe('debit_card');
            expect(expense.check_number).toBeNull();
        });

        test('records a manually reconciled ACH debit as ach', async () => {
            const expense = await reconcileAsExpense({
                type: 'ACH_DEBIT',
                description: 'ORIG CO NAME:CITY WATER IND NAME:CHURCH',
                hash: 'bankhash-manual-ach'
            });

            expect(expense.payment_method).toBe('ach');
            expect(expense.check_number).toBeNull();
        });

        test('still records a manually reconciled check as a check, keeping its number', async () => {
            const expense = await reconcileAsExpense({
                type: 'CHECK_PAID',
                description: 'CHECK #1601',
                hash: 'bankhash-manual-check',
                checkNumber: '1601'
            });

            expect(expense.payment_method).toBe('check');
            expect(expense.check_number).toBe('1601');
        });

        test('canonicalizes a padded check number on the manual path', async () => {
            const expense = await reconcileAsExpense({
                type: 'CHECK_PAID',
                description: 'CHECK #01602',
                hash: 'bankhash-manual-padded',
                checkNumber: '01602'
            });

            expect(expense.check_number).toBe('1602');
        });

        test('manual reconcile-expense learns the classification', async () => {
            const debit = await BankTransaction.create({
                date: new Date('2025-01-12'),
                amount: -200.00,
                description: 'ORIG CO NAME:POWER AND LIGHT CO ID:555 IND NAME:CHURCH WEB ID:777',
                type: 'ACH_DEBIT',
                status: 'PENDING',
                transaction_hash: 'bankhash-learn',
                raw_data: {}
            });

            const res = await request(app)
                .post('/api/bank/reconcile-expense')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    transaction_id: debit.id,
                    gl_code: 'EXP100',
                    payee_name: 'Power & Light'
                });

            expect(res.status).toBe(201);
            expect(await ExpenseMemoMatch.count()).toBeGreaterThan(0);
        });
    });

    describe('Bounded pass semantics', () => {
        test('an explicitly-empty transactionIds list is a no-op, not a full-backlog scan', async () => {
            await BankTransaction.create({
                date: new Date('2025-03-01'),
                amount: 42.00,
                description: 'Zelle payment from STRANGER PERSON 99887766',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'STRANGER PERSON',
                transaction_hash: 'bankhash-noop',
                raw_data: {}
            });

            const stats = await autoReconcilePending({ user: adminUser, transactionIds: [] });

            // Nothing examined — the pending row must NOT be swept up by accident.
            expect(stats.examined).toBe(0);
            expect(stats.done).toBe(true);
            expect(stats.nextAfterId).toBeNull();
        });

        test('limit bounds the service pass and reports an accurate cursor', async () => {
            const created = [];
            for (let i = 0; i < 3; i++) {
                created.push(await BankTransaction.create({
                    date: new Date(`2025-03-1${i}`),
                    amount: 20 + i,
                    description: `Zelle payment from NOBODY KNOWN ${i} 1122334${i}`,
                    type: 'ZELLE_CREDIT',
                    status: 'PENDING',
                    payer_name: `NOBODY KNOWN ${i}`,
                    transaction_hash: `bankhash-limit-${i}`,
                    raw_data: {}
                }));
            }

            const first = await autoReconcilePending({ user: adminUser, limit: 2 });
            expect(first.examined).toBe(2);
            expect(first.done).toBe(false);
            expect(String(first.nextAfterId)).toBe(String(created[1].id));

            const second = await autoReconcilePending({ user: adminUser, limit: 2, afterId: first.nextAfterId });
            expect(second.examined).toBe(1);
            expect(second.done).toBe(true);
        });
    });

    describe('Targeted linking when a Zelle transaction is created (review screen)', () => {
        // This block exercises POST /api/zelle/reconcile/create-transaction directly,
        // which match-only mode gates behind ZELLE_GMAIL_CREATE_ENABLED (default off).
        // These tests are about bank-link side effects of a create, not about the flag
        // itself, so run them with the flag on rather than adding CREATE_DISABLED
        // handling to every case.
        const originalFlag = process.env.ZELLE_GMAIL_CREATE_ENABLED;
        beforeAll(() => { process.env.ZELLE_GMAIL_CREATE_ENABLED = 'true'; });
        afterAll(() => {
            if (originalFlag === undefined) delete process.env.ZELLE_GMAIL_CREATE_ENABLED;
            else process.env.ZELLE_GMAIL_CREATE_ENABLED = originalFlag;
        });

        test('Tier 0: creating a transaction from the Zelle review links the matching PENDING bank row immediately', async () => {
            // Bank CSV row uploaded FIRST — sits pending, carrying the Zelle reference
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-04-07'),
                amount: 75.00,
                description: 'Zelle payment from ALMAZ TESFAY TARGREF01',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'ALMAZ TESFAY',
                external_ref_id: 'TARGREF01',
                transaction_hash: 'bankhash-target0',
                raw_data: {}
            });

            // Treasurer matches the payment from the Zelle review screen
            const res = await request(app)
                .post('/api/zelle/reconcile/create-transaction')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    external_id: 'zelle:TARGREF01',
                    amount: 75.00,
                    payment_date: '2025-04-04',
                    member_id: member.id,
                    payment_type: 'donation',
                    payer_name: 'ALMAZ TESFAY'
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.bank_link).toBeTruthy();
            expect(res.body.bank_link.linked).toBe(1);

            // The Bank Transactions screen must now show this row as MATCHED
            await bankTxn.reload();
            expect(bankTxn.status).toBe('MATCHED');
            expect(bankTxn.reconciled_source).toBe('AUTO_LINKED');
            expect(bankTxn.reconciled_meta.transaction_id).toBe(res.body.id);
        });

        test('Tier 1: links the pending row even when the bank reference differs from the Zelle number', async () => {
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-04-09'),
                amount: 60.00,
                description: 'Zelle payment from ALMAZ TESFAY SENDERREF9',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'ALMAZ TESFAY',
                external_ref_id: 'SENDERREF9', // sender-bank ref ≠ Chase number
                transaction_hash: 'bankhash-target1',
                raw_data: {}
            });

            const res = await request(app)
                .post('/api/zelle/reconcile/create-transaction')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    external_id: 'zelle:987654321',
                    amount: 60.00,
                    payment_date: '2025-04-07',
                    member_id: member.id,
                    payment_type: 'donation',
                    payer_name: 'ALMAZ TESFAY'
                })
                .expect(200);

            expect(res.body.bank_link.linked).toBe(1);

            await bankTxn.reload();
            expect(bankTxn.status).toBe('MATCHED');
            expect(bankTxn.reconciled_source).toBe('AUTO_LINKED');
        });

        test('link-only: does NOT Tier-2 create transactions for unrelated learned payers sharing the amount', async () => {
            // Unrelated pending row from a LEARNED payer with the same amount —
            // the full pass would auto-create a member transaction for it (Tier 2).
            const unrelated = await BankTransaction.create({
                date: new Date('2025-04-08'),
                amount: 90.00,
                description: 'Zelle payment from BERHE KIDANE 55443322',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'BERHE KIDANE',
                transaction_hash: 'bankhash-target2',
                raw_data: {}
            });
            await learnBankMemoMatch(unrelated.get({ plain: true }), member.id);

            await request(app)
                .post('/api/zelle/reconcile/create-transaction')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    external_id: 'zelle:111222333',
                    amount: 90.00,
                    payment_date: '2025-04-08',
                    member_id: member.id,
                    payment_type: 'donation',
                    payer_name: 'ALMAZ TESFAY'
                })
                .expect(200);

            // The learned-payer row must be untouched — no Tier 2 side effects
            await unrelated.reload();
            expect(unrelated.status).toBe('PENDING');
            expect(unrelated.reconciled_source).toBeNull();
            expect(await Transaction.count({ where: { external_id: 'bankhash-target2' } })).toBe(0);
        });

        test('re-creating the same Zelle payment after auto-link does NOT double post', async () => {
            const { ZelleEmailQueue } = require('../../src/models');
            await ZelleEmailQueue.destroy({ where: {} });

            // Bank row pending with the Zelle reference
            await BankTransaction.create({
                date: new Date('2025-04-14'),
                amount: 45.00,
                description: 'Zelle payment from ALMAZ TESFAY DBLREF01',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'ALMAZ TESFAY',
                external_ref_id: 'DBLREF01',
                transaction_hash: 'bankhash-dbl',
                raw_data: {}
            });

            const payload = {
                external_id: 'zelle:DBLREF01',
                amount: 45.00,
                payment_date: '2025-04-14',
                member_id: member.id,
                payment_type: 'donation',
                payer_name: 'ALMAZ TESFAY'
            };

            // 1st create: succeeds and immediately links (which RENAMES the
            // transaction's external_id to the bank hash)
            const first = await request(app)
                .post('/api/zelle/reconcile/create-transaction')
                .set('Authorization', 'Bearer valid-token')
                .send(payload)
                .expect(200);
            expect(first.body.bank_link.linked).toBe(1);

            // 2nd identical create (double-click / retry / stale preview tab):
            // must be rejected as EXISTS, not create a duplicate
            const second = await request(app)
                .post('/api/zelle/reconcile/create-transaction')
                .set('Authorization', 'Bearer valid-token')
                .send(payload);
            expect(second.status).toBe(409);

            // Exactly ONE transaction and ONE ledger entry for this payment
            expect(await Transaction.count()).toBe(1);
            expect(await LedgerEntry.count()).toBe(1);
        });

        test('memo anchor: links and learns when the Zelle sender name differs from the member name (MULUBIRHAN repro)', async () => {
            // Real production case: sender "MULUBIRHAN REDA" pays for member
            // "Mulubirhan Zerihun" — surname differs, so Tier 1's name rule
            // fails; the email had no parseable payer, only the memo.
            const zerihun = await Member.create({
                first_name: 'Mulubirhan',
                last_name: 'Zerihun',
                phone_number: '+1444555666',
                is_active: true
            });

            const rowA = await BankTransaction.create({
                date: new Date('2026-07-13'),
                amount: 300.00,
                description: 'Zelle payment from MULUBIRHAN REDA BACgp9am05vo',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'MULUBIRHAN REDA',
                external_ref_id: 'BACgp9am05vo',
                transaction_hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                raw_data: {}
            });
            const rowB = await BankTransaction.create({
                date: new Date('2026-07-13'),
                amount: 300.00,
                description: 'Zelle payment from MULUBIRHAN REDA BACd624fssr9',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'MULUBIRHAN REDA',
                external_ref_id: 'BACd624fssr9',
                transaction_hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                raw_data: {}
            });

            // Treasurer matches the payment in the Zelle review screen; the
            // memo contains the bank payer string.
            const res = await request(app)
                .post('/api/zelle/reconcile/create-transaction')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    external_id: 'zelle:29979684657',
                    amount: 300.00,
                    payment_date: '2026-07-12',
                    member_id: zerihun.id,
                    payment_type: 'donation',
                    note: 'MULUBIRHAN REDA member bank'
                })
                .expect(200);

            // The memo-anchored link matched the OLDEST pending row
            expect(res.body.bank_link.linked).toBe(1);
            await rowA.reload();
            expect(rowA.status).toBe('MATCHED');
            expect(rowA.reconciled_source).toBe('AUTO_LINKED');
            expect(rowA.reconciled_meta.reason).toMatch(/memo contains/i);

            // And the payer→member association was learned from the bank row
            const learnedKey = await BankMemoMatch.findOne({
                where: { match_key: 'ZELLE:PAYER:MULUBIRHAN REDA' }
            });
            expect(learnedKey).not.toBeNull();
            expect(String(learnedKey.member_id)).toBe(String(zerihun.id));

            // The second $300 payment (a genuinely separate one) is a Zelle
            // credit, so even with the learned key from the anchor match
            // above, Tier 2 no longer auto-creates for it — it stays PENDING
            // for the treasurer to approve explicitly.
            const stats = await autoReconcilePending({ user: adminUser });
            expect(stats.autoMember).toBe(0);
            expect(stats.needsReview).toBe(1);
            await rowB.reload();
            expect(rowB.status).toBe('PENDING');
        });

        test('Tier 2 links an existing unlinked member transaction instead of creating a duplicate (ACH)', async () => {
            // Tier 2's link-first mechanism is payment-method agnostic. Zelle
            // Tier 2 is disabled entirely (see "Zelle credits require
            // approval"), so this exercises the mechanism via ACH: a
            // transaction already recorded by hand (unlinked, and invisible
            // to Tier 1 because the sender name differs from the member's
            // registered name).
            const existingTx = await Transaction.create({
                member_id: member.id, // Almaz Tesfay
                collected_by: adminUser.id,
                payment_date: '2026-07-10',
                amount: 120.00,
                payment_type: 'donation',
                payment_method: 'ach',
                status: 'succeeded',
                external_id: 'manual:55511122'
            });

            const bankTxn = await BankTransaction.create({
                date: new Date('2026-07-11'),
                amount: 120.00,
                description: 'ORIG CO NAME:EXAMPLE EMPLOYER IND NAME:KIDANE,BERHE WEB ID:9999', // ≠ "Almaz Tesfay" → Tier 1 misses
                type: 'ACH_CREDIT',
                status: 'PENDING',
                transaction_hash: 'bankhash-linkfirst',
                raw_data: {}
            });
            // Learned association: BERHE KIDANE pays for Almaz
            await learnBankMemoMatch(bankTxn.get({ plain: true }), member.id);

            const stats = await autoReconcilePending({ user: adminUser });

            // Must LINK the existing transaction, not create a second one
            expect(stats.autoLinked).toBe(1);
            expect(stats.autoMember).toBe(0);
            await bankTxn.reload();
            expect(bankTxn.status).toBe('MATCHED');
            expect(bankTxn.reconciled_source).toBe('AUTO_LINKED');
            expect(bankTxn.reconciled_meta.transaction_id).toBe(existingTx.id);
            expect(bankTxn.reconciled_meta.reason).toMatch(/linked existing/i);
            expect(await Transaction.count()).toBe(1); // no duplicate
        });
    });

    describe('Zelle credits require approval', () => {
        test('does not auto-create for a learned Zelle payer; row stays PENDING', async () => {
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-03-01'),
                amount: 90.00,
                description: 'Zelle payment from ALMAZ TESFAY 55443322',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'ALMAZ TESFAY',
                transaction_hash: 'bankhash-approve-1',
                raw_data: {}
            });
            await learnBankMemoMatch(bankTxn.get({ plain: true }), member.id);

            const stats = await autoReconcilePending({ user: adminUser });

            expect(stats.autoMember).toBe(0);
            expect(stats.needsReview).toBe(1);
            await bankTxn.reload();
            expect(bankTxn.status).toBe('PENDING');
            expect(await Transaction.count()).toBe(0);
        });

        test('does not auto-link a Zelle row to a heuristic Tier 1 candidate', async () => {
            const handEntered = await Transaction.create({
                member_id: member.id,
                collected_by: adminUser.id,
                payment_date: '2025-03-05',
                amount: 120.00,
                payment_type: 'donation',
                payment_method: 'zelle',
                status: 'succeeded',
                external_id: 'manual:entry-1'
            });

            const bankTxn = await BankTransaction.create({
                date: new Date('2025-03-06'),
                amount: 120.00,
                description: 'Zelle payment from ALMAZ TESFAY 66554433',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'ALMAZ TESFAY',
                transaction_hash: 'bankhash-approve-2',
                raw_data: {}
            });

            const stats = await autoReconcilePending({ user: adminUser });

            expect(stats.autoLinked).toBe(0);
            expect(stats.needsReview).toBe(1);
            await bankTxn.reload();
            expect(bankTxn.status).toBe('PENDING');
            await handEntered.reload();
            expect(handEntered.external_id).toBe('manual:entry-1'); // not renamed
            expect(await Transaction.count()).toBe(1); // only the pre-existing handEntered row; nothing created
        });

        test('Tier 0 still absorbs the Gmail-created backlog by exact reference', async () => {
            const backlog = await Transaction.create({
                member_id: member.id,
                collected_by: adminUser.id,
                payment_date: '2025-03-10',
                amount: 45.00,
                payment_type: 'donation',
                payment_method: 'zelle',
                status: 'succeeded',
                external_id: 'zelle:BACKLOGREF1'
            });

            const bankTxn = await BankTransaction.create({
                date: new Date('2025-03-14'),
                amount: 45.00,
                description: 'Zelle payment from ALMAZ TESFAY BACKLOGREF1',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'ALMAZ TESFAY',
                external_ref_id: 'BACKLOGREF1',
                transaction_hash: 'bankhash-approve-3',
                raw_data: {}
            });

            const stats = await autoReconcilePending({ user: adminUser });

            expect(stats.autoLinked).toBe(1);
            await bankTxn.reload();
            expect(bankTxn.status).toBe('MATCHED');
            expect(bankTxn.reconciled_meta.transaction_id).toBe(backlog.id);
            expect(await Transaction.count()).toBe(1);
        });

        test('ACH credits still auto-create for a learned payer', async () => {
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-03-20'),
                amount: 65.00,
                description: 'ORIG CO NAME:EXAMPLE EMPLOYER IND NAME:TESFAY,ALMAZ WEB ID:1234',
                type: 'ACH_CREDIT',
                status: 'PENDING',
                transaction_hash: 'bankhash-approve-4',
                raw_data: {}
            });
            await learnBankMemoMatch(bankTxn.get({ plain: true }), member.id);

            const stats = await autoReconcilePending({ user: adminUser });

            expect(stats.autoMember).toBe(1);
            await bankTxn.reload();
            expect(bankTxn.status).toBe('MATCHED');
            expect(bankTxn.reconciled_source).toBe('AUTO_MEMBER');
        });

        test('a Zelle credit with a MISMATCHED reference (sender-bank ref vs Chase number) stays PENDING for approval', async () => {
            // Email-created transaction: Chase numeric transaction number
            const emailTxn = await Transaction.create({
                member_id: member.id,
                collected_by: adminUser.id,
                payment_date: '2025-01-03', // Friday
                amount: 50.00,
                payment_type: 'donation',
                payment_method: 'zelle',
                status: 'succeeded',
                external_id: 'zelle:29891157299'
            });

            // Bank posts the following Tuesday with the SENDER's bank
            // reference. Tier 0's exact-reference match can't find it (the
            // references don't match) and Tier 1's heuristic link is now
            // disabled for Zelle, so this row waits for the treasurer instead
            // of auto-linking the way it used to.
            const bankTxn = await BankTransaction.create({
                date: new Date('2025-01-07'),
                amount: 50.00,
                description: 'Zelle payment from ALMAZ TESFAY WFCT12CZXKH9',
                type: 'ZELLE_CREDIT',
                status: 'PENDING',
                payer_name: 'ALMAZ TESFAY',
                external_ref_id: 'WFCT12CZXKH9', // does NOT match the email number
                transaction_hash: 'bankhash-t1w',
                raw_data: {}
            });

            const stats = await autoReconcilePending({ user: adminUser });
            expect(stats.autoLinked).toBe(0);
            expect(stats.needsReview).toBe(1);

            await bankTxn.reload();
            expect(bankTxn.status).toBe('PENDING');

            await emailTxn.reload();
            expect(emailTxn.external_id).toBe('zelle:29891157299'); // untouched

            expect(await Transaction.count()).toBe(1); // no duplicate created
        });
    });
});
