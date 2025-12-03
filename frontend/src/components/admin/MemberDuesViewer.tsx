import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateForDisplay } from '../../utils/dateUtils';
import AddPaymentModal from './AddPaymentModal';

interface MemberDuesData {
  member: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  household: {
    isHouseholdView: boolean;
    headOfHousehold: {
      id: number;
      firstName: string;
      lastName: string;
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
  const { firebaseUser } = useAuth();
  const [duesData, setDuesData] = useState<MemberDuesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  useEffect(() => {
    const fetchMemberDues = async () => {
      if (!firebaseUser || !memberId) return;

      setLoading(true);
      setError(null);

      try {
        const token = await firebaseUser.getIdToken();
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/payments/${memberId}/dues`,
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
    };

    fetchMemberDues();
  }, [firebaseUser, memberId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-red-600 mb-4">
            <i className="fas fa-exclamation-triangle text-2xl mb-2"></i>
            <h3 className="text-lg font-semibold">Error</h3>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!duesData) {
    return null;
  }

  const { member, payment, transactions } = duesData;
  const { monthStatuses } = payment;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'due': return 'bg-red-100 text-red-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            {duesData.household.isHouseholdView ? (
              <>
                <div className="flex items-center mb-2">
                  <i className="fas fa-home text-blue-600 text-xl mr-2"></i>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Household Dues & Payment History
                  </h2>
                </div>
                <p className="text-gray-700 font-medium">
                  {duesData.household.headOfHousehold.firstName} {duesData.household.headOfHousehold.lastName}'s Household
                </p>
                <p className="text-sm text-gray-600">
                  Family Members: {duesData.household.headOfHousehold.firstName}
                  {duesData.household.memberNames && `, ${duesData.household.memberNames}`}
                  {' '}({duesData.household.totalMembers} total)
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900">
                  Member Dues & Payment History
                </h2>
                <p className="text-gray-600">
                  {member.firstName} {member.lastName} • {member.email}
                </p>
                {member.phoneNumber && (
                  <p className="text-sm text-gray-500">{member.phoneNumber}</p>
                )}
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddPaymentModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium flex items-center"
            >
              <i className="fas fa-plus mr-2"></i>
              Make a Payment
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Section 1: Membership Dues Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center mb-4">
              <i className="fas fa-clipboard-list text-blue-600 text-xl mr-3"></i>
              <h3 className="text-lg font-semibold text-gray-900">📊 Membership Dues Summary for {payment.year}</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Annual Pledge</p>
                <p className="text-xl font-bold text-gray-900">${payment.annualPledge.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Monthly Expected</p>
                <p className="text-xl font-bold text-gray-900">${payment.monthlyPayment.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Dues Collected</p>
                <p className="text-xl font-bold text-green-600">${payment.duesCollected.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Outstanding Dues</p>
                <p className={`text-xl font-bold ${payment.outstandingDues > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${payment.outstandingDues.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm font-semibold text-blue-600">{payment.duesProgress}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(payment.duesProgress, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {payment.annualPledge > 0
                  ? `${(payment.duesCollected / payment.monthlyPayment).toFixed(1)} of 12 months paid`
                  : 'No annual pledge set'}
              </p>
            </div>
          </div>

          {/* Section 2: Other Contributions */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
            <div className="flex items-center mb-4">
              <i className="fas fa-hand-holding-heart text-green-600 text-xl mr-3"></i>
              <h3 className="text-lg font-semibold text-gray-900">💰 Additional Contributions</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {payment.otherContributions.donation > 0 && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-gray-600">Donations</p>
                  <p className="text-lg font-bold text-green-600">${payment.otherContributions.donation.toFixed(2)}</p>
                </div>
              )}
              {payment.otherContributions.pledge_payment > 0 && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-gray-600">Pledges</p>
                  <p className="text-lg font-bold text-green-600">${payment.otherContributions.pledge_payment.toFixed(2)}</p>
                </div>
              )}
              {payment.otherContributions.tithe > 0 && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-gray-600">Tithes</p>
                  <p className="text-lg font-bold text-green-600">${payment.otherContributions.tithe.toFixed(2)}</p>
                </div>
              )}
              {payment.otherContributions.offering > 0 && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-gray-600">Offerings</p>
                  <p className="text-lg font-bold text-green-600">${payment.otherContributions.offering.toFixed(2)}</p>
                </div>
              )}
              {payment.otherContributions.other > 0 && (
                <div className="bg-white rounded-lg p-3 shadow-sm">
                  <p className="text-xs text-gray-600">Other</p>
                  <p className="text-lg font-bold text-green-600">${payment.otherContributions.other.toFixed(2)}</p>
                </div>
              )}
              <div className="bg-white rounded-lg p-3 shadow-sm border-2 border-green-300">
                <p className="text-xs text-gray-600 font-semibold">Total Other</p>
                <p className="text-lg font-bold text-green-700">${payment.totalOtherContributions.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Section 3: Grand Total */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border-2 border-purple-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <i className="fas fa-chart-line text-purple-600 text-2xl mr-3"></i>
                <h3 className="text-xl font-bold text-gray-900">🎯 Total Collected (All Types)</h3>
              </div>
              <p className="text-3xl font-bold text-purple-600">${payment.grandTotal.toFixed(2)}</p>
            </div>
          </div>

          {/* Monthly Status */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {payment.year} Monthly Payment Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {monthStatuses.map((monthStatus, index) => (
                <div
                  key={monthStatus.month}
                  className={`p-3 rounded-lg border ${getStatusColor(monthStatus.status)}`}
                >
                  <div className="text-sm font-medium capitalize">{monthStatus.month}</div>
                  <div className="text-xs mt-1">
                    <div>Paid: ${monthStatus.paid.toFixed(2)}</div>
                    {monthStatus.due > 0 && (
                      <div>Due: ${monthStatus.due.toFixed(2)}</div>
                    )}
                    <div className="mt-1">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${monthStatus.status === 'paid' ? 'bg-green-200 text-green-800' :
                        monthStatus.status === 'due' ? 'bg-red-200 text-red-800' :
                          'bg-blue-200 text-blue-800'
                        }`}>
                        {monthStatus.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment History */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Payment History ({payment.year})
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Receipt
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Paid By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateForDisplay(transaction.payment_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${transaction.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {transaction.payment_type.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {transaction.payment_method.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.receipt_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.paid_by || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {transaction.note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No payments found for {payment.year}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-md font-medium"
          >
            Close
          </button>
        </div>
      </div>

      {/* Add Payment Modal */}
      {showAddPaymentModal && (
        <AddPaymentModal
          onClose={() => setShowAddPaymentModal(false)}
          onPaymentAdded={() => {
            setShowAddPaymentModal(false);
            // Refresh dues data to show new payment
            const fetchMemberDues = async () => {
              if (!firebaseUser || !memberId) return;
              setLoading(true);
              setError(null);
              try {
                const token = await firebaseUser.getIdToken();
                const response = await fetch(
                  `${process.env.REACT_APP_API_URL}/api/payments/${memberId}/dues`,
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
            };
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
