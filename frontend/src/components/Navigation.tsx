import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { getRolePermissions, hasPermission } from '../utils/roles';

const Navigation: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { currentUser, logout, getUserProfile } = useAuth();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Fetch user profile to check permissions
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser) {
        try {
          setLoading(true);
          const profile = await getUserProfile(currentUser.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error('Error fetching user profile:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserProfile();
  }, [currentUser, getUserProfile]);

  // Check if user has admin permissions
  const userRole = userProfile?.role || 'member';
  const permissions = getRolePermissions(userRole);

  // Don't show navigation on homepage since it has its own header
  if (location.pathname === '/') {
    return null;
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo and Home Link */}
          <Link to="/" className="flex items-center space-x-3">
            <i className="fas fa-cross text-2xl text-primary-800"></i>
            <span className="text-xl font-semibold text-gray-900">
              {t('church.name')}
            </span>
          </Link>

          {/* Right side - Language and Auth */}
          <div className="flex items-center space-x-4">
            {/* Language Switcher */}
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 rounded text-sm ${
                  language === 'en' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setLanguage('en')}
              >
                English
              </button>
              <button
                className={`px-3 py-1 rounded text-sm ${
                  language === 'ti' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setLanguage('ti')}
              >
                ትግርኛ
              </button>
            </div>

            {/* Auth Links */}
            {currentUser ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {t('welcome')}, {currentUser.displayName || currentUser.email}
                </span>
                <Link
                  to="/dashboard"
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  {t('member.dashboard')}
                </Link>
                {permissions.canAccessAdminPanel && (
                  <Link
                    to="/admin"
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    <i className="fas fa-shield-alt mr-1"></i>
                    {t('admin.panel')}
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  {t('sign.out')}
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-sm text-primary-600 hover:text-primary-800"
                >
                  {t('sign.in')}
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
                >
                  {t('register.member')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation; 