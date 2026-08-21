const { PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');

describe('PledgeAllocation model', () => {
  let pledge, txn, member;

  beforeAll(async () => { await sequelize.sync({ force: true }); });

  beforeEach(async () => {
    await PledgeAllocation.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Pledge.destroy({ where: {} });
    await PledgeCampaign.destroy({ where: {} });
    await Member.destroy({ where: {} });

    const campaign = await PledgeCampaign.create({
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
      amount: 1000, payment_type: 'donation', payment_method: 'zelle', status: 'succeeded'
    });
  });

  it('creates a positive allocation', async () => {
    const a = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000,
      source: 'treasurer_manual', allocated_by: member.id
    });
    expect(parseFloat(a.amount)).toBe(1000);
  });

  it('rejects a zero allocation', async () => {
    await expect(PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 0, source: 'treasurer_manual'
    })).rejects.toThrow();
  });

  it('rejects an unknown source', async () => {
    await expect(PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 100, source: 'guesswork'
    })).rejects.toThrow();
  });

  it('rejects a reversal that is not negative', async () => {
    const a = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000, source: 'treasurer_manual'
    });
    await expect(PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 500,
      source: 'treasurer_manual', reverses_allocation_id: a.id, reason: 'oops'
    })).rejects.toThrow();
  });

  it('rejects a reversal with no reason', async () => {
    const a = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000, source: 'treasurer_manual'
    });
    await expect(PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: -1000,
      source: 'treasurer_manual', reverses_allocation_id: a.id
    })).rejects.toThrow();
  });

  it('accepts a well-formed reversal', async () => {
    const a = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000, source: 'treasurer_manual'
    });
    const r = await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: -1000,
      source: 'treasurer_manual', reverses_allocation_id: a.id,
      reason: 'Applied to the wrong pledge', allocated_by: member.id
    });
    expect(parseFloat(r.amount)).toBe(-1000);
  });

  it('rejects a duplicate idempotency key', async () => {
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 500,
      source: 'stripe_auto', idempotency_key: 'auto:pi_123:1'
    });
    await expect(PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 500,
      source: 'stripe_auto', idempotency_key: 'auto:pi_123:1'
    })).rejects.toThrow();
  });
});
