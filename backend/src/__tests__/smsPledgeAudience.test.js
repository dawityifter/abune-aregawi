process.env.NODE_ENV = 'test';

/**
 * The SMS page's "Pending Pledges" and "Fulfilled Pledges" audiences were
 * selected with `where: { legacy_status: ... }` and no campaign filter at all.
 * The Pledge model is explicit that legacy_status "holds the hand-flipped 2025
 * values verbatim" and is "NOT a source of truth" — fulfillment is derived by
 * the pledge_balances view. So both buttons texted whoever was hand-marked
 * during the 2025 drive, regardless of what anyone owes today.
 *
 * pledge_balances is a Postgres VIEW and cannot exist under sqlite, so
 * PledgeBalance.findAll is stubbed — but the stub honours the where clause
 * against a fixture table, so the filtering semantics under test (campaign
 * scoping, which derived_status counts as pending) are exercised for real
 * rather than asserted against a mock's call arguments.
 */

const LIVE_CAMPAIGN = { id: 20, name: '2026 Pledge Drive' };
const OLD_CAMPAIGN_ID = 11;

const mockMember = (id, over = {}) => ({
  id, first_name: `First${id}`, last_name: `Last${id}`,
  phone_number: `+1555000${String(id).padStart(4, '0')}`,
  email: `m${id}@example.test`, is_active: true, ...over
});

// One row per pledge, as the view returns them.
const mockBalances = [
  // Live drive, still owes everything.
  { pledge_id: 1, campaign_id: LIVE_CAMPAIGN.id, member_id: 1, derived_status: 'not_started',
    pledged_amount: '500.00', paid_amount: '0.00', remaining_amount: '500.00',
    member: mockMember(1), pledge: { due_date: '2026-12-31' } },
  // Live drive, part paid — still owes, so still "pending".
  { pledge_id: 2, campaign_id: LIVE_CAMPAIGN.id, member_id: 2, derived_status: 'partially_fulfilled',
    pledged_amount: '400.00', paid_amount: '150.00', remaining_amount: '250.00',
    member: mockMember(2), pledge: { due_date: '2026-12-31' } },
  // Live drive, paid in full.
  { pledge_id: 3, campaign_id: LIVE_CAMPAIGN.id, member_id: 3, derived_status: 'fulfilled',
    pledged_amount: '300.00', paid_amount: '300.00', remaining_amount: '0.00',
    member: mockMember(3), pledge: { due_date: '2026-12-31' } },
  // Live drive, cancelled — belongs to neither audience.
  { pledge_id: 4, campaign_id: LIVE_CAMPAIGN.id, member_id: 4, derived_status: 'cancelled',
    pledged_amount: '200.00', paid_amount: '0.00', remaining_amount: '200.00',
    member: mockMember(4), pledge: { due_date: '2026-12-31' } },
  // Live drive, but the member left.
  { pledge_id: 5, campaign_id: LIVE_CAMPAIGN.id, member_id: 5, derived_status: 'not_started',
    pledged_amount: '100.00', paid_amount: '0.00', remaining_amount: '100.00',
    member: mockMember(5, { is_active: false }), pledge: { due_date: '2026-12-31' } },
  // Live drive, no phone to text.
  { pledge_id: 6, campaign_id: LIVE_CAMPAIGN.id, member_id: 6, derived_status: 'not_started',
    pledged_amount: '100.00', paid_amount: '0.00', remaining_amount: '100.00',
    member: mockMember(6, { phone_number: null }), pledge: { due_date: '2026-12-31' } },
  // LAST YEAR'S DRIVE. The whole point: this must never be texted by a button
  // that says it is about the current one.
  { pledge_id: 7, campaign_id: OLD_CAMPAIGN_ID, member_id: 7, derived_status: 'not_started',
    pledged_amount: '900.00', paid_amount: '0.00', remaining_amount: '900.00',
    member: mockMember(7), pledge: { due_date: '2025-12-31' } },
];

const mockFindLiveCampaign = jest.fn();
jest.mock('../services/pledgeCampaignService', () => ({
  findLiveCampaign: (...a) => mockFindLiveCampaign(...a)
}));

const mockSendSmsBatch = jest.fn().mockResolvedValue([]);
jest.mock('../services/twilioService', () => ({
  sendSms: jest.fn().mockResolvedValue({ sid: 'SM1' }),
  sendSmsBatch: (...a) => mockSendSmsBatch(...a),
  getSmsPricing: jest.fn()
}));

jest.mock('../models', () => {
  // A plain function, not a jest.fn: this project's jest config sets
  // resetMocks, which strips implementations before every test and would leave
  // this returning undefined.
  const PledgeBalance = {
    findAll: async ({ where }) => {
      const statuses = [].concat(where.derived_status);
      return mockBalances.filter(
        (r) => r.campaign_id === where.campaign_id && statuses.includes(r.derived_status)
      );
    }
  };
  return {
    PledgeBalance,
    Member: { findAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn() },
    Pledge: { findAll: jest.fn() },
    Group: {}, MemberGroup: {}, Department: {}, DepartmentMember: {},
    SmsLog: { create: jest.fn().mockResolvedValue({}) },
    sequelize: { authenticate: jest.fn(), sync: jest.fn(), close: jest.fn() }
  };
});

const smsController = require('../controllers/smsController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
const staffReq = (body = {}) => ({ user: { id: 99, role: 'admin' }, body, query: {}, params: {} });

const namesFrom = (res) => {
  const payload = res.json.mock.calls[0][0];
  return (payload.data?.recipients || []).map((r) => r.firstName).sort();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFindLiveCampaign.mockResolvedValue(LIVE_CAMPAIGN);
  mockSendSmsBatch.mockResolvedValue([]);
});

describe('pending-pledge audience is the live drive', () => {
  it('includes everyone who still owes on the live drive, and nobody else', async () => {
    const res = makeRes();
    await smsController.getPendingPledgesRecipients(staffReq(), res);

    // First1 owes it all, First2 owes part. First3 paid up, First4 cancelled,
    // First5 inactive, First6 unreachable, First7 is last year's drive.
    expect(namesFrom(res)).toEqual(['First1', 'First2']);
  });

  it('names the drive it is about to text', async () => {
    const res = makeRes();
    await smsController.getPendingPledgesRecipients(staffReq(), res);

    expect(res.json.mock.calls[0][0].data.campaign).toEqual(
      expect.objectContaining({ id: LIVE_CAMPAIGN.id, name: LIVE_CAMPAIGN.name })
    );
  });
});

describe('fulfilled-pledge audience is the live drive', () => {
  it('includes only those paid in full on the live drive', async () => {
    const res = makeRes();
    await smsController.getFulfilledPledgesRecipients(staffReq(), res);

    expect(namesFrom(res)).toEqual(['First3']);
  });
});

describe('with no drive running', () => {
  beforeEach(() => mockFindLiveCampaign.mockResolvedValue(null));

  it('reports no audience rather than falling back to a closed drive', async () => {
    const res = makeRes();
    await smsController.getPendingPledgesRecipients(staffReq(), res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.data.recipients).toEqual([]);
    expect(payload.data.campaign).toBeNull();
  });

  it('refuses to send, so a direct API call cannot reach the wrong audience', async () => {
    const res = makeRes();
    await smsController.sendPendingPledges(staffReq({ message: 'Please pay your pledge' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockSendSmsBatch).not.toHaveBeenCalled();
  });
});

describe('sending to the pending audience', () => {
  it('texts only the live drive debtors', async () => {
    const res = makeRes();
    await smsController.sendPendingPledges(staffReq({ message: 'You owe {remainingAmount}' }), res);

    expect(mockSendSmsBatch).toHaveBeenCalled();
    const batch = mockSendSmsBatch.mock.calls[0][0];
    expect(batch.map((b) => b.to).sort()).toEqual(['+15550000001', '+15550000002']);
  });

  it('fills in what the member still owes', async () => {
    const res = makeRes();
    await smsController.sendPendingPledges(staffReq({ message: 'Balance: {remainingAmount}' }), res);

    const batch = mockSendSmsBatch.mock.calls[0][0];
    const first = batch.find((b) => b.to === '+15550000001');
    expect(first.body).toBe('Balance: $500.00');
  });

  it('leaves {amount} meaning the pledged amount, so saved templates do not change', async () => {
    const res = makeRes();
    await smsController.sendPendingPledges(staffReq({ message: 'Pledged: {amount}' }), res);

    const batch = mockSendSmsBatch.mock.calls[0][0];
    const second = batch.find((b) => b.to === '+15550000002');
    expect(second.body).toBe('Pledged: $400.00');
  });
});
