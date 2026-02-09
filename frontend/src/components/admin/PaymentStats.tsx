import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDateForDisplay } from '../../utils/dateUtils';

interface PaymentStatsProps {
  stats: {
    totalMembers: number;
    contributingMembers: number;
    upToDateMembers: number;
    behindMembers: number;
    totalAmountDue: number;
    totalMembershipCollected: number;
    otherPayments: number;
    totalCollected: number;
    totalExpenses: number;
    netIncome: number;
    collectionRate: number;
    outstandingAmount: number;
    currentBankBalance?: number;
    lastBankUpdate?: string;
  };
}

const PaymentStats: React.FC<PaymentStatsProps> = ({ stats }) => {
  const { t } = useLanguage();
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Tier 1: Financial Summary (The Bottom Line) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Bank Balance - Hero Card */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg shadow-md p-6 text-white col-span-1 md:col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 font-medium text-sm mb-1">{t('treasurerDashboard.stats.currentBalance')}</p>
              <h3 className="text-2xl font-bold">{formatCurrency(stats.currentBankBalance || 0)}</h3>
              {stats.lastBankUpdate && (
                <p className="text-xs text-blue-200 mt-2">
                  {t('treasurerDashboard.stats.lastUpdated')}: {formatDateForDisplay(stats.lastBankUpdate)}
                </p>
              )}
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <span className="text-xl">🏦</span>
            </div>
          </div>
        </div>

        {/* Net Income - Hero Card */}
        <div className={`rounded-lg shadow-md p-6 text-white ${stats.netIncome >= 0 ? 'bg-gradient-to-br from-green-600 to-green-700' : 'bg-gradient-to-br from-red-600 to-red-700'}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-100 font-medium text-sm mb-1">{t('treasurerDashboard.stats.netIncome')}</p>
              <h3 className="text-2xl font-bold">{formatCurrency(stats.netIncome)}</h3>
              <p className="text-xs opacity-80 mt-2">
                {stats.netIncome >= 0 ? 'Surplus' : 'Deficit'}
              </p>
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <span className="text-xl">{stats.netIncome >= 0 ? '📈' : '📉'}</span>
            </div>
          </div>
        </div>

        {/* Revenue & Expenses Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 flex flex-col justify-center lg:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-500 text-xs uppercase tracking-wider">{t('treasurerDashboard.stats.totalCollected')}</span>
              </div>
              <div className="text-xl font-bold text-green-700">{formatCurrency(stats.totalCollected)}</div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-gray-500 text-xs uppercase tracking-wider">{t('treasurerDashboard.stats.totalExpenses')}</span>
              </div>
              <div className="text-xl font-bold text-red-700">{formatCurrency(stats.totalExpenses)}</div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min((stats.totalExpenses / (stats.totalCollected || 1)) * 100, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier 2: Membership Health */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('treasurerDashboard.health.title')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <span className="block text-2xl font-bold text-blue-700">{stats.contributingMembers}</span>
              <span className="text-xs text-blue-600 font-medium uppercase tracking-wide">{t('treasurerDashboard.health.activeGivers')}</span>
              <p className="text-xs text-blue-400 mt-1">{t('treasurerDashboard.health.totalMembers', { count: stats.totalMembers })}</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-100">
                <span className="text-sm text-green-800">{t('treasurerDashboard.health.upToDate')}</span>
                <span className="font-bold text-green-700">{stats.upToDateMembers}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-red-50 rounded border border-red-100">
                <span className="text-sm text-red-800">{t('treasurerDashboard.health.behind')}</span>
                <span className="font-bold text-red-700">{stats.behindMembers}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tier 3: Dues & Pledges Progress */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('treasurerDashboard.stats.collectionProgress')}</h3>

          <div className="mb-6">
            <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
              <span>{t('treasurerDashboard.stats.collectionRate')} (Dues Only)</span>
              <span>{stats.collectionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${Math.min(parseFloat(stats.collectionRate.toString()), 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">{t('treasurerDashboard.stats.target')}: {formatCurrency(stats.totalAmountDue)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="border-r border-gray-100 pr-4">
              <p className="text-gray-500">{t('treasurerDashboard.stats.membershipDues')}</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalMembershipCollected)}</p>
            </div>
            <div className="pl-4">
              <p className="text-gray-500">{t('treasurerDashboard.stats.otherDonations')}</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.otherPayments)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStats;