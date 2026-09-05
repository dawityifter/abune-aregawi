const {
  Transaction,
  Member,
  PledgeCampaign,
  Pledge,
  PledgeAllocation,
  PledgeBalance,
  sequelize
} = require('../../src/models');

describe('Transaction enum additions', () => {
  let member;

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
    member = await Member.create({
      first_name: 'Ann',
      last_name: 'Giver',
      phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
  });

  it('accepts the pledge_drive payment type', async () => {
    const t = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 100, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    expect(t.payment_type).toBe('pledge_drive');
  });

  it('accepts the refunded status', async () => {
    const t = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 100, payment_type: 'pledge_drive', payment_method: 'credit_card', status: 'refunded'
    });
    expect(t.status).toBe('refunded');
  });

  it('excludes refunded transactions from a pledge balance', async () => {
    const campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01', status: 'active'
    });
    const pledge = await Pledge.create({
      amount: 5000,
      first_name: 'Ann',
      last_name: 'Giver',
      pledge_type: 'fundraising',
      campaign_id: campaign.id,
      member_id: member.id
    });
    const pay = async (amount, status) => {
      const txn = await Transaction.create({
        member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
        amount, payment_type: 'pledge_drive', payment_method: 'zelle', status
      });
      await PledgeAllocation.create({
        pledge_id: pledge.id, transaction_id: txn.id, amount,
        source: 'treasurer_manual', allocated_by: member.id
      });
    };
    await pay(1000, 'succeeded');
    await pay(2000, 'refunded');

    const balance = await PledgeBalance.findOne({ where: { pledge_id: pledge.id } });
    expect(parseFloat(balance.paid_amount)).toBe(1000);
  });
});
