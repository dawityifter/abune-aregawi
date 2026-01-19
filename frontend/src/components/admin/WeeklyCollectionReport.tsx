import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDateForDisplay } from '../../utils/dateUtils';

interface Transaction {
  id: string;
  type: string;
  category: string;
  member_id: number | null;
  member_name: string | null;
  collected_by: number;
  collector_name: string;
  amount: number;
  entry_date: string;
  receipt_number: string | null;
  memo: string | null;
}

interface PaymentMethodData {
  income: Transaction[];
  expenses: Transaction[];
  totalIncome: number;
  totalExpenses: number;
  netToDeposit: number;
}

interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  byPaymentMethod: Record<string, PaymentMethodData>;
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netTotal: number;
    totalTransactions: number;
    depositBreakdown: Record<string, number>;
  };
}

const WeeklyCollectionReport: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { t } = useLanguage();
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['cash', 'check', 'zelle']));

  // Helper function to get the Monday of a given date's week in CST
  const getMondayOfWeek = (date: Date | string): string => {
    // If string is passed, parse it carefully to avoid timezone issues
    let workingDate: Date;
    if (typeof date === 'string') {
      const [year, month, day] = date.split('-').map(Number);
      workingDate = new Date(year, month - 1, day);
    } else {
      workingDate = new Date(date);
    }

    const dayOfWeek = workingDate.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday (0), go back 6 days; otherwise go to Monday
    const monday = new Date(workingDate);
    monday.setDate(workingDate.getDate() + diff);

    // Format as YYYY-MM-DD in CST timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(monday);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    // Set default to current week's Monday
    const today = new Date();
    setWeekStart(getMondayOfWeek(today));
  }, []);

  useEffect(() => {
    if (weekStart) {
      fetchReport();
    }
  }, [weekStart]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const token = await firebaseUser?.getIdToken();

      const params = new URLSearchParams();
      if (weekStart) params.append('week_start', weekStart);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/payments/weekly-report?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReportData(data.data);
      } else {
        console.error('Failed to fetch weekly report');
      }
    } catch (error) {
      console.error('Error fetching weekly report:', error);
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
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'cash': return '💵';
      case 'check': return '📝';
      case 'zelle': return '📱';
      case 'card': return '💳';
      default: return '💰';
    }
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

  const getPaymentTypeLabel = (type: string) => {
    const labels = {
      membership_due: t('treasurerDashboard.transactionList.types.membership_due'),
      tithe: t('treasurerDashboard.transactionList.types.tithe'),
      donation: t('treasurerDashboard.transactionList.types.donation'),
      event: t('treasurerDashboard.transactionList.types.event'),
      tigray_hunger_fundraiser: t('treasurerDashboard.transactionList.types.tigray_hunger_fundraiser'),
      other: t('treasurerDashboard.transactionList.types.other')
    };
    return labels[type as keyof typeof labels] || type.split('_').join(' ');
  };

  const toggleSection = (method: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(method)) {
      newExpanded.delete(method);
    } else {
      newExpanded.add(method);
    }
    setExpandedSections(newExpanded);
  };

  const goToPreviousWeek = () => {
    const [year, month, day] = weekStart.split('-').map(Number);
    const current = new Date(year, month - 1, day);
    current.setDate(current.getDate() - 7);
    setWeekStart(getMondayOfWeek(current)); // Ensure it's a Monday
  };

  const goToNextWeek = () => {
    const [year, month, day] = weekStart.split('-').map(Number);
    const current = new Date(year, month - 1, day);
    current.setDate(current.getDate() + 7);
    setWeekStart(getMondayOfWeek(current)); // Ensure it's a Monday
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDateStr = e.target.value;
    // Always adjust to the Monday of the selected week
    setWeekStart(getMondayOfWeek(selectedDateStr));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!reportData) {
    return <div className="text-center py-12 text-gray-500">No data available</div>;
  }

  return (
    <div className="space-y-6 print:space-y-0">
      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 font-serif">Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church</h1>
        <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString()}</p>
      </div>

      {/* Header with Week Selector */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {t('treasurerDashboard.reportTabs.weekly.title')}
          </h2>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-4">
            <button
              onClick={goToPreviousWeek}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 print:hidden"
            >
              ← {t('treasurerDashboard.reportTabs.weekly.previous')}
            </button>

            <div className="flex flex-col">
              <input
                type="date"
                value={weekStart}
                onChange={handleDateChange}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 print:hidden"
                title="Select any date - will automatically adjust to the Monday of that week"
              />
              <span className="text-xs text-gray-500 mt-1 print:hidden">
                📌 Week starts on Monday
              </span>
            </div>

            <button
              onClick={goToNextWeek}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 print:hidden"
            >
              {t('treasurerDashboard.reportTabs.weekly.next')} →
            </button>

            <div className="flex-1 text-right print:text-center">
              <span className="text-lg font-semibold text-gray-700">
                {formatDate(reportData.weekStart)} - {formatDate(reportData.weekEnd)}
              </span>
            </div>
          </div>
          <div className="mt-4 flex justify-end print:hidden">
            <button
              onClick={() => {
                if (reportData?.byPaymentMethod) {
                  const allMethodKeys = Object.keys(reportData.byPaymentMethod);
                  setExpandedSections(new Set(allMethodKeys));
                  // Allow state to update and render before printing
                  setTimeout(() => window.print(), 100);
                }
              }}
              disabled={loading || !reportData}
              className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium flex items-center"
            >
              <i className="fas fa-print mr-2"></i>
              {t('common.print')}
            </button>
          </div>
        </div>
      </div>

      {/* Net Deposit Summary Card */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white print:bg-none print:text-black print:shadow-none print:border print:border-gray-800">
        <h3 className="text-xl font-semibold mb-4">{t('treasurerDashboard.reportTabs.weekly.netDeposit')}</h3>
        <div className="text-4xl font-bold mb-4">
          {formatCurrency(reportData.summary.netTotal)}
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="opacity-90">{t('treasurerDashboard.reportTabs.weekly.income')}</div>
            <div className="text-2xl font-semibold">{formatCurrency(reportData.summary.totalIncome)}</div>
          </div>
          <div>
            <div className="opacity-90">{t('treasurerDashboard.transactionList.types.event')}s</div>
            <div className="text-2xl font-semibold">-{formatCurrency(reportData.summary.totalExpenses)}</div>
          </div>
          <div>
            <div className="opacity-90">{t('treasurerDashboard.reportTabs.weekly.transactions')}</div>
            <div className="text-2xl font-semibold">{reportData.summary.totalTransactions}</div>
          </div>
        </div>
      </div>

      {/* Payment Method Sections */}
      {Object.entries(reportData.byPaymentMethod).map(([method, data]) => {
        const isExpanded = expandedSections.has(method);
        const netColor = data.netToDeposit >= 0 ? 'text-green-600' : 'text-red-600';

        return (
          <div key={method} className="bg-white rounded-lg shadow-md overflow-hidden print:shadow-none print:overflow-visible print:break-inside-avoid print:mb-4">
            {/* Section Header */}
            <div
              className={`bg-gray-50 px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors print:bg-white print:px-0 print:py-2 ${expandedSections.has(method) ? 'print:border-b-2 print:border-gray-800' : ''}`}
              onClick={() => toggleSection(method)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl print:hidden">{getPaymentMethodIcon(method)}</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 print:text-lg">
                      {getPaymentMethodLabel(method)} {t('treasurerDashboard.reportTabs.weekly.transactions')}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {t('treasurerDashboard.paymentStats.netIncome')}: {formatCurrency(data.totalIncome)} |
                      {t('treasurerDashboard.paymentStats.totalExpenses')}: {formatCurrency(data.totalExpenses)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-1">{t('treasurerDashboard.reportTabs.weekly.netToDeposit')}</div>
                  <div className={`text-2xl font-bold ${netColor}`}>
                    {formatCurrency(data.netToDeposit)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {isExpanded ? `▲ ${t('treasurerDashboard.reportTabs.weekly.hide')}` : `▼ ${t('treasurerDashboard.reportTabs.weekly.show')}`} {t('treasurerDashboard.reportTabs.weekly.details')}
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="p-6 space-y-6">
                {/* Income Section */}
                {data.income.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-green-700 mb-3">
                      ⬆️ {t('treasurerDashboard.reportTabs.weekly.income')} ({data.income.length} {t('treasurerDashboard.reportTabs.weekly.transactions')})
                    </h4>
                    <div className="bg-green-50 rounded-lg overflow-hidden">
                      <table className="min-w-full">
                        <thead className="bg-green-100">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-green-800">{t('treasurerDashboard.transactionList.table.date')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-green-800">{t('treasurerDashboard.transactionList.table.type')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-green-800">{t('treasurerDashboard.transactionList.table.member')}</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-green-800">{t('treasurerDashboard.transactionList.table.amount')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-200">
                          {data.income.map((transaction) => (
                            <tr key={transaction.id} className="hover:bg-green-100">
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {formatDate(transaction.entry_date)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {getPaymentTypeLabel(transaction.type)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {transaction.member_name || 'Anonymous'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-semibold text-green-700">
                                +{formatCurrency(transaction.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Expenses Section */}
                {data.expenses.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-red-700 mb-3">
                      ⬇️ {t('treasurerDashboard.paymentStats.totalExpenses')} ({data.expenses.length} {t('treasurerDashboard.reportTabs.weekly.transactions')})
                    </h4>
                    <div className="bg-red-50 rounded-lg overflow-hidden">
                      <table className="min-w-full">
                        <thead className="bg-red-100">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-800">{t('treasurerDashboard.expenses.table.date')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-800">{t('treasurerDashboard.expenses.table.category')}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-800">{t('treasurerDashboard.expenses.table.recordedBy')}</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-red-800">{t('treasurerDashboard.expenses.table.amount')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-200">
                          {data.expenses.map((transaction) => (
                            <tr key={transaction.id} className="hover:bg-red-100">
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {formatDate(transaction.entry_date)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {transaction.category}
                                {transaction.memo && (
                                  <div className="text-xs text-gray-500">{transaction.memo}</div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {transaction.collector_name}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-semibold text-red-700">
                                -{formatCurrency(transaction.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {data.income.length === 0 && data.expenses.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    {t('treasurerDashboard.reportTabs.weekly.empty')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {Object.keys(reportData.byPaymentMethod).length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          {t('treasurerDashboard.reportTabs.weekly.empty')}
        </div>
      )}


      {/* Print Footer */}
      <div className="hidden print:block fixed bottom-0 left-0 w-full text-center p-4 border-t border-gray-300">
        <p className="text-sm text-gray-600">
          <a href="https://abunearegawi.church" className="text-blue-600 hover:underline">https://abunearegawi.church</a>
        </p>
      </div>
    </div >
  );
};

export default WeeklyCollectionReport;
