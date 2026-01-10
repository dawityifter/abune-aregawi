import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDateForDisplay } from '../../utils/dateUtils';

interface Expense {
  id: string;
  category: string;
  category_name: string;
  category_description: string;
  amount: number;
  entry_date: string;
  payment_method: string;
  receipt_number: string;
  check_number: string;
  memo: string;
  payee_name?: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    position: string;
  };
  vendor?: {
    id: string;
    name: string;
    vendor_type: string;
  };
  collector?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  created_at: string;
}

interface ExpenseCategory {
  id: string;
  gl_code: string;
  name: string;
}

const ExpenseList: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [glCodeFilter, setGlCodeFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [page, startDate, endDate, glCodeFilter, paymentMethodFilter]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      fetchExpenses();
    };
    window.addEventListener('expenses:refresh' as any, handleRefresh);
    return () => window.removeEventListener('expenses:refresh' as any, handleRefresh);
  }, [page, startDate, endDate, glCodeFilter, paymentMethodFilter]);

  const fetchCategories = async () => {
    try {
      const token = await firebaseUser?.getIdToken();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/expenses/categories`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const token = await firebaseUser?.getIdToken();

      const params = new URLSearchParams({
        page: (page - 1).toString(), // Spring is 0-indexed
        size: '10'
      });

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (glCodeFilter) params.append('glCode', glCodeFilter);
      if (paymentMethodFilter) params.append('paymentMethod', paymentMethodFilter);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/expenses?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const expenseList = data.data.content || data.data.expenses || [];
        setExpenses(expenseList);
        setTotalPages(data.data.totalPages || data.data.pagination?.total_pages || 1);
        setTotalItems(data.data.totalElements || data.data.pagination?.total_items || 0);
      }
    } catch (err) {
      console.error('Error fetching expenses:', err);
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

  const getPayeeDisplay = (expense: Expense) => {
    if (expense.employee) {
      return (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {expense.employee.first_name} {expense.employee.last_name}
          </div>
          <div className="text-xs text-gray-500">{t('treasurerDashboard.expenses.table.employee')}</div>
        </div>
      );
    }
    if (expense.vendor) {
      return (
        <div>
          <div className="text-sm font-medium text-gray-900">
            {expense.vendor.name}
          </div>
          <div className="text-xs text-gray-500">{t('treasurerDashboard.expenses.table.vendor')}</div>
        </div>
      );
    }
    if (expense.payee_name) {
      return (
        <div className="text-sm text-gray-900">
          {expense.payee_name}
        </div>
      );
    }
    return <span className="text-sm text-gray-400">-</span>;
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setGlCodeFilter('');
    setPaymentMethodFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('treasurerDashboard.expenses.filters.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('treasurerDashboard.expenses.filters.startDate')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('treasurerDashboard.expenses.filters.endDate')}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* GL Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('treasurerDashboard.expenses.filters.category')}
            </label>
            <select
              value={glCodeFilter}
              onChange={(e) => {
                setGlCodeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('treasurerDashboard.expenses.filters.allCategories')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.gl_code}>
                  {cat.gl_code} - {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('treasurerDashboard.expenses.filters.paymentMethod')}
            </label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => {
                setPaymentMethodFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('treasurerDashboard.expenses.filters.allMethods')}</option>
              <option value="cash">{t('treasurerDashboard.transactionList.methods.cash')}</option>
              <option value="check">{t('treasurerDashboard.transactionList.methods.check')}</option>
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {(startDate || endDate || glCodeFilter || paymentMethodFilter) && (
          <div className="mt-4">
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              {t('treasurerDashboard.expenses.filters.clear')}
            </button>
          </div>
        )}
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('treasurerDashboard.expenses.table.title')} ({totalItems})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">{t('treasurerDashboard.expenses.table.loading')}</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {t('treasurerDashboard.expenses.table.empty')}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('treasurerDashboard.expenses.table.date')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('treasurerDashboard.expenses.table.category')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('treasurerDashboard.expenses.table.payee')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('treasurerDashboard.expenses.table.amount')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('treasurerDashboard.expenses.table.method')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('treasurerDashboard.expenses.table.checkNumber')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('treasurerDashboard.expenses.table.recordedBy')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('treasurerDashboard.expenses.table.memo')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(expense.entry_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {expense.category}
                        </div>
                        <div className="text-sm text-gray-500">
                          {expense.category_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPayeeDisplay(expense)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${expense.payment_method === 'cash'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                          }`}>
                          {expense.payment_method.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {expense.check_number || expense.receipt_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {expense.collector
                          ? `${expense.collector.first_name} ${expense.collector.last_name}`
                          : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {expense.memo || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {t('treasurerDashboard.transactionList.pagination.page')} {page} {t('treasurerDashboard.transactionList.pagination.of')} {totalPages}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    {t('treasurerDashboard.transactionList.pagination.previous')}
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    {t('treasurerDashboard.transactionList.pagination.next')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ExpenseList;
