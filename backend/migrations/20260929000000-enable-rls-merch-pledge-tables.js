'use strict';

// Supabase Security Advisor flagged five more public-schema tables missing
// RLS: pledge_allocations and pledge_campaigns (added after
// 20260820000001-enable-rls-pledges.js covered only `pledges` itself), and
// merch_orders, merch_order_items, merch_inventory (the merchandise/t-shirt
// sales feature — see MERCHANDISE_SALES.md — added after the first RLS pass).
//
// Same reasoning as 20260811000000-enable-rls-square-expense-zelle-tables.js:
// this app has no supabase-js client and never talks to PostgREST/anon keys —
// the backend connects to Postgres only via Sequelize's direct DATABASE_URL
// (see backend/CLAUDE.md). Enable RLS with no policies: default-deny blocks
// Supabase's auto-exposed REST API for these tables, while the backend is
// unaffected because Sequelize connects as the tables' owner, and Postgres
// exempts owners from RLS unless FORCE ROW LEVEL SECURITY is also set (it is
// not, here).

const TABLES = ['pledge_allocations', 'pledge_campaigns', 'merch_orders', 'merch_order_items', 'merch_inventory'];

async function tableExists(queryInterface, table) {
  try {
    await queryInterface.describeTable(table);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  up: async (queryInterface) => {
    // RLS is a Postgres concept; no-op under sqlite (local/test).
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;

    for (const table of TABLES) {
      if (!(await tableExists(queryInterface, table))) continue;
      // No USING/WITH CHECK policy is added on purpose — see the module
      // comment above. Deny-all-to-non-owners is the desired end state.
      await queryInterface.sequelize.query(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;`);
    }
  },

  down: async (queryInterface) => {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;

    for (const table of TABLES) {
      if (!(await tableExists(queryInterface, table))) continue;
      await queryInterface.sequelize
        .query(`ALTER TABLE public."${table}" DISABLE ROW LEVEL SECURITY;`)
        .catch(() => {});
    }
  }
};
