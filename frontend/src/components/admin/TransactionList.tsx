import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDateForDisplay } from '../../utils/dateUtils';

interface Transaction {
  id: number;
  member_id: number | null;
  collected_by: number;
  payment_date: string;
  amount: number;
  payment_type: 'membership_due' | 'tithe' | 'donation' | 'event' | 'tigray_hunger_fundraiser' | 'other';
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
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [receiptNumberFilter, setReceiptNumberFilter] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [minAmountFilter, setMinAmountFilter] = useState('');
  const [maxAmountFilter, setMaxAmountFilter] = useState('');
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
  }, [paymentTypeFilter, paymentMethodFilter, minAmountFilter, maxAmountFilter, dateRangeFilter, customStartDate, customEndDate, receiptNumberFilter, currentPage]);

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

      if (minAmountFilter.trim()) {
        params.append('min_amount', minAmountFilter.trim());
      }

      if (maxAmountFilter.trim()) {
        params.append('max_amount', maxAmountFilter.trim());
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
      membership_due: t('treasurerDashboard.transactionList.types.membership_due'),
      tithe: t('treasurerDashboard.transactionList.types.tithe'),
      donation: t('treasurerDashboard.transactionList.types.donation'),
      event: t('treasurerDashboard.transactionList.types.event'),
      tigray_hunger_fundraiser: t('treasurerDashboard.transactionList.types.tigray_hunger_fundraiser'),
      other: t('treasurerDashboard.transactionList.types.other')
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      cash: t('treasurerDashboard.transactionList.methods.cash'),
      check: t('treasurerDashboard.transactionList.methods.check'),
      zelle: t('treasurerDashboard.transactionList.methods.zelle'),
      credit_card: t('treasurerDashboard.transactionList.methods.credit_card'),
      debit_card: t('treasurerDashboard.transactionList.methods.debit_card'),
      ach: t('treasurerDashboard.transactionList.methods.ach'),
      other: t('treasurerDashboard.transactionList.methods.other')
    };
    return labels[method as keyof typeof labels] || method;
  };

  const renderStatusBadge = (status?: string) => {
    if (!status) return null;
    const map: Record<string, { text: string; classes: string }> = {
      pending: { text: t('treasurerDashboard.transactionList.status.pending'), classes: 'bg-yellow-100 text-yellow-800' },
      succeeded: { text: t('treasurerDashboard.transactionList.status.succeeded'), classes: 'bg-green-100 text-green-800' },
      failed: { text: t('treasurerDashboard.transactionList.status.failed'), classes: 'bg-red-100 text-red-800' },
      canceled: { text: t('treasurerDashboard.transactionList.status.canceled'), classes: 'bg-gray-100 text-gray-800' }
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

  const closeDetails = () => setSelectedTransaction(null);

  useEffect(() => {
    if (!selectedTransaction) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetails();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTransaction]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('treasurerDashboard.transactionList.filters.memberSearch')}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('treasurerDashboard.transactionList.filters.placeholder.search')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && searchTerm.trim().length < 3 && (
              <p className="mt-1 text-xs text-gray-500">Type at least 3 characters</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('treasurerDashboard.transactionList.filters.receiptNumber')}
            </label>
            <input
              type="text"
              value={receiptNumberFilter}
              onChange={(e) => setReceiptNumberFilter(e.target.value)}
              placeholder={t('treasurerDashboard.transactionList.filters.placeholder.receipt')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('treasurerDashboard.transactionList.filters.paymentType')}
            </label>
            <select
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('treasurerDashboard.transactionList.filters.options.allTypes')}</option>
              <option value="membership_due">{t('treasurerDashboard.transactionList.types.membership_due')}</option>
              <option value="tithe">{t('treasurerDashboard.transactionList.types.tithe')}</option>
              <option value="donation">{t('treasurerDashboard.transactionList.types.donation')}</option>
              <option value="event">{t('treasurerDashboard.transactionList.types.event')}</option>
              <option value="tigray_hunger_fundraiser">{t('treasurerDashboard.transactionList.types.tigray_hunger_fundraiser')}</option>
              <option value="other">{t('treasurerDashboard.transactionList.types.other')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('treasurerDashboard.transactionList.filters.paymentMethod')}
            </label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('treasurerDashboard.transactionList.filters.options.allMethods')}</option>
              <option value="cash">{t('treasurerDashboard.transactionList.methods.cash')}</option>
              <option value="check">{t('treasurerDashboard.transactionList.methods.check')}</option>
              <option value="zelle">{t('treasurerDashboard.transactionList.methods.zelle')}</option>
              <option value="credit_card">{t('treasurerDashboard.transactionList.methods.credit_card')}</option>
              <option value="debit_card">{t('treasurerDashboard.transactionList.methods.debit_card')}</option>
              <option value="ach">{t('treasurerDashboard.transactionList.methods.ach')}</option>
              <option value="other">{t('treasurerDashboard.transactionList.methods.other')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('treasurerDashboard.transactionList.filters.minAmount')}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={minAmountFilter}
              onChange={(e) => setMinAmountFilter(e.target.value)}
              placeholder={t('treasurerDashboard.transactionList.filters.placeholder.minAmount')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('treasurerDashboard.transactionList.filters.maxAmount')}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={maxAmountFilter}
              onChange={(e) => setMaxAmountFilter(e.target.value)}
              placeholder={t('treasurerDashboard.transactionList.filters.placeholder.maxAmount')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-1 md:col-span-2 lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('treasurerDashboard.transactionList.filters.dateRange')}
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
              <option value="all">{t('treasurerDashboard.transactionList.filters.options.allTime')}</option>
              <option value="today">{t('treasurerDashboard.transactionList.filters.options.today')}</option>
              <option value="week">{t('treasurerDashboard.transactionList.filters.options.week')}</option>
              <option value="month">{t('treasurerDashboard.transactionList.filters.options.month')}</option>
              <option value="year">{t('treasurerDashboard.transactionList.filters.options.year')}</option>
              <option value="custom">{t('treasurerDashboard.transactionList.filters.options.custom')}</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dateRangeFilter === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('treasurerDashboard.transactionList.filters.startDate')}
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
                {t('treasurerDashboard.transactionList.filters.endDate')}
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
            {t('treasurerDashboard.transactionList.filters.apply')}
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-100/80">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t('treasurerDashboard.transactionList.table.date')}
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t('treasurerDashboard.transactionList.table.member')}
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t('treasurerDashboard.transactionList.table.amount')}
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t('treasurerDashboard.transactionList.table.type')}
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t('treasurerDashboard.transactionList.table.method')}
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t('treasurerDashboard.transactionList.table.status')}
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t('treasurerDashboard.transactionList.table.receipt')}
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/70 transition-colors">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                    {formatDate(transaction.payment_date)}
                  </td>
                  <td className="px-6 py-4">
                    {transaction.member_id ? (
                      <>
                        <div className="text-sm font-semibold text-slate-900">
                          {transaction.member ? `${transaction.member.first_name} ${transaction.member.last_name}` : `Member ${transaction.member_id}`}
                        </div>
                        {transaction.member?.email && (
                          <div className="text-sm text-slate-500">
                            {transaction.member.email}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center">
                          <span className="text-sm font-semibold text-slate-900">
                            {parseDonorInfo(transaction.note)?.name || 'Anonymous Donor'}
                          </span>
                          <span className="ml-2 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
                            Non-Member
                          </span>
                        </div>
                        {parseDonorInfo(transaction.note)?.email && (
                          <div className="text-sm text-slate-500">
                            {parseDonorInfo(transaction.note)?.email}
                          </div>
                        )}
                        {parseDonorInfo(transaction.note)?.type && (
                          <div className="text-xs text-slate-400">
                            {parseDonorInfo(transaction.note)?.type === 'organization' ? 'Organization/Group' : 'Individual'}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                      {getPaymentTypeLabel(transaction.payment_type)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      {getPaymentMethodLabel(transaction.payment_method)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    {renderStatusBadge(transaction.status)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-900">
                    {transaction.receipt_number || '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                    <button
                      onClick={() => setSelectedTransaction(transaction)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        selectedTransaction?.id === transaction.id
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-md px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {t('treasurerDashboard.transactionList.pagination.page')} {currentPage} {t('treasurerDashboard.transactionList.pagination.of')} {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('treasurerDashboard.transactionList.pagination.previous')}
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('treasurerDashboard.transactionList.pagination.next')}
              </button>
            </div>
          </div>
        </div>
      )}

      {transactions.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-gray-500 text-lg font-medium">
            {t('treasurerDashboard.transactionList.empty.title')}
          </div>
          <div className="text-gray-400 text-sm mt-2">
            {t('treasurerDashboard.transactionList.empty.desc')}
          </div>
        </div>
      )}

      {selectedTransaction && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closeDetails} aria-hidden="true" />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-900 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-white">Payment Details</p>
                <p className="mt-1 text-xs text-slate-300">Transaction #{selectedTransaction.id}</p>
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
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(selectedTransaction.payment_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Amount</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(selectedTransaction.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Status</p>
                    <div className="mt-1">{renderStatusBadge(selectedTransaction.status)}</div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Method</p>
                    <div className="mt-1">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {getPaymentMethodLabel(selectedTransaction.payment_method)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Member</p>
                {selectedTransaction.member_id ? (
                  <>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {selectedTransaction.member
                        ? `${selectedTransaction.member.first_name} ${selectedTransaction.member.last_name}`
                        : `Member ${selectedTransaction.member_id}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">Member ID: {selectedTransaction.member?.id ?? selectedTransaction.member_id}</p>
                    {selectedTransaction.member?.email && <p className="mt-1 text-sm text-slate-500">{selectedTransaction.member.email}</p>}
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{parseDonorInfo(selectedTransaction.note)?.name || 'Anonymous Donor'}</p>
                    <p className="mt-1 text-sm text-slate-500">Anonymous / non-member payment</p>
                    {parseDonorInfo(selectedTransaction.note)?.email && (
                      <p className="mt-1 text-sm text-slate-500">{parseDonorInfo(selectedTransaction.note)?.email}</p>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Classification</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                    {getPaymentTypeLabel(selectedTransaction.payment_type)}
                  </span>
                  {selectedTransaction.incomeCategory ? (
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      GL {selectedTransaction.incomeCategory.gl_code}: {selectedTransaction.incomeCategory.name}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      GL auto-assigned
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Record Info</p>
                <dl className="mt-3 space-y-3">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Receipt Number</dt>
                    <dd className="mt-1 text-sm text-slate-900">{selectedTransaction.receipt_number || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Collected By</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {selectedTransaction.collector
                        ? `${selectedTransaction.collector.first_name} ${selectedTransaction.collector.last_name}`
                        : `Collector ${selectedTransaction.collected_by}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Created</dt>
                    <dd className="mt-1 text-sm text-slate-900">{formatDate(selectedTransaction.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Notes</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selectedTransaction.note || '-'}</dd>
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

export default TransactionList; 
