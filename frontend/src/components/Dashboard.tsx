import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getRolePermissions, UserRole } from '../utils/roles';

interface UserProfile {
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  isActive: boolean;
}

const Dashboard: React.FC = () => {
  const { currentUser, logout, getUserProfile } = useAuth();
  const { t } = useLanguage();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user has admin permissions
  const userRole = (userProfile?.role || 'member') as UserRole;
  const permissions = getRolePermissions(userRole);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser) {
        try {
          console.log('Fetching profile for user:', currentUser.uid);
          const profile = await getUserProfile(currentUser.uid);
          console.log('Profile fetched:', profile);
          setUserProfile(profile);
        } catch (error: any) {
          console.error('Error fetching user profile:', error);
          // Check if it's a Firestore permission error or network error
          if (error.message.includes('permission') || error.message.includes('403')) {
            setError('Firestore permission denied. Please check your Firebase rules.');
          } else if (error.message.includes('network') || error.message.includes('fetch')) {
            setError('Network error. Please check your internet connection.');
          } else {
            setError(`Failed to load user profile: ${error.message}`);
          }
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [currentUser, getUserProfile]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleViewProfile = () => {
    // Navigate to profile page
    window.location.href = '/profile';
  };

  const handleViewDues = () => {
    alert('View Dues functionality coming soon!');
    // TODO: Navigate to dues page
  };

  const handleViewEvents = () => {
    alert('View Events functionality coming soon!');
    // TODO: Navigate to events page
  };

  const handleVolunteerSignUp = () => {
    alert('Volunteer Sign Up functionality coming soon!');
    // TODO: Navigate to volunteer signup page
  };

  const handleDonate = () => {
    window.location.href = '/donate';
  };

  const handleManageAccount = () => {
    alert('Manage Account functionality coming soon!');
    // TODO: Navigate to account settings page
  };

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
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <i className="fas fa-cross text-2xl text-primary-800 mr-3"></i>
              <h1 className="text-xl font-semibold text-gray-900">
                {t('member.dashboard')}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Sign out functionality is available in the Navigation component */}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Profile Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-user text-primary-800"></i>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {t('profile')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {userProfile?.displayName || currentUser?.displayName || 'User'}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button 
                    onClick={handleViewProfile}
                    className="w-full bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
                  >
                    {t('view.profile')}
                  </button>
                </div>
              </div>
            </div>

            {/* Dues Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-dollar-sign text-green-800"></i>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {t('dues')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('view.and.pay')}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button 
                    onClick={handleViewDues}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                  >
                    {t('view.dues')}
                  </button>
                </div>
              </div>
            </div>

            {/* Events Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-calendar text-blue-800"></i>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {t('events')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('upcoming.events')}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button 
                    onClick={handleViewEvents}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {t('view.events')}
                  </button>
                </div>
              </div>
            </div>

            {/* Volunteer Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-hands-helping text-purple-800"></i>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {t('volunteer')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('serve.community')}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button 
                    onClick={handleVolunteerSignUp}
                    className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
                  >
                    {t('volunteer.sign.up')}
                  </button>
                </div>
              </div>
            </div>

            {/* Giving Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-heart text-yellow-800"></i>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {t('give')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('support.church')}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button 
                    onClick={handleDonate}
                    className="w-full bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors"
                  >
                    {t('donate')}
                  </button>
                </div>
              </div>
            </div>

            {/* Children Management Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-child text-pink-800"></i>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Children & Dependents
                    </h3>
                    <p className="text-sm text-gray-500">
                      Manage family members
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button 
                    onClick={() => window.location.href = '/children'}
                    className="w-full bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700 transition-colors"
                  >
                    Manage Children
                  </button>
                </div>
              </div>
            </div>

            {/* Settings Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-cog text-gray-800"></i>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {t('settings')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('account.settings')}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button 
                    onClick={handleManageAccount}
                    className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                  >
                    {t('manage.account')}
                  </button>
                </div>
              </div>
            </div>

            {/* Admin Panel Card - Only show for admin users */}
            {permissions.canAccessAdminPanel && (
              <div className="bg-white overflow-hidden shadow rounded-lg border-2 border-red-200">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-shield-alt text-red-800"></i>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        {t('admin.panel')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t('manage.members.and.roles')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button 
                      onClick={() => window.location.href = '/admin'}
                      className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                    >
                      <i className="fas fa-shield-alt mr-2"></i>
                      {t('access.admin.panel')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 