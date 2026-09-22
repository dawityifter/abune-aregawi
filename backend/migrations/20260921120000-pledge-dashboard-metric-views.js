'use strict';

// Recreates the pledge views so campaign_totals carries the dashboard's counts
// (household_count, anonymous_pledge_count, anonymous_collected) and its single
// definition of money-still-owed (outstanding_positive, overpaid_amount), and so
// the new campaign_status_totals view exists.
//
// Data-only in effect — no table is altered and no row is written.
// createPledgeViews() does DROP VIEW IF EXISTS before each CREATE, so this is
// safely re-runnable.
//
// down() drops all three views. Restoring the previous definitions requires
// checking out the earlier version of src/database/pledgeViews.js and re-running
// the create — the SQL lives only in that file, never inlined here.

const { createPledgeViews, dropPledgeViews } = require('../src/database/pledgeViews');

module.exports = {
  up: async (queryInterface) => { await createPledgeViews(queryInterface); },
  down: async (queryInterface) => { await dropPledgeViews(queryInterface); }
};
