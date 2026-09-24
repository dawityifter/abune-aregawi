# Pledge Executive Dashboard UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the executive band — money bar, KPI row, fulfilment breakdown, attention panel, and the two below-the-fold charts — above the existing donor table on the Treasurer dashboard's Pledges tab, so leadership can read the state of the drive in 10–15 seconds.

**Architecture:** A typed API client per Plan 2's three endpoints, a set of pure presentational chart primitives built from CSS and inline SVG (no charting library), and one container that assembles them and owns fetching. The container mounts above `TreasurerPledges` on the existing Pledges tab — no new route. Every figure the API may suppress renders as an em dash with an explanation, never as zero.

**Tech Stack:** React 19 + TypeScript 4.9 (CRA 5), Tailwind with the repo's "Brana" tokens, Jest + React Testing Library, the custom `useLanguage()` i18n (EN/TI).

**Spec:** `docs/PLEDGE_DASHBOARD_SPEC.md` — §4 (information architecture), §5 (executive band), §6 (year-over-year), §7 (charts), §8 (access tiers), §10 (filtering and drill-down), §11 (mistakes to avoid), §13 (desktop wireframe), §14 (mobile). This is Plan 3 of 5. Plans 1 and 2 are complete on this branch.

## Global Constraints

- **A suppressed figure is `null` from the API and renders as `—`, never `0`.** Spec §11 rule 1. Zero and unknown are different answers, and conflating them is the single most dangerous failure in this design. Every numeric render path goes through the shared formatter in Task 1.
- **`/monthly` and `/compare` are restricted to tier-3 roles** (`admin`, `treasurer`, `bookkeeper`, `ar_team`) — Plan 2 ruling 15. A tier-2 caller gets **403**. The UI must treat that as an expected state with an explanation, not an error toast.
- **No charting library.** These charts are stacked bars, a column series and bullet bars — CSS widths and inline SVG. Adding a dependency to CRA 5 for this geometry is unjustified bundle cost.
- **Use the Brana tokens** — `primary`, `secondary`, `accent`, `neutral`, `tsaeda` from `tailwind.config.js`. Never raw Tailwind palette colors (`blue-700`, `gray-200`, `amber-500`). `PaymentStats.tsx` nearby uses raw colors; that is drift, not the pattern to copy.
- **Every user-visible string needs `en` and `ti` entries** in `src/i18n/dictionaries.ts`, plus its key on the TypeScript interface. The file has three parallel blocks — the interface, `en`, and `ti`. All three.
- **Tigrigna runs 20–40% longer than English.** Cards grow vertically; never fix a label's height, never truncate a KPI label.
- **Money is formatted with `Intl.NumberFormat`, `maximumFractionDigits: 0`**, matching `TreasurerPledges.tsx:19-22`.
- **Numbers use IBM Plex Sans (`font-sans`)** — the token file states it ships tabular figures, which a ledger app needs. Headings use Literata (`font-serif`).
- Never real member PII in tests or fixtures. These components render aggregates only; no donor names reach them.
- Frontend tests: `npm test` from `frontend/`, colocated in `__tests__/`.

---

## Design plan

The frontend-design process asks for a token plan, then a review pass against the brief before building. Both are below. **This section is binding on the implementation, not commentary.**

### Color

The repo already has a distinctive, documented system — "Brana", drawn from Ge'ez manuscript illumination and Tigray rock-church fresco. The design brief here is therefore *extend an existing identity*, not invent one. The generic-AI-design checklist flags warm-cream-plus-serif-plus-terracotta as a tell; that is precisely this palette, and it is **pre-existing, culturally grounded, and documented in `tailwind.config.js` with its contrast ratios**. It predates this work and wins. Do not "modernise" it.

| Role | Token | Hex |
|---|---|---|
| Page ground | `neutral-50` (brana) | `#ede7d9` |
| Card surface | `accent-50` (wax) | `#fbf8f1` |
| Ink / figures | `accent-700` | `#241f19` |
| Muted labels | `accent-500` | `#6f6557` |
| Hairlines | `accent-200` | `#e3dbc9` |
| **Money received** | `tsaeda-600` | `#2e5e5a` |
| **Money promised, not received** | `tsaeda-300` | `#8db3ae` |
| **Not yet pledged (gap to goal)** | `accent-200` + hairline | `#e3dbc9` |
| Genuine alert only | `primary-700` | `#9e2b25` |

**Encode by value and texture, not hue.** This is a measured conclusion, not a preference. Running the palette validator against the system's own ramps:

```
#3c7a74,#c89a3c,#cfc4ac  → FAIL  chroma floor (tsaeda 0.065, accent 0.035 — read gray)
                            FAIL  normal-vision ΔE 14.1 on #cfc4ac↔#c89a3c (below the 15 floor)
#3c7a74,#a99c88          → PASS  CVD 13.5, normal 18.1; FAIL chroma floor on both
#25514d,#b8842b,#9e2b25  → PASS  CVD 18.2, normal 21.5, contrast; FAIL lightness band
```

The tsaeda and accent ramps fail the categorical chroma floor at **every step** — they read gray by construction, because a muted fresco palette is the system's deliberate character. It cannot supply three saturated categorical hues, and forcing it to would mean conscripting `primary` (vermilion), which the system reserves for actions.

That constraint points the same way the data does. Fulfilled → partially fulfilled → not started is **ordinal**, and so is collected → outstanding → gap-to-goal: both are progressions of certainty, so a single-hue sequential ramp is the correct form regardless of palette. Value and texture also survive the **printed board packet**, which hue does not.

Where two series must be told apart (year-over-year), the prior year is the reference, not an equal peer: current is solid `tsaeda-600`, prior is `accent-400` with a 45° hatch. That pair passes CVD (13.5) and normal-vision (18.1); its chroma FAIL and contrast WARN are answered by the mitigations the validator requires — hatch texture, a legend, and direct labels, all of which this design already carries.

**Considered and rejected:** the system's `borderRadius.arch` (the Aksumite window silhouette, "allowed on at most one element per page") on the money bar. The money bar is the page's one hero element, so it is where that device would go — but arching a stacked bar's top edge distorts the geometry that encodes the value. Mark geometry beats decoration. The arch is not used on this page.

### Type

One family per job, both already in the system:

- **Figures and data labels: IBM Plex Sans** (`font-sans`). The token file's own reason — tabular figures — is exactly why a column of money must use it.
- **Headings and the campaign name: Literata** (`font-serif`). It gives the band the feel of a document rather than an app chrome, which suits something printed and tabled at a board meeting.
- **Tigrigna: Noto Serif Ethiopic / Noto Sans Ethiopic** (`font-tigrigna`, `font-tigrigna-sans`), already wired.

Scale from the system's own `fontSize` tokens. The hero figure is the only thing allowed above `h2`.

### Layout

Spec §13's wireframe, at a 12-column grid, max width ~1280px, left-aligned throughout — a ledger reads left-aligned, and centring financial figures makes columns impossible to scan.

```
┌────────────────────────────────────────────────────────────┐
│ 2026 Pledge Drive   ● Active                               │  campaign header
│ Sep 1 – Dec 31 · Day 22 of 122 · 100 days remaining        │
│                                                            │
│ $0                                            Goal $100,000│
│ ┌──────────────┬────────┬──────────────────────────────┐   │  THE HERO
│ │███ received ██│░ owed ░│        not yet pledged       │   │  money bar
│ └──────────────┴────────┴──────────────────────────────┘   │
│                    ▲ linear pace, day 22                   │
├──────────┬──────────┬──────────────┬───────────────────────┤
│ RECEIVED │   OWED   │ PARTICIPATION│     FULFILMENT        │  4 KPI cards
├──────────┴──────────┴──────┬───────┴───────────────────────┤
│ FULFILMENT BREAKDOWN       │ NEEDS ATTENTION               │
│  Households ▓▓▓▒▒░░░       │  12 stalled              →    │
│  Dollars    ▓▓▓▓▓▓▒░       │  47 never started        →    │
├────────────────────────────┴───────────────────────────────┤
│ ▸ Monthly collections                      (tier 3 only)   │  collapsed
│ ▸ Compared with 2025                       (tier 3 only)   │  collapsed
├────────────────────────────────────────────────────────────┤
│ ALL PLEDGES — the existing TreasurerPledges table          │
└────────────────────────────────────────────────────────────┘
```

The two paired breakdown bars share one category order and one x-scale so the **misalignment between them is the insight** — "40% of our households, 24% of the money" is legible by looking down the page, not by reading two numbers.

### Principles

1. **One hero.** The money bar is the memorable element. Everything else is quiet: hairline borders, one elevation, no gradients, no card shadows competing for attention.
2. **An unknown is never a zero.** `—` with a reason, everywhere, always.
3. **Factual, not evaluative.** No red/green verdicts on pace. A neutral tick and a stated number; the drive is currently at 2.5× linear pace and a design tuned to scold would be wrong today in the opposite direction.
4. **Prints legibly in grayscale.** Value and texture carry meaning; hue only reinforces.
5. **No motion.** A board reads this on a projector. Nothing animates, nothing fades in.

### Review pass against the brief

Three things in the first draft were defaults rather than choices, and are revised above:

- **Three categorical hues for the status breakdown** — revised to a sequential ramp. The validator proved the palette cannot support it, and the data is ordinal anyway, so the original was wrong twice over.
- **Card shadows on every panel** — the SaaS-card kit. Revised to hairline borders on one flat elevation; the system defines only two elevations and reserves the raised one for things that genuinely float.
- **A red/amber/green pace indicator** — revised to a neutral marker. It is the generic dashboard default, the spec forbids it, and on today's data it would read green for three months and inform nobody.

---

## File structure

| File | Responsibility |
|---|---|
| `frontend/src/utils/pledgeDashboardApi.ts` | **new** — typed fetchers + response types for the three endpoints; the shared `formatFigure` suppression-aware formatter. |
| `frontend/src/components/admin/dashboard/MoneyBar.tsx` | **new** — the hero stacked bar with the pace marker. Pure. |
| `frontend/src/components/admin/dashboard/DistributionBars.tsx` | **new** — the paired households/dollars bars. Pure. |
| `frontend/src/components/admin/dashboard/KpiCard.tsx` | **new** — one card; the row is composed in the container. Pure. |
| `frontend/src/components/admin/dashboard/AttentionPanel.tsx` | **new** — the five counts, each a filter trigger. Pure. |
| `frontend/src/components/admin/dashboard/MonthlyCollections.tsx` | **new** — inline-SVG column series. Pure. |
| `frontend/src/components/admin/dashboard/YearOverYear.tsx` | **new** — bullet-bar table + the pledging curve. Pure. |
| `frontend/src/components/admin/PledgeDashboard.tsx` | **new** — the container: fetches, composes, owns filter state. |
| `frontend/src/components/admin/TreasurerDashboard.tsx` | modify — mount the container above `TreasurerPledges`. |
| `frontend/src/i18n/dictionaries.ts` | modify — strings, in all three blocks. |

Presentational components take data and callbacks only — no fetching, no context — so each is testable by rendering it with props. The container is the only piece that knows about HTTP.

---

### Task 1: API client, types, and the suppression-aware formatter

Everything downstream depends on two things: the response types Plan 2 actually returns, and one formatter that cannot accidentally print a suppressed figure as zero.

**Files:**
- Create: `frontend/src/utils/pledgeDashboardApi.ts`
- Test: `frontend/src/utils/__tests__/pledgeDashboardApi.test.ts`

**Interfaces:**
- Consumes: nothing — first task.
- Produces:
  - Types `DashboardSnapshot`, `MonthlySeries`, `Comparison` (shapes below).
  - `fetchDashboard(campaignId: number): Promise<DashboardSnapshot>`
  - `fetchMonthly(campaignId: number): Promise<MonthlySeries | null>` — **`null` on 403**, which is the expected tier-2 response, not an error.
  - `fetchComparison(campaignId: number, priorId: number): Promise<Comparison | null>` — same 403 contract.
  - `formatFigure(value: number | null, kind: 'money' | 'count' | 'percent'): string` — returns `'—'` for `null`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/__tests__/pledgeDashboardApi.test.ts`:

```ts
import { formatFigure, fetchDashboard, fetchMonthly } from '../pledgeDashboardApi';

jest.mock('../../firebase', () => ({
  auth: { currentUser: { getIdToken: async () => 'test-token' } }
}));

describe('formatFigure', () => {
  // The whole point of the formatter. A suppressed figure and a real zero are
  // different answers, and rendering the first as the second is the single
  // most misleading thing this dashboard could do.
  it('renders a suppressed figure as an em dash, never as zero', () => {
    expect(formatFigure(null, 'money')).toBe('—');
    expect(formatFigure(null, 'count')).toBe('—');
    expect(formatFigure(null, 'percent')).toBe('—');
  });

  it('renders a real zero as zero', () => {
    expect(formatFigure(0, 'money')).toBe('$0');
    expect(formatFigure(0, 'count')).toBe('0');
    expect(formatFigure(0, 'percent')).toBe('0%');
  });

  it('formats money without cents', () => {
    expect(formatFigure(45581, 'money')).toBe('$45,581');
    expect(formatFigure(45581.62, 'money')).toBe('$45,582');
  });

  it('formats counts and percentages', () => {
    expect(formatFigure(1234, 'count')).toBe('1,234');
    expect(formatFigure(84.6, 'percent')).toBe('84.6%');
    expect(formatFigure(60, 'percent')).toBe('60%');
  });
});

describe('fetchDashboard', () => {
  afterEach(() => { (global.fetch as jest.Mock)?.mockRestore?.(); });

  it('returns the dashboard payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, dashboard: { campaign: { id: '2' } } })
    }) as any;

    const result = await fetchDashboard(2);
    expect(result.campaign.id).toBe('2');
  });

  it('throws with the server message on failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ success: false, message: 'Failed to build the pledge dashboard' })
    }) as any;

    await expect(fetchDashboard(2)).rejects.toThrow('Failed to build the pledge dashboard');
  });
});

describe('fetchMonthly', () => {
  afterEach(() => { (global.fetch as jest.Mock)?.mockRestore?.(); });

  // 403 is what a tier-2 role gets by design — these two series are tier 3 only
  // because a cumulative cannot be protected by small-number suppression. It is
  // an expected state the UI explains, not a failure it reports.
  it('returns null on 403 rather than throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 403, json: async () => ({ success: false })
    }) as any;

    await expect(fetchMonthly(2)).resolves.toBeNull();
  });

  it('still throws on a genuine error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({ success: false, message: 'boom' })
    }) as any;

    await expect(fetchMonthly(2)).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/utils/__tests__/pledgeDashboardApi.test.ts`

Expected: FAIL — `Cannot find module '../pledgeDashboardApi'`.

- [ ] **Step 3: Write the client**

Create `frontend/src/utils/pledgeDashboardApi.ts`:

```ts
import { auth } from '../firebase';

/**
 * Types mirror the payloads Plan 2's endpoints return. A `number | null` field
 * is one the API may withhold: the server blanks any figure derived from fewer
 * than five pledges for callers who may not see donor detail. `null` means
 * "withheld", never "zero" — see formatFigure.
 */
export interface DashboardCampaign {
  id: string; slug: string; name: string; name_ti: string | null;
  start_date: string; end_date: string | null; status: string;
  goal_amount: number | null;
}

export interface DashboardTimeline {
  day: number; total_days: number | null;
  days_remaining: number | null; elapsed_fraction: number | null;
}

export interface DashboardMoney {
  pledged: number; collected: number; outstanding_owed: number;
  overpaid: number | null; goal: number | null;
  gap_to_goal: number | null; percent_to_goal: number | null;
  fulfillment_rate: number; linear_pace_target: number | null;
  required_run_rate: number | null;
}

export interface DashboardParticipation {
  households: number; active_households: number; rate: number;
  anonymous_pledges: number | null; anonymous_collected: number | null;
  family_id_populated: boolean;
}

export interface DashboardBreakdownRow {
  status: string;
  pledge_count: number | null; household_count: number | null;
  total_pledged: number | null; total_collected: number | null;
  outstanding_owed: number | null;
}

export interface DashboardAttention {
  stalled: number | null; never_started: number | null;
  overpaid: number | null; unlinked: number | null; ending_soon: boolean;
}

export interface DashboardSnapshot {
  campaign: DashboardCampaign;
  timeline: DashboardTimeline;
  money: DashboardMoney;
  participation: DashboardParticipation;
  breakdown: DashboardBreakdownRow[];
  attention: DashboardAttention;
  as_of: string;
}

export interface MonthlySeries {
  available: boolean;
  reason: string | null;
  partial_historical: boolean;
  months: Array<{ month: string; collected: number; cumulative: number }>;
}

export interface Comparison {
  comparable: { goal: boolean; collections: boolean; partial: boolean; pledging_curve: boolean };
  campaigns: {
    current: ComparisonWindow;
    prior: ComparisonWindow;
  };
  figures: Record<string, { current: number; prior: number }>;
  pledging_curve: {
    current: Array<{ day: number; cumulative_pledged: number }>;
    prior: Array<{ day: number; cumulative_pledged: number }>;
  };
}

export interface ComparisonWindow {
  id: string; slug: string; name: string;
  start_date: string; end_date: string | null;
  total_days: number | null; in_progress: boolean; day: number;
}

const BASE = `${process.env.REACT_APP_API_URL}/api/pledge-campaigns`;

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  return { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' };
}

const money = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
});
const count = new Intl.NumberFormat('en-US');

/**
 * The one place a figure becomes text.
 *
 * A withheld figure arrives as null and must render as an em dash. Rendering it
 * as "$0" would tell a reader that nothing is owed when the truth is that the
 * number is being protected — the most misleading thing this dashboard could
 * do, and the reason every numeric render path goes through here.
 */
export function formatFigure(value: number | null, kind: 'money' | 'count' | 'percent'): string {
  if (value === null || value === undefined) return '—';
  if (kind === 'money') return money.format(value);
  if (kind === 'count') return count.format(value);
  // Percentages keep one decimal only when they have one — "60%" reads better
  // than "60.0%" on a card, and "84.6%" must not round to "85%".
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

async function readError(response: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await response.json();
    if (body?.message) message = body.message;
  } catch {
    /* non-JSON error body: keep the fallback */
  }
  throw new Error(message);
}

export async function fetchDashboard(campaignId: number): Promise<DashboardSnapshot> {
  const response = await fetch(`${BASE}/${campaignId}/dashboard`, { headers: await authHeaders() });
  if (!response.ok) await readError(response, 'Failed to load the dashboard');
  return (await response.json()).dashboard;
}

/**
 * Returns null for 403. Both series carry a running cumulative, which
 * small-number suppression cannot protect — a hidden point is recoverable from
 * its neighbours' deltas — so they are restricted to roles that may see donor
 * detail. For everyone else a 403 is the designed answer, and the UI explains
 * it rather than reporting a failure.
 */
export async function fetchMonthly(campaignId: number): Promise<MonthlySeries | null> {
  const response = await fetch(`${BASE}/${campaignId}/monthly`, { headers: await authHeaders() });
  if (response.status === 403) return null;
  if (!response.ok) await readError(response, 'Failed to load monthly collections');
  return (await response.json()).series;
}

export async function fetchComparison(
  campaignId: number, priorId: number
): Promise<Comparison | null> {
  const response = await fetch(
    `${BASE}/${campaignId}/compare?to=${priorId}`, { headers: await authHeaders() }
  );
  if (response.status === 403) return null;
  if (!response.ok) await readError(response, 'Failed to load the comparison');
  return (await response.json()).comparison;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/utils/__tests__/pledgeDashboardApi.test.ts`

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/pledgeDashboardApi.ts frontend/src/utils/__tests__/pledgeDashboardApi.test.ts
git commit -m "feat(pledges): typed dashboard API client with a suppression-aware formatter

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The money bar

The page's one hero element, and the thing that has to answer "how are we doing" before anyone reads a word. A single stacked bar scaled to the goal: money received, money promised but not received, and the remaining gap — plus a neutral tick at linear pace.

**Files:**
- Create: `frontend/src/components/admin/dashboard/MoneyBar.tsx`
- Create: `frontend/src/components/admin/dashboard/__tests__/MoneyBar.test.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `formatFigure` from Task 1.
- Produces: `<MoneyBar money={DashboardMoney} timeline={DashboardTimeline} />`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/dashboard/__tests__/MoneyBar.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import MoneyBar from '../MoneyBar';
import { DashboardMoney, DashboardTimeline } from '../../../../utils/pledgeDashboardApi';

const money: DashboardMoney = {
  pledged: 53881, collected: 45581, outstanding_owed: 9000, overpaid: 700,
  goal: 100000, gap_to_goal: 54419, percent_to_goal: 45.6,
  fulfillment_rate: 84.6, linear_pace_target: 18033, required_run_rate: 545
};
const timeline: DashboardTimeline = {
  day: 22, total_days: 122, days_remaining: 100, elapsed_fraction: 0.18
};

const widthOf = (testId: string) => {
  const el = screen.getByTestId(testId);
  return parseFloat(el.style.width);
};

describe('MoneyBar', () => {
  it('scales each segment to the goal, not to the pledged total', () => {
    render(<MoneyBar money={money} timeline={timeline} />);
    // 45581/100000 and 9000/100000 — a bar scaled to `pledged` would show
    // ~85% received and mislead about progress toward the goal.
    expect(widthOf('moneybar-collected')).toBeCloseTo(45.581, 1);
    expect(widthOf('moneybar-outstanding')).toBeCloseTo(9, 1);
  });

  it('labels the segments with real figures', () => {
    render(<MoneyBar money={money} timeline={timeline} />);
    expect(screen.getByText('$45,581')).toBeInTheDocument();
    expect(screen.getByText('$9,000')).toBeInTheDocument();
    expect(screen.getByText(/\$100,000/)).toBeInTheDocument();
  });

  it('places the pace marker at the elapsed fraction of the goal', () => {
    render(<MoneyBar money={money} timeline={timeline} />);
    expect(parseFloat(screen.getByTestId('moneybar-pace').style.left)).toBeCloseTo(18, 0);
  });

  // Spec section 5: the marker is factual, never a verdict. The drive is
  // currently far ahead of pace; a design that only knows how to scold would
  // be wrong today in the opposite direction.
  it('states the pace figure without a pass or fail colour', () => {
    render(<MoneyBar money={money} timeline={timeline} />);
    const marker = screen.getByTestId('moneybar-pace');
    expect(marker.className).not.toMatch(/red|green|primary-700/);
  });

  it('renders without a goal, showing pledged and received only', () => {
    const noGoal = { ...money, goal: null, gap_to_goal: null,
      percent_to_goal: null, linear_pace_target: null, required_run_rate: null };
    render(<MoneyBar money={noGoal} timeline={timeline} />);
    expect(screen.queryByTestId('moneybar-pace')).not.toBeInTheDocument();
    expect(screen.getByTestId('moneybar-nogoal')).toBeInTheDocument();
  });

  it('never renders a negative or overflowing segment when collection exceeds the goal', () => {
    const over = { ...money, collected: 120000, gap_to_goal: 0 };
    render(<MoneyBar money={over} timeline={timeline} />);
    expect(widthOf('moneybar-collected')).toBeLessThanOrEqual(100);
    expect(widthOf('moneybar-gap')).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/dashboard/__tests__/MoneyBar.test.tsx`

Expected: FAIL — cannot resolve `../MoneyBar`.

- [ ] **Step 3: Write the component**

Create `frontend/src/components/admin/dashboard/MoneyBar.tsx`:

```tsx
import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DashboardMoney, DashboardTimeline, formatFigure } from '../../../utils/pledgeDashboardApi';

interface MoneyBarProps {
  money: DashboardMoney;
  timeline: DashboardTimeline;
}

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0;

/**
 * The one hero element on the page.
 *
 * Scaled to the GOAL, not to the pledged total: a bar scaled to pledged would
 * read ~85% full while the drive sits under half way to its target. Segments
 * are separated by a 2px surface gap so adjacent fills stay countable, and the
 * ordering is a progression of certainty — received, promised, neither — which
 * is why a single-hue sequential ramp carries it rather than three hues.
 *
 * The pace marker states a number and takes no view. Spec section 5.
 */
const MoneyBar: React.FC<MoneyBarProps> = ({ money, timeline }) => {
  const { t } = useLanguage();
  const hasGoal = money.goal != null && money.goal > 0;
  const scale = hasGoal ? (money.goal as number) : money.pledged;

  const collectedPct = pct(money.collected, scale);
  const outstandingPct = pct(money.outstanding_owed, scale);
  const gapPct = Math.max(0, 100 - collectedPct - outstandingPct);

  return (
    <section aria-label={t('pledgeDashboard.moneyBar.label')} className="mt-4">
      <div className="flex items-baseline justify-between text-caption text-accent-500 font-sans">
        <span>$0</span>
        {hasGoal ? (
          <span>
            {t('pledgeDashboard.moneyBar.goal')} {formatFigure(money.goal, 'money')}
          </span>
        ) : (
          <span data-testid="moneybar-nogoal">{t('pledgeDashboard.moneyBar.noGoal')}</span>
        )}
      </div>

      <div className="relative mt-1">
        <div className="flex h-10 w-full overflow-hidden rounded-md border border-accent-200 bg-accent-100">
          <div
            data-testid="moneybar-collected"
            style={{ width: `${collectedPct}%` }}
            className="h-full bg-tsaeda-600"
            title={`${t('pledgeDashboard.moneyBar.received')} ${formatFigure(money.collected, 'money')}`}
          />
          {/* 2px surface gap keeps adjacent fills countable rather than reading
              as one long block. */}
          <div style={{ width: outstandingPct > 0 ? '2px' : 0 }} className="h-full bg-accent-50" />
          <div
            data-testid="moneybar-outstanding"
            style={{ width: `${outstandingPct}%` }}
            className="h-full bg-tsaeda-300"
            title={`${t('pledgeDashboard.moneyBar.owed')} ${formatFigure(money.outstanding_owed, 'money')}`}
          />
          <div
            data-testid="moneybar-gap"
            style={{ width: `${gapPct}%` }}
            className="h-full bg-accent-200"
          />
        </div>

        {hasGoal && timeline.elapsed_fraction != null && (
          <div
            data-testid="moneybar-pace"
            style={{ left: `${timeline.elapsed_fraction * 100}%` }}
            className="absolute -top-1 h-12 w-px bg-accent-500"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-sans text-caption">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-tsaeda-600" aria-hidden="true" />
          <span className="text-accent-500">{t('pledgeDashboard.moneyBar.received')}</span>
          <strong className="text-accent-700">{formatFigure(money.collected, 'money')}</strong>
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-tsaeda-300" aria-hidden="true" />
          <span className="text-accent-500">{t('pledgeDashboard.moneyBar.owed')}</span>
          <strong className="text-accent-700">{formatFigure(money.outstanding_owed, 'money')}</strong>
        </span>
        {hasGoal && (
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-accent-200" aria-hidden="true" />
            <span className="text-accent-500">{t('pledgeDashboard.moneyBar.gap')}</span>
            <strong className="text-accent-700">{formatFigure(money.gap_to_goal, 'money')}</strong>
          </span>
        )}
      </div>

      {hasGoal && money.linear_pace_target != null && (
        <p className="mt-1 font-sans text-caption text-accent-500">
          {t('pledgeDashboard.moneyBar.paceNote', {
            day: String(timeline.day),
            amount: formatFigure(money.linear_pace_target, 'money')
          })}
        </p>
      )}
    </section>
  );
};

export default MoneyBar;
```

- [ ] **Step 4: Add the strings**

In `frontend/src/i18n/dictionaries.ts`, add a `pledgeDashboard` group to **all three blocks** — the TypeScript interface, `en`, and `ti`. For this task:

```ts
// interface
pledgeDashboard: {
  moneyBar: {
    label: string; goal: string; noGoal: string;
    received: string; owed: string; gap: string; paceNote: string;
  };
};
```

```ts
// en
pledgeDashboard: {
  moneyBar: {
    label: 'Progress toward the fundraising goal',
    goal: 'Goal',
    noGoal: 'No goal set for this drive',
    received: 'Received',
    owed: 'Still owed',
    gap: 'Not yet pledged',
    paceNote: 'Linear pace at day {day} would be {amount}'
  }
};
```

```ts
// ti
pledgeDashboard: {
  moneyBar: {
    label: 'ናብ ዕላማ ምእካብ ገንዘብ ዘሎ ኣፈጻጽማ',
    goal: 'ዕላማ',
    noGoal: 'ነዚ ወፈያ ዕላማ ኣይተቐመጠን',
    received: 'እተቐበለ',
    owed: 'ዝተረፈ',
    gap: 'ገና ዘይተመባጽዐ',
    paceNote: 'ብቐጥታዊ ኣሰራርሓ ኣብ መዓልቲ {day} {amount} ምዃኑ ይግመት'
  }
};
```

Follow the interpolation convention already used by `fundraising.alreadyPledged` in this file.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/dashboard/__tests__/MoneyBar.test.tsx`

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/dashboard/MoneyBar.tsx frontend/src/components/admin/dashboard/__tests__/MoneyBar.test.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat(pledges): money bar scaled to the goal, with a factual pace marker

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: KPI row and campaign header

Four cards and the line above them. The cards carry the numbers leadership acts on; three of the four can be withheld by the API, so every one of them must survive a `null`.

**Files:**
- Create: `frontend/src/components/admin/dashboard/KpiCard.tsx`
- Create: `frontend/src/components/admin/dashboard/CampaignHeader.tsx`
- Create: `frontend/src/components/admin/dashboard/__tests__/KpiCard.test.tsx`
- Create: `frontend/src/components/admin/dashboard/__tests__/CampaignHeader.test.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `formatFigure` from Task 1.
- Produces:
  - `<KpiCard label secondary value />` where `value: string` (already formatted) and `secondary?: string`.
  - `<CampaignHeader campaign={DashboardCampaign} timeline={DashboardTimeline} asOf={string} onRefresh={() => void} />`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/admin/dashboard/__tests__/KpiCard.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import KpiCard from '../KpiCard';

describe('KpiCard', () => {
  it('renders the label, value and secondary line', () => {
    render(<KpiCard label="Received" value="$45,581" secondary="needs $545/day for 100 days" />);
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('$45,581')).toBeInTheDocument();
    expect(screen.getByText('needs $545/day for 100 days')).toBeInTheDocument();
  });

  it('renders without a secondary line', () => {
    render(<KpiCard label="Received" value="$45,581" />);
    expect(screen.getByText('$45,581')).toBeInTheDocument();
  });

  // Tigrigna runs 20-40% longer than English. A fixed height would clip it.
  it('does not constrain its own height', () => {
    const { container } = render(<KpiCard label="ተቐቢሉ" value="$45,581" />);
    expect(container.firstChild).toHaveClass('h-full');
    expect((container.firstChild as HTMLElement).className).not.toMatch(/\bh-\d/);
  });

  it('renders a withheld value as the em dash it was given', () => {
    render(<KpiCard label="Overpaid" value="—" secondary="withheld to protect a small group" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
```

Create `frontend/src/components/admin/dashboard/__tests__/CampaignHeader.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CampaignHeader from '../CampaignHeader';
import { DashboardCampaign, DashboardTimeline } from '../../../../utils/pledgeDashboardApi';

const campaign: DashboardCampaign = {
  id: '2', slug: '2026-pledge-drive', name: '2026 Pledge Drive', name_ti: null,
  start_date: '2026-09-01', end_date: '2026-12-31', status: 'active', goal_amount: 100000
};
const timeline: DashboardTimeline = {
  day: 22, total_days: 122, days_remaining: 100, elapsed_fraction: 0.18
};

describe('CampaignHeader', () => {
  it('names the drive and states where it is in its window', () => {
    render(<CampaignHeader campaign={campaign} timeline={timeline}
      asOf="2026-09-22T23:57:07.481Z" onRefresh={jest.fn()} />);
    expect(screen.getByText('2026 Pledge Drive')).toBeInTheDocument();
    expect(screen.getByText(/22/)).toBeInTheDocument();
    expect(screen.getByText(/122/)).toBeInTheDocument();
  });

  it('omits the day count for an open-ended drive', () => {
    const openEnded = { ...campaign, end_date: null };
    const noTotal = { ...timeline, total_days: null, days_remaining: null, elapsed_fraction: null };
    render(<CampaignHeader campaign={openEnded} timeline={noTotal}
      asOf="2026-09-22T23:57:07.481Z" onRefresh={jest.fn()} />);
    expect(screen.queryByTestId('campaign-window')).not.toBeInTheDocument();
  });

  // Spec section 11 rule 9: numbers must not shift under a board discussion.
  it('shows an as-of time and refreshes only when asked', async () => {
    const onRefresh = jest.fn();
    render(<CampaignHeader campaign={campaign} timeline={timeline}
      asOf="2026-09-22T23:57:07.481Z" onRefresh={onRefresh} />);
    expect(screen.getByTestId('as-of')).toBeInTheDocument();
    expect(onRefresh).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run both tests to verify they fail**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/dashboard/__tests__/KpiCard.test.tsx src/components/admin/dashboard/__tests__/CampaignHeader.test.tsx`

Expected: FAIL — neither module resolves.

- [ ] **Step 3: Write `KpiCard`**

Create `frontend/src/components/admin/dashboard/KpiCard.tsx`:

```tsx
import React from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  secondary?: string;
}

/**
 * One card. Takes already-formatted strings so it cannot accidentally render a
 * withheld figure as zero — the formatting decision lives in formatFigure and
 * is made once, upstream.
 *
 * Height is unconstrained on purpose: Tigrigna labels run 20-40% longer than
 * their English counterparts and a fixed height clips them.
 */
const KpiCard: React.FC<KpiCardProps> = ({ label, value, secondary }) => (
  <div className="h-full rounded-md border border-accent-200 bg-accent-50 p-4">
    <p className="font-sans text-caption text-accent-500">{label}</p>
    <p className="mt-1 font-sans text-h2 tabular-nums text-accent-700">{value}</p>
    {secondary && <p className="mt-1 font-sans text-caption text-accent-500">{secondary}</p>}
  </div>
);

export default KpiCard;
```

- [ ] **Step 4: Write `CampaignHeader`**

Create `frontend/src/components/admin/dashboard/CampaignHeader.tsx`:

```tsx
import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DashboardCampaign, DashboardTimeline } from '../../../utils/pledgeDashboardApi';

interface CampaignHeaderProps {
  campaign: DashboardCampaign;
  timeline: DashboardTimeline;
  asOf: string;
  onRefresh: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-tsaeda-100 text-tsaeda-700',
  draft: 'bg-accent-100 text-accent-600',
  closed: 'bg-accent-200 text-accent-600'
};

/**
 * Identity and position in the window. No auto-refresh: figures shifting under
 * a board discussion is worse than figures a few minutes old, so the reader is
 * told when this was taken and refreshes when they choose. Spec section 11.
 */
const CampaignHeader: React.FC<CampaignHeaderProps> = ({
  campaign, timeline, asOf, onRefresh
}) => {
  const { t, language } = useLanguage();
  const title = language === 'ti' && campaign.name_ti ? campaign.name_ti : campaign.name;
  const asOfTime = new Date(asOf).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-h3 text-accent-700">{title}</h2>
          <span className={`rounded-full px-2 py-0.5 font-sans text-caption capitalize ${
            STATUS_STYLES[campaign.status] || STATUS_STYLES.draft
          }`}>
            {campaign.status}
          </span>
        </div>
        {campaign.end_date && timeline.total_days != null && (
          <p data-testid="campaign-window" className="mt-1 font-sans text-caption text-accent-500">
            {campaign.start_date} – {campaign.end_date}
            {' · '}
            {t('pledgeDashboard.header.dayOf', {
              day: String(timeline.day), total: String(timeline.total_days)
            })}
            {timeline.days_remaining != null && (
              <> {' · '}{t('pledgeDashboard.header.remaining', {
                days: String(timeline.days_remaining)
              })}</>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span data-testid="as-of" className="font-sans text-caption text-accent-500">
          {t('pledgeDashboard.header.asOf', { time: asOfTime })}
        </span>
        <button
          onClick={onRefresh}
          className="rounded-md border border-accent-200 px-3 py-1.5 font-sans text-caption text-accent-600 hover:bg-accent-100"
        >
          {t('pledgeDashboard.header.refresh')}
        </button>
      </div>
    </header>
  );
};

export default CampaignHeader;
```

- [ ] **Step 5: Add the strings**

Extend `pledgeDashboard` in all three blocks of `frontend/src/i18n/dictionaries.ts`:

```ts
// interface
header: { dayOf: string; remaining: string; asOf: string; refresh: string };
```

```ts
// en
header: {
  dayOf: 'Day {day} of {total}',
  remaining: '{days} days remaining',
  asOf: 'as of {time}',
  refresh: 'Refresh'
}
```

```ts
// ti
header: {
  dayOf: 'መዓልቲ {day} ካብ {total}',
  remaining: '{days} መዓልትታት ተሪፉ',
  asOf: 'ክሳብ {time}',
  refresh: 'ኣሓድስ'
}
```

- [ ] **Step 6: Run both tests to verify they pass**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/dashboard/__tests__/KpiCard.test.tsx src/components/admin/dashboard/__tests__/CampaignHeader.test.tsx`

Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/admin/dashboard/KpiCard.tsx frontend/src/components/admin/dashboard/CampaignHeader.tsx frontend/src/components/admin/dashboard/__tests__/ frontend/src/i18n/dictionaries.ts
git commit -m "feat(pledges): KPI card and campaign header with manual refresh

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Paired fulfilment breakdown

Two stacked bars — households and dollars — sharing one category order and one scale. The insight is the **misalignment between them**: "40% of our households account for 24% of the money" is legible by looking down the page, and no single figure or donut can express it.

**Files:**
- Create: `frontend/src/components/admin/dashboard/DistributionBars.tsx`
- Create: `frontend/src/components/admin/dashboard/__tests__/DistributionBars.test.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `formatFigure` from Task 1.
- Produces: `<DistributionBars rows={DashboardBreakdownRow[]} onSelectStatus={(status: string) => void} />`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/dashboard/__tests__/DistributionBars.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DistributionBars from '../DistributionBars';
import { DashboardBreakdownRow } from '../../../../utils/pledgeDashboardApi';

const rows: DashboardBreakdownRow[] = [
  { status: 'fulfilled', pledge_count: 97, household_count: 83,
    total_pledged: 44881, total_collected: 44881, outstanding_owed: 0 },
  { status: 'not_started', pledge_count: 20, household_count: 17,
    total_pledged: 9000, total_collected: 0, outstanding_owed: 9000 },
  { status: 'cancelled', pledge_count: 3, household_count: 1,
    total_pledged: 2200, total_collected: 0, outstanding_owed: 0 }
];

describe('DistributionBars', () => {
  it('renders a households bar and a dollars bar over the same categories', () => {
    render(<DistributionBars rows={rows} onSelectStatus={jest.fn()} />);
    expect(screen.getByTestId('dist-households')).toBeInTheDocument();
    expect(screen.getByTestId('dist-dollars')).toBeInTheDocument();
  });

  // The two bars must be proportioned independently — that difference is the
  // whole point of showing both.
  it('proportions households and dollars independently', () => {
    render(<DistributionBars rows={rows} onSelectStatus={jest.fn()} />);
    const households = parseFloat(screen.getByTestId('dist-households-fulfilled').style.width);
    const dollars = parseFloat(screen.getByTestId('dist-dollars-fulfilled').style.width);
    expect(households).toBeCloseTo(83 / 100 * 100, 0);   // 83 of 100 households
    expect(dollars).toBeCloseTo(44881 / 53881 * 100, 0); // 44881 of 53881 dollars
    expect(Math.abs(households - dollars)).toBeGreaterThan(1);
  });

  it('excludes cancelled pledges from both bars but still lists them', () => {
    render(<DistributionBars rows={rows} onSelectStatus={jest.fn()} />);
    expect(screen.queryByTestId('dist-households-cancelled')).not.toBeInTheDocument();
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
  });

  // Spec section 11 rule 1: a withheld bucket is unknown, not empty.
  it('renders a withheld bucket as an em dash and omits its segment', () => {
    const withheld: DashboardBreakdownRow[] = [
      { status: 'fulfilled', pledge_count: 97, household_count: 83,
        total_pledged: 44881, total_collected: 44881, outstanding_owed: 0 },
      { status: 'not_started', pledge_count: null, household_count: null,
        total_pledged: null, total_collected: null, outstanding_owed: null }
    ];
    render(<DistributionBars rows={withheld} onSelectStatus={jest.fn()} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('dist-households-not_started')).not.toBeInTheDocument();
  });

  it('calls back with the status when a segment is chosen', async () => {
    const onSelectStatus = jest.fn();
    render(<DistributionBars rows={rows} onSelectStatus={onSelectStatus} />);
    await userEvent.click(screen.getByTestId('dist-households-fulfilled'));
    expect(onSelectStatus).toHaveBeenCalledWith('fulfilled');
  });

  it('renders nothing but an empty note when there are no pledges', () => {
    render(<DistributionBars rows={[]} onSelectStatus={jest.fn()} />);
    expect(screen.getByTestId('dist-empty')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/dashboard/__tests__/DistributionBars.test.tsx`

Expected: FAIL — cannot resolve `../DistributionBars`.

- [ ] **Step 3: Write the component**

Create `frontend/src/components/admin/dashboard/DistributionBars.tsx`:

```tsx
import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DashboardBreakdownRow, formatFigure } from '../../../utils/pledgeDashboardApi';

interface DistributionBarsProps {
  rows: DashboardBreakdownRow[];
  onSelectStatus: (status: string) => void;
}

/**
 * Ordered by completeness, and rendered with a sequential ramp rather than
 * three separate hues: the statuses are a progression, and the palette's
 * muted ramps cannot carry three categorical hues that a colour-blind reader
 * could separate. Value and texture also survive a printed board packet.
 */
const ORDER = ['fulfilled', 'partially_fulfilled', 'not_started'];
const FILL: Record<string, string> = {
  fulfilled: 'bg-tsaeda-600',
  partially_fulfilled: 'bg-tsaeda-400',
  not_started: 'bg-accent-300'
};

const sum = (rows: DashboardBreakdownRow[], pick: (r: DashboardBreakdownRow) => number | null) =>
  rows.reduce((total, row) => total + (pick(row) ?? 0), 0);

const DistributionBars: React.FC<DistributionBarsProps> = ({ rows, onSelectStatus }) => {
  const { t } = useLanguage();

  // Cancelled is listed but never plotted: a retired pledge is not part of the
  // drive's distribution, and including it would make both bars sum to more
  // than the live campaign.
  const live = ORDER
    .map((status) => rows.find((row) => row.status === status))
    .filter((row): row is DashboardBreakdownRow => Boolean(row));
  const cancelled = rows.find((row) => row.status === 'cancelled');

  const householdTotal = sum(live, (r) => r.household_count);
  const dollarTotal = sum(live, (r) => r.total_pledged);

  if (live.length === 0) {
    return (
      <p data-testid="dist-empty" className="font-sans text-caption text-accent-500">
        {t('pledgeDashboard.breakdown.empty')}
      </p>
    );
  }

  const bar = (
    testId: string,
    pick: (r: DashboardBreakdownRow) => number | null,
    total: number,
    kind: 'count' | 'money'
  ) => (
    <div data-testid={testId} className="flex h-7 w-full overflow-hidden rounded-md border border-accent-200">
      {live.map((row) => {
        const value = pick(row);
        // A withheld bucket has no honest width. Omitting the segment is
        // correct; drawing it at zero would assert that it is empty.
        if (value === null) return null;
        const width = total > 0 ? (value / total) * 100 : 0;
        return (
          <button
            key={row.status}
            data-testid={`${testId}-${row.status}`}
            style={{ width: `${width}%` }}
            onClick={() => onSelectStatus(row.status)}
            title={`${t(`pledgeDashboard.status.${row.status}`)} ${formatFigure(value, kind)}`}
            className={`h-full border-r-2 border-accent-50 last:border-r-0 ${FILL[row.status]}`}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="font-sans text-caption text-accent-500">
          {t('pledgeDashboard.breakdown.households')}
        </p>
        {bar('dist-households', (r) => r.household_count, householdTotal, 'count')}
      </div>
      <div>
        <p className="font-sans text-caption text-accent-500">
          {t('pledgeDashboard.breakdown.dollars')}
        </p>
        {bar('dist-dollars', (r) => r.total_pledged, dollarTotal, 'money')}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-caption">
        {live.map((row) => (
          <li key={row.status} className="flex items-center gap-2">
            <span className={`inline-block h-3 w-3 rounded-sm ${FILL[row.status]}`} aria-hidden="true" />
            <span className="text-accent-500">{t(`pledgeDashboard.status.${row.status}`)}</span>
            <strong className="text-accent-700">{formatFigure(row.household_count, 'count')}</strong>
            <span className="text-accent-400">{formatFigure(row.total_pledged, 'money')}</span>
          </li>
        ))}
        {cancelled && (
          <li className="flex items-center gap-2 text-accent-400">
            <span>{t('pledgeDashboard.status.cancelled')}</span>
            <span>{formatFigure(cancelled.pledge_count, 'count')}</span>
          </li>
        )}
      </ul>
    </div>
  );
};

export default DistributionBars;
```

- [ ] **Step 4: Add the strings**

Extend `pledgeDashboard` in all three blocks:

```ts
// interface
breakdown: { households: string; dollars: string; empty: string };
status: {
  fulfilled: string; partially_fulfilled: string;
  not_started: string; cancelled: string;
};
```

```ts
// en
breakdown: {
  households: 'Households',
  dollars: 'Dollars',
  empty: 'No pledges recorded for this drive yet'
},
status: {
  fulfilled: 'Paid in full',
  partially_fulfilled: 'Part paid',
  not_started: 'Nothing received',
  cancelled: 'Cancelled'
}
```

```ts
// ti
breakdown: {
  households: 'ስድራቤታት',
  dollars: 'ገንዘብ',
  empty: 'ነዚ ወፈያ ገና ዝተመዝገበ መብጽዓ የለን'
},
status: {
  fulfilled: 'ምሉእ ተኸፊሉ',
  partially_fulfilled: 'ብኸፊል ተኸፊሉ',
  not_started: 'ዝኾነ ኣይተቐበለን',
  cancelled: 'ተሰሪዙ'
}
```

Note the English labels are plain descriptions, not the database's `not_started` / `partially_fulfilled` enums. Spec §9 calls the raw enum leaking into the UI a defect.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/dashboard/__tests__/DistributionBars.test.tsx`

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/dashboard/DistributionBars.tsx frontend/src/components/admin/dashboard/__tests__/DistributionBars.test.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat(pledges): paired households/dollars fulfilment bars

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Attention panel

Five counts, each a link into the filtered table. Operational content deliberately kept out of the KPI row — "3 unlinked pledges" is a chore, not a leadership metric (spec §11 rule 8).

**Files:**
- Create: `frontend/src/components/admin/dashboard/AttentionPanel.tsx`
- Create: `frontend/src/components/admin/dashboard/__tests__/AttentionPanel.test.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `formatFigure` from Task 1.
- Produces: `<AttentionPanel attention={DashboardAttention} onSelect={(filter: string) => void} />` where `filter` is one of `'stalled' | 'never_started' | 'overpaid' | 'unlinked'`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/dashboard/__tests__/AttentionPanel.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttentionPanel from '../AttentionPanel';
import { DashboardAttention } from '../../../../utils/pledgeDashboardApi';

const attention: DashboardAttention = {
  stalled: 12, never_started: 47, overpaid: 2, unlinked: 3, ending_soon: false
};

describe('AttentionPanel', () => {
  it('lists each non-zero count as an actionable row', () => {
    render(<AttentionPanel attention={attention} onSelect={jest.fn()} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
  });

  // Nothing needing attention is good news and should read as such, not as an
  // empty list the reader has to interpret.
  it('says so plainly when nothing needs attention', () => {
    render(<AttentionPanel
      attention={{ stalled: 0, never_started: 0, overpaid: 0, unlinked: 0, ending_soon: false }}
      onSelect={jest.fn()} />);
    expect(screen.getByTestId('attention-clear')).toBeInTheDocument();
  });

  it('omits a zero row rather than listing it', () => {
    render(<AttentionPanel attention={{ ...attention, unlinked: 0 }} onSelect={jest.fn()} />);
    expect(screen.queryByTestId('attention-unlinked')).not.toBeInTheDocument();
  });

  // A withheld count is not the same as no problem. It must stay visible and
  // say that the figure is protected.
  it('shows a withheld count as an em dash rather than hiding the row', () => {
    render(<AttentionPanel attention={{ ...attention, overpaid: null }} onSelect={jest.fn()} />);
    expect(screen.getByTestId('attention-overpaid')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('flags a drive inside its final thirty days', () => {
    render(<AttentionPanel attention={{ ...attention, ending_soon: true }} onSelect={jest.fn()} />);
    expect(screen.getByTestId('attention-ending-soon')).toBeInTheDocument();
  });

  it('calls back with the filter name when a row is chosen', async () => {
    const onSelect = jest.fn();
    render(<AttentionPanel attention={attention} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId('attention-stalled'));
    expect(onSelect).toHaveBeenCalledWith('stalled');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/dashboard/__tests__/AttentionPanel.test.tsx`

Expected: FAIL — cannot resolve `../AttentionPanel`.

- [ ] **Step 3: Write the component**

Create `frontend/src/components/admin/dashboard/AttentionPanel.tsx`:

```tsx
import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { DashboardAttention, formatFigure } from '../../../utils/pledgeDashboardApi';

interface AttentionPanelProps {
  attention: DashboardAttention;
  onSelect: (filter: string) => void;
}

const ROWS: Array<keyof Omit<DashboardAttention, 'ending_soon'>> =
  ['stalled', 'never_started', 'overpaid', 'unlinked'];

/**
 * Counts only, each one a way into the filtered table below. The names behind
 * them live in that table, not here.
 *
 * A zero row is dropped — it is not a problem. A WITHHELD row is kept, because
 * "we are not showing you this" is different from "there is nothing here", and
 * dropping it would let a protected figure read as a clean bill of health.
 */
const AttentionPanel: React.FC<AttentionPanelProps> = ({ attention, onSelect }) => {
  const { t } = useLanguage();

  const visible = ROWS.filter((key) => attention[key] === null || (attention[key] as number) > 0);
  const nothingToShow = visible.length === 0 && !attention.ending_soon;

  if (nothingToShow) {
    return (
      <p data-testid="attention-clear" className="font-sans text-caption text-accent-500">
        {t('pledgeDashboard.attention.clear')}
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {visible.map((key) => (
        <li key={key}>
          <button
            data-testid={`attention-${key.replace('_', '-')}`}
            onClick={() => onSelect(key)}
            className="flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent-100"
          >
            <strong className="font-sans tabular-nums text-accent-700">
              {formatFigure(attention[key], 'count')}
            </strong>
            <span className="font-sans text-caption text-accent-500">
              {t(`pledgeDashboard.attention.${key}`)}
            </span>
          </button>
        </li>
      ))}
      {attention.ending_soon && (
        <li data-testid="attention-ending-soon"
          className="px-2 py-1.5 font-sans text-caption text-accent-600">
          {t('pledgeDashboard.attention.endingSoon')}
        </li>
      )}
    </ul>
  );
};

export default AttentionPanel;
```

- [ ] **Step 4: Add the strings**

Extend `pledgeDashboard` in all three blocks:

```ts
// interface
attention: {
  clear: string; stalled: string; never_started: string;
  overpaid: string; unlinked: string; endingSoon: string;
};
```

```ts
// en
attention: {
  clear: 'Nothing needs attention right now',
  stalled: 'part paid, nothing received in 60 days',
  never_started: 'pledged but nothing received',
  overpaid: 'paid more than they pledged',
  unlinked: 'not linked to a member record',
  endingSoon: 'This drive closes within 30 days'
}
```

```ts
// ti
attention: {
  clear: 'ሕጂ ኣቓልቦ ዘድልዮ የለን',
  stalled: 'ብኸፊል ተኸፊሉ፣ ኣብ 60 መዓልቲ ዝኾነ ኣይተቐበለን',
  never_started: 'መብጽዓ ኣለዎ፣ ግን ዝኾነ ኣይተቐበለን',
  overpaid: 'ካብ ዝኣተዎ መብጽዓ ንላዕሊ ከፊሉ',
  unlinked: 'ምስ መዝገብ ኣባል ኣይተኣሳሰረን',
  endingSoon: 'እዚ ወፈያ ኣብ ውሽጢ 30 መዓልቲ ይዕጾ'
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/dashboard/__tests__/AttentionPanel.test.tsx`

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/admin/dashboard/AttentionPanel.tsx frontend/src/components/admin/dashboard/__tests__/AttentionPanel.test.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat(pledges): attention panel keeping withheld counts visible

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The container, and mounting it on the Pledges tab

Assembles everything, owns fetching and filter state, and puts the band above the existing donor table — the single-page information architecture from spec §4.

**Files:**
- Create: `frontend/src/components/admin/PledgeDashboard.tsx`
- Create: `frontend/src/components/admin/__tests__/PledgeDashboard.test.tsx`
- Modify: `frontend/src/components/admin/TreasurerDashboard.tsx` (the `pledges` tab block)
- Modify: `frontend/src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–5, plus `useActiveCampaign` (already used by `TreasurerPledges`).
- Produces: `<PledgeDashboard onFilterChange={(filter: string | null) => void} />`, mounted above `TreasurerPledges`.

The monthly and comparison sections are **not** in this task. They are tier-3 only and collapsed by default; Task 7 adds them.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/admin/__tests__/PledgeDashboard.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PledgeDashboard from '../PledgeDashboard';
import * as api from '../../../utils/pledgeDashboardApi';

jest.mock('../../../hooks/useActiveCampaign', () => ({
  useActiveCampaign: () => ({ campaign: { id: 2, name: '2026 Pledge Drive' }, loading: false })
}));

jest.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key, language: 'en' })
}));

const snapshot: api.DashboardSnapshot = {
  campaign: { id: '2', slug: '2026-pledge-drive', name: '2026 Pledge Drive', name_ti: null,
    start_date: '2026-09-01', end_date: '2026-12-31', status: 'active', goal_amount: 100000 },
  timeline: { day: 22, total_days: 122, days_remaining: 100, elapsed_fraction: 0.18 },
  money: { pledged: 53881, collected: 45581, outstanding_owed: 9000, overpaid: 700,
    goal: 100000, gap_to_goal: 54419, percent_to_goal: 45.6, fulfillment_rate: 84.6,
    linear_pace_target: 18033, required_run_rate: 545 },
  participation: { households: 99, active_households: 310, rate: 31.9,
    anonymous_pledges: 17, anonymous_collected: 4200, family_id_populated: true },
  breakdown: [
    { status: 'fulfilled', pledge_count: 97, household_count: 83,
      total_pledged: 44881, total_collected: 44881, outstanding_owed: 0 }
  ],
  attention: { stalled: 12, never_started: 47, overpaid: 2, unlinked: 3, ending_soon: false },
  as_of: '2026-09-22T23:57:07.481Z'
};

describe('PledgeDashboard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders the band once the snapshot loads', async () => {
    jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
    render(<PledgeDashboard onFilterChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('2026 Pledge Drive')).toBeInTheDocument());
    expect(screen.getByText('$45,581')).toBeInTheDocument();
  });

  it('reports a failure without pretending the numbers are zero', async () => {
    jest.spyOn(api, 'fetchDashboard').mockRejectedValue(new Error('Failed to load the dashboard'));
    render(<PledgeDashboard onFilterChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('dashboard-error')).toBeInTheDocument());
    expect(screen.queryByText('$0')).not.toBeInTheDocument();
  });

  // Spec section 5: participation must say "members" when family_id is not
  // populated, because the figure is then a member count wearing a household
  // label. The API returns the flag precisely so the UI can tell the truth.
  it('labels participation as members when family_id is unpopulated', async () => {
    jest.spyOn(api, 'fetchDashboard').mockResolvedValue({
      ...snapshot,
      participation: { ...snapshot.participation, family_id_populated: false }
    });
    render(<PledgeDashboard onFilterChange={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('kpi-participation')).toHaveTextContent(/members/i));
  });

  it('raises the chosen filter to its parent', async () => {
    const onFilterChange = jest.fn();
    jest.spyOn(api, 'fetchDashboard').mockResolvedValue(snapshot);
    render(<PledgeDashboard onFilterChange={onFilterChange} />);
    await waitFor(() => expect(screen.getByTestId('attention-stalled')).toBeInTheDocument());
    screen.getByTestId('attention-stalled').click();
    await waitFor(() => expect(onFilterChange).toHaveBeenCalledWith('stalled'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/__tests__/PledgeDashboard.test.tsx`

Expected: FAIL — cannot resolve `../PledgeDashboard`.

- [ ] **Step 3: Write the container**

Create `frontend/src/components/admin/PledgeDashboard.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useActiveCampaign } from '../../hooks/useActiveCampaign';
import {
  DashboardSnapshot, fetchDashboard, formatFigure
} from '../../utils/pledgeDashboardApi';
import CampaignHeader from './dashboard/CampaignHeader';
import MoneyBar from './dashboard/MoneyBar';
import KpiCard from './dashboard/KpiCard';
import DistributionBars from './dashboard/DistributionBars';
import AttentionPanel from './dashboard/AttentionPanel';

interface PledgeDashboardProps {
  /** Raises a chosen status or attention filter so the donor table can scope to it. */
  onFilterChange: (filter: string | null) => void;
}

const PledgeDashboard: React.FC<PledgeDashboardProps> = ({ onFilterChange }) => {
  const { t } = useLanguage();
  const { campaign } = useActiveCampaign();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!campaign) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchDashboard(campaign.id));
    } catch (err: any) {
      setError(err.message || 'Failed to load the dashboard');
    } finally {
      setLoading(false);
    }
  }, [campaign]);

  useEffect(() => { load(); }, [load]);

  if (!campaign) return null;
  if (loading && !snapshot) {
    return <div className="py-8 text-center font-sans text-caption text-accent-500">…</div>;
  }

  // A failed load shows nothing rather than zeroes. Rendering an empty band
  // would state that the drive has collected nothing, which is a different and
  // much worse claim than "this did not load".
  if (error && !snapshot) {
    return (
      <div data-testid="dashboard-error"
        className="rounded-md border border-primary-200 bg-primary-50 p-4 font-sans text-caption text-primary-800">
        {error}
      </div>
    );
  }
  if (!snapshot) return null;

  const { money, participation, timeline } = snapshot;

  // When family_id is not populated, every member reads as their own household
  // and the figure is a member count wearing a household label. Say "members".
  const participationLabel = participation.family_id_populated
    ? t('pledgeDashboard.kpi.participationHouseholds')
    : t('pledgeDashboard.kpi.participationMembers');

  return (
    <section className="space-y-4">
      <CampaignHeader
        campaign={snapshot.campaign}
        timeline={timeline}
        asOf={snapshot.as_of}
        onRefresh={load}
      />

      <MoneyBar money={money} timeline={timeline} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('pledgeDashboard.kpi.received')}
          value={formatFigure(money.collected, 'money')}
          secondary={money.required_run_rate != null && timeline.days_remaining != null
            ? t('pledgeDashboard.kpi.runRate', {
                amount: formatFigure(money.required_run_rate, 'money'),
                days: String(timeline.days_remaining)
              })
            : undefined}
        />
        <KpiCard
          label={t('pledgeDashboard.kpi.owed')}
          value={formatFigure(money.outstanding_owed, 'money')}
          secondary={money.overpaid != null && money.overpaid > 0
            ? t('pledgeDashboard.kpi.overpaid', { amount: formatFigure(money.overpaid, 'money') })
            : undefined}
        />
        <div data-testid="kpi-participation">
          <KpiCard
            label={participationLabel}
            value={t('pledgeDashboard.kpi.participationValue', {
              count: formatFigure(participation.households, 'count'),
              total: formatFigure(participation.active_households, 'count'),
              rate: formatFigure(participation.rate, 'percent')
            })}
            secondary={participation.anonymous_pledges != null && participation.anonymous_pledges > 0
              ? t('pledgeDashboard.kpi.anonymous', {
                  count: formatFigure(participation.anonymous_pledges, 'count')
                })
              : undefined}
          />
        </div>
        <KpiCard
          label={t('pledgeDashboard.kpi.fulfillment')}
          value={formatFigure(money.fulfillment_rate, 'percent')}
          secondary={t('pledgeDashboard.kpi.fulfillmentNote')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-accent-200 bg-accent-50 p-4">
          <h3 className="mb-3 font-serif text-h4 text-accent-700">
            {t('pledgeDashboard.breakdown.title')}
          </h3>
          <DistributionBars rows={snapshot.breakdown} onSelectStatus={onFilterChange} />
        </div>
        <div className="rounded-md border border-accent-200 bg-accent-50 p-4">
          <h3 className="mb-3 font-serif text-h4 text-accent-700">
            {t('pledgeDashboard.attention.title')}
          </h3>
          <AttentionPanel attention={snapshot.attention} onSelect={onFilterChange} />
        </div>
      </div>
    </section>
  );
};

export default PledgeDashboard;
```

- [ ] **Step 4: Add the strings**

Extend `pledgeDashboard` in all three blocks:

```ts
// interface
kpi: {
  received: string; owed: string; overpaid: string; runRate: string;
  participationHouseholds: string; participationMembers: string;
  participationValue: string; anonymous: string;
  fulfillment: string; fulfillmentNote: string;
};
```

```ts
// en
kpi: {
  received: 'Received',
  owed: 'Still owed',
  overpaid: '{amount} paid over',
  runRate: 'needs {amount}/day for {days} days',
  participationHouseholds: 'Households giving',
  participationMembers: 'Members giving',
  participationValue: '{count} of {total} ({rate})',
  anonymous: 'plus {count} anonymous gifts',
  fulfillment: 'Fulfilment',
  fulfillmentNote: 'of pledged dollars received'
}
```

```ts
// ti
kpi: {
  received: 'እተቐበለ',
  owed: 'ዝተረፈ',
  overpaid: '{amount} ተወሳኺ ተኸፊሉ',
  runRate: 'ኣብ መዓልቲ {amount} ን{days} መዓልትታት የድሊ',
  participationHouseholds: 'ዝወፈያ ስድራቤታት',
  participationMembers: 'ዝወፈዩ ኣባላት',
  participationValue: '{count} ካብ {total} ({rate})',
  anonymous: 'ከምኡ ድማ {count} ስም ዘይተጠቕሰ ወፈያታት',
  fulfillment: 'ኣፈጻጽማ',
  fulfillmentNote: 'ካብ እተመባጽዐ ገንዘብ እተቐበለ'
}
```

Also add `breakdown.title` and `attention.title` to the existing groups: `'Fulfilment breakdown'` / `'ኣፈጻጽማ ብዝርዝር'` and `'Needs attention'` / `'ኣቓልቦ የድልዮ'`.

- [ ] **Step 5: Mount it on the Pledges tab**

In `frontend/src/components/admin/TreasurerDashboard.tsx`, add the import beside the existing `TreasurerPledges` one:

```tsx
import TreasurerPledges from './TreasurerPledges';
import PledgeDashboard from './PledgeDashboard';
```

Add filter state alongside the component's other `useState` hooks:

```tsx
// Raised by the dashboard band so the donor table can scope to a chosen
// status or attention group. Spec section 10: one page, the band filters the
// table beneath it.
const [pledgeFilter, setPledgeFilter] = useState<string | null>(null);
```

Then replace the body of the `pledges` tab block with:

```tsx
{activeTab === 'pledges' && (
  <div className="space-y-6">
    <PledgeDashboard onFilterChange={setPledgeFilter} />
    {/* Entry is admin/treasurer only: POST /api/pledges honors an
        explicit member_id for those roles and silently files the
        pledge under the caller for anyone else. */}
    <TreasurerPledges
      canRecord={userRoles.some((r) => ['admin', 'treasurer'].includes(r))}
      filter={pledgeFilter}
      onClearFilter={() => setPledgeFilter(null)}
    />
  </div>
)}
```

Then add the two new optional props to `TreasurerPledges`. In `frontend/src/components/admin/TreasurerPledges.tsx`, extend its props interface:

```tsx
interface TreasurerPledgesProps {
  canRecord: boolean;
  /** A status or attention group chosen in the dashboard band above. */
  filter?: string | null;
  onClearFilter?: () => void;
}
```

and destructure them with defaults: `({ canRecord, filter = null, onClearFilter })`.

Filter the rendered rows by status when `filter` matches a derived status, and show a removable chip above the table when a filter is active:

```tsx
const visibleRows = filter
  ? rows.filter((row) => row.status === filter)
  : rows;
```

```tsx
{filter && (
  <div className="mb-3 flex items-center gap-2">
    <span className="rounded-full bg-accent-100 px-3 py-1 font-sans text-caption text-accent-600">
      {t(`pledgeDashboard.status.${filter}`)} · {visibleRows.length}
    </span>
    <button onClick={onClearFilter}
      className="font-sans text-caption text-accent-500 underline">
      {t('pledgeDashboard.clearFilter')}
    </button>
  </div>
)}
```

Render `visibleRows` in place of `rows` in the table body. Add `clearFilter` to the dictionary: `'Clear filter'` / `'መጽረዪ ኣወግድ'`.

The attention filters (`stalled`, `unlinked`, `overpaid`) do not correspond to a `derived_status`, so they will match no rows for now. Leave that — wiring them needs donor-level fields the table does not yet carry, which is Plan 4's work. Do not invent a client-side approximation.

- [ ] **Step 6: Run the container test and the existing pledge tests**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/__tests__/PledgeDashboard.test.tsx src/components/admin/__tests__/TreasurerPledges.test.tsx`

Expected: PASS. The existing `TreasurerPledges` tests must still pass — the new props are optional and default to no filtering.

- [ ] **Step 7: Run the full frontend suite**

Run: `cd frontend && CI=true npm test -- --watchAll=false`

Expected: PASS, all suites. Baseline before this plan was 105 suites / 975 passing.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin/PledgeDashboard.tsx frontend/src/components/admin/__tests__/PledgeDashboard.test.tsx frontend/src/components/admin/TreasurerDashboard.tsx frontend/src/components/admin/TreasurerPledges.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat(pledges): executive band above the donor table on the Pledges tab

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Monthly collections and the year-over-year strip

The two below-the-fold sections, both collapsed by default and both **tier-3 only** — Plan 2 restricted their endpoints because a cumulative series cannot be protected by small-number suppression. A tier-2 caller gets a 403, which this UI must present as an explained state rather than an error.

**Files:**
- Create: `frontend/src/components/admin/dashboard/MonthlyCollections.tsx`
- Create: `frontend/src/components/admin/dashboard/YearOverYear.tsx`
- Create: `frontend/src/components/admin/dashboard/__tests__/MonthlyCollections.test.tsx`
- Create: `frontend/src/components/admin/dashboard/__tests__/YearOverYear.test.tsx`
- Modify: `frontend/src/components/admin/PledgeDashboard.tsx`
- Modify: `frontend/src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `fetchMonthly`, `fetchComparison`, `formatFigure` from Task 1 — both fetchers return `null` on 403.
- Produces: `<MonthlyCollections series={MonthlySeries | null} />` and `<YearOverYear comparison={Comparison | null} />`, both mounted collapsed in the container.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/admin/dashboard/__tests__/MonthlyCollections.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import MonthlyCollections from '../MonthlyCollections';
import { MonthlySeries } from '../../../../utils/pledgeDashboardApi';

const series: MonthlySeries = {
  available: true, reason: null, partial_historical: false,
  months: [
    { month: '2026-09', collected: 1500, cumulative: 1500 },
    { month: '2026-11', collected: 2000, cumulative: 3500 }
  ]
};

describe('MonthlyCollections', () => {
  it('draws one column per month', () => {
    render(<MonthlyCollections series={series} />);
    expect(screen.getByTestId('month-2026-09')).toBeInTheDocument();
    expect(screen.getByTestId('month-2026-11')).toBeInTheDocument();
  });

  it('scales columns against the largest month', () => {
    render(<MonthlyCollections series={series} />);
    const tall = Number(screen.getByTestId('month-2026-11').getAttribute('height'));
    const short = Number(screen.getByTestId('month-2026-09').getAttribute('height'));
    expect(tall).toBeGreaterThan(short);
  });

  // 403 is the designed answer for a role that may not see donor detail, not a
  // failure. Say why the chart is missing rather than showing an error.
  it('explains the restriction instead of erroring when the series is withheld', () => {
    render(<MonthlyCollections series={null} />);
    expect(screen.getByTestId('monthly-restricted')).toBeInTheDocument();
  });

  it('explains why a pre-allocation drive has no series at all', () => {
    render(<MonthlyCollections series={{
      available: false, reason: 'historical_campaign', partial_historical: false, months: []
    }} />);
    expect(screen.getByTestId('monthly-unavailable')).toBeInTheDocument();
  });

  it('captions a partial series rather than presenting it as complete', () => {
    render(<MonthlyCollections series={{ ...series, partial_historical: true }} />);
    expect(screen.getByTestId('monthly-partial')).toBeInTheDocument();
  });

  it('shows an empty-but-available series as no payments yet', () => {
    render(<MonthlyCollections series={{
      available: true, reason: null, partial_historical: false, months: []
    }} />);
    expect(screen.getByTestId('monthly-empty')).toBeInTheDocument();
  });
});
```

Create `frontend/src/components/admin/dashboard/__tests__/YearOverYear.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import YearOverYear from '../YearOverYear';
import { Comparison } from '../../../../utils/pledgeDashboardApi';

const comparison: Comparison = {
  comparable: { goal: false, collections: false, partial: false, pledging_curve: true },
  campaigns: {
    current: { id: '2', slug: '2026-pledge-drive', name: '2026', start_date: '2026-09-01',
      end_date: '2026-12-31', total_days: 122, in_progress: true, day: 22 },
    prior: { id: '1', slug: '2025-pledge-drive', name: '2025', start_date: '2025-09-13',
      end_date: '2026-01-12', total_days: 122, in_progress: false, day: 122 }
  },
  figures: {
    total_pledged: { current: 53881, prior: 69949 },
    total_collected: { current: 45581, prior: 61599 },
    fully_paid: { current: 97, prior: 129 }
  },
  pledging_curve: {
    current: [{ day: 1, cumulative_pledged: 1000 }, { day: 22, cumulative_pledged: 53881 }],
    prior: [{ day: 1, cumulative_pledged: 2000 }, { day: 122, cumulative_pledged: 69949 }]
  }
};

describe('YearOverYear', () => {
  it('shows the comparable figures side by side', () => {
    render(<YearOverYear comparison={comparison} />);
    expect(screen.getByText('$53,881')).toBeInTheDocument();
    expect(screen.getByText('$69,949')).toBeInTheDocument();
  });

  // Spec section 6 rule 1: the asymmetry belongs in the column headers, not in
  // a caption the bars have already contradicted.
  it('marks which drive is still running, in the headers', () => {
    render(<YearOverYear comparison={comparison} />);
    expect(screen.getByTestId('yoy-header-current')).toHaveTextContent(/22/);
    expect(screen.getByTestId('yoy-header-prior')).toHaveTextContent(/122/);
  });

  // Rule 3: a comparison that cannot be computed is omitted, never drawn as a
  // zero. A zero bar reads as "we did badly", not "we do not know".
  it('omits rows the capability flags mark incomparable', () => {
    render(<YearOverYear comparison={comparison} />);
    expect(screen.queryByTestId('yoy-row-goal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('yoy-row-partial')).not.toBeInTheDocument();
  });

  // Rule 6: no deltas for this pairing. One drive is finished, the other is not.
  it('shows no percentage change or direction arrows', () => {
    const { container } = render(<YearOverYear comparison={comparison} />);
    expect(container.textContent).not.toMatch(/[▲▼]|behind|ahead/i);
  });

  it('draws the pledging curve when the flag allows it', () => {
    render(<YearOverYear comparison={comparison} />);
    expect(screen.getByTestId('yoy-curve')).toBeInTheDocument();
  });

  it('explains the restriction instead of erroring when withheld', () => {
    render(<YearOverYear comparison={null} />);
    expect(screen.getByTestId('yoy-restricted')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run both tests to verify they fail**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/dashboard/__tests__/MonthlyCollections.test.tsx src/components/admin/dashboard/__tests__/YearOverYear.test.tsx`

Expected: FAIL — neither module resolves.

- [ ] **Step 3: Write `MonthlyCollections`**

Create `frontend/src/components/admin/dashboard/MonthlyCollections.tsx`:

```tsx
import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { MonthlySeries, formatFigure } from '../../../utils/pledgeDashboardApi';

interface MonthlyCollectionsProps {
  /** null means the API returned 403 — this series is tier-3 only. */
  series: MonthlySeries | null;
}

const CHART_HEIGHT = 120;

const note = (testId: string, text: string) => (
  <p data-testid={testId} className="font-sans text-caption text-accent-500">{text}</p>
);

/**
 * A single series, so no legend — the heading names it. Columns are scaled
 * against the largest month rather than against the goal: this chart answers
 * "are we accelerating or stalling", not "how close are we".
 */
const MonthlyCollections: React.FC<MonthlyCollectionsProps> = ({ series }) => {
  const { t } = useLanguage();

  if (series === null) return note('monthly-restricted', t('pledgeDashboard.monthly.restricted'));
  if (!series.available) return note('monthly-unavailable', t('pledgeDashboard.monthly.unavailable'));
  if (series.months.length === 0) return note('monthly-empty', t('pledgeDashboard.monthly.empty'));

  const peak = Math.max(...series.months.map((m) => m.collected), 1);
  const barWidth = 100 / (series.months.length * 2);

  return (
    <div>
      <svg
        role="img"
        aria-label={t('pledgeDashboard.monthly.title')}
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
      >
        {series.months.map((month, index) => {
          const height = (month.collected / peak) * (CHART_HEIGHT - 16);
          return (
            <rect
              key={month.month}
              data-testid={`month-${month.month}`}
              x={index * barWidth * 2 + barWidth / 2}
              y={CHART_HEIGHT - height}
              width={barWidth}
              height={height}
              rx={1}
              className="fill-tsaeda-500"
            >
              <title>{`${month.month} · ${formatFigure(month.collected, 'money')}`}</title>
            </rect>
          );
        })}
      </svg>

      <div className="mt-1 flex justify-between font-sans text-caption text-accent-400">
        <span>{series.months[0].month}</span>
        <span>{series.months[series.months.length - 1].month}</span>
      </div>

      {series.partial_historical &&
        note('monthly-partial', t('pledgeDashboard.monthly.partial'))}
    </div>
  );
};

export default MonthlyCollections;
```

- [ ] **Step 4: Write `YearOverYear`**

Create `frontend/src/components/admin/dashboard/YearOverYear.tsx`:

```tsx
import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { Comparison, formatFigure } from '../../../utils/pledgeDashboardApi';

interface YearOverYearProps {
  /** null means the API returned 403 — this comparison is tier-3 only. */
  comparison: Comparison | null;
}

/** Which figures are money, so the row knows how to format itself. */
const MONEY_ROWS = ['total_pledged', 'total_collected', 'outstanding_owed'];
const PERCENT_ROWS = ['fulfillment_rate'];

/**
 * A reference scoreboard, not a race.
 *
 * No deltas and no arrows: one drive is finished and the other is mid-flight,
 * so "37% behind" would be technically true and substantively false. Rows the
 * capability flags mark incomparable are omitted entirely rather than drawn as
 * zero, because a zero bar reads as "we did badly" and the honest answer is
 * "we cannot know". Spec section 6.
 */
const YearOverYear: React.FC<YearOverYearProps> = ({ comparison }) => {
  const { t } = useLanguage();

  if (comparison === null) {
    return (
      <p data-testid="yoy-restricted" className="font-sans text-caption text-accent-500">
        {t('pledgeDashboard.yoy.restricted')}
      </p>
    );
  }

  const { comparable, campaigns, figures, pledging_curve: curve } = comparison;

  const rowKeys = Object.keys(figures).filter((key) => {
    if (key === 'fully_paid' || key === 'never_paid') return comparable.partial || true;
    return true;
  });

  const kind = (key: string): 'money' | 'count' | 'percent' =>
    MONEY_ROWS.includes(key) ? 'money' : PERCENT_ROWS.includes(key) ? 'percent' : 'count';

  const peak = Math.max(
    ...curve.current.map((p) => p.cumulative_pledged),
    ...curve.prior.map((p) => p.cumulative_pledged),
    1
  );
  const span = Math.max(campaigns.current.total_days ?? 1, campaigns.prior.total_days ?? 1);
  const path = (points: Array<{ day: number; cumulative_pledged: number }>) =>
    points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${(p.day / span) * 100} ${100 - (p.cumulative_pledged / peak) * 100}`
    ).join(' ');

  return (
    <div className="space-y-4">
      <p className="font-sans text-caption text-accent-500">
        {t('pledgeDashboard.yoy.caveat')}
      </p>

      <table className="w-full font-sans text-caption">
        <thead>
          <tr className="text-left text-accent-500">
            <th className="py-1 font-normal" />
            <th data-testid="yoy-header-current" className="py-1 font-normal">
              {campaigns.current.name}
              {campaigns.current.in_progress && ` · ${t('pledgeDashboard.yoy.inProgress', {
                day: String(campaigns.current.day),
                total: String(campaigns.current.total_days ?? '')
              })}`}
            </th>
            <th data-testid="yoy-header-prior" className="py-1 font-normal">
              {campaigns.prior.name}
              {` · ${t('pledgeDashboard.yoy.final', {
                days: String(campaigns.prior.total_days ?? '')
              })}`}
            </th>
          </tr>
        </thead>
        <tbody className="text-accent-700">
          {rowKeys.map((key) => (
            <tr key={key} data-testid={`yoy-row-${key}`} className="border-t border-accent-200">
              <td className="py-1.5 text-accent-500">{t(`pledgeDashboard.yoy.rows.${key}`)}</td>
              <td className="py-1.5 tabular-nums">{formatFigure(figures[key].current, kind(key))}</td>
              <td className="py-1.5 tabular-nums">{formatFigure(figures[key].prior, kind(key))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {comparable.pledging_curve && (
        <div>
          <p className="font-sans text-caption text-accent-500">
            {t('pledgeDashboard.yoy.curveTitle')}
          </p>
          <svg
            data-testid="yoy-curve"
            role="img"
            aria-label={t('pledgeDashboard.yoy.curveTitle')}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-32 w-full"
          >
            {/* Prior year is the reference, not an equal peer: dashed and muted
                so the eye reads the current drive first. */}
            <path d={path(curve.prior)} fill="none" strokeWidth={2}
              strokeDasharray="4 3" className="stroke-accent-400" vectorEffect="non-scaling-stroke" />
            <path d={path(curve.current)} fill="none" strokeWidth={2}
              className="stroke-tsaeda-600" vectorEffect="non-scaling-stroke" />
          </svg>
          <p className="font-sans text-caption text-accent-400">
            {t('pledgeDashboard.yoy.curveCaveat')}
          </p>
        </div>
      )}
    </div>
  );
};

export default YearOverYear;
```

- [ ] **Step 5: Add the strings**

Extend `pledgeDashboard` in all three blocks with a `monthly` group and a `yoy` group. English:

```ts
monthly: {
  title: 'Monthly collections',
  restricted: 'Monthly collections are available to treasurers and bookkeepers. The month-by-month figures can expose an individual gift, so they are not shown at this access level.',
  unavailable: 'This drive predates payment records, so there is no month-by-month history to show.',
  empty: 'No payments received yet.',
  partial: 'Some pledges in this drive predate payment records and are not in this chart.'
},
yoy: {
  title: 'Compared with the previous drive',
  restricted: 'The year-over-year comparison is available to treasurers and bookkeepers. The day-by-day figures can expose an individual gift, so they are not shown at this access level.',
  caveat: 'Both drives ran 122 days in autumn, so the totals compare directly. The previous drive recorded payments without dates and set no goal, so timing and goal progress are not shown.',
  inProgress: 'in progress, day {day} of {total}',
  final: 'final, {days}-day drive',
  curveTitle: 'Cumulative pledged, by day of campaign',
  curveCaveat: 'This is money pledged, not money received.',
  rows: {
    total_pledged: 'Total pledged',
    total_collected: 'Total received',
    outstanding_owed: 'Still owed',
    pledge_count: 'Pledges',
    household_count: 'Households',
    fulfillment_rate: 'Fulfilment',
    fully_paid: 'Paid in full',
    never_paid: 'Nothing received'
  }
}
```

Add the matching `ti` entries and the interface keys. Keep the Tigrigna translations in the plain register the rest of the dictionary uses.

- [ ] **Step 6: Mount both in the container, collapsed**

In `frontend/src/components/admin/PledgeDashboard.tsx`, add state and a lazy fetch that runs only when a section is first opened — a tier-2 user should not pay for two requests that will 403:

```tsx
const [monthly, setMonthly] = useState<MonthlySeries | null | undefined>(undefined);
const [comparison, setComparison] = useState<Comparison | null | undefined>(undefined);
const [openSection, setOpenSection] = useState<'monthly' | 'yoy' | null>(null);
```

```tsx
// Fetched on first open rather than with the band: both are collapsed by
// default, and for a tier-2 role both return 403. `undefined` means not yet
// fetched; `null` means fetched and withheld.
const openMonthly = async () => {
  setOpenSection(openSection === 'monthly' ? null : 'monthly');
  if (monthly === undefined && campaign) setMonthly(await fetchMonthly(campaign.id));
};
```

Render each as a `<details>`-style disclosure below the two panels, with the section title as the summary. Wire `openMonthly` and an equivalent `openComparison`; the comparison needs a prior campaign id, so pass the one the campaign list provides, and render nothing at all if there is no prior drive to compare against.

- [ ] **Step 7: Run the new tests and the full frontend suite**

Run: `cd frontend && CI=true npx react-scripts test --watchAll=false src/components/admin/dashboard/__tests__/`

Expected: PASS, all dashboard component tests.

Run: `cd frontend && CI=true npm test -- --watchAll=false`

Expected: PASS, all suites.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/admin/dashboard/ frontend/src/components/admin/PledgeDashboard.tsx frontend/src/i18n/dictionaries.ts
git commit -m "feat(pledges): monthly collections and year-over-year strip, tier 3 only

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage.** §4's single-page architecture → Task 6 mounts the band above the existing table on one tab, no new route. §5's band → Tasks 2 (money bar, pace marker), 3 (KPI row, header, manual refresh), 4 (paired breakdown), 5 (attention). §5's participation relabelling when `family_id` is unpopulated → Task 6, tested. §6's year-over-year, including omitting incomparable rows and carrying no deltas → Task 7, tested against both rules. §7's four visual elements → money bar (Task 2), paired bars (Task 4), monthly columns and the pledging curve (Task 7); no donut, no gauge, no sparklines. §8's tiering → Task 1's 403 contract and Task 7's explained restriction. §10's filtering → Tasks 4 and 5 raise a filter, Task 6 wires it to the table with a removable chip. §11's rules → an unknown never renders as zero (Task 1's formatter, enforced everywhere), no auto-refresh (Task 3), no evaluative pace colour (Task 2), translated status labels (Task 4), unconstrained card heights for Tigrigna (Task 3). §13's wireframe → Task 6's layout. §14's tablet and mobile → the grids in Task 6 collapse at `sm` and `lg`.

Deliberately out of scope, with reasons: **URL filter state** (§10) — the filter is component state here; putting it in the URL needs a router change on a tab that has none, and is better done with Plan 4's sort and search, which have the same need. **Attention filters reaching the table** — `stalled`, `unlinked` and `overpaid` are not `derived_status` values and need donor-level fields the table does not yet carry; Task 6 says so explicitly rather than faking a client-side approximation. **The table's own sort, search, pagination and CSV** (§9) — Plan 4. **Retiring `CampaignDonors` and stripping the admin card's inline totals** (§4's consolidation) — a separate change that touches a different dashboard; it is not needed for this band to work.

**Placeholder scan.** No TBDs. Every code step carries the real component or the real test. Task 6 Step 5 and Task 7 Step 6 describe edits to existing files in prose plus exact snippets, because the surrounding file is long and pasting it whole would be worse — but the snippets are complete and the insertion points are named.

**Type consistency.** `DashboardSnapshot` and its nested types are declared once in Task 1 and imported by every component. `formatFigure(value, kind)` keeps one signature throughout, and no component formats a number any other way. `onSelectStatus` (Task 4) and `onSelect` (Task 5) both raise a plain `string` and both land on Task 6's single `onFilterChange`. `MonthlySeries | null` and `Comparison | null` mean the same thing — withheld — in Task 1's fetchers and Task 7's props.

**One risk flagged for the executor.** Tasks 2–7 all append to the same `pledgeDashboard` group in `dictionaries.ts`, in three separate blocks. An implementer who replaces the group rather than extending it will silently delete earlier tasks' strings, and the failure shows up as raw key names on screen rather than as a test failure. Each task's string step lists only its own additions; extend, never replace.
