import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDateForDisplay } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';

interface Reconciliation {
  thresholdDollars: number;
  hasBankData: boolean;
  bankDeposits: number;
  bankDebits: number;
  receiptsReconciled: boolean;
  receiptsDifference: number;
  expensesReconciled: boolean;
  expensesDifference: number;
}

interface PaymentStatsData {
  totalMembers: number;
  contributingMembers: number;
  duesTrackedMembers?: number;
  notDuesTrackedMembers?: number;
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
  reconciliation?: Reconciliation;
}

interface PaymentStatsProps {
  stats: PaymentStatsData;
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
  onNavigateToBank?: () => void;
}

interface LoanStats {
  totalOutstandingBalance: number;
  lendingMembersCount: number;
}

const PaymentStats: React.FC<PaymentStatsProps> = ({ stats, selectedYear, availableYears, onYearChange, onNavigateToBank }) => {
  const { t } = useLanguage();
  const { firebaseUser } = useAuth();
  const td = 'treasurerDashboard';
  const [loanStats, setLoanStats] = useState<LoanStats | null>(null);

  const fmt = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  // Show a reconciliation warning only when we have bank data for the year and
  // the ledger total is off from the bank total by more than the threshold.
  const recon = stats.reconciliation;
  const showReceiptsWarn = !!recon && recon.hasBankData && !recon.receiptsReconciled;
  const showExpensesWarn = !!recon && recon.hasBankData && !recon.expensesReconciled;
  // The i18n layer does not interpolate placeholders into dictionary hits, so
  // compose the tooltip from translatable labels + locally formatted amounts.
  const reconcileDetail = (ledger: number, bank: number, diff: number) =>
    `${t(`${td}.stats.reconcileRequired`)} — ` +
    `${t(`${td}.stats.reconcileLedger`)} ${fmt(ledger)} · ` +
    `${t(`${td}.stats.reconcileBank`)} ${fmt(bank)} · ` +
    `${t(`${td}.stats.reconcileDiff`)} ${fmt(Math.abs(diff))}`;
  const receiptsWarnText = recon ? reconcileDetail(stats.totalCollected, recon.bankDeposits, recon.receiptsDifference) : '';
  const expensesWarnText = recon ? reconcileDetail(stats.totalExpenses, recon.bankDebits, recon.expensesDifference) : '';

  const ReconcileWarning: React.FC<{ text: string }> = ({ text }) => (
    <button
      type="button"
      onClick={onNavigateToBank}
      title={text}
      aria-label={text}
      className="inline-flex items-center text-amber-500 hover:text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
    >
      {/* warning triangle */}
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    </button>
  );

  const progressPct = Math.min(parseFloat(stats.collectionRate.toString()), 100);

  const currentYear = new Date().getFullYear();
  const isCurrentYear = selectedYear === currentYear;
  const today = new Date();
  const endDate = isCurrentYear
    ? today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : `Dec 31, ${selectedYear}`;
  const periodLabel = `Jan 1 – ${endDate}`;
  const periodTag = isCurrentYear ? 'year to date' : 'full year';
  const currentMonthAbbr = today.toLocaleDateString('en-US', { month: 'short' });
  const ytdLabel = isCurrentYear ? `Jan–${currentMonthAbbr} Net` : 'Full-Year Net';
  const duesTrackedMembers = stats.duesTrackedMembers ?? stats.contributingMembers ?? 0;
  const notDuesTrackedMembers = stats.notDuesTrackedMembers ?? Math.max(stats.totalMembers - duesTrackedMembers, 0);

  useEffect(() => {
    const fetchLoanStats = async () => {
      try {
        const token = await firebaseUser?.getIdToken();
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/loans/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setLoanStats(data.data);
        }
      } catch (err) {
        // Non-critical — silently skip if loans endpoint unavailable
      }
    };
    fetchLoanStats();
  }, [firebaseUser]);

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
              <p className="text-xs text-blue-200 mt-1 italic">
                {t(`${td}.stats.balanceNote`)}
              </p>
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
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {t(`${td}.health.financialHealth`)}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 font-normal normal-case tracking-normal">
              {periodLabel} <span className="italic">({periodTag})</span>
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <span className="text-green-500">↑</span> {t(`${td}.stats.totalReceipts`)} <span className="font-normal text-gray-400">({selectedYear})</span>
                {showReceiptsWarn && <ReconcileWarning text={receiptsWarnText} />}
              </span>
              <span className="text-lg font-bold text-green-700">{fmt(stats.totalCollected)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <span className="text-red-500">↓</span> {t(`${td}.stats.totalExpenses`)} <span className="font-normal text-gray-400">({selectedYear})</span>
                {showExpensesWarn && <ReconcileWarning text={expensesWarnText} />}
              </span>
              <span className="text-lg font-bold text-red-700">{fmt(stats.totalExpenses)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">{ytdLabel}</span>
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
            {loanStats && loanStats.totalOutstandingBalance > 0 && (
              <div className="border-t border-orange-100 pt-3 flex justify-between items-center bg-orange-50 -mx-6 px-6 pb-1 rounded-b-lg">
                <span className="text-sm text-orange-800 flex items-center gap-1.5">
                  <span>⚠</span> Member Loans Owed
                  <span className="text-xs text-orange-600">({loanStats.lendingMembersCount} member{loanStats.lendingMembersCount !== 1 ? 's' : ''})</span>
                </span>
                <span className="text-base font-bold text-orange-700">{fmt(loanStats.totalOutstandingBalance)}</span>
              </div>
            )}
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
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-600" title="Active members with no yearly pledge or not expected to pay membership dues.">
                  <span>-</span> Not Dues-Tracked
                </span>
                <span className="font-bold text-slate-700 text-base">{notDuesTrackedMembers}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span className="flex items-center gap-1.5" title="Active members = fully paid + behind on dues + not dues-tracked.">
                  <span>○</span> {t(`${td}.health.activeMembers`)}
                </span>
                <span className="font-bold text-gray-700 text-base">{stats.totalMembers}</span>
              </div>
              <p className="text-xs text-gray-400">
                {stats.upToDateMembers} fully paid + {stats.behindMembers} behind + {notDuesTrackedMembers} not dues-tracked = {stats.totalMembers} active members
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStats;
