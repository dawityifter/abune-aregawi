import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getRolePermissions, UserRole } from '../utils/roles';

interface UserProfile {
  success: boolean;
  data: {
    member: {
      id: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      email: string;
      role: UserRole;
      phoneNumber: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      // Add other member fields as needed
    };
  };
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logout, getUserProfile } = useAuth();
  const { t } = useLanguage();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user has admin permissions
  const userRole = (userProfile?.data?.member?.role || 'member') as UserRole;
  const permissions = getRolePermissions(userRole);
  
  // Debug logging for role and permissions


  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser) {
        try {
          const profile = await getUserProfile(currentUser.uid);
          setUserProfile(profile);
        } catch (error: any) {
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

  const handleViewProfile = () => {
    // Navigate to profile page using React Router
    navigate('/profile');
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
    navigate('/donate');
  };

  const handleManageAccount = () => {
    alert('Manage Account functionality coming soon!');
    // TODO: Navigate to account settings page
  };

  const handleRefreshProfile = async () => {
    if (currentUser) {
      setLoading(true);
      try {
        console.log('🔄 Manually refreshing user profile...');
        const profile = await getUserProfile(currentUser.uid);
        console.log('🔄 Refreshed profile:', profile);
        setUserProfile(profile);
        setError(null);
      } catch (error: any) {
        console.error('Error refreshing profile:', error);
        setError(`Failed to refresh profile: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
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
                      {userProfile?.data?.member?.firstName || currentUser?.email || 'User'}
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
                    onClick={() => navigate('/children')}
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

            {/* Treasurer Card - Show for treasurer, admin, and church_leadership roles */}
            {(permissions.canViewFinancialRecords || permissions.canEditFinancialRecords) && (
              <div className="bg-white overflow-hidden shadow rounded-lg border-2 border-green-200">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-coins text-green-800"></i>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        Treasurer
                      </h3>
                      <p className="text-sm text-gray-500">
                        Manage member payments and financial records
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button 
                      onClick={() => navigate('/treasurer')}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                    >
                      <i className="fas fa-coins mr-2"></i>
                      View Payments
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                      onClick={() => navigate('/admin')}
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