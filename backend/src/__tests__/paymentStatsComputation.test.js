process.env.NODE_ENV = 'test';

const { Op } = require('sequelize');

// Mock the models so we can drive getPaymentStats with a known ledger dataset.
jest.mock('../models', () => ({
  Member: { count: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), findByPk: jest.fn() },
  LedgerEntry: { sum: jest.fn(), findAll: jest.fn() },
  BankTransaction: { findOne: jest.fn(), sum: jest.fn() },
  Transaction: { findAll: jest.fn(), sum: jest.fn() },
  ChurchSetting: { findByPk: jest.fn(), upsert: jest.fn() },
  Dependent: {},
  Title: {},
  Employee: {},
  Vendor: {},
  MemberPayment: {},
  sequelize: {},
}));

const { Member, LedgerEntry, BankTransaction, ChurchSetting } = require('../models');
const controller = require('../controllers/memberPaymentController');

// A ledger with one dues entry, two non-dues income entries, and one expense.
// Totals: receipts (totalCollected) = 600 + 200 + 100 = 900; expenses = 500.
const LEDGER = [
  { type: 'membership_due', amount: 600 },
  { type: 'tithe', amount: 200 },
  { type: 'donation', amount: 100 },
  { type: 'expense', amount: 500 }, // stored as a POSITIVE amount
];

// Emulate LedgerEntry.sum honoring the where.type condition (string / Op.ne / Op.notIn)
function sumByType(typeCond) {
  const match = (row) => {
    if (typeof typeCond === 'string') return row.type === typeCond;
    if (typeCond && typeCond[Op.ne] !== undefined) return row.type !== typeCond[Op.ne];
    if (typeCond && typeCond[Op.notIn] !== undefined) return !typeCond[Op.notIn].includes(row.type);
    return true;
  };
  return LEDGER.filter(match).reduce((s, r) => s + r.amount, 0);
}

// Bank sums are configured per-test. Deposits = SUM(amount > 0), debits = SUM(amount < 0, negative).
let mockDeposits = null;
let mockDebits = null;

async function invoke() {
  const req = { query: {} };
  let payload;
  const res = { json: (p) => { payload = p; }, status: () => res };
  await controller.getPaymentStats(req, res);
  return payload;
}

beforeEach(() => {
  jest.clearAllMocks();
  Member.count.mockResolvedValue(1);
  Member.findAll.mockResolvedValue([{ id: 1, yearly_pledge: 1200 }]);
  LedgerEntry.findAll.mockResolvedValue([{ member_id: 1, paid_to_date: 600 }]);
  LedgerEntry.sum.mockImplementation(async (col, opts) => sumByType(opts.where.type));
  BankTransaction.findOne.mockResolvedValue(null);
  ChurchSetting.findByPk.mockResolvedValue(null); // threshold falls back to default $50

  mockDeposits = null;
  mockDebits = null;
  BankTransaction.sum.mockImplementation(async (col, opts) => {
    const amt = (opts && opts.where && opts.where.amount) || {};
    if (amt[Op.gt] !== undefined) return mockDeposits;
    if (amt[Op.lt] !== undefined) return mockDebits;
    return null;
  });
});

describe('getPaymentStats income vs expenses', () => {
  it('excludes expense entries from receipts and subtracts them in net income', async () => {
    const payload = await invoke();

    expect(payload.success).toBe(true);
    const d = payload.data;
    // Other income = tithe + donation only (expense must NOT be counted here)
    expect(d.otherPayments).toBe(300);
    expect(d.totalMembershipCollected).toBe(600);
    // Total receipts = dues + other income, NOT inflated by the 500 expense
    expect(d.totalCollected).toBe(900);
    expect(d.totalExpenses).toBe(500);
    // Net actually subtracts expenses: 900 - 500
    expect(d.netIncome).toBe(400);
  });
});

describe('getPaymentStats reconciliation', () => {
  it('marks both sides reconciled when within the threshold', async () => {
    mockDeposits = 910;   // |900 - 910| = 10 <= 50
    mockDebits = -480;    // |500 - 480| = 20 <= 50

    const r = (await invoke()).data.reconciliation;
    expect(r.hasBankData).toBe(true);
    expect(r.bankDeposits).toBe(910);
    expect(r.bankDebits).toBe(480);
    expect(r.receiptsReconciled).toBe(true);
    expect(r.expensesReconciled).toBe(true);
  });

  it('flags the receipts side when the gap exceeds the threshold', async () => {
    mockDeposits = 3700;  // |900 - 3700| = 2800 > 50
    mockDebits = -480;    // expenses still within tolerance

    const r = (await invoke()).data.reconciliation;
    expect(r.hasBankData).toBe(true);
    expect(r.receiptsReconciled).toBe(false);
    expect(r.receiptsDifference).toBe(-2800);
    expect(r.expensesReconciled).toBe(true);
  });

  it('suppresses the warning when there is no bank data for the year', async () => {
    mockDeposits = null;
    mockDebits = null;

    const r = (await invoke()).data.reconciliation;
    expect(r.hasBankData).toBe(false);
    expect(r.receiptsReconciled).toBe(true);
    expect(r.expensesReconciled).toBe(true);
  });
});
