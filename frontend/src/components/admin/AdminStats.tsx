import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { auth } from '../../firebase';

interface AdminStatsProps {
  // Add any props if needed
}

const AdminStats: React.FC<AdminStatsProps> = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Get current user from Firebase Auth
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/all/firebase?limit=1000&email=${encodeURIComponent(currentUser.email)}`, {
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data = await response.json();
      const members = data.data.members;

      // Calculate statistics
      const stats = {
        totalMembers: members.length,
        activeMembers: members.filter((m: any) => m.isActive).length,
        inactiveMembers: members.filter((m: any) => !m.isActive).length,
        roleBreakdown: members.reduce((acc: any, member: any) => {
          acc[member.role] = (acc[member.role] || 0) + 1;
          return acc;
        }, {}),
        genderBreakdown: members.reduce((acc: any, member: any) => {
          if (member.gender) {
            acc[member.gender] = (acc[member.gender] || 0) + 1;
          }
          return acc;
        }, {}),
        maritalStatusBreakdown: members.reduce((acc: any, member: any) => {
          if (member.maritalStatus) {
            acc[member.maritalStatus] = (acc[member.maritalStatus] || 0) + 1;
          }
          return acc;
        }, {}),
        languageBreakdown: members.reduce((acc: any, member: any) => {
          if (member.languagePreference) {
            acc[member.languagePreference] = (acc[member.languagePreference] || 0) + 1;
          }
          return acc;
        }, {}),
        childrenCount: members.reduce((total: number, member: any) => {
          return total + (member.children?.length || 0);
        }, 0),
        averageChildrenPerFamily: members.length > 0 ? 
          members.reduce((total: number, member: any) => {
            return total + (member.children?.length || 0);
          }, 0) / members.length : 0
      };

      setStats(stats);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 text-lg mb-4">{error}</div>
        <button 
          onClick={fetchStats} 
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 text-lg">{t('no.data.available')}</div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${color}`}>
              <i className={`${icon} text-white`}></i>
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {value}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  const BreakdownCard = ({ title, data, colorClass }: { title: string; data: Record<string, number>; colorClass: string }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
        <div className="space-y-3">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center">
              <span className="text-sm text-gray-600 capitalize">
                {key.replace('_', ' ')}
              </span>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClass}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {t('statistics')}
        </h2>
        <p className="text-gray-600">
          {t('overview.of.church.membership')}
        </p>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={t('total.members')}
          value={stats.totalMembers}
          icon="fas fa-users"
          color="bg-blue-500"
        />
        <StatCard
          title={t('active.members')}
          value={stats.activeMembers}
          icon="fas fa-user-check"
          color="bg-green-500"
        />
        <StatCard
          title={t('total.children')}
          value={stats.childrenCount}
          icon="fas fa-child"
          color="bg-pink-500"
        />
        <StatCard
          title={t('recent.registrations')}
          value={stats.totalMembers}
          icon="fas fa-user-plus"
          color="bg-purple-500"
        />
      </div>

      {/* Detailed Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Breakdown */}
        <BreakdownCard
          title={t('role.breakdown')}
          data={stats.roleBreakdown}
          colorClass="bg-blue-100 text-blue-800"
        />

        {/* Gender Breakdown */}
        <BreakdownCard
          title={t('gender.breakdown')}
          data={stats.genderBreakdown}
          colorClass="bg-green-100 text-green-800"
        />

        {/* Marital Status Breakdown */}
        <BreakdownCard
          title={t('marital.status.breakdown')}
          data={stats.maritalStatusBreakdown}
          colorClass="bg-purple-100 text-purple-800"
        />

        {/* Language Preference Breakdown */}
        <BreakdownCard
          title={t('language.preference.breakdown')}
          data={stats.languageBreakdown}
          colorClass="bg-yellow-100 text-yellow-800"
        />
      </div>

      {/* Additional Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('membership.status')}</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{t('active')}</span>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  {stats.activeMembers}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{t('inactive')}</span>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                  {stats.inactiveMembers}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{t('members.with.children')}</span>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                  {stats.totalMembers}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('activity.metrics')}</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{t('new.registrations.30.days')}</span>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                  {stats.totalMembers}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{t('avg.children.per.family')}</span>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-pink-100 text-pink-800">
                  {stats.averageChildrenPerFamily.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{t('active.rate')}</span>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  {stats.totalMembers > 0 ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('quick.actions')}</h3>
            <div className="space-y-3">
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                <i className="fas fa-download mr-2"></i>
                {t('export.member.list')}
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                <i className="fas fa-chart-bar mr-2"></i>
                {t('generate.report')}
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md">
                <i className="fas fa-envelope mr-2"></i>
                {t('send.communication')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="text-center">
        <button
          onClick={fetchStats}
          className="bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700"
        >
          <i className="fas fa-sync-alt mr-2"></i>
          {t('refresh.statistics')}
        </button>
      </div>
    </div>
  );
};

export default AdminStats; 