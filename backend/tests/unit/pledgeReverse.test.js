const { allocate, reverse } = require('../../src/services/pledgeAllocationService');
const { PledgeAllocation, PledgeBalance, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');

describe('pledgeAllocationService.reverse', () => {
  let campaign, member, pledge, txn, original;

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
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01', status: 'active'
    });
    member = await Member.create({
      first_name: 'Ann',
      last_name: 'Giver',
      phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
    pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver',
      pledge_type: 'fundraising', campaign_id: campaign.id, member_id: member.id
    });
    txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 1000, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    original = await allocate({
      pledgeId: pledge.id, transactionId: txn.id, amount: 1000,
      source: 'treasurer_manual', allocatedBy: member.id
    });
  });

  it('creates a negative reversing row linked to the original', async () => {
    const r = await reverse({
      allocationId: original.id, reason: 'Applied to the wrong pledge', reversedBy: member.id
    });
    expect(parseFloat(r.amount)).toBe(-1000);
    expect(String(r.reverses_allocation_id)).toBe(String(original.id));
    expect(r.reason).toBe('Applied to the wrong pledge');
  });

  it('zeroes the pledge balance after a full reversal', async () => {
    await reverse({ allocationId: original.id, reason: 'Mistake', reversedBy: member.id });
    const b = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(b.paid_amount)).toBe(0);
    expect(b.derived_status).toBe('not_started');
  });

  it('supports a partial reversal', async () => {
    await reverse({ allocationId: original.id, amount: 400, reason: 'Partial refund', reversedBy: member.id });
    const b = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(b.paid_amount)).toBe(600);
  });

  it('requires a reason', async () => {
    await expect(
      reverse({ allocationId: original.id, reversedBy: member.id })
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  it('refuses to reverse the same allocation twice', async () => {
    await reverse({ allocationId: original.id, reason: 'First', reversedBy: member.id });
    await expect(
      reverse({ allocationId: original.id, reason: 'Second', reversedBy: member.id })
    ).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
  });

  it('refuses a reversal larger than the original', async () => {
    await expect(
      reverse({ allocationId: original.id, amount: 1500, reason: 'Too big', reversedBy: member.id })
    ).rejects.toMatchObject({ code: 'REVERSAL_TOO_LARGE' });
  });

  it('leaves the original row untouched', async () => {
    await reverse({ allocationId: original.id, reason: 'Mistake', reversedBy: member.id });
    const untouched = await PledgeAllocation.findByPk(original.id);
    expect(parseFloat(untouched.amount)).toBe(1000);
  });
});
