'use strict';

// Recreates the pledge views so campaign_totals carries the dashboard's counts
// (household_count, anonymous_pledge_count, anonymous_collected) and its single
// definition of money-still-owed (outstanding_positive, overpaid_amount), and so
// the new campaign_status_totals view exists.
//
// Data-only in effect — no table is altered and no row is written.
// createPledgeViews() does DROP VIEW IF EXISTS before each CREATE inside a single
// transaction, so this is safely re-runnable and never exposes a window where a
// view is missing.
//
// down() IS DELIBERATELY A NO-OP.
//
// (a) These views are shared infrastructure OWNED BY AN EARLIER MIGRATION —
//     20260820000005-create-pledge-views.js created pledge_balances and
//     campaign_totals. Dropping them here would take out that migration's work too,
//     and because 20260820000005 stays marked applied in SequelizeMeta, `db:migrate`
//     would NOT recreate them. GET /api/pledge-campaigns, getPledgeStats and the
//     unauthenticated PledgeTracker path would all 500 with no standard recovery.
// (b) up() is idempotent, so re-running it after a rollback is safe and is the
//     supported way to get back to a known state.
// (c) Nothing downstream requires these views to be absent — no later migration
//     drops or redefines a conflicting object.
// (d) Reverting the view DEFINITIONS (as opposed to removing them) means checking
//     out the earlier version of src/database/pledgeViews.js and re-running the
//     create. The SQL lives only in that file, never inlined here.
//
// Not `down: createPledgeViews` either: that is byte-for-byte up(), and a down()
// that re-applies the migration reads as a copy-paste mistake to the next person.

const { createPledgeViews } = require('../src/database/pledgeViews');

module.exports = {
  up: async (queryInterface) => { await createPledgeViews(queryInterface); },
  down: async () => { /* intentionally empty — see the note above */ }
};
