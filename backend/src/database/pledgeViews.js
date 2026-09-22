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

// outstanding vs outstanding_positive: a pledge can be over-fulfilled (a payment
// lands on it in full even when it overshoots), so remaining_amount goes negative
// and `outstanding` nets one member's overshoot against another's shortfall.
// outstanding_positive is money actually still owed; overpaid_amount is the
// overshoot as a positive number. UI surfaces read those two, never `outstanding`
// raw — this is the one definition of the rule.

// Three counts, three different questions:
//   donor_count      - distinct member rows. KEPT AS-IS for existing callers, but
//                      it silently skips anonymous pledges, because SQL
//                      COUNT(DISTINCT x) ignores NULLs and an anonymous pledge has
//                      no member_id. Do not build a participation rate on it.
//   household_count  - distinct families. A spouse or promoted dependent pledges
//                      against their OWN member row, so distinct members is not
//                      distinct households. COALESCE(family_id, id) is the house
//                      pattern (statementController.js) where family_id IS NULL
//                      means implicit head.
//   anonymous_*      - anonymous gifts are not attributable to a household, so they
//                      are reported BESIDE the participation rate, never inside it.
//                      The `b.pledge_id IS NOT NULL` guard matters: an empty drive
//                      still yields one all-NULL row from the LEFT JOIN, which
//                      would otherwise count as one anonymous pledge.
const CAMPAIGN_TOTALS = (securityInvoker) => `
CREATE VIEW campaign_totals ${securityInvoker ? 'WITH (security_invoker = true) ' : ''}AS
SELECT
  c.id                AS campaign_id,
  c.slug              AS slug,
  c.goal_amount       AS goal_amount,
  COUNT(b.pledge_id)  AS pledge_count,
  COUNT(DISTINCT b.member_id) AS donor_count,
  COUNT(DISTINCT CASE WHEN b.member_id IS NOT NULL
                      THEN COALESCE(m.family_id, m.id) END) AS household_count,
  SUM(CASE WHEN b.pledge_id IS NOT NULL AND b.member_id IS NULL
           THEN 1 ELSE 0 END) AS anonymous_pledge_count,
  COALESCE(SUM(CASE WHEN b.member_id IS NULL
                    THEN b.paid_amount ELSE 0 END), 0) AS anonymous_collected,
  COALESCE(SUM(b.pledged_amount), 0)   AS total_pledged,
  COALESCE(SUM(b.paid_amount), 0)      AS total_collected,
  COALESCE(SUM(b.remaining_amount), 0) AS outstanding,
  COALESCE(SUM(CASE WHEN b.remaining_amount > 0
                    THEN b.remaining_amount ELSE 0 END), 0) AS outstanding_positive,
  COALESCE(SUM(CASE WHEN b.remaining_amount < 0
                    THEN -b.remaining_amount ELSE 0 END), 0) AS overpaid_amount,
  CASE WHEN c.goal_amount > 0
       THEN ROUND(COALESCE(SUM(b.paid_amount), 0) * 100.0 / c.goal_amount, 1)
       ELSE 0 END AS percent_to_goal
FROM pledge_campaigns c
LEFT JOIN pledge_balances b
  ON b.campaign_id = c.id AND b.derived_status <> 'cancelled'
LEFT JOIN members m ON m.id = b.member_id
GROUP BY c.id, c.slug, c.goal_amount
`;

// One row per (campaign, derived status), carrying BOTH a count and a dollar sum.
// The dashboard's fulfillment breakdown needs both to show that e.g. 40% of donors
// account for 24% of dollars — a single figure cannot express that.
//
// `cancelled` gets its own row rather than being filtered out: campaign_totals
// deliberately excludes cancelled pledges from headline money, but admins still
// need to see them, which is what getPledgeStats already does in JS today.
const CAMPAIGN_STATUS_TOTALS = (securityInvoker) => `
CREATE VIEW campaign_status_totals ${securityInvoker ? 'WITH (security_invoker = true) ' : ''}AS
SELECT
  b.campaign_id       AS campaign_id,
  b.derived_status    AS status,
  COUNT(b.pledge_id)  AS pledge_count,
  COUNT(DISTINCT CASE WHEN b.member_id IS NOT NULL
                      THEN COALESCE(m.family_id, m.id) END) AS household_count,
  COALESCE(SUM(b.pledged_amount), 0) AS total_pledged,
  COALESCE(SUM(b.paid_amount), 0)    AS total_collected,
  COALESCE(SUM(CASE WHEN b.remaining_amount > 0
                    THEN b.remaining_amount ELSE 0 END), 0) AS outstanding
FROM pledge_balances b
LEFT JOIN members m ON m.id = b.member_id
GROUP BY b.campaign_id, b.derived_status
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
  await queryInterface.sequelize.query(CAMPAIGN_STATUS_TOTALS(securityInvoker));
}

async function dropPledgeViews(queryInterface) {
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS campaign_status_totals;');
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS campaign_totals;');
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS pledge_balances;');
}

module.exports = { createPledgeViews, dropPledgeViews };
