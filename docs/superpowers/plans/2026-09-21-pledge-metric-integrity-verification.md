# Verification — pledge metric integrity

Run after the deploy pipeline has applied
`20260921120000-pledge-dashboard-metric-views.js`. All queries are READ-ONLY.
Do not run anything that writes against a DATABASE_URL containing supabase.com.

## 1. Is family_id actually populated?

The blocking question from the spec. If almost every active member has a NULL
family_id, then household_count equals the member count and the participation
card must say "members", not "households".

This query mirrors `countActiveHouseholds()`
(`backend/src/services/pledgeCampaignService.js`) expression for expression, so it
returns the same verdict the shipped code returns. `linked_members` in particular
requires `family_id <> id`: a self-pointing head has a non-null family_id and links
nobody, so counting it as "linked" would report "populated" on exactly the table
where the service reports `familyIdPopulated: false`.

    SELECT
      COUNT(*) AS active_members,
      COUNT(DISTINCT COALESCE(family_id, id)) AS households,
      SUM(CASE WHEN family_id IS NULL THEN 1 ELSE 0 END) AS implicit_heads,
      SUM(CASE WHEN family_id IS NOT NULL AND family_id <> id THEN 1 ELSE 0 END)
        AS linked_members
    FROM members WHERE is_active = true;

Interpretation:

- `households` is the ACTUAL participation denominator the dashboard will divide by
  — not a proxy for it. Record this number.
- `linked_members = 0` means `familyIdPopulated` is false: nobody is attached to
  anybody, every member reads as their own household, and the participation card
  must say "members".
- `households = active_members` is the same signal from the other side.

Report the numbers back before Plan 3 builds the participation card.

## 2. Do the new counts diverge as expected?

    SELECT campaign_id, slug, pledge_count, donor_count, household_count,
           anonymous_pledge_count, anonymous_collected
    FROM campaign_totals ORDER BY campaign_id;

Expected for the 2026 drive: pledge_count > donor_count (anonymous pledges are
in the first and not the second), and household_count <= donor_count.

`household_count == donor_count` is NOT by itself evidence of an unpopulated
family_id. It also happens legitimately whenever no two donors in the drive share a
family_id — a drive of 40 unrelated givers produces it with family_id fully
populated. Query 1 is the test; this is only a prompt to go run it.

`household_count` also excludes donors who have since been deactivated
(`members.is_active = false`), matching the denominator. A drop against a previously
recorded figure can mean deactivations, not a bug.

## 3. Is there real over-payment?

    SELECT slug, outstanding, outstanding_positive, overpaid_amount
    FROM campaign_totals ORDER BY campaign_id;

Any non-zero overpaid_amount confirms the clamp is load-bearing and belongs in
the attention panel (spec §10).

## 4. Does the status breakdown reconcile?

    SELECT campaign_id, status, pledge_count, household_count,
           total_pledged, total_collected, outstanding_positive
    FROM campaign_status_totals ORDER BY campaign_id, status;

Summing total_pledged across every status EXCEPT 'cancelled' must equal
campaign_totals.total_pledged for that campaign. A mismatch means the cancelled
filter diverged between the two views.

`outstanding_positive` carries the same name as the campaign_totals column because
it obeys the same rule (clamped at zero). There is no `outstanding` column here —
that name means the raw signed net, and this view does not produce it. The
'cancelled' row reports 0: a cancelled pledge owes nothing.

**`household_count` is NOT additive down this column.** One household holding two
pledges in different states appears in two rows, so summing the column overcounts
and can exceed `campaign_totals.household_count`. Spec §7's paired "Donors" bar is
exactly such a sum — build it from `pledge_count`, or label each segment per bucket
and never print a total.

Expected for the 2025 drive: no 'partially_fulfilled' row at all. Every 2025
pledge is is_historical and therefore binary (spec §3). Its absence is correct,
not a bug.

## 5. Are the views running as the invoker (PG15+ only)?

`security_invoker = true` is what keeps these views honouring the row-level security
`20260820000001-enable-rls-pledges.js` enables on `pledges`. Without it a view runs
as its OWNER and reads straight past RLS — silently, with correct-looking numbers.

    SELECT relname, reloptions FROM pg_class
    WHERE relname IN ('pledge_balances','campaign_totals','campaign_status_totals');

On PostgreSQL 15 or newer (production/Supabase is), all three rows must show
`{security_invoker=true}` in `reloptions`. A NULL or missing option on any of them
means the migration ran against a server it could not identify as PG15+, or against
a genuinely older one — investigate before trusting anything the dashboard shows to
a non-admin. On pre-15 servers the clause is a hard syntax error and is correctly
absent; the views are owner-run there, which is why pre-15 is not a supported
production configuration.
