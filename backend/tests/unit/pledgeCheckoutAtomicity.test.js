'use strict';

const {
  Pledge, PledgeCampaign, PledgeAllocation, Member, Transaction, LedgerEntry, sequelize
} = require('../../src/models');
const { handlePaymentSucceeded } = require('../../src/controllers/donationController');

// The pledge-and-pay write is all-or-nothing (spec §7.6): the transaction row,
// the pledge and the allocation share one DB transaction. It has to be, because
// handlePaymentSucceeded early-returns on a duplicate external_id — a payment
// that committed without its pledge could never be repaired by a Stripe
// redelivery, and the gift would be missing from total_pledged, pledge_count
// and CampaignDonors for good.
//
// The failure is injected by making Pledge.create reject once, which is what a
// transient DB error looks like from the caller's side. Pledge.create is
// reached as a property of the shared model at call time, so spying on it needs
// no module mocking (and no second copy of ../models, which would sit on its
// own empty in-memory database).
const pledgeIntent = (id, metadata) => ({
  id,
  amount: 40000,
  amount_received: 40000,
  created: Math.floor(Date.now() / 1000),
  metadata: {
    purpose: 'pledge_drive',
    pledgeIntent: 'immediate',
    ...metadata
  }
});

describe('pledge-and-pay is written atomically', () => {
  let campaign, member;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {} });
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-drive', name: 'Test Drive', status: 'active',
      start_date: '2026-01-01', end_date: null
    });
    member = await Member.create({
      first_name: 'Atomic', last_name: 'Tester',
      phone_number: '+15550000701',
      email: 'atomic.tester@example.test', is_active: true, role: 'member'
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const intentFor = (id) => pledgeIntent(id, {
    memberId: String(member.id),
    campaignId: String(campaign.id),
    donor_first_name: 'Atomic',
    donor_last_name: 'Tester'
  });

  it('leaves no transaction behind when the pledge write fails', async () => {
    jest.spyOn(Pledge, 'create').mockRejectedValueOnce(new Error('transient DB error'));

    await handlePaymentSucceeded(intentFor('pi_atomic_001'));

    expect(await Pledge.count()).toBe(0);
    expect(await PledgeAllocation.count()).toBe(0);
    // The load-bearing assertion: with Transaction.create outside the wrapper
    // the payment row commits on its own, and no redelivery can ever add the
    // pledge it is missing.
    expect(await Transaction.count()).toBe(0);
    expect(await LedgerEntry.count()).toBe(0);
  });

  it('creates both on the redelivery that follows a rolled-back attempt', async () => {
    jest.spyOn(Pledge, 'create').mockRejectedValueOnce(new Error('transient DB error'));

    await handlePaymentSucceeded(intentFor('pi_atomic_002'));
    // Stripe redelivers the identical payment intent.
    await handlePaymentSucceeded(intentFor('pi_atomic_002'));

    expect(await Transaction.findOne({ where: { external_id: 'pi_atomic_002' } })).not.toBeNull();

    const pledge = await Pledge.findOne({ where: { member_id: member.id } });
    expect(pledge).not.toBeNull();
    expect(pledge.fulfillment_intent).toBe('immediate');
    expect(await PledgeAllocation.count()).toBe(1);
  });

  it('still keeps an ordinary donation whose ledger entry fails', async () => {
    // The licence to roll a payment back is scoped to the pledge-intent path.
    // For everything else recording the money still wins: a failed ledger
    // entry is a treasurer's problem, a vanished payment is nobody's.
    jest.spyOn(LedgerEntry, 'create').mockRejectedValueOnce(new Error('ledger exploded'));

    await handlePaymentSucceeded({
      id: 'pi_atomic_003',
      amount: 5000,
      amount_received: 5000,
      created: Math.floor(Date.now() / 1000),
      metadata: { purpose: 'donation', memberId: String(member.id) }
    });

    const txn = await Transaction.findOne({ where: { external_id: 'pi_atomic_003' } });
    expect(txn).not.toBeNull();
    expect(txn.status).toBe('succeeded');
    expect(await LedgerEntry.count()).toBe(0);
  });
});
