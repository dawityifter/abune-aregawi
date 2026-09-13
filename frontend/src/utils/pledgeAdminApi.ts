import { auth } from '../firebase';

/**
 * Treasurer-side pledge writes. Reads live in pledgeCampaignApi (the drive's
 * donor rows) and pledgeBalanceApi (one member's position) — this module only
 * covers the three things a treasurer can change.
 */

const BASE = `${process.env.REACT_APP_API_URL}/api/pledges`;

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** The server reports a refused write in `message`; surface that, not a generic string. */
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

export interface NewPledgeForMember {
  member_id: number;
  amount: number;
  first_name: string;
  last_name: string;
  notes?: string;
}

/**
 * Records a pledge on behalf of a member. member_id is honored only for admin
 * and treasurer callers; for anyone else the server silently attributes the
 * pledge to the caller instead, which is why the tab gates the entry form on
 * those two roles rather than on a broader finance permission.
 */
export async function createPledgeForMember(input: NewPledgeForMember): Promise<{ id: number }> {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input)
  });
  if (!response.ok) await readError(response, 'Failed to record the pledge');
  const data = await response.json();
  return data.pledge;
}

/** Retires a pledge without deleting it: totals drop, the record survives. */
export async function cancelPledge(pledgeId: number, notes: string): Promise<void> {
  const response = await fetch(`${BASE}/${pledgeId}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ lifecycle: 'cancelled', notes })
  });
  if (!response.ok) await readError(response, 'Failed to cancel the pledge');
}

/** Corrects what was pledged. Never touches what was received — that is derived. */
export async function updatePledgeAmount(pledgeId: number, amount: number): Promise<void> {
  const response = await fetch(`${BASE}/${pledgeId}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ amount })
  });
  if (!response.ok) await readError(response, 'Failed to update the pledge amount');
}
