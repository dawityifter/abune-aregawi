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

  const userRole = userProfile?.role || 'member';
  const permissions = getRolePermissions(userRole);

  if (location.pathname === '/') {
    return null;
  }

  return (
    <nav className="traditional-header shadow-lg border-b border-primary-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo and Home Link */}
          <Link to="/" className="flex items-center space-x-3">
            <i className="fas fa-cross text-2xl text-secondary-400"></i>
            <span className="text-xl font-serif font-semibold text-white">
              {t('church.name')}
            </span>
          </Link>

          {/* Right side - Language and Auth */}
          <div className="flex items-center space-x-4">
            {/* Language Switcher */}
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  language === 'en' 
                    ? 'bg-secondary-600 text-white' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                onClick={() => setLanguage('en')}
              >
                English
              </button>
              <button
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  language === 'ti' 
                    ? 'bg-secondary-600 text-white' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
                onClick={() => setLanguage('ti')}
              >
                ትግርኛ
              </button>
            </div>

            {/* Auth Links */}
            {currentUser ? (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-white/90">
                  {t('welcome')}, {currentUser.displayName || currentUser.email}
                </span>
                <Link
                  to="/dashboard"
                  className="text-sm text-secondary-200 hover:text-secondary-100 transition-colors"
                >
                  {t('member.dashboard')}
                </Link>
                {permissions.canAccessAdminPanel && (
                  <Link
                    to="/admin"
                    className="text-sm text-yellow-200 hover:text-yellow-100 font-medium transition-colors"
                  >
                    <i className="fas fa-shield-alt mr-1"></i>
                    {t('admin.panel')}
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="text-sm text-yellow-200 hover:text-yellow-100 transition-colors"
                >
                  {t('sign.out')}
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-sm text-secondary-200 hover:text-secondary-100 transition-colors"
                >
                  {t('sign.in')}
                </Link>
                <Link
                  to="/register"
                  className="bg-secondary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-secondary-700 transition-colors"
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