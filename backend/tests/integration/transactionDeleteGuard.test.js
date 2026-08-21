const request = require('supertest');
const app = require('../../src/server');
const { PledgeAllocation, Pledge, PledgeCampaign, Member, Transaction, sequelize } = require('../../src/models');
const admin = require('firebase-admin');

const asAdmin = () => {
  admin.auth = jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'uid-admin', email: 'adam@example.com' })
  }));
};

describe('DELETE /api/transactions/:id with allocations', () => {
  let member, txn, pledge;

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

    const campaign = await PledgeCampaign.create({
      slug: '2026-pledge-drive', name: '2026', start_date: '2026-01-01', status: 'active'
    });
    await Member.create({
      first_name: 'Adam',
      last_name: 'Admin',
      phone_number: '+15550000003',
      email: 'adam@example.com', is_active: true, role: 'admin', firebase_uid: 'uid-admin'
    });
    member = await Member.create({
      first_name: 'Ann',
      last_name: 'Giver',
      phone_number: '+15550000010',
      email: 'ann@example.com', is_active: true, role: 'member', firebase_uid: 'uid-ann'
    });
    pledge = await Pledge.create({
      amount: 5000, first_name: 'Ann', last_name: 'Giver', pledge_type: 'fundraising',
      campaign_id: campaign.id, member_id: member.id
    });
    txn = await Transaction.create({
      member_id: member.id, collected_by: member.id, payment_date: '2026-02-01',
      amount: 1000, payment_type: 'pledge_drive', payment_method: 'zelle', status: 'succeeded'
    });
  });

  it('refuses to delete an allocated transaction and explains why', async () => {
    await PledgeAllocation.create({
      pledge_id: pledge.id, transaction_id: txn.id, amount: 1000,
      source: 'treasurer_manual', allocated_by: member.id
    });
    asAdmin();
    const res = await request(app).delete(`/api/transactions/${txn.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRANSACTION_ALLOCATED');
    expect(await Transaction.findByPk(txn.id)).not.toBeNull();
  });

  it('still deletes an unallocated transaction', async () => {
    asAdmin();
    const res = await request(app).delete(`/api/transactions/${txn.id}`)
      .set('Authorization', 'Bearer t');
    expect(res.status).toBe(200);
    expect(await Transaction.findByPk(txn.id)).toBeNull();
  });
});
