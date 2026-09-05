'use strict';

const { Transaction, LedgerEntry, sequelize } = require('../../src/models');
const { handlePaymentSucceeded } = require('../../src/controllers/donationController');

// A Stripe payment intent whose metadata resolves to no member at all.
const anonymousIntent = (id) => ({
  id,
  amount: 25000,
  amount_received: 25000,
  created: Math.floor(Date.now() / 1000),
  metadata: {
    purpose: 'donation',
    donor_name: 'Test Anonymous Giver',
    donor_type: 'individual'
  }
});

describe('anonymous Stripe donations reach the books', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await LedgerEntry.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
  });

  it('creates a transaction with a null member and a null collector', async () => {
    await handlePaymentSucceeded(anonymousIntent('pi_anon_001'));

    const txn = await Transaction.findOne({ where: { external_id: 'pi_anon_001' } });
    expect(txn).not.toBeNull();
    expect(txn.member_id).toBeNull();
    expect(txn.collected_by).toBeNull();
    expect(parseFloat(txn.amount)).toBe(250);
    expect(txn.status).toBe('succeeded');
  });

  it('records the donor in the note block the dashboard parses', async () => {
    await handlePaymentSucceeded(anonymousIntent('pi_anon_002'));

    const txn = await Transaction.findOne({ where: { external_id: 'pi_anon_002' } });
    expect(txn.donor_name).toBe('Test Anonymous Giver');
    expect(txn.note).toContain('[Anonymous Donor]');
    expect(txn.note).toContain('Name: Test Anonymous Giver');
  });

  it('creates a ledger entry so the money is on the books', async () => {
    await handlePaymentSucceeded(anonymousIntent('pi_anon_003'));

    const txn = await Transaction.findOne({ where: { external_id: 'pi_anon_003' } });
    const entry = await LedgerEntry.findOne({ where: { transaction_id: txn.id } });
    expect(entry).not.toBeNull();
    expect(entry.member_id).toBeNull();
    expect(parseFloat(entry.amount)).toBe(250);
  });
});
