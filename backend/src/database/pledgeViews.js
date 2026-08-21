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

const PLEDGE_BALANCES = (securityInvoker) => `
CREATE VIEW pledge_balances ${securityInvoker ? 'WITH (security_invoker = true) ' : ''}AS
SELECT
  p.id                AS pledge_id,
  p.campaign_id       AS campaign_id,
  p.member_id         AS member_id,
  p.amount            AS pledged_amount,
  COALESCE(SUM(CASE WHEN t.status = 'succeeded' THEN a.amount ELSE 0 END), 0) AS paid_amount,
  p.amount - COALESCE(SUM(CASE WHEN t.status = 'succeeded' THEN a.amount ELSE 0 END), 0) AS remaining_amount,
  CASE WHEN p.amount > 0
       THEN ROUND(COALESCE(SUM(CASE WHEN t.status = 'succeeded' THEN a.amount ELSE 0 END), 0) * 100.0 / p.amount, 1)
       ELSE 0 END AS percent_fulfilled,
  CASE
    WHEN p.lifecycle = 'cancelled' THEN 'cancelled'
    WHEN COALESCE(SUM(CASE WHEN t.status = 'succeeded' THEN a.amount ELSE 0 END), 0) <= 0 THEN 'not_started'
    WHEN COALESCE(SUM(CASE WHEN t.status = 'succeeded' THEN a.amount ELSE 0 END), 0) >= p.amount THEN 'fulfilled'
    ELSE 'partially_fulfilled'
  END AS derived_status,
  MAX(CASE WHEN t.status = 'succeeded' THEN t.payment_date ELSE NULL END) AS last_payment_at
FROM pledges p
LEFT JOIN pledge_allocations a ON a.pledge_id = p.id
LEFT JOIN transactions t ON t.id = a.transaction_id
GROUP BY p.id, p.campaign_id, p.member_id, p.amount, p.lifecycle
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

async function createPledgeViews(queryInterface) {
  const isPg = queryInterface.sequelize.getDialect() === 'postgres';
  await dropPledgeViews(queryInterface);
  // security_invoker matters: in PG15 a view runs as its OWNER by default, which
  // would bypass the RLS we enabled on pledges. SQLite has no such concept.
  await queryInterface.sequelize.query(PLEDGE_BALANCES(isPg));
  await queryInterface.sequelize.query(CAMPAIGN_TOTALS(isPg));
}

async function dropPledgeViews(queryInterface) {
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS campaign_totals;');
  await queryInterface.sequelize.query('DROP VIEW IF EXISTS pledge_balances;');
}

module.exports = { createPledgeViews, dropPledgeViews };
