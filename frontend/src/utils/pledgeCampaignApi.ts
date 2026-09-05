import { auth } from '../firebase';

/** The public shape returned by GET /api/pledge-campaigns/active. */
export interface PledgeCampaign {
  id: number;
  slug: string;
  name: string;
  name_ti: string | null;
  description: string | null;
  description_ti: string | null;
  start_date: string;
  end_date: string | null;
  goal_amount: string | null;
  currency: string;
}

/** The admin shape from GET /api/pledge-campaigns — adds status and totals. */
export interface AdminCampaign extends PledgeCampaign {
  status: 'draft' | 'active' | 'closed';
  default_payment_type: string | null;
  income_category_id: number | null;
  totals: {
    total_pledged: string | null;
    total_collected: string | null;
    /** Pledged minus collected, from the campaign_totals view. */
    outstanding: string | null;
    percent_to_goal: string | null;
    pledge_count: number | null;
    donor_count: number | null;
  } | null;
}

export interface CampaignInput {
  slug?: string;
  name: string;
  name_ti?: string | null;
  description?: string | null;
  description_ti?: string | null;
  start_date: string;
  end_date?: string | null;
  goal_amount?: number | null;
  currency?: string;
  status?: 'draft' | 'active' | 'closed';
  default_payment_type?: string | null;
  income_category_id?: number | null;
}

const BASE = `${process.env.REACT_APP_API_URL}/api/pledge-campaigns`;

/** Public and unauthenticated — the visitor home page calls this. */
export async function fetchActiveCampaign(): Promise<PledgeCampaign | null> {
  const response = await fetch(`${BASE}/active`);
  if (!response.ok) throw new Error('Failed to load the active campaign');
  const data = await response.json();
  // The endpoint returns 0 or 1 entries; one drive runs at a time.
  return data.campaigns?.[0] ?? null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function fetchAllCampaigns(): Promise<AdminCampaign[]> {
  const response = await fetch(BASE, { headers: await authHeaders() });
  if (!response.ok) throw new Error('Failed to load campaigns');
  const data = await response.json();
  return data.campaigns || [];
}

/**
 * Both writers surface the server's message rather than a generic one: the
 * 409 CAMPAIGN_OVERLAP body names the conflicting drive, which is the whole
 * point of that error.
 */
export async function createCampaign(input: CampaignInput): Promise<AdminCampaign> {
  const response = await fetch(BASE, {
    method: 'POST', headers: await authHeaders(), body: JSON.stringify(input)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create the campaign');
  return data.campaign;
}

export async function updateCampaign(id: number, input: Partial<CampaignInput>): Promise<AdminCampaign> {
  const response = await fetch(`${BASE}/${id}`, {
    method: 'PATCH', headers: await authHeaders(), body: JSON.stringify(input)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to update the campaign');
  return data.campaign;
}

/** One donor's position in a campaign, derived from pledge_balances. */
export interface CampaignDonor {
  id: number;
  name: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  /** Derived from real payments, except on pre-modernization drives. */
  status: string;
  /** True when paid/remaining come from the legacy_status record rather than
      from allocations, so those figures cannot be tied to a transaction. */
  is_historical: boolean;
  pledge_type: string | null;
  created_at: string;
}

/**
 * Donor-level rows for one campaign. These carry member names (PII), so the
 * endpoint requires auth and a finance/leadership role; the public tracker
 * calls the same route WITHOUT detail=true and gets aggregates only.
 */
export async function fetchCampaignDonors(campaignId: number): Promise<CampaignDonor[]> {
  const response = await fetch(
    `${process.env.REACT_APP_API_URL}/api/pledges/stats?campaign_id=${campaignId}&detail=true`,
    { headers: await authHeaders() }
  );
  if (!response.ok) throw new Error('Failed to load donors');
  const data = await response.json();

  // The API groups donors under each derived status; flatten to rows and
  // carry the group's status down onto each one.
  return (data.stats?.status_breakdown || []).flatMap((group: any) =>
    (group.pledges || []).map((p: any) => ({ ...p, status: group.status }))
  );
}
