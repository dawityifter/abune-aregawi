import React, { useState, useEffect, useCallback } from 'react';
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
  invoice_number?: string;
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

interface ExpenseListProps {
  /** Shows the Edit control in the details drawer. The API is guarded separately. */
  canEdit?: boolean;
  /** Called after a successful edit so the dashboard can refresh stats/check gaps. */
  onExpenseChanged?: () => void;
}

interface EditForm {
  gl_code: string;
  amount: string;
  entry_date: string;
  payment_method: 'cash' | 'check';
  check_number: string;
  receipt_number: string;
  invoice_number: string;
  memo: string;
}

const ExpenseList: React.FC<ExpenseListProps> = ({ canEdit = false, onExpenseChanged }) => {
  const { firebaseUser } = useAuth();
  const { t } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [glCodeFilter, setGlCodeFilter] = useState('');
  const [payeeFilter, setPayeeFilter] = useState('');

  const fetchCategories = useCallback(async () => {
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
  }, [firebaseUser]);

  const fetchExpenses = useCallback(async () => {
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
  }, [firebaseUser, page, startDate, endDate, glCodeFilter, payeeFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      fetchExpenses();
    };
    window.addEventListener('expenses:refresh' as any, handleRefresh);
    return () => window.removeEventListener('expenses:refresh' as any, handleRefresh);
  }, [fetchExpenses]);

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

  const closeDetails = () => {
    setSelectedExpense(null);
    setIsEditing(false);
    setEditForm(null);
    setEditError(null);
  };

  useEffect(() => {
    if (!selectedExpense) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetails();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedExpense]);

  const startEditing = () => {
    if (!selectedExpense) return;
    setEditForm({
      gl_code: selectedExpense.category || '',
      amount: String(selectedExpense.amount ?? ''),
      // entry_date can arrive as a full ISO timestamp; the date input needs YYYY-MM-DD
      entry_date: (selectedExpense.entry_date || '').split('T')[0],
      payment_method: selectedExpense.payment_method === 'cash' ? 'cash' : 'check',
      check_number: selectedExpense.check_number || '',
      receipt_number: selectedExpense.receipt_number || '',
      invoice_number: selectedExpense.invoice_number || '',
      memo: selectedExpense.memo || ''
    });
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(null);
    setEditError(null);
  };

  const updateEditField = <K extends keyof EditForm>(field: K, value: EditForm[K]) => {
    setEditForm(prev => (prev ? { ...prev, [field]: value } : prev));
    setEditError(null);
  };

  const validateEdit = (form: EditForm): string | null => {
    if (!form.gl_code) return t('treasurerDashboard.expenses.edit.categoryRequired');

    const amountValue = parseFloat(form.amount);
    if (!form.amount || !Number.isFinite(amountValue) || amountValue <= 0) {
      return t('treasurerDashboard.expenses.edit.amountInvalid');
    }

    if (!form.entry_date) return t('treasurerDashboard.expenses.edit.dateRequired');
    const selected = new Date(form.entry_date + 'T00:00:00');
    const todayCST = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
    todayCST.setHours(23, 59, 59, 999);
    if (selected > todayCST) return t('treasurerDashboard.expenses.edit.dateFuture');

    if (form.payment_method === 'check' && !form.check_number.trim()) {
      return t('treasurerDashboard.expenses.addModal.checkNumberRequired');
    }

    return null;
  };

  const handleSaveEdit = async () => {
    if (!selectedExpense || !editForm) return;

    const validationError = validateEdit(editForm);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    try {
      setSaving(true);
      setEditError(null);
      const token = await firebaseUser?.getIdToken();

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/expenses/${selectedExpense.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            gl_code: editForm.gl_code,
            amount: parseFloat(editForm.amount),
            expense_date: editForm.entry_date,
            payment_method: editForm.payment_method,
            check_number: editForm.payment_method === 'check' ? editForm.check_number.trim() : null,
            receipt_number: editForm.receipt_number.trim() || null,
            invoice_number: editForm.invoice_number.trim() || null,
            memo: editForm.memo.trim() || null
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        const category = categories.find(c => c.gl_code === editForm.gl_code);
        const updated: Expense = {
          ...selectedExpense,
          ...data.data,
          category: editForm.gl_code,
          category_name: category?.name || selectedExpense.category_name
        };
        setSelectedExpense(updated);
        setExpenses(prev => prev.map(e => (e.id === updated.id ? updated : e)));
        setIsEditing(false);
        setEditForm(null);
        // Re-run the query so filters, ordering and totals stay consistent
        fetchExpenses();
        onExpenseChanged?.();
      } else {
        // Keeps the form open with the user's input so a 409 can be corrected
        setEditError(data.message || t('treasurerDashboard.expenses.edit.saveFailed'));
      }
    } catch (err) {
      console.error('Error updating expense:', err);
      setEditError(t('treasurerDashboard.expenses.edit.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /** Check payments recorded before the check number became mandatory. */
  const isMissingCheckNumber = (expense: Expense) =>
    expense.payment_method === 'check' && !expense.check_number;

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
                        {expense.payment_method === 'check' && (
                          expense.check_number ? (
                            <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              #{expense.check_number}
                            </span>
                          ) : (
                            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                              <i className="fas fa-exclamation-triangle mr-1"></i>
                              {t('treasurerDashboard.expenses.missingCheckNumber')}
                            </span>
                          )
                        )}
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
              <div className="flex items-center gap-2">
                {canEdit && !isEditing && (
                  <button
                    onClick={startEditing}
                    className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    {t('treasurerDashboard.expenses.edit.edit')}
                  </button>
                )}
                <button
                  onClick={closeDetails}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                  aria-label="Close details"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {isEditing && editForm ? (
                <>
                  {editError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {editError}
                    </div>
                  )}

                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('treasurerDashboard.expenses.addModal.category')} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={editForm.gl_code}
                        onChange={(e) => updateEditField('gl_code', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.gl_code}>
                            {cat.gl_code} - {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('treasurerDashboard.expenses.addModal.amount')} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editForm.amount}
                          onChange={(e) => {
                            if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) {
                              updateEditField('amount', e.target.value);
                            }
                          }}
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('treasurerDashboard.expenses.addModal.date')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={editForm.entry_date}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => updateEditField('entry_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('treasurerDashboard.expenses.addModal.paymentMethod')} <span className="text-red-500">*</span>
                      </label>
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            checked={editForm.payment_method === 'cash'}
                            onChange={() => updateEditField('payment_method', 'cash')}
                            className="mr-2"
                          />
                          {t('treasurerDashboard.transactionList.methods.cash')}
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            checked={editForm.payment_method === 'check'}
                            onChange={() => updateEditField('payment_method', 'check')}
                            className="mr-2"
                          />
                          {t('treasurerDashboard.transactionList.methods.check')}
                        </label>
                      </div>
                    </div>

                    {editForm.payment_method === 'check' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('treasurerDashboard.expenses.addModal.checkNumber')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.check_number}
                          onChange={(e) => updateEditField('check_number', e.target.value)}
                          placeholder="CHK-1234"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('treasurerDashboard.expenses.addModal.receiptNumber')}
                      </label>
                      <input
                        type="text"
                        value={editForm.receipt_number}
                        onChange={(e) => updateEditField('receipt_number', e.target.value)}
                        placeholder="REC-1234"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('treasurerDashboard.expenses.invoiceNumber')}
                      </label>
                      <input
                        type="text"
                        value={editForm.invoice_number}
                        onChange={(e) => updateEditField('invoice_number', e.target.value)}
                        placeholder="INV-2024-001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('treasurerDashboard.expenses.addModal.memo')}
                      </label>
                      <textarea
                        value={editForm.memo}
                        onChange={(e) => updateEditField('memo', e.target.value)}
                        maxLength={500}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Payee is deliberately not editable — changing who was paid is
                      a delete-and-recreate, not an edit. */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Payee</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {selectedExpense.employee
                        ? `${selectedExpense.employee.first_name} ${selectedExpense.employee.last_name}`
                        : selectedExpense.vendor
                          ? selectedExpense.vendor.name
                          : selectedExpense.payee_name || '-'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t('treasurerDashboard.expenses.edit.payeeReadOnly')}
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={saving}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {t('treasurerDashboard.expenses.edit.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving
                        ? t('treasurerDashboard.expenses.edit.saving')
                        : t('treasurerDashboard.expenses.edit.save')}
                    </button>
                  </div>
                </>
              ) : (
                <>
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
                  {selectedExpense.payment_method === 'check' && (
                    <div>
                      <dt className="text-xs font-medium text-slate-500">
                        {t('treasurerDashboard.expenses.addModal.checkNumber')}
                      </dt>
                      <dd className="mt-1 text-sm text-slate-900">
                        {selectedExpense.check_number || (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            <i className="fas fa-exclamation-triangle mr-1"></i>
                            {t('treasurerDashboard.expenses.missingCheckNumber')}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-medium text-slate-500">
                      {t('treasurerDashboard.expenses.invoiceNumber')}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900">{selectedExpense.invoice_number || '-'}</dd>
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
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExpenseList;
