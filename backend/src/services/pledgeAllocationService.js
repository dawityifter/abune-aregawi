'use strict';

const {
  sequelize, Pledge, PledgeCampaign, PledgeAllocation, Transaction, Member
} = require('../models');

class AllocationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AllocationError';
    this.code = code;
  }
}

// Does the transaction's payer belong to the same person or household as the
// pledge holder? Household is the existing members.family_id self-FK — the same
// roll-up the dues views use. Anything else needs an explicit treasurer reason.
async function sameMemberOrHousehold(pledge, txn, options) {
  if (pledge.member_id == null || txn.member_id == null) return false;
  if (String(pledge.member_id) === String(txn.member_id)) return true;

  const [pledger, payer] = await Promise.all([
    Member.findByPk(pledge.member_id, options),
    Member.findByPk(txn.member_id, options)
  ]);
  if (!pledger || !payer) return false;

  const pledgerHousehold = String(pledger.family_id || pledger.id);
  const payerHousehold = String(payer.family_id || payer.id);
  return pledgerHousehold === payerHousehold;
}

async function allocate(
  { pledgeId, transactionId, amount, source, allocatedBy = null, reason = null, idempotencyKey = null },
  { transaction: outer } = {}
) {
  const run = async (t) => {
    const options = { transaction: t };

    if (idempotencyKey) {
      const existing = await PledgeAllocation.findOne({
        where: { idempotency_key: idempotencyKey }, ...options
      });
      if (existing) return existing;
    }

    const pledge = await Pledge.findByPk(pledgeId, options);
    if (!pledge) throw new AllocationError('PLEDGE_NOT_FOUND', 'Pledge not found');

    const campaign = await PledgeCampaign.findByPk(pledge.campaign_id, options);
    if (!campaign || campaign.status === 'closed') {
      throw new AllocationError('CAMPAIGN_CLOSED',
        'This campaign is closed and cannot accept new allocations');
    }

    // Lock the payment row. This is what makes the over-allocation check correct
    // under concurrency — two simultaneous allocations serialise here.
    const txn = await Transaction.findByPk(transactionId, { ...options, lock: t.LOCK.UPDATE });
    if (!txn) throw new AllocationError('TRANSACTION_NOT_FOUND', 'Transaction not found');

    if (!reason && !(await sameMemberOrHousehold(pledge, txn, options))) {
      throw new AllocationError('MEMBER_MISMATCH',
        'Payment belongs to a different member; supply a reason to allocate it anyway');
    }

    const allocatedSoFar = await PledgeAllocation.sum('amount', {
      where: { transaction_id: transactionId }, ...options
    }) || 0;

    const requested = parseFloat(amount);
    if (parseFloat(allocatedSoFar) + requested > parseFloat(txn.amount) + 1e-9) {
      throw new AllocationError('OVER_ALLOCATED',
        `Only ${(parseFloat(txn.amount) - parseFloat(allocatedSoFar)).toFixed(2)} of this payment is unallocated`);
    }

    try {
      return await PledgeAllocation.create({
        pledge_id: pledgeId,
        transaction_id: transactionId,
        amount: requested,
        source,
        allocated_by: allocatedBy,
        reason,
        idempotency_key: idempotencyKey
      }, options);
    } catch (err) {
      // A concurrent caller with the same idempotency key won the race. The DB
      // unique constraint is the real guarantee; this converts the loser's
      // constraint violation into the same no-op the sequential path returns.
      // On Postgres the re-fetch inside an aborted transaction may itself
      // fail to find the row (visibility rules); if so, rethrow the original
      // error rather than returning undefined.
      if (idempotencyKey && err.name === 'SequelizeUniqueConstraintError') {
        const winner = await PledgeAllocation.findOne({
          where: { idempotency_key: idempotencyKey }, ...options
        });
        if (winner) return winner;
      }
      throw err;
    }
  };

  if (outer) return run(outer);
  return sequelize.transaction(run);
}

module.exports = { allocate, AllocationError };
