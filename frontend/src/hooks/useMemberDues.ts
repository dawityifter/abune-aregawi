import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface MemberDuesSummary {
  year: number;
  totalAmountDue: number;
  duesCollected: number;
  outstandingDues: number;
  /**
   * Everything received in the year — dues plus donations, tithes and
   * offerings — which is what "Given in {year}" on the dashboard means.
   * `duesCollected` covers membership dues alone and is the wrong figure to
   * put under that label.
   */
  totalGiven: number;
}

interface State {
  dues: MemberDuesSummary | null;
  loading: boolean;
}

/**
 * The signed-in member's own dues standing for a year.
 *
 * Hits the same endpoint the Dues page uses, so the dashboard can open with
 * what the member actually wants to know — where they stand — instead of a
 * grid of places to go. (The Dues page still has its own copy of this fetch;
 * it also needs the month-by-month breakdown and the transaction list, so it
 * was left alone rather than refactored underneath a working payment screen.)
 *
 * Fails closed. Every caller treats a null result as "we don't know", and the
 * dashboard must render for a member whose dues record is missing, whose token
 * has expired, or who is offline.
 */
export function useMemberDues(year: number = new Date().getFullYear()): State {
  const { firebaseUser, user, authReady } = useAuth();
  const [state, setState] = useState<State>({ dues: null, loading: true });

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;
    const apiUrl = process.env.REACT_APP_API_URL;

    const load = async () => {
      try {
        if (!firebaseUser || !apiUrl) {
          if (!cancelled) setState({ dues: null, loading: false });
          return;
        }

        // A dependent has no dues of their own; the Dues page shows the head
        // of household's, so the dashboard agrees with it rather than showing
        // a dependent zeroes.
        const role = (user?.data?.member?.role || user?.role) as string | undefined;
        const linkedHeadId =
          (user as any)?.data?.member?.linkedMember?.id || (user as any)?.linkedMember?.id;
        if (role === 'dependent' && !linkedHeadId) {
          if (!cancelled) setState({ dues: null, loading: false });
          return;
        }

        const endpoint =
          role === 'dependent'
            ? `${apiUrl}/api/members/dues/by-member/${linkedHeadId}?year=${year}`
            : `${apiUrl}/api/members/dues/my?year=${year}`;

        const token = await firebaseUser.getIdToken();
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(String(res.status));

        const json = await res.json();
        const payment = json?.data?.payment;
        if (!json?.success || !payment) throw new Error('unexpected shape');

        if (!cancelled) {
          setState({
            dues: {
              year: payment.year ?? year,
              totalAmountDue: Number(payment.totalAmountDue) || 0,
              duesCollected: Number(payment.duesCollected) || 0,
              outstandingDues: Number(payment.outstandingDues) || 0,
              totalGiven: Number(payment.grandTotal) || 0,
            },
            loading: false,
          });
        }
      } catch {
        // Deliberately silent: the dashboard shows nothing rather than an
        // error for a figure the member did not ask for.
        if (!cancelled) setState({ dues: null, loading: false });
      }
    };

    load();
    return () => { cancelled = true; };
  }, [authReady, firebaseUser, user, year]);

  return state;
}
