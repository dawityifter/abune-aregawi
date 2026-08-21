'use strict';

const { Op } = require('sequelize');
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

// Corrections are appended, never edited in place. A reversal is a new row:
// negative amount, reverses_allocation_id pointing at the original, and a
// mandatory reason. The original row is never touched — that is the entire
// audit trail (who / when / from what / to what / why), with no separate
// audit table. A Postgres trigger physically blocks UPDATE/DELETE on
// pledge_allocations in production; this service must never issue either.
async function reverse(
  { allocationId, reason, reversedBy = null, amount = null, idempotencyKey = null },
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

    if (!reason || !String(reason).trim()) {
      throw new AllocationError('REASON_REQUIRED',
        'A reason is required when reversing an allocation');
    }

    // Lock the original row. This is what makes the outstanding/cap check correct
    // under concurrency — two simultaneous reversals of the same allocation
    // serialise here, mirroring the Transaction lock in allocate(). (SQLite, used
    // in tests, ignores row locks; this is a production-only guarantee, same as
    // in allocate().)
    const original = await PledgeAllocation.findByPk(allocationId, { ...options, lock: t.LOCK.UPDATE });
    if (!original) throw new AllocationError('ALLOCATION_NOT_FOUND', 'Allocation not found');

    const alreadyReversed = await PledgeAllocation.sum('amount', {
      where: { reverses_allocation_id: allocationId }, ...options
    }) || 0;

    const originalAmount = parseFloat(original.amount);
    const outstanding = originalAmount + parseFloat(alreadyReversed); // reversals are negative
    if (outstanding <= 1e-9) {
      throw new AllocationError('ALREADY_REVERSED', 'This allocation has already been reversed');
    }

    const requestedRaw = amount == null ? outstanding : parseFloat(amount);
    if (!Number.isFinite(requestedRaw) || requestedRaw === 0) {
      throw new AllocationError('INVALID_AMOUNT',
        'Reversal amount must be a non-zero number');
    }
    // Callers may express a reversal as either 400 or -400; both mean "reverse
    // 400". Normalise to a magnitude BEFORE the cap check, or a negative input
    // bypasses the cap and is then written at full magnitude below.
    const requested = Math.abs(requestedRaw);
    if (requested > outstanding + 1e-9) {
      throw new AllocationError('REVERSAL_TOO_LARGE',
        `At most ${outstanding.toFixed(2)} of this allocation can be reversed`);
    }

    // Append a reversing row. The original is never modified — that is the
    // entire audit mechanism.
    try {
      return await PledgeAllocation.create({
        pledge_id: original.pledge_id,
        transaction_id: original.transaction_id,
        amount: -requested,
        source: original.source === 'stripe_refund' ? 'stripe_refund' : 'treasurer_manual',
        allocated_by: reversedBy,
        reason,
        reverses_allocation_id: original.id,
        idempotency_key: idempotencyKey
      }, options);
    } catch (err) {
      // A concurrent caller with the same idempotency key won the race (e.g. a
      // duplicate Stripe refund webhook). The DB unique constraint is the real
      // guarantee; this converts the loser's constraint violation into the same
      // no-op the sequential path returns. On Postgres the re-fetch inside an
      // aborted transaction may itself fail to find the row (visibility rules);
      // if so, rethrow the original error rather than returning undefined.
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

// Payments that arrived with no pledge attached (spec scenario 4). This is a
// queue, not an error state — the treasurer decides, the system never guesses.
async function listUnallocated({ campaignId, paymentType = null, limit = 100 }) {
  const campaign = await PledgeCampaign.findByPk(campaignId);
  if (!campaign) throw new AllocationError('CAMPAIGN_NOT_FOUND', 'Campaign not found');

  const where = { status: 'succeeded' };

  if (campaign.start_date) {
    where.payment_date = { [Op.gte]: campaign.start_date };
    if (campaign.end_date) {
      where.payment_date = { [Op.between]: [campaign.start_date, campaign.end_date] };
    }
  }

  // Default to the campaign's own type so the queue does not nag about dues.
  if (paymentType !== 'all') {
    where.payment_type = paymentType || campaign.default_payment_type || 'pledge_drive';
  }

  const candidates = await Transaction.findAll({
    where, order: [['payment_date', 'DESC']], limit: parseInt(limit, 10)
  });

  const items = [];
  for (const txn of candidates) {
    const allocated = parseFloat(await PledgeAllocation.sum('amount', {
      where: { transaction_id: txn.id }
    }) || 0);
    const unallocated = parseFloat(txn.amount) - allocated;
    if (unallocated <= 1e-9) continue;

    // Deterministic because of the one-active-pledge-per-member-per-campaign
    // index — a suggestion, never applied without a click.
    let suggestedPledgeId = null;
    if (txn.member_id) {
      const suggestion = await Pledge.findOne({
        where: {
          campaign_id: campaignId, member_id: txn.member_id,
          lifecycle: 'active', is_historical: false
        },
        attributes: ['id']
      });
      suggestedPledgeId = suggestion ? suggestion.id : null;
    }

    items.push({ transaction: txn, allocated, unallocated, suggestedPledgeId });
  }

  return items;
}

module.exports = { allocate, reverse, listUnallocated, AllocationError };
