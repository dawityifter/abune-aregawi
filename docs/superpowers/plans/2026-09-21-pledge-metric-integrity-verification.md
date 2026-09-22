# Verification — pledge metric integrity

Run after the deploy pipeline has applied
`20260921120000-pledge-dashboard-metric-views.js`. All queries are READ-ONLY.
Do not run anything that writes against a DATABASE_URL containing supabase.com.

## 1. Is family_id actually populated?

The blocking question from the spec. If almost every active member has a NULL
family_id, then household_count equals the member count and the participation
card must say "members", not "households".

    SELECT
      COUNT(*) AS active_members,
      SUM(CASE WHEN family_id IS NULL THEN 1 ELSE 0 END) AS implicit_heads,
      SUM(CASE WHEN family_id IS NOT NULL THEN 1 ELSE 0 END) AS linked_members
    FROM members WHERE is_active = true;

Interpretation: linked_members near zero means family_id was never filled in.
Report the numbers back before Plan 3 builds the participation card.

## 2. Do the new counts diverge as expected?

    SELECT campaign_id, slug, pledge_count, donor_count, household_count,
           anonymous_pledge_count, anonymous_collected
    FROM campaign_totals ORDER BY campaign_id;

Expected for the 2026 drive: pledge_count > donor_count (anonymous pledges are
in the first and not the second), and household_count <= donor_count. If
household_count equals donor_count exactly, cross-check against query 1.

## 3. Is there real over-payment?

    SELECT slug, outstanding, outstanding_positive, overpaid_amount
    FROM campaign_totals ORDER BY campaign_id;

Any non-zero overpaid_amount confirms the clamp is load-bearing and belongs in
the attention panel (spec §10).

## 4. Does the status breakdown reconcile?

    SELECT campaign_id, status, pledge_count, household_count,
           total_pledged, total_collected, outstanding
    FROM campaign_status_totals ORDER BY campaign_id, status;

Summing total_pledged across every status EXCEPT 'cancelled' must equal
campaign_totals.total_pledged for that campaign. A mismatch means the cancelled
filter diverged between the two views.

Expected for the 2025 drive: no 'partially_fulfilled' row at all. Every 2025
pledge is is_historical and therefore binary (spec §3). Its absence is correct,
not a bug.
