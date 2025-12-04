const request = require('supertest');
const app = require('../../src/server');
const { Member, Transaction, IncomeCategory, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

// Mock Firebase auth
const setVerifyTokenPayload = (payload) => {
    const verifyMock = jest.fn().mockResolvedValue(payload);
    const authMock = jest.fn(() => ({ verifyIdToken: verifyMock }));
    admin.auth = authMock;
    return { verifyMock, authMock };
};

describe('Zelle Batch Ingestion', () => {
    let adminMember;
    let donorMember;

    beforeAll(async () => {
        await sequelize.sync({ force: true });

        // Setup income categories
        await IncomeCategory.create({ name: 'Donation', payment_type_mapping: 'donation', gl_code: 'INC001' });
        await IncomeCategory.create({ name: 'Offering', payment_type_mapping: 'offering', gl_code: 'INC002' });
    });

    beforeEach(async () => {
        await Transaction.destroy({ where: {} });
        await Member.destroy({ where: {} });

        adminMember = await Member.create({
            first_name: 'Admin',
            last_name: 'User',
            email: 'admin@example.com',
            phone_number: '+15550000001',
            role: 'treasurer',
            firebase_uid: 'admin-uid',
            is_active: true
        });

        donorMember = await Member.create({
            first_name: 'Donor',
            last_name: 'One',
            email: 'donor@example.com',
            phone_number: '+15550000002',
            role: 'member',
            is_active: true
        });
    });

    it('creates multiple transactions in batch', async () => {
        setVerifyTokenPayload({ uid: 'admin-uid', email: 'admin@example.com' });

        const items = [
            {
                external_id: 'gmail:msg1',
                amount: 100.00,
                payment_date: '2023-01-01',
                note: 'Donation 1',
                member_id: donorMember.id,
                payment_type: 'donation'
            },
            {
                external_id: 'gmail:msg2',
                amount: 50.00,
                payment_date: '2023-01-02',
                note: 'Donation 2',
                member_id: donorMember.id,
                payment_type: 'donation'
            }
        ];

        const res = await request(app)
            .post('/api/zelle/reconcile/batch-create')
            .set('Authorization', 'Bearer fake-token')
            .send({ items })
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.results).toHaveLength(2);
        expect(res.body.results[0].success).toBe(true);
        expect(res.body.results[1].success).toBe(true);

        const txs = await Transaction.findAll({ order: [['external_id', 'ASC']] });
        expect(txs).toHaveLength(2);
        expect(txs[0].external_id).toBe('gmail:msg1');
        expect(txs[1].external_id).toBe('gmail:msg2');
    });

    it('handles duplicates gracefully (idempotency)', async () => {
        setVerifyTokenPayload({ uid: 'admin-uid', email: 'admin@example.com' });

        // Create one first
        await Transaction.create({
            member_id: donorMember.id,
            collected_by: adminMember.id,
            payment_date: '2023-01-01',
            amount: 100,
            payment_type: 'donation',
            payment_method: 'zelle',
            status: 'succeeded',
            external_id: 'gmail:msg1'
        });

        const items = [
            {
                external_id: 'gmail:msg1', // Duplicate
                amount: 100.00,
                payment_date: '2023-01-01',
                note: 'Donation 1',
                member_id: donorMember.id,
                payment_type: 'donation'
            },
            {
                external_id: 'gmail:msg2', // New
                amount: 50.00,
                payment_date: '2023-01-02',
                note: 'Donation 2',
                member_id: donorMember.id,
                payment_type: 'donation'
            }
        ];

        const res = await request(app)
            .post('/api/zelle/reconcile/batch-create')
            .set('Authorization', 'Bearer fake-token')
            .send({ items })
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.results).toHaveLength(2);

        // First one should fail with EXISTS but be handled gracefully in results
        expect(res.body.results[0].success).toBe(false);
        expect(res.body.results[0].code).toBe('EXISTS');

        // Second one should succeed
        expect(res.body.results[1].success).toBe(true);

        const txs = await Transaction.findAll();
        expect(txs).toHaveLength(2);
    });
});
