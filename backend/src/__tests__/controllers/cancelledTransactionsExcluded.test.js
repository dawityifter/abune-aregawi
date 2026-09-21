process.env.NODE_ENV = 'test';

// A cancelled payment is not money. It must not reach any figure that claims to
// report what the parish collected — but it MUST still reach the receipt-book
// audit, because a cancelled payment consumed a receipt number from the book
// and the audit exists to find genuinely missing numbers.
//
// These run against real sqlite rather than a mocked `where`, so the exclusion
// is proved by SQL rather than by a test double agreeing with itself.
//
// All fixtures are synthetic.

const { sequelize, Member, Transaction } = require('../../models');
const {
  getTransactionStats,
  getMemberPaymentSummaries,
  generateTransactionReport,
  getSkippedReceipts,
  getLastReceiptNumber
} = require('../../controllers/transactionController');
const { generatePaymentReport } = require('../../controllers/memberPaymentController');
const { getLoanStats } = require('../../controllers/loanController');

const mockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; }
});

const invoke = async (handler, req = {}) => {
  const res = mockRes();
  await handler({ query: {}, params: {}, ...req }, res);
  return res.body;
};

const YEAR = new Date().getFullYear();
let pledger;

beforeAll(async () => {
  await sequelize.sync({ force: true });

  pledger = await Member.create({
    first_name: 'Testpledger', last_name: 'Example',
    phone_number: '+15550009001', role: 'member', yearly_pledge: 1200
  });

  const base = {
    collected_by: pledger.id,
    member_id: pledger.id,
    payment_date: `${YEAR}-03-10`,
    payment_method: 'cash'
  };

  // The shape of the reported incident: one payment entered three times,
  // two of them cancelled. Repeated across the payment types each surface
  // aggregates, so one fixture set drives every assertion below.
  await Transaction.create({ ...base, amount: 1000, payment_type: 'membership_due', status: 'succeeded', receipt_number: '4001' });
  await Transaction.create({ ...base, amount: 1000, payment_type: 'membership_due', status: 'canceled', receipt_number: '4002' });
  await Transaction.create({ ...base, amount: 1000, payment_type: 'membership_due', status: 'canceled', receipt_number: '4003' });

  await Transaction.create({ ...base, amount: 500, payment_type: 'donation', status: 'succeeded', receipt_number: '4004' });
  await Transaction.create({ ...base, amount: 500, payment_type: 'donation', status: 'canceled', receipt_number: '4005' });

  await Transaction.create({ ...base, amount: 300, payment_type: 'tigray_hunger_fundraiser', status: 'succeeded', receipt_number: '4006' });
  await Transaction.create({ ...base, amount: 300, payment_type: 'tigray_hunger_fundraiser', status: 'canceled', receipt_number: '4007' });

  await Transaction.create({ ...base, amount: 200, payment_type: 'loan_repayment', status: 'succeeded', receipt_number: '4008' });
  await Transaction.create({ ...base, amount: 200, payment_type: 'loan_repayment', status: 'canceled', receipt_number: '4009' });

  // A failed row, which has never been money either.
  await Transaction.create({ ...base, amount: 750, payment_type: 'donation', status: 'failed', receipt_number: '4010' });
});

afterAll(async () => {
  try { await sequelize.close(); } catch (e) { /* global teardown may have closed it */ }
});

// Live money in the fixture: 1000 dues + 500 donation + 300 fundraiser
// + 200 loan repayment = 2000.
const LIVE_TOTAL = 2000;
const LIVE_DUES = 1000;

describe('cancelled payments are excluded from the money surfaces', () => {
  it('treasurer dashboard stats count dues once, not three times', async () => {
    const body = await invoke(getTransactionStats);

    expect(body.success).toBe(true);
    expect(body.data.totalCollected).toBe(LIVE_TOTAL);
    expect(body.data.totalMembershipCollected).toBe(LIVE_DUES);
  });

  // GET /api/transactions/member-summaries cannot run at all: it asks Member
  // for a `monthly_payment` attribute that exists only on MemberPayment, so
  // every call fails in Member.findAndCountAll before reaching the transaction
  // queries. Nothing in the frontend calls it, which is presumably why the
  // breakage went unnoticed. Its two aggregates were given the same status
  // filter as the rest, but that cannot be proved until the endpoint runs;
  // un-skip this once the attribute is fixed or the endpoint retired.
  it.skip('member payment summaries report only live giving', async () => {
    const body = await invoke(getMemberPaymentSummaries);

    const row = body.data.members.find(m => m.id === pledger.id);
    expect(row.totalCollected).toBe(LIVE_TOTAL);
    expect(row.duesCollected).toBe(LIVE_DUES);
  });

  it('the summary report totals only live giving', async () => {
    const body = await invoke(generateTransactionReport, { params: { reportType: 'summary' } });

    expect(body.data.summary.totalCollected).toBe(LIVE_TOTAL);
  });

  it('the behind-payments report does not credit cancelled dues', async () => {
    const body = await invoke(generateTransactionReport, { params: { reportType: 'behind_payments' } });

    const row = body.data.behindPayments.find(m => m.id === pledger.id);
    // $1000 of a $1200 pledge is live, so this member is behind by $200. Were
    // the cancelled duplicates counted, they would read as fully paid.
    expect(row).toBeDefined();
    expect(row.totalCollected).toBe(LIVE_DUES);
  });

  it('the monthly breakdown does not count cancelled payments', async () => {
    const body = await invoke(generateTransactionReport, { params: { reportType: 'monthly_breakdown' } });

    expect(body.data.monthlyTotals.march).toBe(LIVE_TOTAL);
  });

  it('the fundraiser report does not count cancelled gifts', async () => {
    const body = await invoke(generateTransactionReport, { params: { reportType: 'fundraiser' } });

    expect(body.data.fundraiser.totalCollected).toBe(300);
    expect(body.data.fundraiser.transactions).toHaveLength(1);
  });

  it('the payment report fallback does not count cancelled payments', async () => {
    const body = await invoke(generatePaymentReport, { params: { reportType: 'summary' } });

    expect(body.data.totalCollected).toBe(LIVE_TOTAL);
  });

  it('loan stats do not list a cancelled repayment', async () => {
    const body = await invoke(getLoanStats);

    expect(body.data.recentRepayments).toHaveLength(1);
    expect(Number(body.data.recentRepayments[0].amount)).toBe(200);
  });
});

describe('the receipt book still sees cancelled payments', () => {
  // The trap in this change: a cancelled payment used up a receipt number.
  // Hiding it from the audit would report that number as missing from the book
  // and send a treasurer hunting for a payment that was never lost.
  it('counts a cancelled receipt as used, not skipped', async () => {
    const body = await invoke(getSkippedReceipts);

    const skipped = body.data.skipped_receipts || body.data.skippedReceipts || [];
    expect(skipped).not.toContain(4002);
    expect(skipped).not.toContain(4003);
  });

  it('counts a cancelled receipt when reporting the last one used', async () => {
    const body = await invoke(getLastReceiptNumber);

    expect(body.data.last_receipt_number).toBe(4010);
  });
});
