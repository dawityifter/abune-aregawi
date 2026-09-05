'use strict';

// Recreates pledge_balances and campaign_totals so that pledges from drives
// predating the allocation model (is_historical = true) are credited from
// their frozen legacy_status instead of computing to zero.
//
// Why this is needed: the 2025 drive recorded fulfilment as a flag on the
// pledge, with no payment-level detail. pledge_allocations.transaction_id is
// NOT NULL and references a real transaction, so those rows cannot be
// backfilled without inventing ledger entries. Left as-is, the views reported
// ~$55k of real giving across 118 donors as never received.
//
// Data-only in effect — no table is altered. createPledgeViews() already does
// DROP VIEW IF EXISTS before creating, so this is safely re-runnable. To
// restore the prior definition, down() drops both views; restoring them
// requires checking out the earlier version of pledgeViews.js and re-running
// the create.

const { createPledgeViews, dropPledgeViews } = require('../src/database/pledgeViews');

module.exports = {
  up: async (queryInterface) => { await createPledgeViews(queryInterface); },
  down: async (queryInterface) => { await dropPledgeViews(queryInterface); }
};
