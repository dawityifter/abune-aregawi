import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateForDisplay } from '../../utils/dateUtils';

interface MemberDuesData {
  member: {
    id: number;
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
    monthStatuses: Array<{
      month: string;
      paid: number;
      due: number;
      status: string;
      isFutureMonth: boolean;
    }>;
    futureDues: number;
  };
  transactions: Array<{
    id: number;
    payment_date: string;
    amount: number;
    payment_type: string;
    payment_method: string;
    receipt_number: string;
    note: string;
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
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Member Dues & Payment History
            </h2>
            <p className="text-gray-600">
              {member.firstName} {member.lastName} • {member.email}
            </p>
            {member.phoneNumber && (
              <p className="text-sm text-gray-500">{member.phoneNumber}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Payment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900">Monthly Payment</h3>
              <p className="text-2xl font-bold text-blue-600">${payment.monthlyPayment.toFixed(2)}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-green-900">Total Collected</h3>
              <p className="text-2xl font-bold text-green-600">${payment.totalCollected.toFixed(2)}</p>
            </div>
            <div className={`p-4 rounded-lg ${payment.balanceDue > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <h3 className={`text-sm font-medium ${payment.balanceDue > 0 ? 'text-red-900' : 'text-green-900'}`}>
                {payment.balanceDue > 0 ? 'Balance Due' : 'Paid in Full'}
              </h3>
              <p className={`text-2xl font-bold ${payment.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${payment.balanceDue.toFixed(2)}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-purple-900">Future Dues</h3>
              <p className="text-2xl font-bold text-purple-600">${payment.futureDues.toFixed(2)}</p>
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
    </div>
  );
};

export default MemberDuesViewer;
