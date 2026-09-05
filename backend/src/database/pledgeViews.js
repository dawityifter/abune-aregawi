'use strict';

// SINGLE SOURCE OF THE VIEW SQL.
//
// Called by migrations/20260820000005-create-pledge-views.js AND by
// tests/setup.js. Tests run sequelize.sync({force:true}) rather than
// migrations, so a view defined only in a migration would not exist under Jest.
//
// PORTABILITY (must run on Postgres and SQLite):
//   - SUM(CASE WHEN ... END), never FILTER (WHERE ...)
//   - LEFT JOIN + GROUP BY, never LATERAL
//   - every division guarded by CASE WHEN ... > 0: Postgres raises on
//     divide-by-zero where SQLite quietly returns NULL.

// Money actually received against a pledge.
//
// Drives that predate the allocation model (is_historical) recorded fulfilment
// as a flag on the pledge, with no payment-level detail. Those rows cannot be
// backfilled: pledge_allocations.transaction_id is NOT NULL and references a
// real transaction, so inventing allocations would mean inventing ledger
// entries. Reading legacy_status for exactly those rows is what keeps the 2025
// drive from reporting its ~$55k of giving as never received.
//
// Everything from 2026 on is unaffected and still requires a real allocation
// joined to a succeeded transaction — a flag alone never credits a pledge.
const ALLOCATED = "COALESCE(SUM(CASE WHEN t.status = 'succeeded' THEN a.amount ELSE 0 END), 0)";
const LEGACY_PAID =
  `CASE WHEN p.is_historical = TRUE AND p.legacy_status = 'fulfilled' ` +
  `THEN p.amount ELSE ${ALLOCATED} END`;

const PLEDGE_BALANCES = (securityInvoker) => `
CREATE VIEW pledge_balances ${securityInvoker ? 'WITH (security_invoker = true) ' : ''}AS
SELECT
  p.id                AS pledge_id,
  p.campaign_id       AS campaign_id,
  p.member_id         AS member_id,
  p.amount            AS pledged_amount,
  p.is_historical     AS is_historical,
  ${LEGACY_PAID} AS paid_amount,
  p.amount - ${LEGACY_PAID} AS remaining_amount,
  CASE WHEN p.amount > 0
       THEN ROUND(${LEGACY_PAID} * 100.0 / p.amount, 1)
       ELSE 0 END AS percent_fulfilled,
  CASE
    WHEN p.lifecycle = 'cancelled' THEN 'cancelled'
    WHEN ${LEGACY_PAID} <= 0 THEN 'not_started'
    WHEN ${LEGACY_PAID} >= p.amount THEN 'fulfilled'
    ELSE 'partially_fulfilled'
  END AS derived_status,
  MAX(CASE WHEN t.status = 'succeeded' THEN t.payment_date ELSE NULL END) AS last_payment_at
FROM pledges p
LEFT JOIN pledge_allocations a ON a.pledge_id = p.id
LEFT JOIN transactions t ON t.id = a.transaction_id
GROUP BY p.id, p.campaign_id, p.member_id, p.amount, p.lifecycle, p.is_historical, p.legacy_status
`;

const CAMPAIGN_TOTALS = (securityInvoker) => `
CREATE VIEW campaign_totals ${securityInvoker ? 'WITH (security_invoker = true) ' : ''}AS
SELECT
  c.id                AS campaign_id,
  c.slug              AS slug,
  c.goal_amount       AS goal_amount,
  COUNT(b.pledge_id)  AS pledge_count,
  COUNT(DISTINCT b.member_id) AS donor_count,
  COALESCE(SUM(b.pledged_amount), 0)   AS total_pledged,
  COALESCE(SUM(b.paid_amount), 0)      AS total_collected,
  COALESCE(SUM(b.remaining_amount), 0) AS outstanding,
  CASE WHEN c.goal_amount > 0
       THEN ROUND(COALESCE(SUM(b.paid_amount), 0) * 100.0 / c.goal_amount, 1)
       ELSE 0 END AS percent_to_goal
FROM pledge_campaigns c
LEFT JOIN pledge_balances b
  ON b.campaign_id = c.id AND b.derived_status <> 'cancelled'
GROUP BY c.id, c.slug, c.goal_amount
`;

async function shouldUseSecurityInvoker(queryInterface) {
  if (queryInterface.sequelize.getDialect() !== 'postgres') return false;

  // `security_invoker = true` is a PostgreSQL 15+ view option (it is a hard
  // syntax error on older servers). Production (Supabase) runs PG15+, so it
  // keeps the RLS-respecting behavior described above. Older servers — e.g. a
  // local Homebrew Postgres 14 used for migration rehearsal, or CI images
  // pinned to an older major version — cannot use the clause at all, so we
  // omit it there and fall back to the view running as its owner (bypassing
  // RLS) on those environments only. Do not drop this for PG15+; production
  // is expected to always qualify.
  //
  // `sequelize.query('SHOW server_version_num;')` resolves to an array of row
  // objects directly (NOT a [rows, metadata] tuple) for this driver/version,
  // so destructure a single row object, not a nested array.
  const [{ server_version_num: versionNum }] = await queryInterface.sequelize.query(
    'SHOW server_version_num;'
  );
  return parseInt(versionNum, 10) >= 150000;
}

async function createPledgeViews(queryInterface) {
  const securityInvoker = await shouldUseSecurityInvoker(queryInterface);
  await dropPledgeViews(queryInterface);
  // security_invoker matters: in PG15 a view runs as its OWNER by default, which
  // would bypass the RLS we enabled on pledges. SQLite has no such concept.
  await queryInterface.sequelize.query(PLEDGE_BALANCES(securityInvoker));
  await queryInterface.sequelize.query(CAMPAIGN_TOTALS(securityInvoker));
}

async function dropPledgeViews(queryInterface) {
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS campaign_totals;');
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS pledge_balances;');
}

module.exports = { createPledgeViews, dropPledgeViews };
