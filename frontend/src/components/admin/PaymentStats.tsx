import React from 'react';

interface PaymentStatsProps {
  stats: {
    totalMembers: number;
    upToDateMembers: number;
    behindMembers: number;
    totalAmountDue: number;
    totalCollected: number;
    collectionRate: string;
    outstandingAmount: number;
  };
}

const PaymentStats: React.FC<PaymentStatsProps> = ({ stats }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const statsCards = [
    {
      title: 'Total Members',
      value: stats.totalMembers,
      color: 'bg-blue-500',
      icon: '👥'
    },
    {
      title: 'Up to Date',
      value: stats.upToDateMembers,
      color: 'bg-green-500',
      icon: '✅'
    },
    {
      title: 'Behind on Payments',
      value: stats.behindMembers,
      color: 'bg-red-500',
      icon: '⚠️'
    },
    {
      title: 'Collection Rate',
      value: `${stats.collectionRate}%`,
      color: 'bg-purple-500',
      icon: '📊'
    },
    {
      title: 'Total Collected',
      value: formatCurrency(stats.totalCollected),
      color: 'bg-green-600',
      icon: '💰'
    },
    {
      title: 'Outstanding Amount',
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Progress</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
              <span>Collection Rate</span>
              <span>{stats.collectionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.collectionRate}%` }}
              ></div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800">Collected</p>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(stats.totalCollected)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800">Outstanding</p>
              <p className="text-2xl font-bold text-red-900">{formatCurrency(stats.outstandingAmount)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStats; 