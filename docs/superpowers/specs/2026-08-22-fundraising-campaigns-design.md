# Fundraising Campaigns — Design Spec

**Date:** 2026-08-22
**Status:** Approved for planning
**Scope:** Let an admin create and run a fundraising campaign (name, description,
start/end dates, goal amount); surface a home-page link to the pledge page only
while a campaign is running; scope the pledge tracker to that campaign.

Builds directly on `2026-08-20-pledge-modernization-design.md`, which created the
`pledge_campaigns` table and its API. This spec adds the operator-facing half:
the UI to create campaigns and the date-driven wiring that makes them visible.

---

## 1. Problem

The pledge modernization work landed the campaign schema and endpoints, but
nothing uses them:

| Gap | Evidence |
|---|---|
| No way to create a campaign | No frontend calls `/api/pledge-campaigns` at all |
| Dates drive nothing | `listActive` filters on `status='active'` only; `start_date`/`end_date` are never compared |
| Campaign selection is a stopgap | `pledgeController.js:58` — *"Campaign selection UI is a later task; for now, use whichever campaign is open, most recent first"* |
| Tracker is unscoped | `GET /api/pledges/stats` has no campaign filter, so the public tracker totals **all 149 pledges** including the 2025 drive |
| Home page link is unconditional | The QuickLinks pledge card renders year-round |

Both seeded campaigns (`2025-pledge-drive`, `2026-pledge-drive`) are still
`draft`, which is why `/api/pledge-campaigns/active` returns `[]`.

**Goal.** An admin defines a drive and its dates; the church website reflects it
automatically, and the tracker reports that drive's progress toward its goal.

---

## 2. What is reused

| Asset | Role |
|---|---|
| `pledge_campaigns` table + model | Already carries `name`, `name_ti`, `description`, `description_ti`, `start_date`, `end_date`, `goal_amount`, `currency`, `status` |
| `POST` / `PATCH /api/pledge-campaigns` | Admin-only create and update, incl. `activity_logs` on status change |
| `GET /api/pledge-campaigns/active` | Public endpoint with a deliberate explicit attribute allow-list |
| `campaign_totals` view + `CampaignTotal` model | `total_pledged`, `total_collected`, `outstanding`, `pledge_count`, `donor_count`, `percent_to_goal` per campaign |
| `config/timezone.js` | `America/Chicago` and a `YYYY-MM-DD` formatter |
| `AdminDashboard` tab pattern | Union-typed `activeTab` + hash sync + lazy-loaded panels |
| `incomeCategoryApi.ts` | The established `getIdToken()` → `Authorization: Bearer` client pattern |

**No schema change is required.** This is wiring plus one admin screen.

---

## 3. The "live campaign" rule

A campaign is **live** when all hold:

```
status = 'active'
AND start_date <= today
AND (end_date IS NULL OR end_date >= today)
```

`today` is `YYYY-MM-DD` computed in **`America/Chicago`** using the existing
`config/timezone.js` helper. UTC would flip a drive off during the final Dallas
evening; `end_date` is inclusive, so the last day counts. A NULL `end_date` means
an open-ended drive, which the column already permits.

### 3.1 One definition, server-side

The rule lives in exactly one exported helper — proposed
`services/pledgeCampaignService.js#findLiveCampaign()` — used by `/active`,
pledge creation, and stats scoping.

Evaluated on the server, never in the browser:

- a client clock set wrong would otherwise show or hide the drive incorrectly;
- a second implementation in TypeScript would drift from the SQL one.

The browser receives the answer ("here is the live campaign, or none"), not the
inputs to recompute it.

### 3.2 Why `status` survives alongside dates

Dates alone cannot express "prepared but not yet announced." `status` stays the
deliberate switch — `draft` while an admin fills in copy and a goal, `active`
when it should go live, `closed` to freeze it as history — while the dates remove
the need for anyone to remember to turn it off when the drive ends.

---

## 4. One live campaign at a time

Enforced on **every write whose result would be an `active` campaign overlapping
another `active` campaign** — three paths, not two:

- `POST /api/pledge-campaigns` with `status: 'active'`
- `PATCH /api/pledge-campaigns/:id` setting `status: 'active'`
- `PATCH /api/pledge-campaigns/:id` moving `start_date`/`end_date` on a campaign
  that is **already** active

The third path is easy to miss and would otherwise be a silent hole: an admin
widens a live campaign's window until it swallows another live one. The check
therefore runs against the campaign's *post-update* state, not the request body.

Reject with **409** when another **`active`** campaign's `[start_date, end_date]`
window intersects the candidate's. `draft` and `closed` campaigns never conflict,
so next year's drive can be staged while this year's runs.

Overlap, with NULL `end_date` treated as "no upper bound":

```
a.start <= COALESCE(b.end, 'infinity') AND b.start <= COALESCE(a.end, 'infinity')
```

The 409 body names the conflict so the admin can act:

```json
{ "success": false, "code": "CAMPAIGN_OVERLAP",
  "message": "2026 Pledge Drive (2026-01-01 – 2026-12-31) is already active for these dates." }
```

### 4.1 Why app-layer, not a database constraint

A Postgres `EXCLUDE USING gist (daterange(...) WITH &&)` would be race-proof, but
the backend test suite runs on `sqlite::memory:`, which has no such constraint —
the same portability rule that shaped the views (parent spec §3.4), and the same
choice already made for read-only enforcement (parent spec decision #4).

**Accepted limitation:** two admins activating overlapping campaigns in the same
instant could both pass the check. Activation is admin-only and rare; the
consequence is a visible duplicate on the home page, not corrupted money. Noted
rather than defended — if it ever happens, the constraint is the fix.

### 4.2 Known overlap in seeded data

`2025-pledge-drive` (2025-09-13 → 2026-01-12) and `2026-pledge-drive`
(2026-01-01 → 2026-12-31) overlap on Jan 1–12, 2026. Both are `draft`, so nothing
conflicts today, but activating 2025 while 2026 is active will be refused. That
is correct: the parent spec freezes 2025 as history.

---

## 5. API changes

### 5.1 `GET /api/pledge-campaigns/active` (public) — date-filtered

Applies §3's rule and returns **at most one** campaign. Response shape is
unchanged (`{ success, campaigns: [...] }`, still the explicit
`PUBLIC_ATTRIBUTES` allow-list) so nothing that reads it today breaks; the array
simply holds 0 or 1 entries.

**Defensive ordering:** §4's enforcement is new, so it cannot retroactively fix
rows activated before it existed. If the query somehow matches more than one, the
endpoint orders by `start_date DESC` and returns the first rather than erroring —
the public home page must not break because of a data state an admin created.

**Totals are deliberately NOT joined into this endpoint.** The controller carries
an explicit warning against joining `campaign_totals` so a future column addition
cannot silently leak financial or donor data through a public, unauthenticated
route. That warning stands.

### 5.2 `GET /api/pledges/stats` (public aggregate) — campaign filter

Gains an optional `campaign_id` query parameter, applied as a `where` on the
included `Pledge`. Everything else — the `detail=true` auth gate, the aggregate
shape — is unchanged.

**The default stays "all campaigns."** Changing the unfiltered response would
alter an existing contract for any staff caller; the public tracker passes
`campaign_id` explicitly instead.

`goal_amount` for the progress bar comes from `/active`, which already returns
it — no new endpoint, and the public surface gains no field it did not have.

### 5.3 Pledge creation binds to the live campaign

`createPledge`'s stopgap (`status != 'closed'`, most recent first) is replaced by
`findLiveCampaign()`. With no live campaign it returns the existing **503**
("Pledges are not currently being accepted").

**Any client-supplied `campaign_id` is ignored.** The server resolves it. A
crafted request must not be able to attach a pledge to a different drive —
particularly a `draft` one, which the current `isOpen` check would have allowed.

---

## 6. Admin UI — "Fundraising" tab

A new lazy-loaded tab in `AdminDashboard`, matching the existing union-typed
`activeTab` + `window.location.hash` pattern and the API's admin-only guard.

**List:** name, window, goal, status, and totals from `campaign_totals`
(`total_pledged`, `total_collected`, `percent_to_goal`), newest first.

**Create / edit form:**

| Field | Notes |
|---|---|
| `name`, `name_ti` | Both offered — the home card renders in the visitor's language |
| `description`, `description_ti` | Same |
| `start_date`, `end_date` | `end_date` optional (open-ended); validated `end >= start` |
| `goal_amount` | Optional; drives the progress bar |
| `slug` | Auto-derived from `name` (kebab-case, uniqueness-checked), editable |
| `currency` | Defaults `usd` |
| `default_payment_type` | Defaults `pledge_drive`, per parent spec §5.1 |
| `income_category_id` | Optional selector via the existing `incomeCategoryApi` |

**Status transitions:** `draft → active → closed`, with the 409 overlap message
surfaced inline. Closing is presented as irreversible in the UI, since the parent
spec's `requireOpenCampaign` rejects all writes to a closed campaign.

New `ti` strings are drafted and flagged in `tigrigna-translation-review.md`, per
the standing convention.

---

## 7. Public frontend wiring

### 7.1 `useActiveCampaign()` hook

One client-side source of truth: fetches `/api/pledge-campaigns/active`
(unauthenticated), returns `{ campaign | null, loading, error }`. Consumed by the
home card, the pledge page, and the tracker so they cannot disagree.

### 7.2 Home page card — conditional

The QuickLinks pledge card renders **only** when a campaign is live, titled from
the campaign's own `name` / `name_ti` with its `description` as the card body, so
new drives need no code change to appear.

**Fails closed:** while loading, and on any fetch error, the card renders
nothing. A broken card is worse than no card on the parish home page.

### 7.3 `/pledge` page

With no live campaign, the form and tracker are replaced by an explanatory empty
state ("No fundraising drive is currently running"), rather than a form whose
submission would 503. The `/pledges → /pledge` redirect is unaffected.

### 7.4 `PledgeTracker`

Scoped to the live campaign via `campaign_id`, and gains a **progress-toward-goal**
bar driven by `goal_amount`. This is what stops the 2025 drive's $70,119 from
appearing on the 2026 tracker.

The tracker's existing `eventName` prop sent `event_name` to the stats endpoint,
filtering on the legacy free-text column. It is replaced by `campaign_id` — the
tracker stops sending `event_name` entirely.

Scope is precise here: **`PledgePage` keeps its `?event=` URL parameter**, which
also drives the page's hero heading, and `PledgeForm` keeps its free-text field.
Only the tracker's own filtering changes. The `event_name` column is untouched —
see §9.

---

## 8. Testing

TDD. Backend on `sqlite::memory:`, frontend RTL. **All fixtures synthetic** —
CLAUDE.md forbids real member data in tests, and campaign fixtures are exactly
where a production row would be tempting to paste.

| Layer | Pins down |
|---|---|
| `findLiveCampaign` (unit) | Day before start → not live; first day → live; last day → live; day after end → not live; NULL `end_date` → live; `draft`/`closed` in-window → not live |
| Timezone (unit) | A campaign ending today is still live at 23:00 America/Chicago (the UTC-rollover bug) |
| Overlap (unit) | Adjacent windows allowed; overlapping rejected 409; overlap with a `draft` allowed; NULL `end_date` treated as unbounded |
| Campaign API (integration) | Create/patch require admin (401 unauthenticated, 403 for a member); `/active` stays public and returns ≤ 1 |
| Stats scoping (integration) | Two campaigns with distinct pledges → `?campaign_id=` returns only that campaign's totals; omitted → unchanged all-campaign total |
| Pledge creation (integration) | Binds to the live campaign; client-supplied `campaign_id` ignored; 503 when none live |
| Home card (RTL) | Renders with a live campaign; renders nothing when none, while loading, and on fetch error |
| Tracker (RTL) | Renders one campaign's totals and goal progress; the no-detail response shape from the current fix still renders |
| Admin tab (RTL) | Create flow posts the right body; overlap 409 surfaces inline |

---

## 9. Out of scope

Deliberately excluded, to keep this shippable:

- **Retiring `PledgeForm`'s free-text `event_name`** (parent spec §8.4). Independent cleanup; the column stays.
- **Member `/my-pledge` page** and the **treasurer pledges tab** — parent spec §7, already assigned to later plans.
- **Stripe auto-allocation, refunds, disputes** — parent spec §6, later plan.
- **Multiple concurrent campaigns.** Explicitly rejected: one at a time, enforced. Revisiting means a featured flag and a home page that lists several.
- **Activating a campaign as part of this work.** Both seeded campaigns stay `draft`; going live is an operator decision made through the new UI.

---

## 10. Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Live = `active` **and** in date window | Dates automate visibility; status keeps deliberate control over announcement |
| 2 | `today` in `America/Chicago` | UTC ends the drive early on its final evening |
| 3 | Rule evaluated server-side, one helper | Client clocks are untrusted; two implementations drift |
| 4 | One live campaign, app-layer 409 | `EXCLUDE` constraints do not exist on the SQLite test dialect; matches existing precedent |
| 5 | Totals stay out of the public `/active` | Preserves the deliberate anti-leak allow-list on an unauthenticated route |
| 6 | `campaign_id` filter on `/stats`, default unchanged | Scopes the tracker without breaking an existing contract |
| 7 | Server ignores client `campaign_id` on pledge creation | Prevents attaching a pledge to a `draft` or unintended drive |
| 8 | Home card fails closed | A broken card on the parish home page is worse than no card |
| 9 | Campaign copy comes from the DB, bilingual | New drives need no code change or deploy |
| 10 | No schema change | The parent spec's table already carries every field requested |

## 11. Open items

- **Tigrigna** for the new admin and home-card strings needs native review before launch (`tigrigna-translation-review.md`).
- **2026 goal amount** still unchosen — carried over from the parent spec, now enterable through the admin UI.
- **Activation timing** is an operator decision: activating `2026-pledge-drive` today makes it live immediately, since 2026-08-22 falls inside its window.
