import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getRolePermissions, UserRole } from '../../utils/roles';

const OutreachDashboard: React.FC = () => {
  const { currentUser, getUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!currentUser) { setLoading(false); return; }
      try {
        const uid = (currentUser as any).uid || (currentUser as any).id;
        const email = (currentUser as any).email;
        const phone = (currentUser as any).phoneNumber;
        const profile = await getUserProfile(uid, email, phone);
        setUserProfile(profile);
      } catch (e) {
        console.error('OutreachDashboard: failed to load profile', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [currentUser, getUserProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  const userRole: UserRole = (userProfile?.data?.member?.role || 'member') as UserRole;
  const permissions = getRolePermissions(userRole);

  const canAccess = permissions.canAccessOutreachDashboard || permissions.canManageOnboarding;

  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-2">Access Denied</div>
          <p className="text-gray-600">You don't have permission to view the Outreach dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <i className="fas fa-hands-helping text-2xl text-primary-800 mr-3"></i>
              <h1 className="text-xl font-semibold text-gray-900">Outreach & Member Relations</h1>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded-full">{userRole}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white shadow-sm rounded-lg p-4 border">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <i className="fas fa-bell mr-2 text-primary-700"></i>
              New Member Notifications
            </h2>
            <p className="text-sm text-gray-600 mb-3">Recently registered members requiring welcome and onboarding.</p>
            <div className="text-sm text-gray-500">No data source connected yet. Hook to backend endpoint when available.</div>
          </section>

          <section className="bg-white shadow-sm rounded-lg p-4 border lg:col-span-2">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <i className="fas fa-user-friends mr-2 text-primary-700"></i>
              Onboarding & Engagement
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {permissions.canManageOnboarding && (
                <button className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
                  Mark Selected as Welcomed
                </button>
              )}
              {permissions.canRecordEngagement && (
                <button className="px-3 py-2 bg-secondary-600 text-white rounded-md hover:bg-secondary-700">
                  Log Engagement Activity
                </button>
              )}
              {permissions.canManageExternalPartners && (
                <button className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700">
                  Manage Partner Organizations
                </button>
              )}
              {permissions.canGenerateOutreachReports && (
                <button className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                  Generate Outreach Report
                </button>
              )}
            </div>
            <div className="mt-4 text-sm text-gray-500">
              Placeholder lists and forms go here. Integrate with backend when endpoints are ready.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default OutreachDashboard;
