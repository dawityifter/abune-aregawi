'use strict';

const { sequelize, PledgeAllocation, Pledge, Member, Transaction } = require('../models');
const { allocate, reverse, listUnallocated, AllocationError } = require('../services/pledgeAllocationService');
const { createTransactionRecord } = require('../services/transactionService');
const { createPledgeWithPayment } = require('../services/pledgeFulfillmentService');
const { findLiveCampaign } = require('../services/pledgeCampaignService');
const { buildDonorNote } = require('../utils/donorNote');

// NOTE: CURRENCY_MISMATCH from the original brief does not exist on
// AllocationError and was removed. INVALID_AMOUNT was added since it is
// thrown by reverse(). CAMPAIGN_NOT_FOUND was removed in an earlier pass
// (unthrowable at the time) but listUnallocated() now throws it when the
// campaign_id query param does not resolve, so it is mapped again here.
// Every code below has a live throw site, and every throw site is mapped.
const STATUS_BY_CODE = {
  PLEDGE_NOT_FOUND: 404,
  TRANSACTION_NOT_FOUND: 404,
  ALLOCATION_NOT_FOUND: 404,
  CAMPAIGN_NOT_FOUND: 404,
  CAMPAIGN_CLOSED: 409,
  OVER_ALLOCATED: 422,
  MEMBER_MISMATCH: 422,
  REASON_REQUIRED: 422,
  ALREADY_REVERSED: 422,
  REVERSAL_TOO_LARGE: 422,
  INVALID_AMOUNT: 422
};

const sendError = (res, err) => {
  if (err instanceof AllocationError) {
    return res.status(STATUS_BY_CODE[err.code] || 400)
      .json({ success: false, code: err.code, message: err.message });
  }
  // transactionService.js validation failures (e.g. cash payment missing a
  // receipt number) throw TransactionServiceError with a real statusCode;
  // honor it instead of collapsing every non-AllocationError into a 500.
  if (err && err.name === 'TransactionServiceError') {
    return res.status(err.statusCode || 400)
      .json({ success: false, code: 'VALIDATION_ERROR', message: err.message });
  }
  console.error('Pledge allocation error:', err);
  return res.status(500).json({ success: false, message: 'Allocation failed' });
};

const createAllocation = async (req, res) => {
  try {
    const allocation = await allocate({
      pledgeId: req.params.id,
      transactionId: req.body.transaction_id,
      amount: req.body.amount,
      source: 'treasurer_manual',
      allocatedBy: req.user.id,
      reason: req.body.reason || null
    });
    return res.status(201).json({ success: true, allocation });
  } catch (err) { return sendError(res, err); }
};

// Offline cash/check: the transaction and its allocation are created inside one
// DB transaction, so a payment can never exist with a failed allocation.
const createPledgePayment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const pledge = await Pledge.findByPk(req.params.id, { transaction: t });
    if (!pledge) throw new AllocationError('PLEDGE_NOT_FOUND', 'Pledge not found');

    const txn = await createTransactionRecord({
      member_id: pledge.member_id,
      collected_by: req.user.id,
      payment_date: req.body.payment_date,
      amount: req.body.amount,
      payment_type: req.campaign?.default_payment_type || 'pledge_drive',
      payment_method: req.body.payment_method,
      receipt_number: req.body.receipt_number || null,
      note: req.body.note || null,
      // This endpoint already knows exactly which pledge the payment is for
      // (the id in the URL). createTransactionRecord's automatic allocation
      // instead *infers* a pledge from the member's pledge in whatever
      // campaign findLiveCampaign() returns — if the member holds an active
      // pledge in more than one open campaign, that inference can target a
      // different pledge than the one this request means. Opt out and do the
      // explicit allocate() below against the URL's pledge, as before.
      skip_pledge_auto_allocation: true
    }, { transaction: t });

    const allocation = await allocate({
      pledgeId: pledge.id,
      transactionId: txn.id,
      amount: req.body.amount,
      source: 'treasurer_manual',
      allocatedBy: req.user.id,
      reason: req.body.reason || null
    }, { transaction: t });

    await t.commit();
    return res.status(201).json({ success: true, transaction: txn, allocation });
  } catch (err) {
    await t.rollback();
    return sendError(res, err);
  }
};

// A pledge that is created and paid in the same act — a walk-up gift at an
// event, anonymous or named. Distinct from createPledgePayment above, which
// pays an EXISTING pledge named in the URL.
const createPledgeWithPaymentHandler = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const campaign = await findLiveCampaign();
    if (!campaign) {
      throw new AllocationError('CAMPAIGN_NOT_FOUND', 'No pledge drive is currently open');
    }

    const pledgeAmount = parseFloat(req.body.pledge_amount);
    const paymentAmount = parseFloat(req.body.amount);
    const isAnonymous = Boolean(req.body.is_anonymous);
    const baptismName = req.body.baptism_name || null;

    if (!Number.isFinite(pledgeAmount) || pledgeAmount <= 0
        || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new AllocationError('INVALID_AMOUNT', 'Pledge and payment amounts must be positive');
    }

    // An anonymous pledge with an outstanding balance is the exact state the
    // design forbids: nobody to collect from. A part payment against a NAMED
    // pledge is fine and simply leaves a balance.
    if (isAnonymous && Math.abs(pledgeAmount - paymentAmount) > 1e-9) {
      throw new AllocationError('INVALID_AMOUNT',
        'An anonymous pledge must be paid in full: the payment must equal the pledge amount');
    }

    const memberId = req.body.member_id || null;
    const baseNote = req.body.note || null;

    const txn = await createTransactionRecord({
      member_id: memberId,
      collected_by: req.user.id,
      payment_date: req.body.payment_date,
      amount: paymentAmount,
      payment_type: campaign.default_payment_type || 'pledge_drive',
      payment_method: req.body.payment_method,
      receipt_number: req.body.receipt_number || null,
      note: memberId
        ? baseNote
        : buildDonorNote(baseNote, {
            donor_name: baptismName || `${req.body.first_name} ${req.body.last_name}`,
            donor_email: req.body.email || null,
            donor_phone: req.body.phone || null
          }),
      donor_name: memberId ? null : (baptismName || `${req.body.first_name} ${req.body.last_name}`),
      // This request creates the pledge itself a moment from now, so there is
      // nothing for the automatic rule to infer and it must not guess.
      skip_pledge_auto_allocation: true
    }, { transaction: t });

    const { pledge, allocation } = await createPledgeWithPayment({
      campaignId: campaign.id,
      amount: pledgeAmount,
      paymentAmount,
      transactionId: txn.id,
      memberId,
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      email: req.body.email || null,
      phone: req.body.phone || null,
      baptismName,
      isAnonymous,
      notes: baseNote,
      source: 'treasurer_manual',
      allocatedBy: req.user.id
    }, { transaction: t });

    await t.commit();
    return res.status(201).json({ success: true, pledge, transaction: txn, allocation });
  } catch (err) {
    await t.rollback();
    return sendError(res, err);
  }
};

const reverseAllocation = async (req, res) => {
  try {
    const reversal = await reverse({
      allocationId: req.params.id,
      reason: req.body.reason,
      amount: req.body.amount ?? null,
      reversedBy: req.user.id
    });
    return res.status(201).json({ success: true, reversal });
  } catch (err) { return sendError(res, err); }
};

const listAllocations = async (req, res) => {
  try {
    const allocations = await PledgeAllocation.findAll({
      where: { pledge_id: req.params.id },
      order: [['created_at', 'ASC']],
      include: [
        { model: Member, as: 'allocator', attributes: ['id', 'first_name', 'last_name'] },
        { model: Transaction, as: 'transaction',
          attributes: ['id', 'amount', 'payment_date', 'payment_method', 'status', 'receipt_number'] }
      ]
    });
    return res.status(200).json({ success: true, allocations });
  } catch (err) { return sendError(res, err); }
};

const listUnallocatedPayments = async (req, res) => {
  try {
    const items = await listUnallocated({
      campaignId: req.query.campaign_id,
      paymentType: req.query.payment_type || null,
      limit: req.query.limit || 100
    });
    return res.status(200).json({ success: true, items });
  } catch (err) { return sendError(res, err); }
};

module.exports = {
  createAllocation, createPledgePayment, createPledgeWithPaymentHandler,
  reverseAllocation, listAllocations, listUnallocatedPayments
};
