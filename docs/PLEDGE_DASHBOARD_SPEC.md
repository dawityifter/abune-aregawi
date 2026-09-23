# Pledge Drive Reporting — Design Spec

**Status:** agreed 2026-09-21. No code written against it yet.
**Scope:** an executive view of pledge-drive performance, without disturbing the
existing operational donor table.

This spec records decisions and the reasoning behind the non-obvious ones. It is the
document the implementation plans argue from.

---

## 1. Problem

The executive layer already exists in the database. `campaign_totals`
(`backend/src/database/pledgeViews.js`) computes total pledged, total collected,
outstanding, pledge count, donor count and percent-to-goal per campaign, and
`GET /api/pledge-campaigns` already ships it.

It is rendered as a right-aligned run of text on a campaign **editing** card
(`FundraisingCampaigns.tsx`), on a screen gated to admins — while the donor table a
treasurer actually works in (`TreasurerPledges.tsx`) lives in a different dashboard and
shows no totals at all, not even a footer.

So the problem is placement and assembly, not missing capability:

> The campaign is split across two dashboards by role, and the numbers landed on the
> wrong side of the split.

Two things genuinely do not exist: a **participation denominator** and a **time
dimension**.

## 2. Confirmed inputs

| Question | Answer |
|---|---|
| 2026 fundraising goal | **$100,000** |
| Participation denominator | **Households** |
| 2025 drive | **Reference point, not a benchmark** |
| Offline record of 2025 monthly collections | **None exists** |
| 2026 pledges with `member_id IS NULL` | **Yes — anonymous donors** |
| 2025 `pledges.created_at` | **Real pledge date**, not import date |
| Current 2026 scale | **120+ pledges, growing** |

Open: which specific roles map to the leadership (no-names) tier — see §8.

## 3. Data constraints that shape the design

**The 2025 drive cannot support most year-over-year comparison.** Every 2025 row has
`is_historical = true`, so `pledge_balances` credits it as
`legacy_status = 'fulfilled' ? full amount : 0`. Consequences:

- Every 2025 pledge is binary — 100% paid or 0% paid. A partial-payment comparison
  returns zero for 2025 by construction.
- 2025 has no `goal_amount`. Goal progress is undefined, not zero.
- 2025 has no allocations, therefore no `transactions.payment_date`. **There is no 2025
  collections curve and no way to build one** — confirmed, no offline record either.
- **Windows are near-identical — verified against the database, not the seed migration.**
  2025: Sep 13 2025 – Jan 12 2026. 2026: Sep 1 2026 – Dec 31 2026. **Both 122 days**, both
  autumn drives, offset about twelve days in the calendar. An earlier draft of this spec
  read the seed migration and claimed 2026 ran Jan 1 – Dec 31 (365 days); the campaign was
  edited after seeding, and that claim was wrong. This materially *helps* the comparison —
  see §6.
- Six members hold duplicate 2025 pledges (up to 3 each), so pledges ≠ donors.

**What survives as honest comparison:** total pledged, total collected, outstanding,
pledge count, donor count, overall fulfillment %, fully-paid and never-paid counts —
plus a **cumulative-pledged curve**, because 2025 `created_at` is a real pledge date.

**`donor_count` is wrong.** `COUNT(DISTINCT b.member_id)` skips SQL NULLs, so every
anonymous pledge is counted in `pledge_count` and invisible in `donor_count`. Those two
numbers already disagree in production and nothing labels why.

**`member_id` is a person, not a household.** A spouse or promoted dependent pledges
against their own member row. The household key is `COALESCE(family_id, id)` — the
pattern already established at `backend/src/controllers/statementController.js:20`
(`member.family_id || member.id`), with `family_id IS NULL` meaning implicit head.

**Over-payment already occurs.** `remaining_amount` goes negative and is currently
clamped ad hoc in one UI file. The rule must be defined once, centrally.

**`total_collected` is allocated money, not campaign income.** A payment that arrived
and was never allocated to a pledge is invisible here. This must be stated in the UI or
the dashboard will be blamed the first time it disagrees with the ledger.

## 4. Information architecture

**One page: executive band above, operational table below, same scroll. KPI cards and
distribution segments act as filters on the table.**

Rejected — separate dashboard route: in a parish this size the treasurer and the board
chair are often the same three people in one meeting. A navigation step between "how are
we doing" and "who hasn't paid" breaks the most valuable interaction: see a number,
click it, see the names behind it.

Rejected — drill-down-only: the table is the treasurer's daily job. Burying it inverts
the priority for the person who uses the page most, and a second drill-down pattern
would duplicate the existing `CampaignDonors` panel.

**Prerequisite consolidation:**

- **Treasurer dashboard → Pledges tab** becomes the single campaign page (executive band
  + operational table), open to the existing `viewRoles`.
- **Admin dashboard → Fundraising** keeps campaign *configuration* only. Strip the
  inline totals; link across instead. Setting up a drive and monitoring one are
  different jobs on different clocks.
- `CampaignDonors` retires, or reduces to the read-only historical view.

## 5. Executive band

**Band 1 — identity + money bar.** Campaign name, status pill, window, "Day 22 of 122 ·
100 days remaining". Then one full-width stacked horizontal bar:

```
[■ Collected ■][░ Outstanding ░][   gap to goal   ]
0                                          Goal $100,000
                    ▲ pace marker
```

Answers "how much pledged / collected / outstanding / % of goal / on track" in one
glance with no reading. Pledged is the first two segments summed.

**Band 2 — four KPI cards.** Four, not eight; each card costs about a second of the
10–15 second budget.

| Card | Primary | Secondary |
|---|---|---|
| Collected | `$38,400` | `needs $545/day for 100 days` |
| Outstanding | `$12,100` | `across 47 donors` |
| Participation | `94 of 310 households (30%)` | `+ 26 anonymous gifts` |
| Fulfillment | `76%` | `of pledged dollars received` |

Excluded, with reasons: **total pledged** (already the width of the money bar); **average
pledge** (a mean over a giving distribution is dominated by two or three large gifts —
show median in the distribution panel if wanted, or better, top-decile concentration);
**pledge count** (differs from donors only by duplicates — operational); **goal** (belongs
on the bar it scales); **year-over-year** (see §6).

**Band 3 — two half-width panels.** Fulfillment breakdown (left), needs attention
(right).

### Pace marker must be factual, not evaluative

$100,000 against the $61,599 collected by the 2025 drive is roughly **1.6× over the same
122-day window** — a real stretch in daily terms, not a gentler one spread over a longer
year as an earlier draft of this spec assumed.

But the live data cuts the other way, and the design has to survive both cases. At day 22
of 122 the drive has already collected $45,581 — about **2.5× linear pace**, and 74% of
what the whole 2025 drive collected. A marker calibrated on the assumption that a stretch
goal means "behind all year" would be wrong today in the opposite direction, and a green
light held for three months is as uninformative as a red one.

So the marker stays **factual rather than evaluative**, which is correct whichever side of
pace the drive sits on:

- Neutral tick plus a factual caption: "linear pace at day 22 would be $18,000".
- Replace the verdict with the action: **required run-rate** on the Collected card. When
  the drive is ahead, that number falls and says so without a congratulatory colour.
- Reserve amber/red for the final 30 days — in a 122-day drive, not 60.
- Show pledged-vs-goal as well as collected-vs-pledged: the first is the recruitment
  question, the second is the follow-up question.

### Participation must not force anonymous gifts into the rate

An anonymous gift is by design not attributable to a household, so it cannot enter the
numerator without inventing one — and should not, since the rate measures known
participation. It must not vanish either. Hence two numbers on one card. This is the
only reading that reconciles to `pledge_count`.

- Numerator: distinct `COALESCE(m.family_id, m.id)` over active members with ≥1
  non-cancelled pledge (`campaign_totals.household_count`).
- Denominator: `COUNT(DISTINCT COALESCE(family_id, id)) WHERE is_active = true`
  (`countActiveHouseholds()` in `backend/src/services/pledgeCampaignService.js`).

**Invariant: the numerator and the denominator must agree on BOTH the household key
and the `is_active` scope.** Either disagreement pushes participation above 100% —
counting only `family_id IS NULL` in the denominator drops every self-pointing head
while the numerator still counts it, and omitting `is_active` from the numerator
leaves a deactivated donor in the top of a fraction they are absent from the bottom
of (measured: 2/1 = 200%). Both halves are asserted against each other in
`backend/tests/unit/campaignTotalsHouseholds.test.js`.

**Unverified:** how populated `family_id` actually is in production. If it was added but
rarely filled, nearly every member reads as an implicit head and "households" silently
collapses to "members" — a denominator that looks precise and is not. One read-only
query settles it; until it passes, the card says "members".

## 6. Year-over-year

**A collapsed strip below the fold, framed as a reference point. Not a hero, not a
grouped-bar chart.**

Bullet-bar table over the seven comparable figures, with:

1. Asymmetry in the column headers themselves — "2026 (in progress, day 22 of 122)" vs
   "2025 (final, 122-day drive)". Never let a bar imply parity the caption has to walk
   back.
2. A **persistent** comparability notice, not a dismissible tooltip.
3. **Omit** uncomputable rows rather than rendering zero. No goal-progress row, no
   partial-payment row. A zero bar reads as "we did badly", not "we don't know" — the
   most dangerous failure mode in the design.
4. Never render 2025 on a collections time chart. There is no 2025 collections series.
5. In-progress column styled differently (lighter/hatched) so the eye does not read two
   finished things.
6. **No delta arrows or percentages for this pairing.** "▼ 37% behind" is technically
   true and substantively false when one drive is finished and the other is mid-flight.

### The one curve that is defensible

**Cumulative pledged by day-of-campaign, 2026 vs 2025** — real dates on both sides, no
reconstruction. 2025's line stops at day 122 where the drive ended; that truncation is
the honest visual and needs no apology.

Two captions, visible and not hidden in a tooltip:

- **This is pledging, not collections.** Axis label "cumulative pledged". Same chart
  shape either way, so a reader who assumes otherwise draws the wrong conclusion.
- **Seasonal alignment is good, not a problem.** Both drives are 122-day autumn
  campaigns offset by about twelve days (2025: Sep 13 – Jan 12; 2026: Sep 1 – Dec 31),
  so day-of-campaign comparison lines up nearly like-for-like. The only real caveat is
  that 2025's tail ran into January and 2026's does not, so the last ~12 days of the
  2025 curve cover a different part of the giving calendar. Note it; do not hedge the
  whole chart over it. (An earlier draft called this "apples-to-oranges" on the strength
  of the wrong 2026 window — see §3.)

Because the two windows line up, the cumulative-pledged curve is the strongest element
of the year-over-year section — not a grudging concession. Give it the space §6's
bullet-bar table would otherwise take.

### Forward design

Build the comparison payload with a capability flag —
`comparable: { goal, timing, collections, partial }` — that the UI reads to decide what
to render. Gate the collections-pace overlay on `NOT is_historical` on both sides. From
2027, when both drives have allocation-backed data, it lights up with no rewrite.
**Design it now, ship it dark.**

## 7. Charts

Four visual elements. Each earns its place against a question a number answers slower.

1. **Money bar** (§5) — stacked horizontal with pace marker. A donut would be strictly
   worse: it cannot put the goal on an axis, and part-to-whole against a target is what
   a bar axis is for.
2. **Fulfillment breakdown — paired stacked bars, not a donut.**

   ```
   Donors   [ Fully paid 71 ][ Partial ][ Not started 47 ]
   Dollars  [ Fully paid $38,400 ][ ][ Not started $12,100 ]
   ```

   The insight is the **misalignment between the two bars**: "40% of our donors haven't
   paid, but they're only 24% of our dollars" is an executive conclusion no KPI card and
   no donut can deliver. A single donut forces a choice between count and amount, and
   whichever you pick is wrong half the time.
3. **Monthly collections — single-series columns, current campaign only**, optional
   cumulative line. Hidden entirely for historical campaigns rather than rendered empty.
4. **The year-over-year bullet-bar table** (§6).

Rejected: donut/pie for status (loses the count-vs-dollars insight); gauge/speedometer
(large footprint, one number, worse precision than the money bar); KPI sparklines (no
per-metric history exists); cohort/retention (needs three years).

## 8. Access tiers

Three tiers. **Tier 1 is not a filtered tier 2** — it is its own component with an
explicit field allowlist. A filtered view fails open: every metric added to the
dashboard later leaks downward by default, and eventually one of them shouldn't.

| Tier | Audience | Contents |
|---|---|---|
| 1 | Public / member | Goal, raised, progress, days remaining, **and their own pledge** |
| 2 | Leadership, no names | Full executive band: participation, fulfillment %, status counts, pace, attention summary |
| 3 | Treasurer / admin | Tier 2 + donor table + anonymity piercing (as today) |

### Role mapping (RESOLVED 2026-09-22)

**Tier 2 (aggregates, no donor names): `ap_team`**, alongside the other view roles that
carry no edit rights — `church_leadership`, `secretary`, `auditor`, `budget_committee`.

**Tier 3 (aggregates + donor table): `admin`, `treasurer`, `bookkeeper`, `ar_team`.**

The original answer put `bookkeeper` and `ar_team` in tier 2 as well. They were moved to
tier 3 because `pledgeRoutes.js:58` already grants them `editRoles` — they can change a
pledge amount and cancel a pledge, which is impossible without knowing whose pledge it
is. The governing principle: **if you can change a record, you can see it.** `ap_team`
holds no edit rights and maps to tier 2 cleanly.

Rejected alternatives: stripping `bookkeeper`/`ar_team` from `editRoles` to make the
original mapping coherent (removes a capability someone may rely on, and is a bigger
change than this plan warrants); and applying the tier to the dashboard band only while
leaving the donor table on today's roles (hides names above the fold and shows them below
it, on one screen, to the same user).

Historical note — the conflict this resolves:
`pledgeRoutes.js:58` defines `editRoles = ['admin', 'treasurer', 'bookkeeper', 'ar_team']`,
so `bookkeeper` and `ar_team` can already `PUT /api/pledges/:id` — change a pledge amount
and cancel a pledge. A no-names tier makes that work impossible: you cannot correct or
cancel a specific pledge without knowing whose it is. Hiding the table in the UI while
the API still permits the write is a product incoherence, not a security control.

### Deferred: tier 2 on the monthly and year-over-year series (2026-09-22)

`GET /:id/monthly` and `GET /:id/compare` are restricted to tier 3 for now, not tiered
down to tier 2 like the dashboard snapshot. Both payloads carry a running cumulative
(month-over-month collections; day-over-day cumulative pledged), and small-number
suppression does not protect a cumulative series — a suppressed point is recoverable
from the delta between its unsuppressed neighbours. Safely exposing either series to
tier 2 requires coarsening (weekly buckets, or a campaign-wide minimum bucket size),
which is a design question for the dashboard UI plan, not a privacy patch. This is a
deliberate restriction recorded here, not an oversight — widening it later, once a
coarsening design exists, is straightforward.

### Known residual: a campaign with one non-empty status bucket (2026-09-22)

Suppression of small status buckets uses **complementary suppression** — when one bucket
would be withheld from tier 2, a second is withheld with it, so the residual against the
visible campaign total resolves to a *sum* of two buckets rather than one identifiable
figure. That closes the reconstruction path in the ordinary case.

It does not close one edge, and cannot. When only **one** status bucket is non-empty —
most plausibly at launch, when every pledge is `not_started` and nothing has been paid —
that bucket's total *is* the campaign total. Suppressing the bucket row blanks a number
the headline figure still displays. There is no arrangement that hides a value identical
to one that must remain visible, short of suppressing the campaign totals themselves,
which would blank the dashboard's headline figures for a coincidental reason.

Recorded so this is not later mistaken for full closure. The exposure is narrow: it
reveals a campaign-wide aggregate that tier 2 is already entitled to see, not any
individual's amount — a single-bucket campaign discloses "everyone is in this state",
not who or how much each gave. If that changes, the remedies are a minimum campaign size
before any breakdown is returned to tier 2, or moving the breakdown to tier 3 as the two
series were.

### Why the executive dashboard must not go to members

Not primarily privacy — it is the wrong document for that audience.

- **Participation rate is a shaming metric in member hands.** Descriptive social norms
  motivate when the majority complies and can work in reverse when it does not.
  "30% of households have pledged" is not a neutral fact, it is a message — and in a
  parish of ~310 households it invites the question of who the other 216 are.
- **Fulfillment % reads as an accusation** — a management signal to send reminders
  becomes "people here don't keep their promises".
- **Pace against a stretch goal demoralizes at scale** — a steady drip of "behind" to
  the whole congregation probably depresses giving.
- **The attention queue is pure operational content** and re-identifying at this scale.

### Privacy rules

Removing names is not removing identity. At 310 households and 120 pledges:

- **Small buckets identify people.** "47 not started" is safe; "2 over-paid by $340" is
  functionally a name to anyone who knows the parties.
- **Deltas leak individual gifts.** This already applies to the existing public tracker:
  a member watching daily sees collected jump $5,000 and has learned a $5,000 gift
  landed. Cross-referenced with who was thanked, that is attribution.
- **Anonymous donors are most exposed.** The schema works hard here — `maskAnonymousPledge`,
  piercing limited to admin/treasurer, and the sharp catch that an online anonymous gift
  carries the cardholder's legal name. "26 anonymous gifts totaling $X" narrows the
  field; at n=2 it publishes an individual amount with extra steps.

Adopt:

1. **Small-number suppression** — any count or amount derived from fewer than 5 pledges
   renders "—" on every non-privileged tier. One threshold, enforced centrally.
2. **Round public money to the nearest $500** and refresh daily rather than live. Closes
   the delta channel for nothing — nobody reads a thermometer to the dollar.
3. **Never expose the anonymous count or total below tier 2.**
4. **Tighten the existing endpoint.** `status_breakdown` counts currently pass the
   unauthenticated path in `pledgeRoutes.js`. They belong behind auth + role, leaving
   only goal-progress figures public. Worthwhile independent of the member view.
5. **Point transparency at the right instrument** — periodic financial reporting and the
   ledger, which are complete and reviewed. "We publish the annual financials, not live
   operational dashboards" is a defensible and generous position.
6. **Write the tiering down and get it board-ratified.** "Why can't I see this?" is a
   pastoral conversation; a one-paragraph policy answers it better than a permission
   error.

### The strongest member-facing element is not an aggregate

It is their own pledge — "You pledged $500 · You've given $300 · $200 remaining ·
[Give now]". Personal, actionable, zero privacy surface, and the thing that converts.
`PledgeBalance`, `usePledgeBalance` and `GET /api/pledges/balance` (which already lets a
member read their own record without a view role) are the machinery. It is the hero of
the member view; campaign progress is context beneath it.

## 9. Operational table

Keep: donor, pledged, paid, outstanding, status, edit, cancel.

Add — arguably higher value than the dashboard, and required at 120+ rows:

- Sort on every numeric column and name; **search**; **status filter chips** wired to
  the dashboard; **pagination or virtualization** (required at launch, not deferrable).
- `percent_fulfilled` and `last_payment_at` — both already in `pledge_balances`, both
  unused by the table today. `last_payment_at` is what makes "stalled" visible.
- `payment_methods` — already fetched by `fetchCampaignDonors` and never rendered.
- `is_historical` badge — currently only suppresses a button; it should be visible,
  because those figures cannot be traced to a transaction.
- `is_anonymous` indicator — returned and unused.
- **Column totals footer** reconciling to the dashboard. If they ever disagree, show it.
- CSV export — otherwise treasurers rebuild this in a spreadsheet and the dashboard has
  a competitor.

Fix: translate the status enums (`not_started`, `partially_fulfilled` currently print
raw, in a bilingual app); move edit/cancel out of inline row expansion — it currently
shifts every row below — into a side panel or modal.

Do not add: goal, campaign totals, year-over-year or charts. The only aggregate that
belongs in the table is the footer that proves it reconciles.

## 10. Filtering and drill-down

- Clicking any KPI card or distribution segment **filters the table** and scrolls to it;
  a removable chip appears above it.
- The active filter is **visibly reflected in the band** — selected segment ringed,
  others dimmed. A user must never wonder whether the top numbers describe the rows
  below.
- **Filter state in the URL** (`?campaign=3&status=not_started`). Treasurers share links;
  a board member should open exactly what was discussed.
- Campaign selector is global to the page, defaults to the live drive, and **disables**
  the time chart and attention panel for closed/historical drives rather than rendering
  them empty.
- Attention items link into the filtered table, never a separate view.
- No sticky-shrinking of the band; a compact sticky summary strip is acceptable.

**Attention panel** — each row a count and a link: stalled (partially paid, no payment in
60+ days via `last_payment_at`); never started past some fraction of the window;
over-paid (negative outstanding); unlinked (`member_id IS NULL`, invisible to automatic
allocation and to the member's own dues banner); ending soon (within 30 days).

## 11. Mistakes to avoid

1. **"$0" or "0%" where the answer is "unknown."** Render "—" with a reason.
2. **Treating `total_collected` as campaign income.** Define it in a tooltip on day one:
   "payments allocated to pledges in this drive".
3. **Deltas on incommensurable comparisons** (§6).
4. **A goal bar when no goal is set.** 2026 has one now; other drives may not. Design the
   empty state — "No goal set · Set goal →" for admins, hidden otherwise.
5. **Counting pledges where you mean households** (§3, §5).
6. **Color carrying meaning alone.** Must survive a colorblind reader and a printed board
   packet — pair with label and shape.
7. **Tigrigna text expansion.** KPI labels and status chips run 20–40% longer. Cards grow
   vertically; never fix label heights or truncate a KPI label.
8. **Operational alerts dressed as executive metrics.** "3 unlinked pledges" is a chore,
   not a leadership metric.
9. **Auto-refresh.** `PledgeTracker` deliberately removed it. Numbers shifting under a
   board discussion is worse than slightly stale ones. Show "as of HH:MM" + manual
   refresh.
10. **Negative outstanding shown raw.**
11. **Shipping the dashboard and leaving the table unsorted.** The dashboard gets the
    praise; the unsorted 120-row table gets the daily complaints.

## 12. Implementation phasing

Five plans, each producing working testable software on its own:

| # | Plan | Depends on |
|---|---|---|
| 1 | **Data & metric integrity** — household rollup, anonymous-aware counts, status aggregation, central over-payment rule | — |
| 2 | Executive read API + access tiering | 1 |
| 3 | Executive dashboard UI | 2 |
| 4 | **Operational table upgrades** — sort/search/filter/pagination | — (independent) |
| 5 | Member tier + public endpoint tightening | 2 |

Plan 1 is the prerequisite for every number on the dashboard. Plan 4 is independent of
all of it and is the most immediate relief for the treasurer; it can run in parallel.
