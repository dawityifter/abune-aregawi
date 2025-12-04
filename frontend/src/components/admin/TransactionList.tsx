import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateForDisplay } from '../../utils/dateUtils';

interface Transaction {
  id: number;
  member_id: number | null;
  collected_by: number;
  payment_date: string;
  amount: number;
  payment_type: 'membership_due' | 'tithe' | 'donation' | 'event' | 'other';
  payment_method: 'cash' | 'check' | 'zelle' | 'credit_card' | 'debit_card' | 'ach' | 'other';
  status?: 'pending' | 'succeeded' | 'failed' | 'canceled';
  receipt_number?: string;
  note?: string;
  income_category_id?: number | null;
  created_at: string;
  updated_at: string;
  member?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  };
  collector?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  };
  incomeCategory?: {
    id: number;
    gl_code: string;
    name: string;
    description: string;
  };
}

interface TransactionListProps {
  onTransactionAdded: () => void;
  refreshToken?: number;
}

const TransactionList: React.FC<TransactionListProps> = ({ onTransactionAdded, refreshToken }) => {
  const { firebaseUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [receiptNumberFilter, setReceiptNumberFilter] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term to reduce API calls while typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Fetch on filter/pagination changes (independent of search typing)
  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentTypeFilter, paymentMethodFilter, dateRangeFilter, customStartDate, customEndDate, receiptNumberFilter, currentPage]);

  // Fetch only when search is cleared or has at least 3 characters
  useEffect(() => {
    const len = debouncedSearchTerm.length;
    if (len === 0 || len >= 3) {
      // Reset to first page when search changes significantly
      setCurrentPage(1);
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  // Refetch when a refresh token changes
  useEffect(() => {
    if (refreshToken !== undefined) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  // Listen for global payments:refresh event (emitted by Stripe flows)
  useEffect(() => {
    const listener = () => fetchTransactions();
    window.addEventListener('payments:refresh' as any, listener);
    return () => window.removeEventListener('payments:refresh' as any, listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });

      if (debouncedSearchTerm && debouncedSearchTerm.length >= 3) {
        params.append('search', debouncedSearchTerm);
      }

      if (paymentTypeFilter !== 'all') {
        params.append('payment_type', paymentTypeFilter);
      }

      if (paymentMethodFilter !== 'all') {
        params.append('payment_method', paymentMethodFilter);
      }

      if (receiptNumberFilter.trim()) {
        params.append('receipt_number', receiptNumberFilter.trim());
      }

      if (dateRangeFilter === 'custom') {
        if (customStartDate) {
          params.append('start_date', customStartDate);
        }
        if (customEndDate) {
          params.append('end_date', customEndDate);
        }
      } else if (dateRangeFilter !== 'all') {
        const today = new Date();
        let startDate = new Date();

        switch (dateRangeFilter) {
          case 'today':
            startDate = today;
            break;
          case 'week':
            startDate.setDate(today.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(today.getMonth() - 1);
            break;
          case 'year':
            startDate.setFullYear(today.getFullYear() - 1);
            break;
        }

        params.append('start_date', startDate.toISOString().split('T')[0]);
        params.append('end_date', today.toISOString().split('T')[0]);
      }

      // Always use real endpoint
      const endpoint = '/api/transactions';

      const response = await fetch(`${process.env.REACT_APP_API_URL}${endpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.data.transactions || []);
        setTotalPages(data.data.pagination?.total_pages || 1);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
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

  const formatDate = (dateString: string) => {
    return formatDateForDisplay(dateString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPaymentTypeLabel = (type: string) => {
    const labels = {
      membership_due: 'Membership Due',
      tithe: 'Tithe',
      donation: 'Donation',
      event: 'Event',
      other: 'Other'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      cash: 'Cash',
      check: 'Check',
      zelle: 'Zelle',
      credit_card: 'Credit Card',
      debit_card: 'Debit Card',
      ach: 'ACH',
      other: 'Other'
    };
    return labels[method as keyof typeof labels] || method;
  };

  const renderStatusBadge = (status?: string) => {
    if (!status) return null;
    const map: Record<string, { text: string; classes: string }> = {
      pending: { text: 'Pending', classes: 'bg-yellow-100 text-yellow-800' },
      succeeded: { text: 'Succeeded', classes: 'bg-green-100 text-green-800' },
      failed: { text: 'Failed', classes: 'bg-red-100 text-red-800' },
      canceled: { text: 'Canceled', classes: 'bg-gray-100 text-gray-800' }
    };
    const cfg = map[status] || { text: status || '', classes: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${cfg.classes}`}>
        {cfg.text}
      </span>
    );
  };

  // Extract donor info from note field for anonymous donations
  const parseDonorInfo = (note?: string) => {
    if (!note || !note.includes('[Anonymous Donor]')) return null;

    const lines = note.split('\n');
    const donorInfo: { name?: string; type?: string; email?: string; phone?: string } = {};

    for (const line of lines) {
      if (line.startsWith('Name:')) donorInfo.name = line.replace('Name:', '').trim();
      if (line.startsWith('Type:')) donorInfo.type = line.replace('Type:', '').trim();
      if (line.startsWith('Email:')) donorInfo.email = line.replace('Email:', '').trim();
      if (line.startsWith('Phone:')) donorInfo.phone = line.replace('Phone:', '').trim();
    }

    return donorInfo;
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Member Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search member (min 3 chars)..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && searchTerm.trim().length < 3 && (
              <p className="mt-1 text-xs text-gray-500">Type at least 3 characters</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt Number
            </label>
            <input
              type="text"
              value={receiptNumberFilter}
              onChange={(e) => setReceiptNumberFilter(e.target.value)}
              placeholder="Search receipt #..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Type
            </label>
            <select
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="membership_due">Membership Due</option>
              <option value="tithe">Tithe</option>
              <option value="donation">Donation</option>
              <option value="event">Event</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="zelle">Zelle</option>
              <option value="credit_card">Credit Card</option>
              <option value="debit_card">Debit Card</option>
              <option value="ach">ACH</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="col-span-1 md:col-span-2 lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={dateRangeFilter}
              onChange={(e) => {
                setDateRangeFilter(e.target.value);
                if (e.target.value !== 'custom') {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dateRangeFilter === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={customStartDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Apply Filters Button */}
        <div className="mt-4">
          <button
            onClick={fetchTransactions}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GL Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Collected By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Receipt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(transaction.payment_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.member_id ? (transaction.member?.id ?? transaction.member_id) : (
                      <span className="italic text-gray-500">Anonymous</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.member_id ? (
                      <>
                        <div className="text-sm font-medium text-gray-900">
                          {transaction.member ? `${transaction.member.first_name} ${transaction.member.last_name}` : `Member ${transaction.member_id}`}
                        </div>
                        {transaction.member?.email && (
                          <div className="text-sm text-gray-500">
                            {transaction.member.email}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-900">
                            {parseDonorInfo(transaction.note)?.name || 'Anonymous Donor'}
                          </span>
                          <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            Non-Member
                          </span>
                        </div>
                        {parseDonorInfo(transaction.note)?.email && (
                          <div className="text-sm text-gray-500">
                            {parseDonorInfo(transaction.note)?.email}
                          </div>
                        )}
                        {parseDonorInfo(transaction.note)?.type && (
                          <div className="text-xs text-gray-400">
                            {parseDonorInfo(transaction.note)?.type === 'organization' ? 'Organization/Group' : 'Individual'}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {getPaymentTypeLabel(transaction.payment_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.incomeCategory ? (
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{transaction.incomeCategory.gl_code}</div>
                        <div className="text-xs text-gray-500">{transaction.incomeCategory.name}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Auto-assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      {getPaymentMethodLabel(transaction.payment_method)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {renderStatusBadge(transaction.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {transaction.collector ? `${transaction.collector.first_name} ${transaction.collector.last_name}` : `Collector ${transaction.collected_by}`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.receipt_number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.note || '-'}
                  </td>
                </tr>
              ))}
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

      {transactions.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-gray-500 text-lg font-medium">
            No transactions found
          </div>
          <div className="text-gray-400 text-sm mt-2">
            Try adjusting your filters or add a new transaction.
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionList; 