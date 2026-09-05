import { auth } from '../firebase';

/** A member's position in the live campaign, from pledge_balances. */
export interface PledgeBalance {
  id: number;
  campaign_id: number;
  campaign_name: string;
  pledged_amount: number;
  paid_amount: number;
  remaining_amount: number;
}

/**
 * The caller's own pledge, or another member's when memberId is given — the
 * latter requires a finance/leadership role at the API. Returns null when the
 * member has no active pledge or no campaign is live.
 */
export async function fetchPledgeBalance(memberId?: number): Promise<PledgeBalance | null> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  const token = await user.getIdToken();

  const query = memberId ? `?member_id=${memberId}` : '';
  const response = await fetch(
    `${process.env.REACT_APP_API_URL}/api/pledges/balance${query}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error('Failed to load pledge balance');

  const data = await response.json();
  return data.pledge ?? null;
}
