import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

interface StatsData {
  totalMembers: number;
  activeMembers: number;
  newMembersThisMonth: number;
  totalDues: number;
  collectedDues: number;
  pendingDues: number;
}

const AdminStats: React.FC = () => {
  const { t } = useLanguage();
  const { currentUser, firebaseUser } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!currentUser || !currentUser.email) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/all/firebase?limit=1000&email=${encodeURIComponent(currentUser.email)}`, {
          headers: {
            'Authorization': `Bearer ${await firebaseUser?.getIdToken()}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Calculate stats from member data
          const members = data.members || [];
          const now = new Date();
          const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

          const statsData: StatsData = {
            totalMembers: members.length,
            activeMembers: members.filter((m: any) => m.isActive).length,
            newMembersThisMonth: members.filter((m: any) => new Date(m.createdAt) >= thisMonth).length,
            totalDues: 0, // TODO: Calculate from dues data
            collectedDues: 0, // TODO: Calculate from payment data
            pendingDues: 0, // TODO: Calculate from dues data
          };

          setStats(statsData);
        } else {
          setError('Failed to fetch stats');
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError('Failed to fetch stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 text-center">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">No stats available</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('admin.stats')}</h1>
          <p className="mt-2 text-gray-600">{t('admin.stats.description')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Members */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <i className="fas fa-users text-white"></i>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {t('admin.stats.totalMembers')}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.totalMembers}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Active Members */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <i className="fas fa-user-check text-white"></i>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {t('admin.stats.activeMembers')}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.activeMembers}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* New Members This Month */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <i className="fas fa-user-plus text-white"></i>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {t('admin.stats.newMembersThisMonth')}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.newMembersThisMonth}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Total Dues */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                    <i className="fas fa-dollar-sign text-white"></i>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {t('admin.stats.totalDues')}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      ${stats.totalDues}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Collected Dues */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <i className="fas fa-check-circle text-white"></i>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {t('admin.stats.collectedDues')}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      ${stats.collectedDues}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Dues */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
                    <i className="fas fa-clock text-white"></i>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {t('admin.stats.pendingDues')}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      ${stats.pendingDues}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStats; 