import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDateForDisplay } from '../../utils/dateUtils';

interface PaymentStatsData {
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
}

interface PaymentStatsProps {
  stats: PaymentStatsData;
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}

const PaymentStats: React.FC<PaymentStatsProps> = ({ stats, selectedYear, availableYears, onYearChange }) => {
  const { t } = useLanguage();
  const td = 'treasurerDashboard';

  const fmt = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const progressPct = Math.min(parseFloat(stats.collectionRate.toString()), 100);

  return (
    <div className="space-y-6">

      {/* Page title + year selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">
          {t(`${td}.stats.pageTitle`)}
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">{t(`${td}.stats.yearLabel`)}:</label>
          <select
            value={selectedYear}
            onChange={e => onYearChange(Number(e.target.value))}
            className="border rounded px-3 py-1.5 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-primary-500"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}{y === new Date().getFullYear() ? ' (Current)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Top row: Bank Balance + Annual Dues Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Bank Balance */}
        <div className="bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg shadow-md p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">{t(`${td}.stats.currentBalance`)}</p>
              <h3 className="text-2xl font-bold">{fmt(stats.currentBankBalance || 0)}</h3>
              {stats.lastBankUpdate && (
                <p className="text-xs text-blue-200 mt-2">
                  {t(`${td}.stats.lastUpdated`)}: {formatDateForDisplay(stats.lastBankUpdate)}
                </p>
              )}
            </div>
            <div className="bg-white/20 p-2 rounded-lg">
              <span className="text-xl">🏦</span>
            </div>
          </div>
        </div>

        {/* Annual Dues Progress + Other Income */}
        <div className="md:col-span-2 bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {t(`${td}.stats.annualDuesProgress`)}
            </p>
            <span className="text-2xl font-bold text-blue-700">{progressPct}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex justify-between text-sm text-gray-600 mb-4">
            <span>
              <span className="font-semibold text-gray-900">{fmt(stats.totalMembershipCollected)}</span>
              {' '}{t(`${td}.stats.collectedOf`)}{' '}
              <span className="font-semibold text-gray-900">{fmt(stats.totalAmountDue)}</span>
              {' '}{t(`${td}.stats.target`)}
            </span>
            <span className="text-red-600 font-medium">
              {fmt(stats.outstandingAmount)} {t(`${td}.stats.stillOutstanding`)}
            </span>
          </div>

          {/* Divider + Other Income */}
          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">{t(`${td}.stats.otherIncome`)}</span>
            <span className="text-base font-bold text-gray-800">{fmt(stats.otherPayments)}</span>
          </div>
        </div>
      </div>

      {/* Bottom row: two equal panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Financial Health */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            {t(`${td}.health.financialHealth`)}
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <span className="text-green-500">↑</span> {t(`${td}.stats.totalReceipts`)}
              </span>
              <span className="text-lg font-bold text-green-700">{fmt(stats.totalCollected)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <span className="text-red-500">↓</span> {t(`${td}.stats.totalExpenses`)}
              </span>
              <span className="text-lg font-bold text-red-700">{fmt(stats.totalExpenses)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">{t(`${td}.stats.ytdBalance`)}</span>
              <div className="text-right">
                <span className={`text-xl font-bold ${stats.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {stats.netIncome >= 0 ? '+' : ''}{fmt(stats.netIncome)}
                </span>
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                  stats.netIncome >= 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {stats.netIncome >= 0 ? t(`${td}.stats.surplus`) : t(`${td}.stats.deficit`)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Dues & Member Status */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            {t(`${td}.health.duesAndMemberStatus`)}
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-sm text-gray-600">{t(`${td}.health.membershipDues`)}</span>
              <div className="text-right">
                <p className="text-base font-bold text-gray-900">{fmt(stats.totalMembershipCollected)}</p>
                <p className="text-xs text-red-600 mt-0.5">{fmt(stats.outstandingAmount)} {t(`${td}.stats.stillOutstanding`)}</p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{t(`${td}.health.otherDonations`)}</span>
              <span className="text-base font-bold text-gray-900">{fmt(stats.otherPayments)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-green-700">
                  <span>✓</span> {t(`${td}.health.fullyPaid`)}
                </span>
                <span className="font-bold text-green-700 text-base">{stats.upToDateMembers}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span>⚠</span> {t(`${td}.health.behindOnDues`)}
                </span>
                <span className="font-bold text-amber-700 text-base">{stats.behindMembers}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span>○</span> {t(`${td}.health.activeMembers`)}
                </span>
                <span className="font-bold text-gray-700 text-base">{stats.totalMembers}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStats;
