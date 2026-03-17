# Payment Overview Redesign — Design

**Date:** 2026-02-28
**Status:** Approved

## Goal

Redesign the Payment Overview tab on the `/treasurer` page so that both financial health (income vs expenses) and membership dues collection carry equal visual weight, all metrics are clearly labelled with church-appropriate language, and the treasurer can view data for any past year.

---

## Problems with the Current Design

1. **No year context** — numbers appear with no indication of what period they cover.
2. **"Net Income" beside "Total Collected" as sibling hero cards** — users see two dollar amounts with no explanation of how they relate.
3. **The progress bar on "Total Collected" is always 100%** — communicates nothing.
4. **"Collection Rate (Dues Only)" qualifier is hardcoded in JSX** — sits awkwardly and the term "dues" is unexplained.
5. **"Active Givers" vs "Up to Date" vs "Behind"** — three overlapping membership counts with unclear distinctions.
6. **`outstandingAmount`** — calculated by the backend but never shown on screen.
7. **Business terminology** — "Net Income" and "Total Collected" are appropriate for a business, not a church.

---

## Layout

### Page Header

```
Financial Overview                                    [2026 ▼]
                                    [+ Add Payment] [+ Add Expense]
```

- Title: "Financial Overview" (static)
- Year selector: dropdown defaulting to current calendar year, listing all years that have payment records. Changing it re-fetches stats for that year.
- Existing "Add Payment" and "Add Expense" action buttons stay in place.

---

### Top Row — Two Hero Cards

```
┌──────────────────────┐  ┌──────────────────────────────────────────┐
│ 🏦 Bank Balance      │  │  Annual Dues Progress              72%   │
│ $12,400              │  │  ████████████████░░░░░░                  │
│ Updated Feb 28       │  │  $14,400 collected of $20,000 goal       │
│                      │  │  $5,600 still outstanding                │
│                      │  │  ──────────────────────────────────      │
│                      │  │  Other Income                  $4,100    │
└──────────────────────┘  └──────────────────────────────────────────┘
```

**Card 1 — Bank Balance** (unchanged)
- Blue gradient card; current bank balance + last reconciliation date.
- No changes to this card.

**Card 2 — Annual Dues Progress + Other Income**
- Large animated progress bar showing `collectionRate`%
- "$X,XXX collected of $Y,YYY goal" — surfacing the annual dues target (`totalAmountDue`)
- "$X,XXX still outstanding" — surfacing `outstandingAmount` (currently unused)
- Divider
- "Other Income: $X,XXX" — `otherPayments` (non-dues contributions)

---

### Main Content — Two Equal Panels

```
┌─────────────────────────────┬──────────────────────────────────────┐
│  FINANCIAL HEALTH           │  DUES & MEMBER STATUS                │
│                             │                                      │
│  Total Receipts  $18,500 ↑  │  Membership Dues                     │
│                             │  $14,400 collected · $5,600 owed     │
│  Total Expenses  $15,300 ↓  │                                      │
│  ───────────────────────    │  Other Donations    $4,100            │
│  Year-to-Date Balance       │  ──────────────────────────────      │
│  +$3,200    [Surplus]       │  ✓ 45  Fully Paid                    │
│                             │  ⚠ 12  Behind on Dues                │
│                             │  ○ 57  Active Members                │
└─────────────────────────────┴──────────────────────────────────────┘
```

**Left panel — Financial Health**
- Total Receipts (`totalCollected`) — green with ↑ icon
- Total Expenses (`totalExpenses`) — red with ↓ icon
- Horizontal divider
- Year-to-Date Balance (`netIncome`) — large, bold; green "+$X,XXX [Surplus]" or red "-$X,XXX [Deficit]"

**Right panel — Dues & Member Status**
- Membership Dues: "$X,XXX collected · $X,XXX outstanding" (`totalMembershipCollected` / `outstandingAmount`)
- Other Donations: `otherPayments`
- Horizontal divider
- ✓ `upToDateMembers` Fully Paid (green)
- ⚠ `behindMembers` Behind on Dues (amber/red)
- ○ `totalMembers` Active Members (gray)

---

## Terminology Changes

| Current Label | New Label | Reason |
|---|---|---|
| Net Income | Year-to-Date Balance | A church isn't a business |
| Total Collected | Total Receipts | More formal, less ambiguous |
| Collection Rate (Dues Only) | Annual Dues Progress + % | Progress bar label; qualifier removed |
| Up to Date | Fully Paid | Clearer intent |
| Behind | Behind on Dues | More specific |
| Active Givers | Active Members | Less confusing |
| Surplus / Deficit | Kept as-is | Already clear |

---

## Backend Changes

### Year Filtering

Both backends must accept an optional `year` query parameter on the stats endpoint.

**Node.js** (`backend/src/controllers/memberPaymentController.js` or similar):
- `GET /api/payments/stats?year=2025`
- When `year` is provided, scope all aggregations (totals, counts, rates) to that calendar year
- When `year` is absent, default to the current calendar year (not all-time)
- Add a companion endpoint or extend the existing one to return the list of distinct years that have payment records: `GET /api/payments/stats/years` → `{ years: [2024, 2025, 2026] }`

**Java** (`java` branch):
- Same `year` query parameter on `GET /api/payments/stats`
- Same `GET /api/payments/stats/years` endpoint

### `outstandingAmount`

Already returned in the stats response. No backend change needed — it just needs to be rendered in the frontend.

---

## Frontend Changes

### `TreasurerDashboard.tsx`

- Add `selectedYear` state, defaulting to `new Date().getFullYear()`
- Add `availableYears` state, populated from `GET /api/payments/stats/years`
- Pass `year` param when fetching stats: `GET /api/payments/stats?year=${selectedYear}`
- Render a `<select>` year dropdown in the page header
- Pass `selectedYear` label into the page title area

### `PaymentStats.tsx`

- Rewrite layout to match the two-panel design above
- Add `outstandingAmount` to the props interface (it's in the existing API response)
- Apply all terminology changes
- Remove the meaningless 100%-always green progress bar on Total Collected
- Progress bar uses `collectionRate` for width (already correct)

### `dictionaries.ts`

Add/update i18n keys under `treasurerDashboard`:
- `stats.pageTitle` — "Financial Overview" / "ናይ ፋይናንስ ሓጺር መግለጺ"
- `stats.yearLabel` — "Year" / "ዓመት"
- `stats.totalReceipts` — "Total Receipts" / "ጠቕላሊ እቶት"
- `stats.ytdBalance` — "Year-to-Date Balance" / "ናይ ዓመት ሰነድ"
- `stats.surplus` — "Surplus" / "ትርፊ"
- `stats.deficit` — "Deficit" / "ጉድለት"
- `stats.annualDuesProgress` — "Annual Dues Progress" / "ናይ ዓመት ኣባልነት ክፍሊት"
- `stats.collected` — "collected" / "ተኣኪቡ"
- `stats.outstanding` — "still outstanding" / "ዝተረፈ"
- `stats.otherIncome` — "Other Income" / "ካልእ እቶት"
- `dues.membershipDues` — "Membership Dues" / "ናይ ኣባልነት ክፍሊት"
- `dues.otherDonations` — "Other Donations" / "ካልእ ሽልማታት"
- `dues.fullyPaid` — "Fully Paid" / "ብምሉኡ ከፊሉ"
- `dues.behindOnDues` — "Behind on Dues" / "ዕዳ ኣለዎ"
- `dues.activeMembers` — "Active Members" / "ንጡፋት ኣባላት"

---

## Out of Scope

- Charts or graphs (bar chart of monthly income over time)
- Month-by-month breakdown within the selected year
- Comparison between years side by side
- Export to PDF/CSV from the overview tab

