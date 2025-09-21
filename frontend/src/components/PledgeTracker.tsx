import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface PledgeStats {
  total_pledged: number;
  total_fulfilled: number;
  total_remaining: number;
  fulfillment_rate: string;
  status_breakdown: Array<{
    status: string;
    count: number;
    total_amount: number;
    pledges: Array<{
      id: number;
      amount: number;
      name: string;
      spouse_name: string | null;
      pledge_type: string;
      created_at: string;
    }>;
  }>;
  recent_pledges: Array<{
    id: number;
    name: string;
    amount: number;
    pledge_type: string;
    created_at: string;
    member: any;
  }>;
}

interface PledgeTrackerProps {
  eventName?: string; // Optional filter by event
  showRecentPledges?: boolean;
  compact?: boolean;
}

const PledgeTracker: React.FC<PledgeTrackerProps> = ({
  eventName,
  showRecentPledges = true,
  compact = false
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [stats, setStats] = useState<PledgeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (eventName) {
        params.append('event_name', eventName);
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/pledges/stats?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.message || 'Failed to load pledge statistics');
      }
    } catch (err) {
      console.error('Error fetching pledge stats:', err);
      setError('Failed to load pledge statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Removed auto-refresh per requirement; manual refresh button provided instead
    return () => {};
  }, [eventName]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2">{error}</div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-500">
        No pledge data available
      </div>
    );
  }

  const progressPercentage = stats.total_pledged > 0
    ? (stats.total_fulfilled / stats.total_pledged) * 100
    : 0;

  // Determine if current user can see individual pledge names
  const privilegedRoles = new Set(['admin', 'secretary', 'treasurer']);
  const canSeeNames = privilegedRoles.has((user?.role || '').toLowerCase());

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${compact ? 'max-w-md' : 'max-w-4xl mx-auto'}`}>
      {/* Header with manual refresh */}
      <div className={`mb-6 ${compact ? '' : 'flex items-center justify-between'}`}>
        <div className={`${compact ? 'text-center' : 'text-left'}`}>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {eventName ? `${eventName} Pledges` : 'Pledge Tracker'}
          </h2>
          <p className="text-gray-600">
            See how our Abune Aregawi church community is coming together to support this cause.
          </p>
        </div>
        {!compact && (
          <button
            onClick={fetchStats}
            className="mt-3 md:mt-0 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary-600 hover:bg-primary-700 text-white shadow"
            title="Refresh"
          >
            <i className="fas fa-rotate-right"></i>
            Refresh
          </button>
        )}
      </div>

      {/* Main Stats */}
      <div className={`grid ${compact ? 'grid-cols-1 gap-4' : 'grid-cols-1 md:grid-cols-3 gap-6'} mb-6`}>
        {/* Total Pledged */}
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {formatCurrency(stats.total_pledged)}
          </div>
          <div className="text-sm text-blue-700 font-medium">Total Pledged</div>
        </div>

        {/* Total Fulfilled */}
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {formatCurrency(stats.total_fulfilled)}
          </div>
          <div className="text-sm text-green-700 font-medium">Total Donated</div>
        </div>

        {/* Remaining */}
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600 mb-1">
            {formatCurrency(stats.total_remaining)}
          </div>
          <div className="text-sm text-orange-700 font-medium">Remaining</div>
        </div>
      </div>

      {/* Progress Bar */}
      {!compact && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Fulfillment Progress</span>
            <span className="text-sm text-gray-600">{stats.fulfillment_rate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Status Breakdown */}
      {!compact && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Pledge Status</h3>
          <div className="space-y-4">
            {stats.status_breakdown.map((status) => (
              <div key={status.status} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      {status.count}
                    </div>
                    <div className="text-sm text-gray-600 capitalize">
                      {status.status}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-green-600">
                      {formatCurrency(status.total_amount)}
                    </div>
                    <div className="text-xs text-gray-500">Total Amount</div>
                  </div>
                </div>

                {/* Individual pledges - scrollable for pending/fulfilled */}
                <div
                  className="space-y-2"
                  style={['pending', 'fulfilled'].includes(status.status) ? { maxHeight: '22rem', overflowY: 'auto', paddingRight: '4px' } : undefined}
                >
                  {status.pledges.map((pledge) => (
                    <div key={pledge.id} className="bg-white rounded border p-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 text-sm">
                            {canSeeNames ? (
                              <>
                                {pledge.name}
                                {pledge.spouse_name && (
                                  <span className="text-gray-500"> & {pledge.spouse_name}</span>
                                )}
                              </>
                            ) : (
                              <span className="italic text-gray-600">Anonymous</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 capitalize">
                            {pledge.pledge_type} • {formatDate(pledge.created_at)}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-green-600">
                          {formatCurrency(pledge.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Pledges - hidden per requirement */}

      {/* Last Updated */}
      <div className="text-center text-xs text-gray-500 mt-6">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default PledgeTracker;
