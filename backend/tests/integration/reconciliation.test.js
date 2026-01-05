const request = require('supertest');
const app = require('../../src/server');
const { Member, BankTransaction, Transaction, LedgerEntry, ZelleMemoMatch } = require('../../src/models');

describe('Bank Reconciliation API', () => {
    let adminUser;
    let memberToLink;
    let bankTxn;

    beforeAll(async () => {
        // Cleanup first - clear dependent tables
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
                payment_type: 'tithe'
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
});
