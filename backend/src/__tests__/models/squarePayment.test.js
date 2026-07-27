const { SquarePayment, sequelize } = require('../../models');

describe('SquarePayment model', () => {
  beforeAll(async () => { await sequelize.sync({ force: true }); });
  afterAll(async () => { await sequelize.close(); });

  it('creates a row and defaults status to NEEDS_REVIEW', async () => {
    const row = await SquarePayment.create({
      square_payment_id: 'sqpmt_TEST_1',
      amount: 25.00,
      currency: 'USD',
      square_created_at: new Date('2026-07-26T12:00:00Z')
    });
    expect(row.id).toBeTruthy();
    expect(row.status).toBe('NEEDS_REVIEW');
  });

  it('enforces a unique square_payment_id', async () => {
    await SquarePayment.create({ square_payment_id: 'sqpmt_DUP', amount: 5, currency: 'USD' });
    await expect(
      SquarePayment.create({ square_payment_id: 'sqpmt_DUP', amount: 6, currency: 'USD' })
    ).rejects.toThrow();
  });
});
