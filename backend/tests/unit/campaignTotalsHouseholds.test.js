const {
  CampaignTotal, PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize
} = require('../../src/models');
const { countActiveHouseholds } = require('../../src/services/pledgeCampaignService');

describe('campaign_totals household and anonymous counts', () => {
  let campaign, head, spouse;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await global.recreatePledgeViews();
  });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01',
      goal_amount: 100000, status: 'active'
    });
    // family_id NULL marks the implicit head of household — the same convention
    // statementController.js uses via `member.family_id || member.id`.
    head = await Member.create({
      first_name: 'Abraham', last_name: 'Tesfaye', phone_number: '+15555550120',
      email: 'abraham@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-abraham', family_id: null
    });
    spouse = await Member.create({
      first_name: 'Selam', last_name: 'Tesfaye', phone_number: '+15555550121',
      email: 'selam@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-selam', family_id: head.id
    });
  });

  const pledgeFor = async (memberId, amount) => Pledge.create({
    amount, first_name: 'X', last_name: 'Y', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: memberId, fulfillment_intent: 'immediate'
  });

  // An anonymous pledge has no member_id, and the model requires it to be both
  // immediate and identifiable by baptism name.
  const anonymousPledge = async (amount, baptismName) => Pledge.create({
    amount, first_name: 'Anonymous', last_name: 'Giver', pledge_type: 'fundraising',
    campaign_id: campaign.id, member_id: null, is_anonymous: true,
    fulfillment_intent: 'immediate', baptism_name: baptismName
  });

  const payFor = async (pledge, amount) => {
    const txn = await Transaction.create({
      member_id: head.id, collected_by: head.id, payment_date: '2026-02-01',
      amount, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: head.id
    });
  };

  const totals = async () => CampaignTotal.findOne({ where: { campaign_id: campaign.id } });

  it('counts two members of one family as a single household', async () => {
    await pledgeFor(head.id, 1000);
    await pledgeFor(spouse.id, 500);

    const t = await totals();
    expect(t.pledge_count).toBe(2);
    expect(t.donor_count).toBe(2);       // two member rows, unchanged behaviour
    expect(t.household_count).toBe(1);   // one family
  });

  it('counts a member with no family_id as their own household', async () => {
    const solo = await Member.create({
      first_name: 'Yonas', last_name: 'Gebre', phone_number: '+15555550122',
      email: 'yonas@example.com', is_active: true, role: 'member',
      firebase_uid: 'uid-yonas', family_id: null
    });
    await pledgeFor(head.id, 1000);
    await pledgeFor(solo.id, 1000);

    const t = await totals();
    expect(t.household_count).toBe(2);
  });

  it('reports anonymous pledges separately and keeps them out of household_count', async () => {
    await pledgeFor(head.id, 1000);
    const anon = await anonymousPledge(750, 'Gebre Mesqel');
    await payFor(anon, 750);

    const t = await totals();
    expect(t.pledge_count).toBe(2);
    expect(t.household_count).toBe(1);          // the anonymous gift is not a household
    expect(t.anonymous_pledge_count).toBe(1);
    expect(parseFloat(t.anonymous_collected)).toBe(750);
  });

  it('reports zeroes, not one, for a drive with no pledges at all', async () => {
    const t = await totals();
    expect(t.pledge_count).toBe(0);
    expect(t.household_count).toBe(0);
    // The LEFT JOIN yields one all-NULL row for an empty drive; a naive
    // SUM(CASE WHEN member_id IS NULL THEN 1 END) would report 1 here.
    expect(t.anonymous_pledge_count).toBe(0);
    expect(parseFloat(t.anonymous_collected)).toBe(0);
  });

  it('excludes cancelled pledges from household_count', async () => {
    await pledgeFor(head.id, 1000);
    const doomed = await pledgeFor(spouse.id, 500);
    await doomed.update({ lifecycle: 'cancelled' });

    const t = await totals();
    expect(t.pledge_count).toBe(1);
    expect(t.household_count).toBe(1);
  });

  it('counts an unpaid anonymous pledge, and collects nothing for it', async () => {
    await anonymousPledge(400, 'Welde Mariam');   // pledged, never paid

    const t = await totals();
    expect(t.anonymous_pledge_count).toBe(1);
    expect(parseFloat(t.anonymous_collected)).toBe(0);
    // Counting the intent while collecting nothing is the point: the attention
    // panel needs unpaid anonymous pledges to be visible, not invisible.
    expect(t.household_count).toBe(0);
  });

  // ── The participation-rate invariant ─────────────────────────────────────────
  //
  // participation = campaign_totals.household_count / countActiveHouseholds().households
  //
  // The two are computed by different engines — SQL in pledgeViews.js, Sequelize in
  // pledgeCampaignService.js — over the same population. If they ever disagree on the
  // household key or on the active scope, the dashboard publishes a rate above 100%.
  // Before the `m.is_active = true` filter was added to HOUSEHOLD_COUNT this case
  // measured numerator 2 against denominator 1: 200%.
  describe('participation numerator never exceeds the denominator', () => {
    it('drops a deactivated pledger from household_count, as the denominator does', async () => {
      const departed = await Member.create({
        first_name: 'Tekle', last_name: 'Haile', phone_number: '+15555550123',
        email: 'tekle@example.com', is_active: false, role: 'member',
        firebase_uid: 'uid-tekle', family_id: null
      });
      await pledgeFor(head.id, 1000);
      await pledgeFor(departed.id, 1000);

      const t = await totals();
      const { households } = await countActiveHouseholds();

      // head + spouse are one active household; `departed` is not counted anywhere.
      expect(households).toBe(1);
      expect(t.household_count).toBe(1);
      expect(t.household_count).toBeLessThanOrEqual(households);
    });

    it('holds when every pledging household is active', async () => {
      await pledgeFor(head.id, 1000);
      await pledgeFor(spouse.id, 500);

      const t = await totals();
      const { households } = await countActiveHouseholds();

      expect(t.household_count).toBe(1);
      expect(t.household_count).toBeLessThanOrEqual(households);
    });

    it('holds when a whole family is deactivated after pledging', async () => {
      await pledgeFor(head.id, 1000);
      await pledgeFor(spouse.id, 500);
      await head.update({ is_active: false });
      await spouse.update({ is_active: false });

      const t = await totals();
      const { households } = await countActiveHouseholds();

      expect(households).toBe(0);
      expect(t.household_count).toBe(0);
      expect(t.household_count).toBeLessThanOrEqual(households);
    });
  });
});
