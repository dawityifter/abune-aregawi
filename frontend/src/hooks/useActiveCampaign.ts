import { useState, useEffect } from 'react';
import { fetchActiveCampaign, PledgeCampaign } from '../utils/pledgeCampaignApi';

interface ActiveCampaignState {
  campaign: PledgeCampaign | null;
  loading: boolean;
  error: string | null;
}

/**
 * The single client-side source for "is a drive running right now?". The home
 * card, the pledge page, and the tracker all read this so they cannot
 * disagree. The live/not-live decision itself is made on the server — this
 * only carries the answer.
 */
export function useActiveCampaign(): ActiveCampaignState {
  const [state, setState] = useState<ActiveCampaignState>({
    campaign: null, loading: true, error: null
  });

  useEffect(() => {
    let cancelled = false;

    fetchActiveCampaign()
      .then((campaign) => {
        if (!cancelled) setState({ campaign, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ campaign: null, loading: false, error: err.message || 'Failed to load' });
        }
      });

    return () => { cancelled = true; };
  }, []);

  return state;
}
