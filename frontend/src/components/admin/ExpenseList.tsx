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
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [glCodeFilter, setGlCodeFilter] = useState('');
  const [payeeFilter, setPayeeFilter] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [page, startDate, endDate, glCodeFilter, payeeFilter]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      fetchExpenses();
    };
    window.addEventListener('expenses:refresh' as any, handleRefresh);
    return () => window.removeEventListener('expenses:refresh' as any, handleRefresh);
  }, [page, startDate, endDate, glCodeFilter, payeeFilter]);

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
        page: page.toString(),
        limit: '20'
      });

      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (glCodeFilter) params.append('gl_code', glCodeFilter);
      if (payeeFilter) params.append('payee', payeeFilter);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/expenses?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setExpenses(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalItems(data.pagination?.totalItems || 0);
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
    setPayeeFilter('');
    setPage(1);
  };

  const closeDetails = () => setSelectedExpense(null);

  useEffect(() => {
    if (!selectedExpense) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetails();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedExpense]);

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

          {/* Payee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payee
            </label>
            <input
              type="text"
              placeholder="Search payee..."
              value={payeeFilter}
              onChange={(e) => {
                setPayeeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {(startDate || endDate || glCodeFilter || payeeFilter) && (
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
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4">
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
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100/80">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t('treasurerDashboard.expenses.table.date')}
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t('treasurerDashboard.expenses.table.category')}
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t('treasurerDashboard.expenses.table.payee')}
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t('treasurerDashboard.expenses.table.amount')}
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t('treasurerDashboard.expenses.table.method')}
                    </th>
                    <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/70 transition-colors">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                        {formatDate(expense.entry_date)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="text-sm font-semibold text-slate-900">
                          {expense.category}
                        </div>
                        <div className="text-sm text-slate-500">
                          {expense.category_name}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {getPayeeDisplay(expense)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${expense.payment_method === 'cash'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                          }`}>
                          {expense.payment_method.toUpperCase()}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                        <button
                          onClick={() => setSelectedExpense(expense)}
                          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            selectedExpense?.id === expense.id
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50'
                          }`}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-6 py-4">
                <div className="text-sm text-slate-700">
                  {t('treasurerDashboard.transactionList.pagination.page')} {page} {t('treasurerDashboard.transactionList.pagination.of')} {totalPages}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
                  >
                    {t('treasurerDashboard.transactionList.pagination.previous')}
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50"
                  >
                    {t('treasurerDashboard.transactionList.pagination.next')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedExpense && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closeDetails} aria-hidden="true" />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-900 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-white">Expense Details</p>
                <p className="mt-1 text-xs text-slate-300">Expense #{selectedExpense.id}</p>
              </div>
              <button
                onClick={closeDetails}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Date</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(selectedExpense.entry_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Amount</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(selectedExpense.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Method</p>
                    <div className="mt-1">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${selectedExpense.payment_method === 'cash'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                        }`}>
                        {selectedExpense.payment_method.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Category</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedExpense.category}</p>
                    <p className="mt-1 text-xs text-slate-500">{selectedExpense.category_name}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Payee</p>
                <div className="mt-2">
                  {selectedExpense.employee ? (
                    <>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedExpense.employee.first_name} {selectedExpense.employee.last_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">Employee · {selectedExpense.employee.position}</p>
                    </>
                  ) : selectedExpense.vendor ? (
                    <>
                      <p className="text-sm font-semibold text-slate-900">{selectedExpense.vendor.name}</p>
                      <p className="mt-1 text-sm text-slate-500">Vendor · {selectedExpense.vendor.vendor_type}</p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-slate-900">{selectedExpense.payee_name || '-'}</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Record Info</p>
                <dl className="mt-3 space-y-3">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">{t('check')} / {t('treasurerDashboard.transactionList.table.receipt')}</dt>
                    <dd className="mt-1 text-sm text-slate-900">{selectedExpense.check_number || selectedExpense.receipt_number || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Category Description</dt>
                    <dd className="mt-1 text-sm text-slate-700">{selectedExpense.category_description || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Recorded By</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {selectedExpense.collector
                        ? `${selectedExpense.collector.first_name} ${selectedExpense.collector.last_name}`
                        : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Memo</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selectedExpense.memo || '-'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExpenseList;
