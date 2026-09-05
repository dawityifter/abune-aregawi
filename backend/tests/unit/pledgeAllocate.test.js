const { allocate, AllocationError } = require('../../src/services/pledgeAllocationService');
const { PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');

describe('pledgeAllocationService.allocate', () => {
  let campaign, member, other, pledge, txn;

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
    other = await Member.create({
      first_name: 'Bob',
      last_name: 'Other',
      phone_number: '+15550000011',
      email: 'bob@example.com', is_active: true, role: 'member', firebase_uid: 'uid-bob'
    });
    pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver',
      pledge_type: 'fundraising', campaign_id: campaign.id, member_id: member.id
    });
    txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 1000, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
  });

  const args = (over = {}) => ({
    pledgeId: pledge.id, transactionId: txn.id, amount: 1000,
    source: 'treasurer_manual', allocatedBy: member.id, ...over
  });

  it('allocates a payment to a pledge', async () => {
    const a = await allocate(args());
    expect(parseFloat(a.amount)).toBe(1000);
  });

  it('allows splitting one payment across two allocations', async () => {
    await allocate(args({ amount: 400 }));
    const second = await allocate(args({ amount: 600 }));
    expect(parseFloat(second.amount)).toBe(600);
  });

  it('rejects allocating more than the transaction amount', async () => {
    await allocate(args({ amount: 800 }));
    await expect(allocate(args({ amount: 300 }))).rejects.toMatchObject({ code: 'OVER_ALLOCATED' });
  });

  it('rejects allocation into a closed campaign', async () => {
    await campaign.update({ status: 'closed' });
    await expect(allocate(args())).rejects.toMatchObject({ code: 'CAMPAIGN_CLOSED' });
  });

  it('rejects a member mismatch when no reason is supplied', async () => {
    const foreign = await Transaction.create({
      member_id: other.id, collected_by: other.id, payment_date: '2026-02-01',
      amount: 500, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    await expect(
      allocate(args({ transactionId: foreign.id, amount: 500 }))
    ).rejects.toMatchObject({ code: 'MEMBER_MISMATCH' });
  });

  it('allows a member mismatch when a reason is supplied', async () => {
    const foreign = await Transaction.create({
      member_id: other.id, collected_by: other.id, payment_date: '2026-02-01',
      amount: 500, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    const a = await allocate(args({
      transactionId: foreign.id, amount: 500, reason: 'Paid on behalf of Ann'
    }));
    expect(parseFloat(a.amount)).toBe(500);
  });

  it('allows a household match via family_id with no reason', async () => {
    await other.update({ family_id: member.id });
    const spouseTxn = await Transaction.create({
      member_id: other.id, collected_by: other.id, payment_date: '2026-02-01',
      amount: 500, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
    const a = await allocate(args({ transactionId: spouseTxn.id, amount: 500 }));
    expect(parseFloat(a.amount)).toBe(500);
  });

  it('returns the existing row for a duplicate idempotency key', async () => {
    const first = await allocate(args({ amount: 500, idempotencyKey: 'auto:pi_1:9' }));
    const second = await allocate(args({ amount: 500, idempotencyKey: 'auto:pi_1:9' }));
    expect(second.id).toBe(first.id);
    expect(await PledgeAllocation.count()).toBe(1);
  });

  it('rejects an unknown pledge', async () => {
    await expect(allocate(args({ pledgeId: 999999 }))).rejects.toMatchObject({ code: 'PLEDGE_NOT_FOUND' });
  });

  it('returns the existing row when create() races on the idempotency key', async () => {
    // Simulate a genuine concurrent duplicate: another caller already committed
    // the winning row for this key, but THIS caller's up-front findOne raced
    // ahead of that commit and saw nothing, so it proceeds to create() and
    // collides with the DB's unique constraint on idempotency_key.
    const existing = await allocate(args({ amount: 500, idempotencyKey: 'race:1' }));

    const findOneSpy = jest.spyOn(PledgeAllocation, 'findOne');
    findOneSpy.mockImplementationOnce(() => Promise.resolve(null)); // fast-path miss

    const createSpy = jest.spyOn(PledgeAllocation, 'create');
    createSpy.mockImplementationOnce(() => {
      const err = new Error('duplicate key value violates unique constraint "pledge_allocations_idempotency_key"');
      err.name = 'SequelizeUniqueConstraintError';
      return Promise.reject(err);
    });

    try {
      const result = await allocate(args({ amount: 500, idempotencyKey: 'race:1' }));
      expect(result.id).toBe(existing.id);
      expect(await PledgeAllocation.count()).toBe(1);
    } finally {
      findOneSpy.mockRestore();
      createSpy.mockRestore();
    }
  });
});
