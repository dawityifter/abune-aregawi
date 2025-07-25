import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Payment {
  id: number;
  memberName: string;
  spouseName: string;
  phone1: string;
  phone2: string;
  totalAmountDue: number;
  totalCollected: number;
  balanceDue: number;
  monthlyPayment: number;
  paymentMethod: string;
  member?: {
    id: string;
    firstName: string;
    lastName: string;
    memberId: string;
    phoneNumber: string;
    email: string;
  };
}

interface PaymentListProps {
  onPaymentAdded: () => void;
}

const PaymentList: React.FC<PaymentListProps> = ({ onPaymentAdded }) => {
  const { currentUser, firebaseUser } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchPayments();
  }, [searchTerm, statusFilter, currentPage]);

  const fetchPayments = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/payments?${params}`, {
        headers: {
          'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Convert totalAmountDue and totalCollected to numbers
        const normalizedPayments = data.data.map((p: any) => ({
          ...p,
          totalAmountDue: Number(p.totalAmountDue),
          totalCollected: Number(p.totalCollected)
        }));
        setPayments(normalizedPayments);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (totalCollected: number, totalAmountDue: number) => {
    if (totalAmountDue > 0 && totalCollected >= totalAmountDue) return 'text-green-600 bg-green-100';
    if (totalAmountDue > 0 && totalCollected > 0 && totalCollected < totalAmountDue) return 'text-yellow-600 bg-yellow-100';
    if (totalAmountDue > 0 && totalCollected === 0) return 'text-red-600 bg-red-100';
    if (totalAmountDue === 0 && totalCollected === 0) return '';
    return '';
  };

  const getStatusText = (totalCollected: number, totalAmountDue: number) => {
    if (totalAmountDue > 0 && totalCollected >= totalAmountDue) return 'Up to Date';
    if (totalAmountDue > 0 && totalCollected > 0 && totalCollected < totalAmountDue) return 'Partial';
    if (totalAmountDue > 0 && totalCollected === 0) return 'Behind';
    if (totalAmountDue === 0 && totalCollected === 0) return '';
    return '';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Members
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or member ID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Members</option>
              <option value="up_to_date">Up to Date</option>
              <option value="behind">Behind on Payments</option>
              <option value="partial">Partial Payments</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchPayments}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monthly Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Collected
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => {
                const statusText = getStatusText(payment.totalCollected, payment.totalAmountDue);
                // Debug log for status computation
                console.log('[DEBUG] Payment Row:', {
                  memberName: payment.memberName,
                  totalAmountDue: payment.totalAmountDue,
                  totalCollected: payment.totalCollected,
                  statusText
                });
                return (
                  <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {payment.memberName}
                      </div>
                      {payment.spouseName && (
                        <div className="text-sm text-gray-500">
                          Spouse: {payment.spouseName}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {payment.phone1}
                    </div>
                    {payment.phone2 && (
                      <div className="text-sm text-gray-500">
                        {payment.phone2}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(payment.monthlyPayment)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(payment.totalAmountDue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(payment.totalCollected)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${payment.totalCollected - payment.totalAmountDue < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatCurrency(payment.totalCollected - payment.totalAmountDue)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.totalCollected, payment.totalAmountDue)}`}>
                      {statusText}
                    </span>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-md px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentList; 