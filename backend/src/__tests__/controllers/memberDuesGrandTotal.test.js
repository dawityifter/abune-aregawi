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

const { Op } = require('sequelize');
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
//
// The status clause is applied here rather than ignored, so that a query which
// forgets to exclude cancelled rows actually returns them — otherwise these
// tests could not tell a filtered query from an unfiltered one.
const applyStatusFilter = (rows, where = {}) => {
  const clause = where.status;
  if (!clause) return rows;
  const excluded = clause[Op.notIn];
  if (!excluded) return rows;
  return rows.filter(r => !excluded.includes(r.status || 'succeeded'));
};

const mockTransactions = (rows) => {
  Transaction.findAll.mockImplementation(async (opts = {}) => {
    const where = opts.where || {};
    const wantsDuesOnly = where.payment_type === 'membership_due';
    const visible = applyStatusFilter(rows, where);
    if (wantsDuesOnly) return visible.filter(r => r.payment_type === 'membership_due');
    return visible.map(r => ({ ...r, member: { first_name: 'Testmember' } }));
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

describe('member dues and cancelled transactions', () => {
  // A payment entered three times by mistake, two of them cancelled. The
  // cancellation has to reach every figure on the screen at once: the ledger
  // list, Total Received, and the Additional Contributions breakdown.
  const triplicate = (type) => ([
    { id: 1, member_id: 1, payment_date: `${YEAR}-02-01`, amount: 1000, payment_type: type, for_year: null, status: 'succeeded' },
    { id: 2, member_id: 1, payment_date: `${YEAR}-02-01`, amount: 1000, payment_type: type, for_year: null, status: 'canceled' },
    { id: 3, member_id: 1, payment_date: `${YEAR}-02-01`, amount: 1000, payment_type: type, for_year: null, status: 'canceled' }
  ]);

  it('leaves cancelled payments out of the ledger the screen lists', async () => {
    const data = await capture(makeMember({ yearly_pledge: 0 }), triplicate('donation'));

    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].id).toBe(1);
  });

  it('leaves cancelled payments out of Total Received', async () => {
    const data = await capture(makeMember({ yearly_pledge: 0 }), triplicate('donation'));

    expect(data.payment.grandTotal).toBe(1000);
  });

  it('leaves cancelled payments out of Total Additional', async () => {
    const data = await capture(makeMember({ yearly_pledge: 0 }), triplicate('donation'));

    expect(data.payment.otherContributions.donation).toBe(1000);
    expect(data.payment.totalOtherContributions).toBe(1000);
  });

  it('leaves cancelled dues out of the pledge progress and its rollover', async () => {
    const rows = [
      // Prior year: one real payment plus a cancelled duplicate. Counting the
      // duplicate would manufacture surplus that rolls into this year.
      { id: 1, member_id: 1, payment_date: `${YEAR - 1}-06-01`, amount: 600, payment_type: 'membership_due', for_year: null, status: 'succeeded' },
      { id: 2, member_id: 1, payment_date: `${YEAR - 1}-06-01`, amount: 600, payment_type: 'membership_due', for_year: null, status: 'canceled' },
      { id: 3, member_id: 1, payment_date: `${YEAR}-06-01`, amount: 200, payment_type: 'membership_due', for_year: null, status: 'succeeded' }
    ];
    const member = makeMember({ yearly_pledge: 600, date_joined_parish: `${YEAR - 1}-01-01` });

    Member.findAll.mockResolvedValue([member]);
    Transaction.findAll.mockImplementation(async (opts = {}) => {
      const where = opts.where || {};
      const visible = applyStatusFilter(rows, where);
      if (where.payment_type === 'membership_due') return visible.filter(r => r.payment_type === 'membership_due');
      return visible
        .filter(r => String(r.payment_date).startsWith(String(YEAR)))
        .map(r => ({ ...r, member: { first_name: 'Testmember' } }));
    });
    const res = { json: jest.fn() };
    await computeAndReturnDues(res, member, YEAR);
    const data = res.json.mock.calls[0][0].data;

    // Prior year settled exactly, so no surplus carries in: dues for this year
    // are the $200 actually paid, not $200 plus a phantom $600.
    expect(data.payment.duesCollected).toBe(200);
    expect(data.payment.grandTotal).toBe(200);
  });

  it('keeps a pending payment, which has not failed and is not cancelled', async () => {
    // ACH gifts are written as pending and settle later; dropping them would
    // hide a payment the treasurer just recorded.
    const data = await capture(makeMember({ yearly_pledge: 0 }), [
      { id: 1, member_id: 1, payment_date: `${YEAR}-02-01`, amount: 50, payment_type: 'donation', for_year: null, status: 'pending' }
    ]);

    expect(data.transactions).toHaveLength(1);
    expect(data.payment.grandTotal).toBe(50);
  });

  it('leaves failed payments out too', async () => {
    const data = await capture(makeMember({ yearly_pledge: 0 }), [
      { id: 1, member_id: 1, payment_date: `${YEAR}-02-01`, amount: 50, payment_type: 'donation', for_year: null, status: 'succeeded' },
      { id: 2, member_id: 1, payment_date: `${YEAR}-03-01`, amount: 75, payment_type: 'donation', for_year: null, status: 'failed' }
    ]);

    expect(data.transactions).toHaveLength(1);
    expect(data.payment.grandTotal).toBe(50);
  });
});

describe('dues earmarked to another year (for_year)', () => {
  // The reported case: a membership payment made in September and earmarked to
  // the previous year. It is cash received this year, so the ledger lists it
  // and Total Received counts it — but it pays last year's dues, so Paid To
  // Date for this year is correctly nil. The two figures disagreeing is the
  // point; the screen has to say why.
  const earmarkedToLastYear = [{
    id: 1, member_id: 1, payment_date: `${YEAR}-09-08`, amount: 1000,
    payment_type: 'membership_due', for_year: YEAR - 1, status: 'succeeded'
  }];

  it('credits a pledged member\'s earmarked payment to the year it names', async () => {
    const data = await capture(
      makeMember({ yearly_pledge: 1200, date_joined_parish: '2020-01-15' }),
      earmarkedToLastYear
    );

    expect(data.payment.duesCollected).toBe(0);
    // Still cash that arrived this year, and still listed.
    expect(data.payment.grandTotal).toBe(1000);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].for_year).toBe(YEAR - 1);
  });

  it('credits a pledge-less member\'s earmarked payment the same way', async () => {
    // Previously for_year was honoured only for members who had pledged, so
    // this same row credited the current year instead.
    const data = await capture(makeMember({ yearly_pledge: 0 }), earmarkedToLastYear);

    expect(data.payment.duesCollected).toBe(0);
    expect(data.payment.grandTotal).toBe(1000);
  });

  it('credits a payment earmarked forward, whichever year it was made in', async () => {
    const rows = [{
      id: 1, member_id: 1, payment_date: `${YEAR - 1}-12-01`, amount: 400,
      payment_type: 'membership_due', for_year: YEAR, status: 'succeeded'
    }];
    const member = makeMember({ yearly_pledge: 0 });

    Member.findAll.mockResolvedValue([member]);
    Transaction.findAll.mockImplementation(async (opts = {}) => {
      const where = opts.where || {};
      const visible = applyStatusFilter(rows, where);
      if (where.payment_type === 'membership_due') return visible;
      // The ledger lists cash received in the viewed year: nothing here.
      return visible
        .filter(r => String(r.payment_date).startsWith(String(YEAR)))
        .map(r => ({ ...r, member: { first_name: 'Testmember' } }));
    });
    const res = { json: jest.fn() };
    await computeAndReturnDues(res, member, YEAR);
    const data = res.json.mock.calls[0][0].data;

    expect(data.payment.duesCollected).toBe(400);
    expect(data.payment.grandTotal).toBe(0);
    expect(data.transactions).toHaveLength(0);
  });

  it('keeps the month grid summing to the dues total for a pledge-less member', async () => {
    const data = await capture(makeMember({ yearly_pledge: 0 }), [
      { id: 1, member_id: 1, payment_date: `${YEAR}-04-01`, amount: 120, payment_type: 'membership_due', for_year: null, status: 'succeeded' },
      { id: 2, member_id: 1, payment_date: `${YEAR}-09-08`, amount: 80, payment_type: 'membership_due', for_year: YEAR, status: 'succeeded' }
    ]);

    const gridTotal = data.payment.monthStatuses.reduce((s, m) => s + m.paid, 0);
    expect(data.payment.duesCollected).toBe(200);
    expect(gridTotal).toBe(200);
  });
});
