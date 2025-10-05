import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

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
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['cash', 'check', 'zelle']));

  // Helper function to get the Monday of a given date's week
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
    
    // Format as YYYY-MM-DD
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const day = String(monday.getDate()).padStart(2, '0');
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
    return new Date(dateString).toLocaleDateString('en-US', {
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
    return method.charAt(0).toUpperCase() + method.slice(1);
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
    <div className="space-y-6">
      {/* Header with Week Selector */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            📅 Weekly Collection & Expense Report
          </h2>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-4">
            <button
              onClick={goToPreviousWeek}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              ← Previous Week
            </button>

            <div className="flex flex-col">
              <input
                type="date"
                value={weekStart}
                onChange={handleDateChange}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Select any date - will automatically adjust to the Monday of that week"
              />
              <span className="text-xs text-gray-500 mt-1">
                📌 Week starts on Monday
              </span>
            </div>

            <button
              onClick={goToNextWeek}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Next Week →
            </button>

            <div className="flex-1 text-right">
              <span className="text-lg font-semibold text-gray-700">
                {formatDate(reportData.weekStart)} - {formatDate(reportData.weekEnd)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Net Deposit Summary Card */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <h3 className="text-xl font-semibold mb-4">💰 Total Net to Deposit</h3>
        <div className="text-4xl font-bold mb-4">
          {formatCurrency(reportData.summary.netTotal)}
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="opacity-90">Total Income</div>
            <div className="text-2xl font-semibold">{formatCurrency(reportData.summary.totalIncome)}</div>
          </div>
          <div>
            <div className="opacity-90">Total Expenses</div>
            <div className="text-2xl font-semibold">-{formatCurrency(reportData.summary.totalExpenses)}</div>
          </div>
          <div>
            <div className="opacity-90">Transactions</div>
            <div className="text-2xl font-semibold">{reportData.summary.totalTransactions}</div>
          </div>
        </div>
      </div>

      {/* Payment Method Sections */}
      {Object.entries(reportData.byPaymentMethod).map(([method, data]) => {
        const isExpanded = expandedSections.has(method);
        const netColor = data.netToDeposit >= 0 ? 'text-green-600' : 'text-red-600';

        return (
          <div key={method} className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Section Header */}
            <div
              className="bg-gray-50 px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleSection(method)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{getPaymentMethodIcon(method)}</span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {getPaymentMethodLabel(method)} Transactions
                    </h3>
                    <p className="text-sm text-gray-600">
                      Income: {formatCurrency(data.totalIncome)} | 
                      Expenses: {formatCurrency(data.totalExpenses)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-1">Net to Deposit</div>
                  <div className={`text-2xl font-bold ${netColor}`}>
                    {formatCurrency(data.netToDeposit)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {isExpanded ? '▲ Hide' : '▼ Show'} Details
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
                      ⬆️ Income ({data.income.length} transactions)
                    </h4>
                    <div className="bg-green-50 rounded-lg overflow-hidden">
                      <table className="min-w-full">
                        <thead className="bg-green-100">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-green-800">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-green-800">Type</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-green-800">Member Name</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-green-800">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-200">
                          {data.income.map((transaction) => (
                            <tr key={transaction.id} className="hover:bg-green-100">
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {formatDate(transaction.entry_date)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700 capitalize">
                                {transaction.type.replace('_', ' ')}
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
                      ⬇️ Expenses ({data.expenses.length} transactions)
                    </h4>
                    <div className="bg-red-50 rounded-lg overflow-hidden">
                      <table className="min-w-full">
                        <thead className="bg-red-100">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-800">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-800">Category</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-red-800">Recorded By</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-red-800">Amount</th>
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
                    No transactions for this payment method
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {Object.keys(reportData.byPaymentMethod).length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          No transactions found for this week
        </div>
      )}
    </div>
  );
};

export default WeeklyCollectionReport;
