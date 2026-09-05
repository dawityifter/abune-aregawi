'use strict';

// Supabase's Security Advisor flags any table in the `public` schema that
// doesn't have Row Level Security enabled, because Supabase auto-exposes
// every public-schema table as a PostgREST endpoint reachable with the
// project's anon/service keys — regardless of whether the app actually uses
// that surface. This app never does: the backend talks to Postgres only
// through Sequelize's direct DATABASE_URL connection (see backend/CLAUDE.md),
// there is no supabase-js client and no PostgREST/anon-key usage anywhere in
// this codebase. So the fix here is the standard one for an "internal only,
// never meant to be in the public API" table: turn RLS on and add no
// policies.
//
// That default-deny is exactly what we want and nothing more needs doing:
// - Postgres' own RLS default is deny-all once RLS is enabled and no policy
//   grants anything, which immediately blocks PostgREST's anon/authenticated
//   roles from ever reading these tables through Supabase's public API.
// - The backend's own access is unaffected. Sequelize connects as the role
//   that owns these tables (it created them, via the migrations that added
//   them), and Postgres exempts table owners from RLS by default — RLS only
//   applies to non-owner roles unless FORCE ROW LEVEL SECURITY is also set,
//   which this migration deliberately does not set.
//
// Covers survey_responses, which stores the anonymous Church Services
// Assessment submissions: per-question answers plus free-text answers about
// clergy, pastoral care, and parish leadership. Confidentiality is the whole
// premise the survey is presented under — the intro copy promises respondents
// their feedback is anonymous — so this table needs the same
// default-deny-to-non-owners RLS as the other sensitive tables, and must never
// be readable through Supabase's auto-generated public API.

const TABLES = ['survey_responses'];

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
