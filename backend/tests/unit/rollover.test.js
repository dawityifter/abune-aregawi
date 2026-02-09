const { computeAndReturnDues } = require('../../src/controllers/memberPaymentController');
const { Transaction, Member, Title, Op } = require('../../src/models');

// Mock Sequelize package (because controller imports Op from 'sequelize', not models)
jest.mock('sequelize', () => ({
    Op: {
        in: Symbol('Op.in'),
        or: Symbol('Op.or'),
        gte: Symbol('Op.gte'),
        lte: Symbol('Op.lte'),
        ne: Symbol('Op.ne'),
        iLike: Symbol('Op.iLike')
    },
    literal: jest.fn()
}));

// Mock Sequelize models
jest.mock('../../src/models', () => ({
    Transaction: {
        findAll: jest.fn()
    },
    Member: {
        findAll: jest.fn()
    },
    Title: {},
    Dependent: {},
    LedgerEntry: {},
    MemberPayment: {}
}));

describe('Payment Rollover Logic', () => {
    const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
    };

    const mockMember = {
        id: 1,
        family_id: 1,
        yearly_pledge: 120.00
    };

    const mockFamilyMembers = [
        { ...mockMember, first_name: 'Test', last_name: 'Member', date_joined_parish: '2020-01-01' }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Should calculate 2025 dues correctly with NO prior payments (Standard)', async () => {
        Member.findAll.mockResolvedValue(mockFamilyMembers);

        // Mock Fetch A: Historical Dues (Empty)
        Transaction.findAll.mockResolvedValueOnce([]);

        // Mock Fetch B: Ledger for 2025 (Empty)
        Transaction.findAll.mockResolvedValueOnce([]);

        await computeAndReturnDues(mockRes, mockMember, 2025);

        expect(mockRes.json).toHaveBeenCalledTimes(1);
        const result = mockRes.json.mock.calls[0][0];

        // 120 dues, 0 paid => Balance 120
        expect(result.data.payment.totalAmountDue).toBe(120);
        expect(result.data.payment.duesCollected).toBe(0);
        expect(result.data.payment.outstandingDues).toBe(120);
    });

    test('Should rollover 2024 surplus to 2025', async () => {
        Member.findAll.mockResolvedValue(mockFamilyMembers);

        // Mock Fetch A: Historical Dues
        // User paid $200 in 2024 (Dues were $120). Surplus = $80.
        const historicalTxns = [
            { amount: 200, payment_date: '2024-05-01', payment_type: 'membership_due', for_year: 2024 }
        ];
        Transaction.findAll.mockResolvedValueOnce(historicalTxns);

        // Mock Fetch B: Ledger for 2025 (Empty - no physical payments in 2025)
        Transaction.findAll.mockResolvedValueOnce([]);

        await computeAndReturnDues(mockRes, mockMember, 2025);

        const result = mockRes.json.mock.calls[0][0];

        // 2025 Dues = 120. Paid = 0 (Physical) + 80 (Rollover) = 80. Balance = 40.
        expect(result.data.payment.totalAmountDue).toBe(120);
        expect(result.data.payment.duesCollected).toBe(80);
        expect(result.data.payment.outstandingDues).toBe(40);
    });

    test('Should handle Ledger vs Allocation separation properly', async () => {
        // Scenario: User pays $120 in 2026 FOR 2025.
        // 1. Viewing 2026: Should show transaction in Ledger, but NOT count towards 2026 dues (unless rollover, but here it satisfies 2025 exactly).
        // 2. Viewing 2025: Should NOT show transaction in Ledger (paid in 2026), but SHOULD count towards 2025 dues.

        Member.findAll.mockResolvedValue(mockFamilyMembers);

        // Common Historical Txns: 
        // Payment made in 2026-02-01 for year 2025.
        const crossYearTxn = {
            id: 99,
            amount: 120,
            payment_date: '2026-02-01',
            payment_type: 'membership_due',
            for_year: 2025,
            amount: 120 // ensuring amount is present
        };

        // --- CASE 1: Requesting 2025 ---
        // Fetch A (Historical): Includes the txn
        Transaction.findAll.mockResolvedValueOnce([crossYearTxn]);
        // Fetch B (Ledger 2025): Empty (Paid in 2026)
        Transaction.findAll.mockResolvedValueOnce([]);

        await computeAndReturnDues(mockRes, mockMember, 2025);
        let result2025 = mockRes.json.mock.calls[0][0];

        // 2025 Status: Paid fully (via allocation logic)
        expect(result2025.data.payment.duesCollected).toBe(120);
        expect(result2025.data.payment.outstandingDues).toBe(0);
        // 2025 Ledger: Empty
        expect(result2025.data.transactions).toHaveLength(0);

        mockRes.json.mockClear();

        // --- CASE 2: Requesting 2026 ---
        // Fetch A (Historical): Includes the txn
        Transaction.findAll.mockResolvedValueOnce([crossYearTxn]);
        // Fetch B (Ledger 2026): Includes the txn (Paid in 2026)
        Transaction.findAll.mockResolvedValueOnce([crossYearTxn]);

        await computeAndReturnDues(mockRes, mockMember, 2026);
        let result2026 = mockRes.json.mock.calls[0][0];

        // 2026 Status: 
        // 2025 was fully paid (120 dues, 120 paid). Surplus = 0.
        // 2026 has 0 allocated payments.
        // Total Paid = 0.
        expect(result2026.data.payment.duesCollected).toBe(0);
        expect(result2026.data.payment.outstandingDues).toBe(120);

        // 2026 Ledger: Shows the transaction (Cash flow)
        expect(result2026.data.transactions).toHaveLength(1);
        expect(result2026.data.transactions[0].id).toBe(99);
    });
});
