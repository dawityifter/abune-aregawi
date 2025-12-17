import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getRolePermissions, UserRole } from '../utils/roles';
import { getDisplayEmail } from '../utils/email';
import { formatMemberName } from '../utils/formatName';

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
      title?: {
        name: string;
        abbreviation?: string;
      };
      // Add other member fields as needed
    };
  };
  _temp?: boolean; // Temporary user flag
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, firebaseUser, loading: authLoading, authReady } = useAuth();
  const { t } = useLanguage();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Temp user CTA timer should be declared at top-level, not conditionally
  const [showTempCta, setShowTempCta] = useState(false);
  const bgStyle: React.CSSProperties = {
    backgroundImage: `url(${process.env.PUBLIC_URL || ''}/bylaws/TigrayOrthodox-background.png)`,
    backgroundRepeat: 'repeat',
    backgroundPosition: 'top left',
    backgroundSize: 'auto',
  };
  useEffect(() => {
    if (!(user?._temp)) {
      setShowTempCta(false);
      return;
    }
    const timer = setTimeout(() => setShowTempCta(true), 10000);
    return () => clearTimeout(timer);
  }, [user]);

  // Get user's display name for the welcome message
  const userName = user?.first_name || user?.data?.member?.firstName || firebaseUser?.displayName || 'User';

  // Check if user has admin permissions
  const userRole = (user?.data?.member?.role || user?.role || 'member') as UserRole;
  const permissions = getRolePermissions(userRole);
  const isTempUser = user?._temp || false;
  // Treat backend-returned 'dependent' as a restricted role for UI visibility
  const isDependent = (user?.data?.member?.role || user?.role) === 'dependent';

  // Debug logging for role and permissions
  useEffect(() => {
    console.log('Dashboard - User state:', {
      isTempUser,
      userRole,
      permissions,
      hasUserProfile: !!user,
      userData: user
    });
  }, [user, isTempUser, userRole, permissions]);

  // Update user profile when auth state changes
  useEffect(() => {
    // Wait until initial Firebase auth state is resolved
    if (!authReady) {
      setLoading(true);
      return;
    }

    if (user) {
      setUserProfile(user);
      setLoading(false);
      return;
    }

    if (!authLoading && !firebaseUser) {
      // If auth is ready and no firebase user, redirect to login
      navigate('/login');
      return;
    }

    if (authLoading) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [user, firebaseUser, authLoading, authReady, navigate]);

  // Show loading state while auth is initializing or loading
  if (!authReady || loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  // Tailored banner for unlinked dependent logins
  if (user?.unlinkedDependent) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8" style={bgStyle}>
        <div className="max-w-3xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6 border border-yellow-200">
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-link text-yellow-700"></i>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Dependent Profile Not Linked</h2>
                <p className="text-gray-700 mb-4">
                  We found your dependent profile, but it is not yet linked to a head of household. Ask your parent/guardian to link you, or you can start a quick self-claim process to verify and link your profile.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => navigate('/dependents')}
                    className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                  >
                    Start Self-Claim
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    {t('dashboard.retry')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isTempUser) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8" style={bgStyle}>
        <div className="max-w-3xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('dashboard.welcome')}</h2>
            <p className="text-gray-600 mb-6">
              {t('dashboard.settingUp')}
            </p>
            <div className="flex justify-center mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
            </div>
            {showTempCta && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => navigate('/register')}
                  className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  {t('dashboard.complete')}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  {t('dashboard.retry')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleViewProfile = () => {
    // Navigate to profile page using React Router
    navigate('/profile');
  };

  const handleViewDues = () => {
    navigate('/dues');
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

  const handleViewBylaw = () => {
    navigate('/church-bylaw');
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">{t('dashboard.incomplete.title')}</h2>
          <p className="text-gray-600 mb-6">{t('dashboard.incomplete.desc')}</p>
          <button
            onClick={() => navigate('/register')}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
          >
            {t('dashboard.complete')}
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
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
    <div className="min-h-screen bg-gray-50 pt-16" style={bgStyle}>
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
                      {t('dashboard.profile.title')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {(userProfile?.data?.member ? formatMemberName(userProfile.data.member) : getDisplayEmail(firebaseUser?.email)) || 'User'}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleViewProfile}
                    className="w-full bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
                  >
                    {t('dashboard.profile.view')}
                  </button>
                </div>
              </div>
            </div>

            {/* Church Bylaw Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-book-open text-indigo-800"></i>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {t('dashboard.bylaw.title')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('dashboard.bylaw.desc')}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleViewBylaw}
                    className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    {t('dashboard.bylaw.view')}
                  </button>
                </div>
              </div>
            </div>

            {/* Dues Card (visible to all, dependents see head-of-household dues) */}
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
                      {t('dashboard.dues.title')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {isDependent ? t('dashboard.dues.dependentView') : t('dashboard.dues.viewAndPay')}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleViewDues}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                  >
                    {t('dashboard.dues.view')}
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
                      {t('dashboard.events.title')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('dashboard.events.upcoming')}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleViewEvents}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {t('dashboard.events.view')}
                  </button>
                </div>
              </div>
            </div>

            {/* Department Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-users text-purple-800"></i>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {t('dashboard.service.title')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('dashboard.service.desc')}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      // TODO: Fetch user departments and implement smart routing
                      // For now, just navigate to a departments page
                      navigate('/departments');
                    }}
                    className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
                  >
                    {t('dashboard.service.view')}
                  </button>
                </div>
              </div>
            </div>

            {/* Board Members Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-church text-amber-800"></i>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {t('board.title') || "Board Members"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('board.card.desc') || "View our church leadership and board members"}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => navigate('/board-members')}
                    className="w-full bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 transition-colors"
                  >
                    {t('board.view') || "View Leadership"}
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
                      {t('dashboard.give.title')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('dashboard.give.desc')}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleDonate}
                    className="w-full bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition-colors"
                  >
                    {t('dashboard.give.action')}
                  </button>
                </div>
              </div>
            </div>

            {/* Children Management Card (hidden for dependents) */}
            {!isDependent && (
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
                        {t('dashboard.family.title')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t('dashboard.family.desc')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => navigate('/dependents')}
                      className="w-full bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700 transition-colors"
                    >
                      {t('dashboard.family.manage')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Communications Card (visible to admin, church leadership, secretary) */}
            {(permissions.canSendCommunications) && (
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-sms text-gray-800"></i>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        {t('dashboard.communications.title')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t('dashboard.communications.desc')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => navigate('/sms')}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                    >
                      {t('dashboard.communications.open')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Relationship Department Card (visible to roles with outreach/onboarding permissions) */}
            {(permissions.canAccessOutreachDashboard || permissions.canManageOnboarding) && (
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                        <i className="fas fa-hands-helping text-teal-800"></i>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">
                        {t('dashboard.relationships.title')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t('dashboard.relationships.desc')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => navigate('/outreach')}
                      className="w-full bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 transition-colors"
                    >
                      {t('dashboard.relationships.open')}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                        {t('dashboard.treasurer.title')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t('dashboard.treasurer.desc')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => navigate('/treasurer')}
                      className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                    >
                      <i className="fas fa-coins mr-2"></i>
                      {t('dashboard.treasurer.view')}
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
                        {t('dashboard.admin.title')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t('dashboard.admin.desc')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => navigate('/admin')}
                      className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
                    >
                      <i className="fas fa-shield-alt mr-2"></i>
                      {t('dashboard.admin.access')}
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