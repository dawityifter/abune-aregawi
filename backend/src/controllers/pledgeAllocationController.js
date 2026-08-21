'use strict';

const { sequelize, PledgeAllocation, Pledge, Member, Transaction } = require('../models');
const { allocate, reverse, AllocationError } = require('../services/pledgeAllocationService');
const { createTransactionRecord } = require('../services/transactionService');

// NOTE: CURRENCY_MISMATCH from the original brief does not exist on
// AllocationError and was removed. CAMPAIGN_NOT_FOUND was also removed here —
// verified against every `new AllocationError(...)` throw site in
// pledgeAllocationService.js, that code is never thrown (a missing/closed
// campaign always surfaces as CAMPAIGN_CLOSED there). INVALID_AMOUNT was
// added since it is thrown by reverse(). Every code below has a live throw
// site, and every throw site is mapped.
const STATUS_BY_CODE = {
  PLEDGE_NOT_FOUND: 404,
  TRANSACTION_NOT_FOUND: 404,
  ALLOCATION_NOT_FOUND: 404,
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
    return res.status(err.statusCode || 400).json({ success: false, message: err.message });
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
      note: req.body.note || null
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

module.exports = { createAllocation, createPledgePayment, reverseAllocation, listAllocations };
