const request = require('supertest');

// Configure environment BEFORE requiring app/models
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

// Define a common mock for create
const mockCreate = jest.fn();

// Mock Stripe module BEFORE requiring anything else
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        paymentIntents: {
            create: mockCreate,
        }
    }));
});

// Mock auth middleware
jest.mock('../../src/middleware/auth', () => ({
    authMiddleware: (req, res, next) => next(),
    firebaseAuthMiddleware: (req, res, next) => {
        req.firebaseUid = 'test_firebase_uid';
        req.user = { id: 1, role: 'member' };
        next();
    },
}));

// Now require app and models
const app = require('../../src/server');
const { sequelize, Member, Donation } = require('../../src/models');

describe('Donation Member Email Lookup Integration', () => {
    let memberWithEmail;
    let memberWithoutEmail;
    let piCounter = 0;

    beforeEach(async () => {
        // Essential: sync the database for each test to ensure fresh state
        await sequelize.sync({ force: true });

        // Setup members
        memberWithEmail = await Member.create({
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@example.com',
            phone_number: '+12223334444',
            role: 'member'
        });

        memberWithoutEmail = await Member.create({
            first_name: 'Jane',
            last_name: 'Smith',
            email: null,
            phone_number: '+15556667777',
            role: 'member'
        });

        // Reset mock
        jest.clearAllMocks();

        // Default mock implementation
        mockCreate.mockImplementation(() => {
            piCounter++;
            return Promise.resolve({
                id: `pi_test_${piCounter}`,
                client_secret: `pi_test_${piCounter}_secret`,
            });
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    const baseDonationRequest = {
        amount: 50,
        donation_type: 'one-time',
        payment_method: 'card',
        donor_first_name: 'Test',
        donor_last_name: 'User'
    };

    it('uses member email from database when request email is missing', async () => {
        const res = await request(app)
            .post('/api/donations/create-payment-intent')
            .send({
                ...baseDonationRequest,
                metadata: { memberId: String(memberWithEmail.id) }
            });

        expect(res.status).toBe(200);
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    donor_email: 'john.doe@example.com'
                })
            })
        );

        const donation = await Donation.findByPk(res.body.donation_id);
        expect(donation.donor_email).toBe('john.doe@example.com');
    });

    it('uses default church email when member has no email and request email is missing', async () => {
        const res = await request(app)
            .post('/api/donations/create-payment-intent')
            .send({
                ...baseDonationRequest,
                metadata: { memberId: String(memberWithoutEmail.id) }
            });

        expect(res.status).toBe(200);
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    donor_email: 'abunearegawitx@gmail.com'
                })
            })
        );

        const donation = await Donation.findByPk(res.body.donation_id);
        expect(donation.donor_email).toBe('abunearegawitx@gmail.com');
    });

    it('overrides member email with email provided in request', async () => {
        const res = await request(app)
            .post('/api/donations/create-payment-intent')
            .send({
                ...baseDonationRequest,
                donor_email: 'override@example.com',
                metadata: { memberId: String(memberWithEmail.id) }
            });

        expect(res.status).toBe(200);
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    donor_email: 'override@example.com'
                })
            })
        );

        const donation = await Donation.findByPk(res.body.donation_id);
        expect(donation.donor_email).toBe('override@example.com');
    });

    it('uses default church email for anonymous donations (no memberId)', async () => {
        const res = await request(app)
            .post('/api/donations/create-payment-intent')
            .send({
                ...baseDonationRequest
            });

        expect(res.status).toBe(200);
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    donor_email: 'abunearegawitx@gmail.com'
                })
            })
        );

        const donation = await Donation.findByPk(res.body.donation_id);
        expect(donation.donor_email).toBe('abunearegawitx@gmail.com');
    });
});
