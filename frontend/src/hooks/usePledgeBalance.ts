import { useState, useEffect } from 'react';
import { fetchPledgeBalance, PledgeBalance } from '../utils/pledgeBalanceApi';

interface PledgeBalanceState {
  balance: PledgeBalance | null;
  loading: boolean;
  error: string | null;
}

/**
 * The signed-in member's own pledge balance. Used by the Donate page to offer
 * "apply to my pledge" and by the Dues page for its banner. Both treat an
 * error as "no pledge": a payment page must never break because this lookup
 * failed.
 */
export function usePledgeBalance(): PledgeBalanceState {
  const [state, setState] = useState<PledgeBalanceState>({
    balance: null, loading: true, error: null
  });

  useEffect(() => {
    let cancelled = false;

    fetchPledgeBalance()
      .then((balance) => {
        if (!cancelled) setState({ balance, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ balance: null, loading: false, error: err.message || 'Failed to load' });
        }
      });

    return () => { cancelled = true; };
  }, []);

  return state;
}
