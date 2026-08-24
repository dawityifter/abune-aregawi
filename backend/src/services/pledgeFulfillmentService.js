'use strict';

const { Pledge } = require('../models');
const { allocate } = require('./pledgeAllocationService');

/**
 * Creates a pledge and credits it with an already-recorded payment, inside the
 * caller's DB transaction. The single definition of "pledged and paid in one
 * act", shared by the Stripe webhook and the treasurer endpoint.
 *
 * The caller owns the transaction so all writes commit or roll back together.
 * A pledge that exists without its allocation would report as unpaid forever;
 * an allocation without its pledge cannot exist at all.
 *
 * @returns {Promise<{ pledge, allocation }>}
 */
async function createPledgeWithPayment({
  campaignId,
  amount,
  transactionId,
  memberId = null,
  firstName,
  lastName,
  email = null,
  phone = null,
  baptismName = null,
  isAnonymous = false,
  notes = null,
  source,
  allocatedBy = null
}, { transaction }) {
  const pledge = await Pledge.create({
    campaign_id: campaignId,
    member_id: memberId,
    amount,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    baptism_name: baptismName,
    is_anonymous: isAnonymous,
    // Always 'immediate' here by definition: this function exists precisely for
    // the case where the money arrives with the pledge.
    fulfillment_intent: 'immediate',
    notes
  }, { transaction });

  const allocation = await allocate({
    pledgeId: pledge.id,
    transactionId,
    amount,
    source,
    allocatedBy,
    // allocate() refuses a payment whose payer does not match the pledge holder
    // unless given a reason (MEMBER_MISMATCH), and an anonymous pledge has no
    // member to match. The pledge and the payment were created by the same
    // request, so identity is certain — and this string lands in the audit
    // trail where a reader can see why the check was bypassed.
    reason: 'Pledge created and paid in one transaction',
    // Distinct prefix from maybeAllocateToPledge's "txn:<id>" so the two paths
    // can never silently collide on one transaction.
    idempotencyKey: `pledge-with-payment:txn:${transactionId}`
  }, { transaction });

  return { pledge, allocation };
}

module.exports = { createPledgeWithPayment };
