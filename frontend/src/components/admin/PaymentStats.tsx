import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

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

  const statsCards = [
    {
      title: t('treasurerDashboard.stats.totalMembers'),
      value: stats.totalMembers,
      color: 'bg-blue-500',
      icon: '👥'
    },
    {
      title: t('treasurerDashboard.stats.contributingMembers'),
      value: stats.contributingMembers,
      color: 'bg-indigo-500',
      icon: '🤝'
    },
    {
      title: t('treasurerDashboard.stats.upToDate'),
      value: stats.upToDateMembers,
      color: 'bg-green-500',
      icon: '✅'
    },
    {
      title: t('treasurerDashboard.stats.behind'),
      value: stats.behindMembers,
      color: 'bg-red-500',
      icon: '⚠️'
    },
    {
      title: t('treasurerDashboard.stats.collectionRate'),
      value: `${stats.collectionRate}%`,
      color: 'bg-purple-500',
      icon: '📊'
    },
    {
      title: t('treasurerDashboard.stats.membershipCollected'),
      value: formatCurrency(stats.totalMembershipCollected),
      color: 'bg-green-600',
      icon: '💵'
    },
    {
      title: t('treasurerDashboard.stats.otherPayments'),
      value: formatCurrency(stats.otherPayments),
      color: 'bg-blue-600',
      icon: '🎁'
    },
    {
      title: t('treasurerDashboard.stats.totalCollected'),
      value: formatCurrency(stats.totalCollected),
      color: 'bg-emerald-600',
      icon: '💰'
    },
    {
      title: t('treasurerDashboard.stats.totalExpenses'),
      value: formatCurrency(stats.totalExpenses),
      color: 'bg-red-600',
      icon: '💳'
    },
    {
      title: t('treasurerDashboard.stats.netIncome'),
      value: formatCurrency(stats.netIncome),
      color: stats.netIncome >= 0 ? 'bg-teal-600' : 'bg-red-700',
      icon: stats.netIncome >= 0 ? '📈' : '📉'
    },
    {
      title: t('treasurerDashboard.stats.outstanding'),
      value: formatCurrency(stats.outstandingAmount),
      color: 'bg-orange-500',
      icon: '💸'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statsCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className={`${card.color} rounded-lg p-3 mr-4`}>
                <span className="text-2xl">{card.icon}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('treasurerDashboard.stats.collectionProgress')}</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
              <span>{t('treasurerDashboard.stats.collectionRate')}</span>
              <span>{stats.collectionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.collectionRate}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800">{t('treasurerDashboard.stats.membershipCollected')}</p>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(stats.totalMembershipCollected)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-800">{t('treasurerDashboard.stats.otherPayments')}</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(stats.otherPayments)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800">{t('treasurerDashboard.stats.outstanding')}</p>
              <p className="text-2xl font-bold text-red-900">{formatCurrency(stats.outstandingAmount)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStats; 