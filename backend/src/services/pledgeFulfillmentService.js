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
 * `amount` is the pledge's total; `paymentAmount` is what the transaction
 * actually carries and is what gets allocated. They differ only for a named
 * pledge's part payment (an anonymous pledge must always pay in full, so the
 * two are always equal there). Defaults to `amount` so every existing caller —
 * where the payment always covers the pledge in full — is unaffected.
 *
 * @returns {Promise<{ pledge, allocation }>}
 */
async function createPledgeWithPayment({
  campaignId,
  amount,
  paymentAmount = amount,
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
    // 'immediate' when the money that arrived covers the pledge, which is the
    // ordinary case this function exists for.
    //
    // A NAMED pledge part-paid at an event (§5.5: "simply leaves a balance")
    // is the exception. Task 3 narrowed maybeAllocateToPledge, getPledgeBalance
    // and listUnallocated to fulfillment_intent: 'later', so an 'immediate'
    // pledge carrying an outstanding balance would be invisible to every one
    // of them: no automatic allocation, nothing on the member's /pledge page
    // or Dues banner, and never suggested to a treasurer. §6.2's premise —
    // "a fully paid immediate pledge must never be an allocation target" —
    // holds only for a fully paid one.
    //
    // An anonymous pledge is always paid in full (D4, enforced by the
    // endpoint), so it never takes this branch and never becomes 'later' —
    // which the anonymousMustBeImmediate CHECK forbids outright.
    fulfillment_intent: (!isAnonymous && paymentAmount < amount) ? 'later' : 'immediate',
    notes
  }, { transaction });

  const allocation = await allocate({
    pledgeId: pledge.id,
    transactionId,
    amount: paymentAmount,
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
