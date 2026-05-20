const request = require('supertest');
const app = require('../../src/server');
const { BankTransaction, LedgerEntry, Member, Transaction, sequelize } = require('../../src/models');

describe('Payment Stats Overview', () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await BankTransaction.destroy({ where: {} });
    await Member.destroy({ where: {} });

    await Member.create({
      first_name: 'Test',
      last_name: 'Treasurer',
      email: 'test@example.com',
      firebase_uid: 'test-firebase-uid',
      phone_number: '+15550000001',
      role: 'treasurer',
      is_active: true
    });
  });

  it('reconciles active members into fully paid, behind, and not dues-tracked buckets', async () => {
    const fullyPaid = await Member.create({
      first_name: 'Fully',
      last_name: 'Paid',
      phone_number: '+15550000002',
      yearly_pledge: 1200,
      is_active: true
    });

    await Member.create({
      first_name: 'Behind',
      last_name: 'Member',
      phone_number: '+15550000003',
      yearly_pledge: 1200,
      is_active: true
    });

    await Member.create({
      first_name: 'No',
      last_name: 'Pledge',
      phone_number: '+15550000004',
      yearly_pledge: 0,
      is_active: true
    });

    const inactive = await Member.create({
      first_name: 'Inactive',
      last_name: 'Pledged',
      phone_number: '+15550000005',
      yearly_pledge: 1200,
      is_active: false
    });

    await LedgerEntry.bulkCreate([
      {
        member_id: fullyPaid.id,
        entry_date: `${currentYear}-01-15`,
        type: 'membership_due',
        amount: currentMonth * 100,
        category: 'INC001',
        payment_method: 'cash'
      },
      {
        member_id: inactive.id,
        entry_date: `${currentYear}-01-15`,
        type: 'membership_due',
        amount: currentMonth * 100,
        category: 'INC001',
        payment_method: 'cash'
      }
    ]);

    const response = await request(app)
      .get(`/api/payments/stats?year=${currentYear}`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.totalMembers).toBe(4);
    expect(response.body.data.duesTrackedMembers).toBe(2);
    expect(response.body.data.upToDateMembers).toBe(1);
    expect(response.body.data.behindMembers).toBe(1);
    expect(response.body.data.notDuesTrackedMembers).toBe(2);
    expect(
      response.body.data.upToDateMembers +
      response.body.data.behindMembers +
      response.body.data.notDuesTrackedMembers
    ).toBe(response.body.data.totalMembers);
  });
});
