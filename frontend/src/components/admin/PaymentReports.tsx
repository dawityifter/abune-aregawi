import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface ReportData {
  summary?: {
    totalMembers: number;
    upToDateMembers: number;
    behindMembers: number;
    totalAmountDue: number;
    totalCollected: number;
    collectionRate: string;
  };
  behindPayments?: Array<{
    id: number;
    memberName: string;
    totalAmountDue: number;
    totalCollected: number;
    balanceDue: number;
    member?: {
      firstName: string;
      lastName: string;
      memberId: string;
      phoneNumber: string;
      email: string;
    };
  }>;
  monthlyTotals?: {
    january: number;
    february: number;
    march: number;
    april: number;
    may: number;
    june: number;
    july: number;
    august: number;
    september: number;
    october: number;
    november: number;
    december: number;
  };
}

interface PaymentReportsProps {
  paymentView: 'old' | 'new';
}

const PaymentReports: React.FC<PaymentReportsProps> = ({ paymentView }) => {
  const { currentUser, firebaseUser } = useAuth();
  const { t } = useLanguage();
  const [reportType, setReportType] = useState<'summary' | 'behind_payments' | 'monthly_breakdown'>('summary');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [reportType, paymentView]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      // Use different endpoints based on the selected view
      const baseEndpoint = paymentView === 'new' ? '/api/transactions' : '/api/payments';
      const response = await fetch(`${process.env.REACT_APP_API_URL}${baseEndpoint}/reports/${reportType}?email=${encodeURIComponent(currentUser?.email || '')}`, {
        headers: {
          'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReportData(data.data);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
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

  const renderSummaryReport = () => {
    if (!reportData?.summary) return null;

    const { summary } = reportData;
    const stats = [
      { label: t('treasurerDashboard.reportTabs.paymentReports.summary.totalMembers'), value: summary.totalMembers, color: 'bg-blue-500' },
      { label: t('treasurerDashboard.reportTabs.paymentReports.summary.upToDate'), value: summary.upToDateMembers, color: 'bg-green-500' },
      { label: t('treasurerDashboard.reportTabs.paymentReports.summary.behind'), value: summary.behindMembers, color: 'bg-red-500' },
      { label: t('treasurerDashboard.reportTabs.paymentReports.summary.collectionRate'), value: `${summary.collectionRate}%`, color: 'bg-purple-500' },
      { label: t('treasurerDashboard.reportTabs.paymentReports.summary.totalDue'), value: formatCurrency(summary.totalAmountDue), color: 'bg-orange-500' },
      { label: t('treasurerDashboard.reportTabs.paymentReports.summary.totalCollected'), value: formatCurrency(summary.totalCollected), color: 'bg-green-600' }
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className={`${stat.color} rounded-lg p-3 mr-4`}>
                  <span className="text-white text-lg font-bold">
                    {stat.label === t('treasurerDashboard.reportTabs.paymentReports.summary.collectionRate') ? '📊' :
                      stat.label === t('treasurerDashboard.reportTabs.paymentReports.summary.totalMembers') ? '👥' :
                        stat.label === t('treasurerDashboard.reportTabs.paymentReports.summary.upToDate') ? '✅' :
                          stat.label === t('treasurerDashboard.reportTabs.paymentReports.summary.behind') ? '⚠️' :
                            stat.label.includes(t('treasurerDashboard.reportTabs.paymentReports.summary.totalDue')) ? '💸' : '💰'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBehindPaymentsReport = () => {
    if (!reportData?.behindPayments) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('treasurerDashboard.reportTabs.paymentReports.behind.title')} ({reportData.behindPayments.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('treasurerDashboard.reportTabs.paymentReports.behind.member')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('treasurerDashboard.reportTabs.paymentReports.behind.contact')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('treasurerDashboard.reportTabs.paymentReports.behind.totalDue')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('treasurerDashboard.reportTabs.paymentReports.behind.collected')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('treasurerDashboard.reportTabs.paymentReports.behind.balance')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.behindPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {payment.memberName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payment.member?.phoneNumber || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {payment.member?.email || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(payment.totalAmountDue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(payment.totalCollected)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      {formatCurrency(payment.balanceDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderMonthlyBreakdownReport = () => {
    if (!reportData?.monthlyTotals) return null;

    const { monthlyTotals } = reportData;
    const months = [
      { key: 'january', label: 'January', value: monthlyTotals.january },
      { key: 'february', label: 'February', value: monthlyTotals.february },
      { key: 'march', label: 'March', value: monthlyTotals.march },
      { key: 'april', label: 'April', value: monthlyTotals.april },
      { key: 'may', label: 'May', value: monthlyTotals.may },
      { key: 'june', label: 'June', value: monthlyTotals.june },
      { key: 'july', label: 'July', value: monthlyTotals.july },
      { key: 'august', label: 'August', value: monthlyTotals.august },
      { key: 'september', label: 'September', value: monthlyTotals.september },
      { key: 'october', label: 'October', value: monthlyTotals.october },
      { key: 'november', label: 'November', value: monthlyTotals.november },
      { key: 'december', label: 'December', value: monthlyTotals.december }
    ];

    const totalCollected = months.reduce((sum, month) => sum + month.value, 0);

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('treasurerDashboard.reportTabs.paymentReports.monthly.title')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {months.map((month) => (
              <div key={month.key} className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{month.label}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatCurrency(month.value)}
                  </span>
                </div>
                {totalCollected > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(month.value / totalCollected) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">{t('treasurerDashboard.reportTabs.paymentReports.monthly.totalCollected')}</span>
              <span className="text-lg font-bold text-green-600">{formatCurrency(totalCollected)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Report Type Selector */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">{t('treasurerDashboard.reportTabs.paymentReports.type')}</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="summary">{t('treasurerDashboard.reportTabs.paymentReports.types.summary')}</option>
            <option value="behind_payments">{t('treasurerDashboard.reportTabs.paymentReports.types.behind')}</option>
            <option value="monthly_breakdown">{t('treasurerDashboard.reportTabs.paymentReports.types.monthly')}</option>
          </select>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium"
          >
            {loading ? t('treasurerDashboard.reportTabs.paymentReports.loading') : t('treasurerDashboard.reportTabs.paymentReports.generate')}
          </button>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div>
          {reportType === 'summary' && renderSummaryReport()}
          {reportType === 'behind_payments' && renderBehindPaymentsReport()}
          {reportType === 'monthly_breakdown' && renderMonthlyBreakdownReport()}
        </div>
      )}
    </div>
  );
};

export default PaymentReports; 