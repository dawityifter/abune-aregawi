process.env.NODE_ENV = 'test';

// Guards the "Total Received" figure on the Member Financial View.
//
// grandTotal = duesCollected + totalOtherContributions. That only holds if the
// two addends are disjoint. For a member with no annual pledge they were not:
// duesCollected summed *every* transaction in the year regardless of payment
// type, and then every non-dues transaction was added a second time as an
// "other contribution", so a member whose only activity was a single $100
// donation was reported as having given $200.
//
// All fixtures here are synthetic.

jest.mock('../../models', () => ({
  Member: { findAll: jest.fn(), findOne: jest.fn() },
  Transaction: { findAll: jest.fn() },
  MemberPayment: {},
  Dependent: {},
  LedgerEntry: {},
  Title: {},
  BankTransaction: {},
  Employee: {},
  Vendor: {},
  sequelize: { define: jest.fn() }
}));

jest.mock('../../controllers/churchSettingController', () => ({
  getReconcileThresholdValue: jest.fn().mockResolvedValue(0)
}));

const { Member, Transaction } = require('../../models');
const { computeAndReturnDues } = require('../../controllers/memberPaymentController');

const YEAR = 2026;

const makeMember = (overrides = {}) => ({
  id: 1,
  first_name: 'Testmember',
  last_name: 'Example',
  email: 'test@example.com',
  phone_number: '+15550000000',
  family_id: null,
  yearly_pledge: 0,
  date_joined_parish: '2020-01-15',
  title: null,
  ...overrides
});

// Transaction.findAll is called twice: once for all historical membership_due
// rows (the rollover input), once for every row dated inside the year (the
// ledger list the screen shows). Route each call by its `where`.
const mockTransactions = (rows) => {
  Transaction.findAll.mockImplementation(async (opts = {}) => {
    const wantsDuesOnly = opts.where && opts.where.payment_type === 'membership_due';
    if (wantsDuesOnly) return rows.filter(r => r.payment_type === 'membership_due');
    return rows.map(r => ({ ...r, member: { first_name: 'Testmember' } }));
  });
};

const capture = async (member, rows, year = YEAR) => {
  Member.findAll.mockResolvedValue([member]);
  mockTransactions(rows);
  const res = { json: jest.fn() };
  await computeAndReturnDues(res, member, year);
  expect(res.json).toHaveBeenCalled();
  return res.json.mock.calls[0][0].data;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('member dues "Total Received" (grandTotal)', () => {
  it('does not double-count a donation for a member with no annual pledge', async () => {
    const data = await capture(makeMember({ yearly_pledge: 0 }), [
      { id: 10, member_id: 1, payment_date: `${YEAR}-03-05`, amount: 100, payment_type: 'donation', for_year: null }
    ]);

    expect(data.payment.totalOtherContributions).toBe(100);
    expect(data.payment.grandTotal).toBe(100);
  });

  it('reports a pledge-less member\'s dues and donations in separate buckets', async () => {
    const data = await capture(makeMember({ yearly_pledge: 0 }), [
      { id: 10, member_id: 1, payment_date: `${YEAR}-03-05`, amount: 100, payment_type: 'donation', for_year: null },
      { id: 11, member_id: 1, payment_date: `${YEAR}-04-05`, amount: 60, payment_type: 'membership_due', for_year: null }
    ]);

    expect(data.payment.duesCollected).toBe(60);
    expect(data.payment.otherContributions.donation).toBe(100);
    expect(data.payment.grandTotal).toBe(160);
  });

  it('keeps grandTotal equal to the ledger the screen lists beneath it', async () => {
    const rows = [
      { id: 10, member_id: 1, payment_date: `${YEAR}-02-01`, amount: 100, payment_type: 'donation', for_year: null },
      { id: 11, member_id: 1, payment_date: `${YEAR}-05-01`, amount: 25, payment_type: 'tithe', for_year: null },
      { id: 12, member_id: 1, payment_date: `${YEAR}-06-01`, amount: 40, payment_type: 'membership_due', for_year: null }
    ];
    const data = await capture(makeMember({ yearly_pledge: 0 }), rows);

    const ledgerSum = data.transactions.reduce((s, t) => s + t.amount, 0);
    expect(data.payment.grandTotal).toBe(ledgerSum);
  });

  it('excludes surplus carried forward from an earlier year', async () => {
    // Pledged $600 and paid $700 in the prior year, so $100 of credit rolls in.
    // That credit counts toward this year's dues, but it is not money received
    // this year and must not appear in the Total Received card.
    const rows = [
      { id: 10, member_id: 1, payment_date: `${YEAR - 1}-06-01`, amount: 700, payment_type: 'membership_due', for_year: null },
      { id: 11, member_id: 1, payment_date: `${YEAR}-06-01`, amount: 100, payment_type: 'membership_due', for_year: null }
    ];
    const member = makeMember({ yearly_pledge: 600, date_joined_parish: `${YEAR - 1}-01-01` });

    Member.findAll.mockResolvedValue([member]);
    Transaction.findAll.mockImplementation(async (opts = {}) => {
      if (opts.where && opts.where.payment_type === 'membership_due') return rows;
      return rows
        .filter(r => String(r.payment_date).startsWith(String(YEAR)))
        .map(r => ({ ...r, member: { first_name: 'Testmember' } }));
    });
    const res = { json: jest.fn() };
    await computeAndReturnDues(res, member, YEAR);
    const data = res.json.mock.calls[0][0].data;

    // The dues figure still carries the credit — that is the accrual view.
    expect(data.payment.duesCollected).toBe(200);
    // Total Received is cash, and matches the one payment the ledger lists.
    expect(data.payment.grandTotal).toBe(100);
    expect(data.transactions).toHaveLength(1);
  });

  it('still sums correctly for a member who does have a pledge', async () => {
    const data = await capture(makeMember({ yearly_pledge: 1200, date_joined_parish: `${YEAR}-01-01` }), [
      { id: 10, member_id: 1, payment_date: `${YEAR}-03-05`, amount: 300, payment_type: 'membership_due', for_year: YEAR },
      { id: 11, member_id: 1, payment_date: `${YEAR}-03-05`, amount: 100, payment_type: 'donation', for_year: null }
    ]);

    expect(data.payment.duesCollected).toBe(300);
    expect(data.payment.totalOtherContributions).toBe(100);
    expect(data.payment.grandTotal).toBe(400);
  });
});
