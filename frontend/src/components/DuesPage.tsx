import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface MonthStatus {
  month: string;
  paid: number;
  due: number;
  status: 'paid' | 'due' | 'upcoming' | 'pre-membership';
  isFutureMonth: boolean;
}

interface MemberTransaction {
  id: number | string;
  payment_date: string;
  amount: number;
  payment_type: string;
  payment_method: string;
  receipt_number?: string | null;
  note?: string | null;
}

interface DuesResponse {
  success: boolean;
  data: {
    member: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber: string;
    };
    payment: {
      year: number;
      monthlyPayment: number;
      totalAmountDue: number;
      duesCollected: number;
      outstandingDues: number;
      monthStatuses: MonthStatus[];
      futureDues: number;
    };
    transactions: MemberTransaction[];
  };
}

const monthLabel = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);

const currency = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

const DuesPage: React.FC = () => {
  const { firebaseUser, user, authReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dues, setDues] = useState<DuesResponse['data'] | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const yearOptions = [2026, 2025];
  const [statementLoading, setStatementLoading] = useState<'pdf' | 'email' | null>(null);
  const [statementMsg, setStatementMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apiUrl = process.env.REACT_APP_API_URL;


  const fetchDues = useMemo(() => async () => {
    try {
      if (!firebaseUser) {
        setError('You must be signed in to view dues.');
        setLoading(false);
        return;
      }
      const token = await firebaseUser.getIdToken();
      // If the current user is a dependent with a linked head-of-household member id, fetch that member's dues
      const role = (user?.data?.member?.role || user?.role) as string | undefined;
      const isDependent = role === 'dependent';
      // Support both nested (data.member.linkedMember) and flat (linkedMember) shapes
      const linkedHeadId = (user as any)?.data?.member?.linkedMember?.id || (user as any)?.linkedMember?.id;
      // If dependent but no linked head, inform the user and stop
      if (isDependent && !linkedHeadId) {
        setError('Your dependent profile is not linked to a head of household yet. Please contact the head to link your profile or use the self-claim flow.');
        setLoading(false);
        return;
      }
      const endpoint = isDependent
        ? `${apiUrl}/api/members/dues/by-member/${linkedHeadId}?year=${selectedYear}`
        : `${apiUrl}/api/members/dues/my?year=${selectedYear}`;
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load dues: ${res.status} ${text}`);
      }
      const json: DuesResponse = await res.json();
      if (!json.success) throw new Error('Failed to load dues');
      setDues(json.data);
      setError(null);
    } catch (e: any) {
      console.error('Error loading dues', e);
      setError(e.message || 'Failed to load dues');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, apiUrl, user, selectedYear]);

  useEffect(() => {
    // Wait for auth to be ready before attempting fetch
    if (!authReady) return;
    fetchDues();
  }, [authReady, fetchDues]);

  const handleDownloadStatement = async () => {
    if (!firebaseUser) return;
    setStatementLoading('pdf');
    setStatementMsg(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(
        `${apiUrl}/api/members/statement/pdf?year=${selectedYear}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Failed to generate statement');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Annual_Contribution_Statement_${selectedYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setStatementMsg({ type: 'error', text: e.message || 'Failed to generate statement' });
    } finally {
      setStatementLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-16 bg-gray-100" data-testid="dues-skeleton">
        <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="h-24 rounded-xl bg-gray-200 overflow-hidden relative">
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-gray-200 overflow-hidden relative">
                <div
                  className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              </div>
            ))}
          </div>
          <div className="h-52 rounded-xl bg-gray-200 overflow-hidden relative">
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
          <div className="h-40 rounded-xl bg-gray-200 overflow-hidden relative">
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-16 bg-gray-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full bg-white shadow rounded-xl p-6 text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button onClick={() => { setLoading(true); setError(null); fetchDues(); }} className="bg-primary-600 text-white px-4 py-2 rounded-lg">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dues) return null;

  const { member, payment, transactions } = dues;
  // Compute Other Payments (non-membership payments)
  const otherPaymentsTotal = (transactions || []).filter(t => t.payment_type !== 'membership_due')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const getStatus = (t: MemberTransaction) => t.payment_method === 'ach' ? 'Pending' : 'Succeeded';

  const monthsInYear = payment.monthStatuses.filter(ms => ms.status !== 'pre-membership').length;
  const yearlyPledge = (payment.monthlyPayment || 0) * (monthsInYear || 12);

  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const curMonthIdx = new Date().getMonth();

  return (
    <div className="min-h-screen pt-16 bg-gray-100">
      <main className="max-w-5xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-4">

        {/* Red Header Banner */}
        <div
          data-testid="dues-header-banner"
          className="bg-primary-600 rounded-xl px-5 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
          style={{ boxShadow: '0 2px 8px rgba(185,28,28,0.25)' }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Member Dues
            </p>
            <p className="text-xl font-bold text-white mb-0.5">
              {member.firstName} {member.lastName}
            </p>
            <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Calculated from parish join date
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {yearOptions.map(y => (
              <button
                key={y}
                onClick={() => { setSelectedYear(y); setLoading(true); }}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  selectedYear === y
                    ? 'bg-white text-primary-600 shadow-md'
                    : 'bg-white/15 text-white border border-white/20 hover:bg-white/25'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Collected',      value: payment.duesCollected   || 0, border: 'border-green-500',  text: 'text-green-700'  },
            { label: 'Balance Due',    value: payment.outstandingDues || 0, border: 'border-red-500',    text: 'text-red-700'    },
            { label: 'Other Payments', value: otherPaymentsTotal,            border: 'border-amber-500',  text: 'text-amber-700'  },
            { label: 'Yearly Pledge',  value: yearlyPledge            || 0, border: 'border-violet-500', text: 'text-violet-700' },
          ].map(({ label, value, border, text }) => (
            <div key={label} className={`bg-white rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-xl font-bold ${text}`}>{currency(value)}</p>
            </div>
          ))}
        </div>

        {/* Month Grid */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-4">Monthly Status</p>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {payment.monthStatuses.map((ms) => {
              const msIdx = MONTHS.indexOf(ms.month);

              let tile    = 'bg-gray-100 border-gray-200';
              let label   = 'text-gray-400';
              let icon: React.ReactNode = <span className="text-gray-300 text-sm">—</span>;

              if (ms.status === 'paid') {
                tile  = 'bg-green-50 border-green-200';
                label = 'text-green-700 font-bold';
                icon  = <span className="text-green-500 text-sm">✓</span>;
              } else if (ms.status === 'due') {
                if (msIdx < curMonthIdx) {
                  tile  = 'bg-red-50 border-red-200';
                  label = 'text-red-700 font-bold';
                  icon  = <span className="text-red-500 text-xs font-semibold">Due</span>;
                } else {
                  tile  = 'bg-yellow-50 border-yellow-200';
                  label = 'text-yellow-700 font-bold';
                  icon  = <span className="text-yellow-600 text-xs font-semibold">Due</span>;
                }
              }

              return (
                <div
                  key={ms.month}
                  data-testid="month-tile"
                  className={`rounded-lg border px-2 py-2.5 text-center ${tile}`}
                >
                  <p className={`text-xs mb-1 ${label}`}>{monthLabel(ms.month).slice(0, 3)}</p>
                  {icon}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Monthly commitment:{' '}
            <strong className="text-gray-700">{currency(payment.monthlyPayment || 0)}</strong>
          </p>
        </div>

        {/* Payment History */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Payment History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Date','Amount','Type','Method','Receipt #','Note','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {transactions.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-sm text-gray-400 italic" colSpan={7}>No payments found for this year.</td>
                  </tr>
                )}
                {transactions.map(t => (
                  <tr key={String(t.id)} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{new Date(t.payment_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">{currency(t.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 capitalize">{t.payment_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 capitalize">{t.payment_method.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{t.receipt_number || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{t.note || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatus(t) === 'Pending' ? (
                        <span className="inline-block rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5">Pending</span>
                      ) : (
                        <span className="inline-block rounded-full bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5">Succeeded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Annual Contribution Statement — prior years only */}
        {selectedYear < new Date().getFullYear() && (
          <div className="bg-white rounded-xl shadow-sm border-t-4 border-primary-600 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Annual Contribution Statement</h3>
            <p className="text-sm text-gray-500 mb-4">
              Generate your tax-deductible contribution statement for {selectedYear}.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDownloadStatement}
                disabled={statementLoading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {statementLoading === 'pdf' ? (
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                Print Statement
              </button>
            </div>
            {statementMsg && (
              <p className={`mt-3 text-sm ${statementMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {statementMsg.text}
              </p>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default DuesPage;
