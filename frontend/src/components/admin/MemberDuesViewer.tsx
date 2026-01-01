import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateForDisplay } from '../../utils/dateUtils';
import { getMergedPermissions, UserRole } from '../../utils/roles';
import AddPaymentModal from './AddPaymentModal';
import { formatMemberName } from '../../utils/formatName';

interface MemberDuesData {
  member: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    title?: {
      name: string;
      abbreviation?: string;
    };
  };
  household: {
    isHouseholdView: boolean;
    headOfHousehold: {
      id: number;
      firstName: string;
      lastName: string;
      title?: {
        name: string;
        abbreviation?: string;
      };
    };
    memberNames: string;
    totalMembers: number;
  };
  payment: {
    year: number;
    annualPledge: number;
    monthlyPayment: number;
    duesCollected: number;
    outstandingDues: number;
    duesProgress: number;
    monthStatuses: Array<{
      month: string;
      paid: number;
      due: number;
      status: string;
      isFutureMonth: boolean;
    }>;
    otherContributions: {
      donation: number;
      pledge_payment: number;
      tithe: number;
      offering: number;
      other: number;
    };
    totalOtherContributions: number;
    grandTotal: number;
  };
  transactions: Array<{
    id: number;
    payment_date: string;
    amount: number;
    payment_type: string;
    payment_method: string;
    receipt_number: string;
    note: string;
    paid_by?: string;
  }>;
}

interface MemberDuesViewerProps {
  memberId: string;
  onClose: () => void;
}

const MemberDuesViewer: React.FC<MemberDuesViewerProps> = ({ memberId, onClose }) => {
  const { firebaseUser, currentUser: authUser } = useAuth();
  const userRoles: UserRole[] = (authUser as any)?.roles || [(authUser as any)?.role || 'member'];
  const permissions = getMergedPermissions(userRoles);

  const [duesData, setDuesData] = useState<MemberDuesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const yearOptions = [2026, 2025, 2024];

  const fetchMemberDues = useCallback(async () => {
    if (!firebaseUser || !memberId) return;

    setLoading(true);
    setError(null);

    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/payments/${memberId}/dues?year=${selectedYear}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch member dues: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setDuesData(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch member dues');
      }
    } catch (err) {
      console.error('Error fetching member dues:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch member dues');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, memberId, selectedYear]);

  useEffect(() => {
    fetchMemberDues();
  }, [fetchMemberDues]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 border-2 border-blue-100 shadow-2xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-100 rounded"></div>
            <div className="h-64 bg-gray-50 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 border-t-4 border-red-500 shadow-2xl">
          <div className="text-red-600 mb-6 text-center">
            <i className="fas fa-exclamation-circle text-5xl mb-4 opacity-75"></i>
            <h3 className="text-xl font-bold">Unable to load data</h3>
            <p className="text-sm mt-2 text-gray-600">{error}</p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white py-2.5 px-4 rounded-lg font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!duesData) return null;

  const { member, payment, transactions } = duesData;
  const { monthStatuses } = payment;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'due': return 'bg-red-50 text-red-800 border-red-200';
      case 'upcoming': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'pre-membership': return 'bg-gray-50 text-gray-400 border-gray-100 opacity-60';
      default: return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-gray-200">

        {/* Professional Header with Year Selection */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="mb-4 md:mb-0">
            {duesData.household.isHouseholdView ? (
              <>
                <div className="flex items-center mb-1">
                  <span className="p-1.5 bg-blue-600 rounded-lg mr-3 shadow-md">
                    <i className="fas fa-home text-white"></i>
                  </span>
                  <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                    Household Finances
                  </h2>
                </div>
                <p className="text-gray-700 font-semibold text-lg">
                  {formatMemberName(duesData.household.headOfHousehold)}'s Household
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {duesData.household.totalMembers} Members: {duesData.household.headOfHousehold.firstName}{duesData.household.memberNames && `, ${duesData.household.memberNames}`}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="p-1.5 bg-indigo-600 rounded-lg mr-3 shadow-md">
                    <i className="fas fa-user text-white text-sm"></i>
                  </span>
                  Member Financial View
                </h2>
                <p className="text-gray-700 font-semibold text-lg mt-1">
                  {formatMemberName(member)}
                </p>
                <p className="text-sm text-gray-500">
                  {member.email} {member.phoneNumber && `• ${member.phoneNumber}`}
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col items-end space-y-4">
            <div className="flex items-center space-x-4 shrink-0 bg-gray-200/50 p-1.5 rounded-xl border border-gray-300 shadow-inner">
              {yearOptions.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-5 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${selectedYear === year
                    ? 'bg-white text-blue-600 shadow-md transform scale-105'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'
                    }`}
                >
                  {year}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-3">
              {permissions.canEditFinancialRecords && (
                <button
                  onClick={() => setShowAddPaymentModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold flex items-center shadow-lg transition-transform active:scale-95"
                >
                  <i className="fas fa-plus mr-2"></i>
                  Add Transaction
                </button>
              )}
              <button
                onClick={onClose}
                className="bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 p-2 rounded-xl shadow-sm transition-colors"
                aria-label="Close"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-8 overflow-y-auto space-y-10 bg-gray-50/30">

          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Membership Dues Highlight Card */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-blue-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-1 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-bl-lg">
                Financial Year {payment.year}
              </div>

              <div className="flex items-center mb-6">
                <i className="fas fa-calendar-check text-blue-600 text-xl mr-3"></i>
                <h3 className="text-xl font-bold text-gray-900">Membership Dues</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-500 uppercase">Annual Pledge</p>
                  <p className="text-2xl font-black text-gray-900">${payment.annualPledge.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-500 uppercase">Monthly Value</p>
                  <p className="text-2xl font-black text-gray-900">${payment.monthlyPayment.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-blue-600 uppercase">Paid To Date</p>
                  <p className="text-2xl font-black text-green-600">${payment.duesCollected.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-500 uppercase">Balance Due</p>
                  <p className={`text-2xl font-black ${payment.outstandingDues > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${payment.outstandingDues.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="p-1 bg-gray-100 rounded-full">
                <div className="relative h-6 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-inner"
                    style={{ width: `${Math.min(payment.duesProgress, 100)}%` }}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow-sm">
                      {payment.duesProgress}% COMPLETE
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-gray-500 mt-2 font-medium italic">
                {payment.annualPledge > 0
                  ? `Dues are calculated starting from ${duesData.member.firstName}'s parish join date.`
                  : 'Calculations based on standard contribution rates'}
              </p>
            </div>

            {/* Total Balance Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-2xl p-6 shadow-xl flex flex-col justify-between text-white">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-bold opacity-75 uppercase tracking-wider">Total Received</p>
                  <i className="fas fa-arrow-trend-up text-green-400 text-xl"></i>
                </div>
                <p className="text-5xl font-black">${payment.grandTotal.toLocaleString()}</p>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold opacity-60 uppercase">Year-over-Year</p>
                  <p className="text-xs font-bold text-green-400">Stable Growth</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold opacity-60 uppercase">System ID</p>
                  <p className="text-xs font-mono">FIN-0{member.id}-{payment.year}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Contributions Breakdown */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center mb-6">
              <i className="fas fa-piggy-bank text-green-600 text-xl mr-3"></i>
              <h3 className="text-xl font-bold text-gray-900">Additional Contributions Breakdown</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Donations', value: payment.otherContributions.donation, icon: 'fa-gift', color: 'blue' },
                { label: 'Pledges', value: payment.otherContributions.pledge_payment, icon: 'fa-handshake', color: 'indigo' },
                { label: 'Tithes', value: payment.otherContributions.tithe, icon: 'fa-landmark', color: 'emerald' },
                { label: 'Offerings', value: payment.otherContributions.offering, icon: 'fa-heart', color: 'rose' },
                { label: 'Other', value: payment.otherContributions.other, icon: 'fa-plus-circle', color: 'amber' }
              ].map(item => (
                <div key={item.label} className={`p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col ${item.value === 0 ? 'opacity-40 grayscale' : ''}`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <i className={`fas ${item.icon} text-sm`}></i>
                    <p className="text-[10px] font-black text-gray-500 uppercase">{item.label}</p>
                  </div>
                  <p className="text-xl font-black text-gray-900">${item.value.toLocaleString()}</p>
                </div>
              ))}
              <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 shadow-md">
                <p className="text-[10px] font-black text-emerald-800 uppercase mb-2">Total Additional</p>
                <p className="text-xl font-black text-emerald-900">${payment.totalOtherContributions.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Monthly Visualization */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <i className="fas fa-layer-group text-indigo-600 mr-3"></i>
                Annual Distribution Timeline
              </h3>
              <div className="flex space-x-3">
                <div className="flex items-center text-xs font-bold text-gray-500"><span className="w-3 h-3 bg-green-500 rounded-full mr-1.5"></span> Paid</div>
                <div className="flex items-center text-xs font-bold text-gray-500"><span className="w-3 h-3 bg-red-500 rounded-full mr-1.5"></span> Pending</div>
                <div className="flex items-center text-xs font-bold text-gray-500"><span className="w-3 h-3 bg-blue-500 rounded-full mr-1.5"></span> Upcoming</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {monthStatuses.map((ms) => (
                <div
                  key={ms.month}
                  className={`relative p-4 rounded-2xl border-2 transition-all group hover:shadow-lg ${getStatusColor(ms.status)}`}
                >
                  <div className="absolute -top-3 left-4 px-2 bg-white rounded-md border text-[10px] font-black uppercase text-gray-900 shadow-sm border-gray-200">
                    {ms.month.substring(0, 3)}
                  </div>

                  <div className="mt-1 flex flex-col">
                    <div className="text-xs font-bold opacity-60 uppercase mb-1">Received</div>
                    <div className="text-lg font-black leading-none">${ms.paid.toLocaleString()}</div>

                    {ms.due > 0 && (
                      <div className="mt-3 pt-3 border-t border-red-200/50">
                        <div className="text-[10px] font-bold text-red-600 uppercase">Required</div>
                        <div className="text-sm font-black text-red-700">${ms.due.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Transaction Ledger */}
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
            <div className="px-6 py-5 border-b flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">Detailed Transaction Ledger ({payment.year})</h3>
              <div className="text-xs font-bold text-gray-500 bg-white border px-3 py-1 rounded-full uppercase">
                {transactions.length} Records Found
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-white">
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Post Date</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reference</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mechanism</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Origin</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-900">
                        {formatDateForDisplay(t.payment_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                        {t.receipt_number || 'GEN-TRX-' + t.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 rounded-md text-[10px] font-black uppercase bg-gray-100 text-gray-700">
                          {t.payment_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 capitalize">
                        {t.payment_method.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium">
                        {t.paid_by || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-black text-gray-900">${t.amount.toLocaleString()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && (
                <div className="text-center py-20 bg-gray-50/50 border-t">
                  <i className="fas fa-folder-open text-gray-300 text-5xl mb-4"></i>
                  <p className="text-gray-500 font-bold uppercase tracking-wider">Historical records empty for {payment.year}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar Footer */}
        <div className="flex justify-between items-center px-8 py-5 border-t bg-gray-50">
          <p className="text-xs text-gray-400 font-medium">
            Authorized Financial Statement • Generated {new Date().toLocaleDateString()}
          </p>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-900 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg transition-transform active:scale-95"
          >
            Finish Review
          </button>
        </div>
      </div>

      {showAddPaymentModal && (
        <AddPaymentModal
          onClose={() => setShowAddPaymentModal(false)}
          onPaymentAdded={() => {
            setShowAddPaymentModal(false);
            fetchMemberDues();
          }}
          paymentView="new"
          initialMemberId={memberId}
          initialPaymentType="membership_due"
        />
      )}
    </div>
  );
};

export default MemberDuesViewer;
