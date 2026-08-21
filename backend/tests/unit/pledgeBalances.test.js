const { PledgeBalance, PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');

describe('pledge_balances view', () => {
  let campaign, member, pledge;

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
  });

  const pay = async (amount, status = 'succeeded') => {
    const txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount, payment_type: 'donation', payment_method: 'zelle', status
    });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount,
      source: 'treasurer_manual', allocated_by: member.id
    });
    return txn;
  };

  const balance = async () => PledgeBalance.findOne({ where: { pledge_id: pledge.id } });

  it('reports the spec example: 5000 pledged, 1000 + 1500 paid', async () => {
    await pay(1000);
    await pay(1500);
    const b = await balance();
    expect(parseFloat(b.pledged_amount)).toBe(5000);
    expect(parseFloat(b.paid_amount)).toBe(2500);
    expect(parseFloat(b.remaining_amount)).toBe(2500);
    expect(parseFloat(b.percent_fulfilled)).toBe(50);
    expect(b.derived_status).toBe('partially_fulfilled');
  });

  it('reports not_started with no payments', async () => {
    const b = await balance();
    expect(parseFloat(b.paid_amount)).toBe(0);
    expect(parseFloat(b.remaining_amount)).toBe(5000);
    expect(b.derived_status).toBe('not_started');
  });

  it('reports fulfilled when the balance is met exactly', async () => {
    await pay(5000);
    const b = await balance();
    expect(parseFloat(b.remaining_amount)).toBe(0);
    expect(b.derived_status).toBe('fulfilled');
  });

  it('leaves remaining_amount negative on overpayment', async () => {
    await pay(6000);
    const b = await balance();
    expect(parseFloat(b.remaining_amount)).toBe(-1000);
    expect(b.derived_status).toBe('fulfilled');
  });

  it('ignores allocations whose transaction failed', async () => {
    await pay(1000);
    await pay(2000, 'failed');
    const b = await balance();
    expect(parseFloat(b.paid_amount)).toBe(1000);
  });

  it('nets a reversing allocation out of the paid amount', async () => {
    const txn = await pay(1000);
    const original = await PledgeAllocation.findOne({ where: { transaction_id: txn.id } });
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: -400,
      source: 'treasurer_manual', reverses_allocation_id: original.id,
      reason: 'Partial refund', allocated_by: member.id
    });
    const b = await balance();
    expect(parseFloat(b.paid_amount)).toBe(600);
  });

  it('reports cancelled regardless of payments', async () => {
    await pay(1000);
    await pledge.update({ lifecycle: 'cancelled' });
    const b = await balance();
    expect(b.derived_status).toBe('cancelled');
  });
});
