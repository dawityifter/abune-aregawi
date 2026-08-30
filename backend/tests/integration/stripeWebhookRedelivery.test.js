'use strict';

// A rolled-back pledge-and-pay must make Stripe redeliver.
//
// The pledge-and-pay write is atomic (spec §7.6), so when the pledge fails the
// payment row goes with it and NOTHING is on the books. The only thing that can
// still record that money is Stripe redelivering the event, and Stripe
// redelivers only on a non-2xx. So the claim under test is about the HTTP
// response of POST /api/donations/webhook, not about the handler function being
// re-runnable: handlePaymentSucceeded used to log the rollback and return
// normally, the webhook answered 200, and Stripe marked the event delivered.
//
// Everything else must still answer 200 — "recording money always wins" governs
// every non-pledge path, and a webhook that 500s on a broken ledger entry would
// be a regression in the other direction.

process.env.STRIPE_SECRET_KEY = 'sk_test_webhook_redelivery';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_redelivery';

// The handler's only Stripe call is signature verification. Real signing is not
// what this test is about, so the stub trusts the raw body and hands back the
// event. A plain function (not jest.fn) so the suite's resetMocks does not strip
// the implementation between tests.
jest.mock('stripe', () => () => ({
  webhooks: {
    constructEvent: (body) => JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : body)
  }
}));

const request = require('supertest');
const app = require('../../src/server');
const {
  Pledge, PledgeCampaign, PledgeAllocation, Member, Transaction, LedgerEntry, sequelize
} = require('../../src/models');

const postWebhook = (paymentIntent) =>
  request(app)
    .post('/api/donations/webhook')
    .set('stripe-signature', 'sig_test')
    .set('Content-Type', 'application/json')
    // Sent as a pre-serialized string, not an object or a Buffer: the route is
    // mounted on express.raw ahead of the body parsers (server.js), and letting
    // superagent serialize would reshape the payload before it got there.
    .send(JSON.stringify({
      id: `evt_${paymentIntent.id}`,
      type: 'payment_intent.succeeded',
      data: { object: paymentIntent }
    }));

describe('POST /api/donations/webhook', () => {
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
      first_name: 'Webhook', last_name: 'Giver',
      phone_number: '+15550000901',
      email: 'webhook.giver@example.test', is_active: true, role: 'member'
    });
  });

  const pledgeAndPayIntent = (id) => ({
    id,
    amount: 40000,
    amount_received: 40000,
    created: Math.floor(Date.now() / 1000),
    metadata: {
      purpose: 'pledge_drive',
      pledgeIntent: 'immediate',
      memberId: String(member.id),
      campaignId: String(campaign.id),
      donor_first_name: 'Webhook',
      donor_last_name: 'Giver'
    }
  });

  const ordinaryDonationIntent = (id) => ({
    id,
    amount: 5000,
    amount_received: 5000,
    created: Math.floor(Date.now() / 1000),
    metadata: { purpose: 'donation', memberId: String(member.id) }
  });

  // purpose is pledge_drive but pledgeIntent is NOT 'immediate', so this takes
  // the ordinary "record the payment, then try to allocate" path rather than
  // the atomic pledge-and-pay path (donationController.js checks
  // metadata.pledgeIntent === 'immediate' to choose between the two).
  const pledgeDriveLaterIntent = (id) => ({
    id,
    amount: 5000,
    amount_received: 5000,
    created: Math.floor(Date.now() / 1000),
    metadata: { purpose: 'pledge_drive', memberId: String(member.id) }
  });

  it('answers non-2xx when a pledge-and-pay rolls back, so Stripe redelivers', async () => {
    jest.spyOn(Pledge, 'create').mockRejectedValueOnce(new Error('transient DB error'));

    const res = await postWebhook(pledgeAndPayIntent('pi_hook_001'));

    // The load-bearing assertion. A 200 here is Stripe being told "delivered",
    // and the money below stays captured with nothing on the books forever.
    expect(res.status).not.toBe(200);
    expect(res.status).toBe(500);

    expect(await Transaction.count()).toBe(0);
    expect(await Pledge.count()).toBe(0);
    expect(await PledgeAllocation.count()).toBe(0);
    expect(await LedgerEntry.count()).toBe(0);
  });

  it('records the payment and the pledge on the redelivery that follows', async () => {
    jest.spyOn(Pledge, 'create').mockRejectedValueOnce(new Error('transient DB error'));

    const failed = await postWebhook(pledgeAndPayIntent('pi_hook_002'));
    expect(failed.status).toBe(500);

    // Stripe redelivers the identical event.
    const retried = await postWebhook(pledgeAndPayIntent('pi_hook_002'));
    expect(retried.status).toBe(200);

    expect(await Transaction.findOne({ where: { external_id: 'pi_hook_002' } })).not.toBeNull();
    const pledge = await Pledge.findOne({ where: { member_id: member.id } });
    expect(pledge).not.toBeNull();
    expect(pledge.fulfillment_intent).toBe('immediate');
    expect(await PledgeAllocation.count()).toBe(1);
  });

  it('answers 200 for a pledge-and-pay that succeeds', async () => {
    // Guards the fix against over-firing: only a rollback may produce non-2xx.
    const res = await postWebhook(pledgeAndPayIntent('pi_hook_003'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(await Transaction.count()).toBe(1);
    expect(await Pledge.count()).toBe(1);
  });

  it('still answers 200 for an ordinary donation whose ledger entry fails', async () => {
    // "Recording money always wins" outside the pledge-intent path: the payment
    // is kept and the webhook reports success, because a redelivery would only
    // find the same transaction and change nothing. A missing ledger entry is a
    // treasurer's problem; a 500 that made Stripe retry forever is not a fix.
    jest.spyOn(LedgerEntry, 'create').mockRejectedValueOnce(new Error('ledger exploded'));

    const res = await postWebhook(ordinaryDonationIntent('pi_hook_004'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    const txn = await Transaction.findOne({ where: { external_id: 'pi_hook_004' } });
    expect(txn).not.toBeNull();
    expect(txn.status).toBe('succeeded');
    expect(await LedgerEntry.count()).toBe(0);
  });

  it('still answers 200 for an ordinary donation whose pledge allocation fails', async () => {
    // Gives the member an open 'later' pledge in the live campaign, so
    // maybeAllocateToPledge actually reaches allocate() instead of returning
    // null before ever calling PledgeAllocation.create.
    await Pledge.create({
      campaign_id: campaign.id,
      member_id: member.id,
      amount: 100,
      first_name: member.first_name,
      last_name: member.last_name,
      lifecycle: 'active',
      is_historical: false,
      fulfillment_intent: 'later'
    });

    const allocationCreateSpy = jest.spyOn(PledgeAllocation, 'create')
      .mockRejectedValueOnce(new Error('allocation exploded'));

    const res = await postWebhook(pledgeDriveLaterIntent('pi_hook_005'));

    expect(res.status).toBe(200);
    const txn = await Transaction.findOne({ where: { external_id: 'pi_hook_005' } });
    expect(txn).not.toBeNull();
    // count() alone cannot prove the mock fired: absent the fixture pledge
    // above, maybeAllocateToPledge returns null before ever calling create,
    // and count() would be 0 either way — reached-and-rejected and
    // never-reached are indistinguishable by row count. The spy call count is
    // what actually proves allocate() ran into the mocked rejection rather
    // than bailing out earlier; deleting this assertion as "redundant" with
    // the count() check below would silently let the path-never-reached bug
    // return without failing anything.
    expect(allocationCreateSpy).toHaveBeenCalledTimes(1);
    expect(await PledgeAllocation.count()).toBe(0);
  });
});
