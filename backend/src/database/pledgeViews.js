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

// The participation NUMERATOR, shared verbatim by campaign_totals and
// campaign_status_totals. It must stay one expression: the denominator lives in
// countActiveHouseholds() (services/pledgeCampaignService.js) and the two have to
// agree on BOTH the household key and the active scope, or the rate they form can
// exceed 100%.
//
//   COALESCE(m.family_id, m.id) — the house household key (statementController.js),
//     where family_id IS NULL means implicit head. A spouse or promoted dependent
//     pledges against their OWN member row, so distinct members is not distinct
//     households.
//   m.is_active = true — the denominator counts only active members, so a donor who
//     pledged and was later deactivated must leave the numerator too. Without this
//     they stay in the numerator and vanish from the denominator: measured 2/1 = 200%.
//     "Participation" therefore means "of the parish we have today".
//   b.member_id IS NOT NULL — NOT redundant. It keeps anonymous pledges (no member_id,
//     so no matching members row) out of the household count, which is the whole point
//     of reporting anonymous_* beside the rate rather than inside it. It also makes the
//     guard explicit rather than implied by the is_active comparison being NULL.
//
// Empty drive: household_count is 0 because the LEFT JOIN finds nothing, so b.member_id
// and every m.* column are NULL and the CASE yields NULL for the single all-NULL row —
// NULL propagation through a failed join, not anything COUNT DISTINCT does on its own.
const HOUSEHOLD_COUNT =
  'COUNT(DISTINCT CASE WHEN b.member_id IS NOT NULL AND m.is_active = true ' +
  'THEN COALESCE(m.family_id, m.id) END)';

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
//   donor_count      - distinct member rows. KEPT AS-IS for existing callers, but it
//                      silently skips anonymous pledges: COUNT(DISTINCT b.member_id)
//                      ignores NULLs and an anonymous pledge has no member_id. That
//                      NULL-skipping claim is about donor_count only. Do not build a
//                      participation rate on it.
//   household_count  - distinct ACTIVE households, defined once in HOUSEHOLD_COUNT
//                      above and shared with campaign_status_totals. Read that
//                      comment before changing either view.
//   anonymous_*      - anonymous gifts are not attributable to a household, so they
//                      are reported BESIDE the participation rate, never inside it.
//                      The `b.pledge_id IS NOT NULL` guard matters: an empty drive
//                      still yields one all-NULL row from the LEFT JOIN, which
//                      would otherwise count as one anonymous pledge.
//
// EMPTY DRIVE: this view emits one all-zero row for a campaign with no pledges (the
// outer FROM is pledge_campaigns, so the campaign row survives the LEFT JOIN).
// campaign_status_totals emits NO rows in the same situation — it aggregates
// pledge_balances directly, and there is nothing to group. Callers reading both must
// handle that asymmetry; both behaviours are covered by tests.
const CAMPAIGN_TOTALS = (securityInvoker) => `
CREATE VIEW campaign_totals ${securityInvoker ? 'WITH (security_invoker = true) ' : ''}AS
SELECT
  c.id                AS campaign_id,
  c.slug              AS slug,
  c.goal_amount       AS goal_amount,
  COUNT(b.pledge_id)  AS pledge_count,
  COUNT(DISTINCT b.member_id) AS donor_count,
  ${HOUSEHOLD_COUNT} AS household_count,
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
// need to see them, which is what getPledgeStats already does in JS today. The
// cancelled row still reports 0 outstanding_positive — a cancelled pledge owes
// nothing, so its unpaid remainder is not money anyone is waiting on.
//
// The column is named outstanding_positive, NOT outstanding, deliberately:
// campaign_totals.outstanding is the raw signed net (over-payments cancel out
// shortfalls) and campaign_totals.outstanding_positive is the clamped figure. This
// view only ever produces the clamped one, so it must carry the clamped name — one
// name per rule, across every view.
//
// household_count is NOT ADDITIVE across the status rows. One household can hold
// several pledges in different states and will then appear in several buckets, so
// summing this column over statuses overcounts and can exceed campaign_totals.
// household_count. Spec §7's paired "Donors" bar is exactly such a sum — it must
// either use pledge_count or be labelled per-bucket, never summed into a total.
//
// EMPTY DRIVE: no rows at all for a campaign with no pledges (nothing to group),
// where campaign_totals emits one all-zero row. See the note on that view.
const CAMPAIGN_STATUS_TOTALS = (securityInvoker) => `
CREATE VIEW campaign_status_totals ${securityInvoker ? 'WITH (security_invoker = true) ' : ''}AS
SELECT
  b.campaign_id       AS campaign_id,
  b.derived_status    AS status,
  COUNT(b.pledge_id)  AS pledge_count,
  ${HOUSEHOLD_COUNT} AS household_count,
  COALESCE(SUM(b.pledged_amount), 0) AS total_pledged,
  COALESCE(SUM(b.paid_amount), 0)    AS total_collected,
  COALESCE(SUM(CASE WHEN b.derived_status <> 'cancelled' AND b.remaining_amount > 0
                    THEN b.remaining_amount ELSE 0 END), 0) AS outstanding_positive
FROM pledge_balances b
LEFT JOIN members m ON m.id = b.member_id
GROUP BY b.campaign_id, b.derived_status
`;

async function shouldUseSecurityInvoker(queryInterface, transaction) {
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
    'SHOW server_version_num;', { transaction }
  );

  // FAIL LOUD, never open. If this parse yields NaN (driver shape changed, row
  // missing, column renamed) the old `parseInt(...) >= 150000` quietly returned
  // false and we shipped owner-run views that BYPASS the row-level security
  // 20260820000001-enable-rls-pledges.js exists to enforce — no error, no log.
  // A migration that dies is recoverable; a silently disabled security control is not.
  const parsed = parseInt(versionNum, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `pledgeViews: could not read the PostgreSQL server version from ` +
      `'SHOW server_version_num' (got ${JSON.stringify(versionNum)}). Refusing to ` +
      `guess: without security_invoker the pledge views run as their owner and ` +
      `bypass row-level security on pledges.`
    );
  }
  return parsed >= 150000;
}

// ONE TRANSACTION around the whole drop/create swap.
//
// The deploy pipeline runs `sequelize-cli db:migrate` while pm2 keeps serving. Run
// unwrapped, any request landing between a DROP VIEW and its CREATE VIEW gets
// `relation "campaign_totals" does not exist` → 500, including on the unauthenticated
// PledgeTracker path. Postgres DDL is transactional, so concurrent readers instead
// block on the lock for the length of the swap and then see the new definitions.
//
// CREATE OR REPLACE VIEW is not an option: household_count sits mid-column-list in
// campaign_totals and OR REPLACE only permits appending columns at the end.
//
// The signature is unchanged for the ~30 existing callers (tests/setup.js,
// global.recreatePledgeViews(), three migrations) — they pass a queryInterface and
// nothing else, and get their own transaction. Pass { transaction } only to join one
// the caller already owns.
async function createPledgeViews(queryInterface, { transaction } = {}) {
  if (transaction) return createViews(queryInterface, transaction);
  return queryInterface.sequelize.transaction((t) => createViews(queryInterface, t));
}

async function createViews(queryInterface, transaction) {
  const securityInvoker = await shouldUseSecurityInvoker(queryInterface, transaction);
  await dropViews(queryInterface, transaction);
  // security_invoker matters: in PG15 a view runs as its OWNER by default, which
  // would bypass the RLS we enabled on pledges. SQLite has no such concept.
  await queryInterface.sequelize.query(PLEDGE_BALANCES(securityInvoker), { transaction });
  await queryInterface.sequelize.query(CAMPAIGN_TOTALS(securityInvoker), { transaction });
  await queryInterface.sequelize.query(CAMPAIGN_STATUS_TOTALS(securityInvoker), { transaction });
}

async function dropPledgeViews(queryInterface, { transaction } = {}) {
  if (transaction) return dropViews(queryInterface, transaction);
  return queryInterface.sequelize.transaction((t) => dropViews(queryInterface, t));
}

// Dropped dependents-first: campaign_totals and campaign_status_totals both select
// from pledge_balances.
async function dropViews(queryInterface, transaction) {
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS campaign_status_totals;', { transaction });
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS campaign_totals;', { transaction });
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS pledge_balances;', { transaction });
}

module.exports = { createPledgeViews, dropPledgeViews };
