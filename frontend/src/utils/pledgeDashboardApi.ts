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
