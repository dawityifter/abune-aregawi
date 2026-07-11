const request = require('supertest');
const app = require('../../src/server');
const { Member, BankTransaction, Transaction, LedgerEntry, ZelleMemoMatch, BankMemoMatch } = require('../../src/models');
const { getBankMatchKeys } = require('../../src/services/bankMemoMatchService');
const { findPotentialMatches } = require('../../src/services/reconciliationService');

describe('Bank Reconciliation API', () => {
    let adminUser;
    let memberToLink;
    let bankTxn;

    beforeAll(async () => {
        // Cleanup first - clear dependent tables
        await BankMemoMatch.destroy({ where: {} });
        await ZelleMemoMatch.destroy({ where: {} });
        await LedgerEntry.destroy({ where: {} });
        await Transaction.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
        await Member.destroy({ where: {} });

        // 1. Create Admin User (matches mocked Firebase token in setup.js)
        adminUser = await Member.create({
            first_name: 'Test',
            last_name: 'Admin',
            email: 'test@example.com', // Matches setup.js mock
            firebase_uid: 'test-firebase-uid', // Matches setup.js mock
            phone_number: '+1234567890',
            role: 'admin', // Authorized role
            is_active: true
        });

        // 2. Create Member to link to
        memberToLink = await Member.create({
            first_name: 'Link',
            last_name: 'Target',
            phone_number: '+1987654321',
            is_active: true
        });
    });

    beforeEach(async () => {
        // Clean up transactions
        await BankMemoMatch.destroy({ where: {} });
        await BankTransaction.destroy({ where: {} });
        await Transaction.destroy({ where: {} });

        bankTxn = await BankTransaction.create({
            date: new Date('2025-01-01'),
            amount: 100.00,
            description: 'Zelle Payment',
            type: 'ZELLE',
            status: 'PENDING',
            transaction_hash: 'hash123',
            raw_data: {}
        });
    });

    test('should reconcile transaction with correct payment type', async () => {
        const response = await request(app)
            .post('/api/bank/reconcile')
            .set('Authorization', 'Bearer valid-token') // Header required, token value verified by mock
            .send({
                transaction_id: bankTxn.id,
                member_id: memberToLink.id,
                action: 'MATCH',
                payment_type: 'tithe',
                receipt_number: '2001'
            });

        if (response.status !== 200) {
            console.error('DEBUG: response.status:', response.status);
            console.error('DEBUG: response.body:', JSON.stringify(response.body, null, 2));
        }
        expect(response.status).toBe(200);

        // Verify Response
        expect(response.body.success).toBe(true);
        expect(response.body.donation).toBeDefined();

        // Verify Bank Transaction Status
        const updatedTxn = await BankTransaction.findByPk(bankTxn.id);
        expect(updatedTxn.status).toBe('MATCHED');
        expect(updatedTxn.member_id).toBe(memberToLink.id);

        // Verify Donation Record
        const donation = await Transaction.findOne({ where: { external_id: 'hash123' } });
        expect(donation).toBeDefined();
        expect(donation.payment_type).toBe('tithe');
        expect(donation.member_id).toBe(memberToLink.id);
        expect(donation.collected_by).toBe(adminUser.id);
        expect(donation.receipt_number).toBe('2001');
    });

    test('should default to donation if no payment type provided', async () => {
        const response = await request(app)
            .post('/api/bank/reconcile')
            .set('Authorization', 'Bearer valid-token')
            .send({
                transaction_id: bankTxn.id,
                member_id: memberToLink.id,
                action: 'MATCH'
            })
            .expect(200);

        const donation = await Transaction.findOne({ where: { external_id: 'hash123' } });
        expect(donation.payment_type).toBe('donation');
    });

    test('should learn ACH association after manual reconciliation', async () => {
        const achTxn = await BankTransaction.create({
            date: new Date('2025-01-02'),
            amount: 150.00,
            description: 'ORIG CO NAME:PAYPAL IND NAME:BERHE,SELAMAWIT WEB ID:123456',
            type: 'ACH_CREDIT',
            status: 'PENDING',
            payer_name: 'BERHE, SELAMAWIT',
            transaction_hash: 'achhash123',
            raw_data: {}
        });

        await request(app)
            .post('/api/bank/reconcile')
            .set('Authorization', 'Bearer valid-token')
            .send({
                transaction_id: achTxn.id,
                member_id: memberToLink.id,
                action: 'MATCH',
                payment_type: 'donation'
            })
            .expect(200);

        const learned = await BankMemoMatch.findAll({ where: { member_id: memberToLink.id } });
        expect(learned.length).toBeGreaterThanOrEqual(2);
        expect(learned.map(match => match.source_type)).toContain('ACH');
        expect(learned.map(match => match.match_key)).toContain('ACH:PAYER:BERHE SELAMAWIT');
    });

    test('should show only ONE suggestion per member even when matched via multiple signals', async () => {
        // Same member matches through learned PAYER key, learned DESCRIPTION
        // key, AND fuzzy name — the UI must show a single (best) suggestion.
        const tekea = await Member.create({
            first_name: 'Tekea',
            last_name: 'Beyene',
            phone_number: '+15555550199',
            is_active: true
        });

        const priorTxn = await BankTransaction.create({
            date: new Date('2025-01-02'),
            amount: 50.00,
            description: 'Zelle payment from TEKEA BEYENE ABC1234567',
            type: 'ZELLE_CREDIT',
            status: 'MATCHED',
            payer_name: 'TEKEA BEYENE',
            transaction_hash: 'zellehash-prior',
            raw_data: {}
        });
        const { learnBankMemoMatch } = require('../../src/services/bankMemoMatchService');
        await learnBankMemoMatch(priorTxn.get({ plain: true }), tekea.id);

        const pendingTxn = await BankTransaction.create({
            date: new Date('2025-02-02'),
            amount: 50.00,
            description: 'Zelle payment from TEKEA BEYENE XYZ7654321',
            type: 'ZELLE_CREDIT',
            status: 'PENDING',
            payer_name: 'TEKEA BEYENE',
            transaction_hash: 'zellehash-pending',
            raw_data: {}
        });

        const response = await request(app)
            .get('/api/bank/transactions?status=PENDING')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);

        const apiTxn = response.body.data.transactions.find(t => t.id === pendingTxn.id);
        expect(apiTxn).toBeDefined();

        const tekeaSuggestions = (apiTxn.suggested_matches || [])
            .filter(s => s.member?.id === tekea.id);
        expect(tekeaSuggestions).toHaveLength(1);
        expect(tekeaSuggestions[0].confidence).toBe('high'); // best signal wins
        expect(String(tekeaSuggestions[0].source)).toMatch(/^LEARNED/);
    });

    test('should return learned and fuzzy ACH candidates when they disagree', async () => {
        const fuzzyMember = await Member.create({
            first_name: 'Selamawit',
            last_name: 'Berhe',
            phone_number: '+15555550100',
            is_active: true
        });

        const pendingAchTxn = await BankTransaction.create({
            date: new Date('2025-01-03'),
            amount: 175.00,
            description: 'ORIG CO NAME:PAYPAL IND NAME:BERHE,SELAMAWIT WEB ID:999999',
            type: 'ACH_CREDIT',
            status: 'PENDING',
            payer_name: 'BERHE, SELAMAWIT',
            transaction_hash: 'achhash456',
            raw_data: {}
        });

        const payerKey = getBankMatchKeys(pendingAchTxn).find(key => key.keyType === 'PAYER');
        await BankMemoMatch.create({
            member_id: memberToLink.id,
            source_type: 'ACH',
            match_key: payerKey.matchKey,
            raw_description: pendingAchTxn.description,
            payer_name: pendingAchTxn.payer_name,
            created_from_bank_transaction_id: pendingAchTxn.id
        });

        const response = await request(app)
            .get('/api/bank/transactions?status=PENDING')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);

        const apiTxn = response.body.data.transactions.find(txn => txn.id === pendingAchTxn.id);
        expect(apiTxn.suggested_matches).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    source: 'LEARNED_ACH',
                    member: expect.objectContaining({ id: memberToLink.id })
                }),
                expect.objectContaining({
                    source: 'FUZZY_NAME',
                    member: expect.objectContaining({ id: fuzzyMember.id })
                })
            ])
        );
        expect(apiTxn.suggested_match.member.id).toBe(memberToLink.id);
    });

    test('should search bank transactions across description, payer, check number, and member name', async () => {
        await BankTransaction.bulkCreate([
            {
                date: new Date('2025-01-04'),
                amount: 75.00,
                description: 'Generic deposit memo',
                type: 'ACH_CREDIT',
                status: 'PENDING',
                payer_name: 'Searchable ACH Payer',
                transaction_hash: 'searchhash1',
                raw_data: {}
            },
            {
                date: new Date('2025-01-05'),
                amount: 80.00,
                description: 'Generic check memo',
                type: 'CHECK',
                status: 'MATCHED',
                check_number: '99123',
                member_id: memberToLink.id,
                transaction_hash: 'searchhash2',
                raw_data: {}
            }
        ]);

        const byPayer = await request(app)
            .get('/api/bank/transactions?description=searchable')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);
        expect(byPayer.body.data.transactions.map(txn => txn.transaction_hash)).toContain('searchhash1');

        const byCheck = await request(app)
            .get('/api/bank/transactions?description=99123')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);
        expect(byCheck.body.data.transactions.map(txn => txn.transaction_hash)).toContain('searchhash2');

        const byMember = await request(app)
            .get('/api/bank/transactions?description=target')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);
        expect(byMember.body.data.transactions.map(txn => txn.transaction_hash)).toContain('searchhash2');
    });

    test('should filter bank transaction type by contained type value', async () => {
        await BankTransaction.bulkCreate([
            {
                date: new Date('2025-01-06'),
                amount: 90.00,
                description: 'ACH credit filter test',
                type: 'ACH_CREDIT',
                status: 'PENDING',
                transaction_hash: 'typehash1',
                raw_data: {}
            },
            {
                date: new Date('2025-01-07'),
                amount: 95.00,
                description: 'Deposit filter test',
                type: 'DEPOSIT',
                status: 'PENDING',
                transaction_hash: 'typehash2',
                raw_data: {}
            }
        ]);

        const response = await request(app)
            .get('/api/bank/transactions?type=ACH')
            .set('Authorization', 'Bearer valid-token')
            .expect(200);

        const hashes = response.body.data.transactions.map(txn => txn.transaction_hash);
        expect(hashes).toContain('typehash1');
        expect(hashes).not.toContain('typehash2');
    });

    test('should only flag potential duplicates when amount, method, date, and fuzzy name match', async () => {
        await Transaction.create({
            member_id: memberToLink.id,
            collected_by: adminUser.id,
            amount: 100.00,
            payment_date: '2025-01-02',
            payment_type: 'donation',
            payment_method: 'zelle',
            status: 'succeeded',
            note: 'Manually entered before bank upload'
        });

        const matches = await findPotentialMatches({
            amount: 100.00,
            date: '2025-01-01',
            description: 'Zelle payment from LINK TARGET 123456789',
            type: 'ZELLE',
            payer_name: 'LINK TARGET',
            transaction_hash: 'newbankhash'
        });

        expect(matches).toHaveLength(1);
        expect(matches[0].member.first_name).toBe('Link');
    });

    test('should not flag potential duplicates for method, date, or name mismatches', async () => {
        await Transaction.bulkCreate([
            {
                member_id: memberToLink.id,
                collected_by: adminUser.id,
                amount: 100.00,
                payment_date: '2025-01-02',
                payment_type: 'donation',
                payment_method: 'ach',
                status: 'succeeded',
                note: 'Same amount/date/name but different method'
            },
            {
                member_id: memberToLink.id,
                collected_by: adminUser.id,
                amount: 100.00,
                payment_date: '2025-01-05',
                payment_type: 'donation',
                payment_method: 'zelle',
                status: 'succeeded',
                note: 'Same amount/method/name but outside two-day window'
            }
        ]);

        const differentNameMember = await Member.create({
            first_name: 'Different',
            last_name: 'Person',
            phone_number: '+15555550101',
            is_active: true
        });

        await Transaction.create({
            member_id: differentNameMember.id,
            collected_by: adminUser.id,
            amount: 100.00,
            payment_date: '2025-01-02',
            payment_type: 'donation',
            payment_method: 'zelle',
            status: 'succeeded',
            note: 'Same amount/date/method but different member name'
        });

        const matches = await findPotentialMatches({
            amount: 100.00,
            date: '2025-01-01',
            description: 'Zelle payment from LINK TARGET 123456789',
            type: 'ZELLE',
            payer_name: 'LINK TARGET',
            transaction_hash: 'newbankhash2'
        });

        expect(matches).toHaveLength(0);

        const noNameMatches = await findPotentialMatches({
            amount: 100.00,
            date: '2025-01-01',
            description: 'Deposit',
            type: 'DEPOSIT',
            payer_name: null,
            transaction_hash: 'newbankhash3'
        });

        expect(noNameMatches).toHaveLength(0);
    });
});
