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
      totalCollected: number;
      balanceDue: number;
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

  const apiUrl = process.env.REACT_APP_API_URL;

  // Shared tiled background style (same as bylaws page)
  const bgStyle: React.CSSProperties = {
    backgroundImage: `url(${process.env.PUBLIC_URL}/bylaws/TigrayOrthodox-background.png)`,
    backgroundRepeat: 'repeat',
    backgroundPosition: 'top left',
    backgroundSize: 'auto',
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={bgStyle}>
        <div className="max-w-xl w-full bg-white shadow rounded p-6 text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button onClick={() => { setLoading(true); setError(null); fetchDues(); }} className="bg-primary-600 text-white px-4 py-2 rounded">
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

  return (
    <div className="min-h-screen pt-16" style={bgStyle}>
      <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-gray-100 pb-4">
              <div className="mb-4 md:mb-0">
                <h2 className="text-2xl font-semibold text-gray-900">Member Dues and Payment History</h2>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-gray-600 mt-1">
                  <span>{member.firstName} {member.lastName}</span>
                  <span className="hidden sm:inline">•</span>
                  <span>Year {payment.year}</span>
                  <span className="text-xs italic bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                    Calculated from parish join date
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 bg-gray-100 p-1.5 rounded-xl border border-gray-200 shadow-inner">
                {yearOptions.map(y => (
                  <button
                    key={y}
                    onClick={() => { setSelectedYear(y); setLoading(true); }}
                    className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all duration-200 ${selectedYear === y
                      ? 'bg-white text-blue-600 shadow-md transform scale-105'
                      : 'text-gray-500 hover:text-gray-800'
                      }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded bg-green-50 border border-green-100">
                <div className="text-sm text-gray-600">Total Collected</div>
                <div className="text-xl font-semibold text-green-700">{currency(payment.totalCollected || 0)}</div>
              </div>
              <div className="p-4 rounded bg-yellow-50 border border-yellow-100">
                <div className="text-sm text-gray-600">Balance Due</div>
                <div className="text-xl font-semibold text-yellow-700">{currency(payment.balanceDue || 0)}</div>
              </div>
              <div className="p-4 rounded bg-blue-50 border border-blue-100">
                <div className="text-sm text-gray-600">Other Payments</div>
                <div className="text-xl font-semibold text-blue-700">{currency(otherPaymentsTotal)}</div>
              </div>
              <div className="p-4 rounded bg-purple-50 border border-purple-100">
                <div className="text-sm text-gray-600">Yearly Pledge</div>
                <div className="text-xl font-semibold text-purple-700">{currency(yearlyPledge || 0)}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payment.monthStatuses.map((ms) => (
                    <tr key={ms.month} className={
                      ms.status === 'paid' ? 'bg-green-50' :
                        ms.status === 'due' ? 'bg-yellow-50' :
                          ms.status === 'pre-membership' ? 'bg-gray-50 opacity-50' : ''
                    }>
                      <td className="px-4 py-2 whitespace-nowrap">{monthLabel(ms.month)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600">{ms.status === 'pre-membership' ? '-' : currency(ms.paid || 0)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-600">{ms.status === 'pre-membership' ? '-' : currency(ms.due || 0)}</td>
                      <td className="px-4 py-2 whitespace-nowrap capitalize text-gray-500 italic">
                        {ms.status === 'pre-membership' ? 'Not Required' : ms.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 text-sm text-gray-600">
              Monthly commitment: {currency(payment.monthlyPayment || 0)}
            </div>

            <div className="mt-10">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Payment History</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt #</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.length === 0 && (
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-500" colSpan={7}>No payments found for this year.</td>
                      </tr>
                    )}
                    {transactions.map(t => (
                      <tr key={String(t.id)}>
                        <td className="px-4 py-2 whitespace-nowrap">{new Date(t.payment_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{currency(t.amount)}</td>
                        <td className="px-4 py-2 whitespace-nowrap capitalize">{t.payment_type.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 whitespace-nowrap capitalize">{t.payment_method.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{t.receipt_number || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{t.note || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{getStatus(t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DuesPage;
