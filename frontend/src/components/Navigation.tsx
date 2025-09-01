import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../contexts/AuthContext';
import { getRolePermissions } from '../utils/roles';
import { isFeatureEnabled, featureFlags } from '../config/featureFlags';
// import { Transition } from '@headlessui/react'; // Removed due to React 19 compatibility

// type Language = 'en' | 'ti';

const Navigation: React.FC = () => {
  const { lang, setLang, t } = useI18n();
  const { currentUser, logout, getUserProfile } = useAuth();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  const handleLogout = async () => {
    console.log('🔄 Logout button clicked');
    try {
      await logout();
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Error logging out:', error);
    }
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser) {
        // Skip API calls for temporary users (new users who haven't completed registration)
        if (currentUser._temp) {
          console.log('🔄 Skipping profile fetch for temporary user');
          return;
        }
        
        try {
          setLoading(true);
          console.log('🔍 Navigation - currentUser:', currentUser);
          
          // Handle different user object structures
          const uid = currentUser.uid || currentUser.id;
          const email = currentUser.email;
          const phone = currentUser.phoneNumber;
          
          if (!uid) {
            console.error('❌ No UID found in currentUser:', currentUser);
            return;
          }
          
          const profile = await getUserProfile(uid, email, phone);
          console.log('🔍 Navigation - userProfile:', profile);
          console.log('🔍 Navigation - userRole from profile:', profile?.data?.member?.role || profile?.role);
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

  const userRole = userProfile?.data?.member?.role || userProfile?.role || 'member';
  const permissions = getRolePermissions(userRole);

  // Show navigation on all pages including home page

  return (
    <nav className="bg-gradient-to-r from-primary-700 to-primary-800 shadow-lg fixed w-full z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Church Name - Home Link */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity" onClick={() => setIsMenuOpen(false)}>
              <i className="fas fa-church text-2xl text-white"></i>
              <span className="text-lg md:text-xl font-bold text-white hidden sm:inline-block ml-2">
                Debre Tsehay Abune Aregawi Tigray Orthodox Tewahedo Church
              </span>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center ml-4">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {!isMenuOpen ? (
                <svg className="block h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {currentUser && (
              <>
                <Link 
                  to="/dashboard" 
                  className="px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 rounded-md transition-colors"
                >
                  {t('navigation.dashboard')}
                </Link>
                
                {/* Admin link removed from desktop header */}
                {/* Outreach link removed; access via Dashboard Relationship Department card */}
                {/* SMS link removed; access via Dashboard Communications card */}
                {/* Profile link removed as requested */}
              </>
            )}
          </div>

          {/* Right side - Language and Auth */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Language Switcher */}
            <div className="flex rounded-md overflow-hidden border border-white/20">
              <button
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  lang === 'en' 
                    ? 'bg-secondary-600 text-white' 
                    : 'bg-transparent text-white hover:bg-white/10'
                }`}
                onClick={() => setLang('en')}
              >
                EN
              </button>
              <div className="h-6 w-px bg-white/30"></div>
              <button
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  lang === 'ti' 
                    ? 'bg-secondary-600 text-white' 
                    : 'bg-transparent text-white hover:bg-white/10'
                }`}
                onClick={() => setLang('ti')}
              >
                ትግ
              </button>
            </div>

            {/* Auth Links */}
            {currentUser ? (
              <div className="flex items-center space-x-3">
                <div className="hidden lg:flex flex-col items-end">
                  <span className="text-sm font-medium text-white">
                    {userProfile?.data?.member?.firstName || userProfile?.firstName || currentUser.displayName?.split(' ')[0] || currentUser.email?.split('@')[0]}
                  </span>
                  <span className="text-xs text-white/70">
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {/* Profile link removed from desktop header */}
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 text-sm font-medium text-red-300 hover:text-red-100 hover:bg-red-600/20 rounded-md transition-colors"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i>
                    {t('sign.out')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 rounded-md transition-colors"
                >
                  {t('sign.in')}
                </Link>
                {/* Sign Up button only shows when email auth is enabled */}
                {featureFlags.enableEmailPasswordAuth && (
                  <Link
                    to="/register"
                    className="px-4 py-1.5 bg-secondary-600 text-white text-sm font-medium rounded-md hover:bg-secondary-700 transition-colors"
                  >
                    {t('auth.sign.up')}
                  </Link>
                )}
                {/* Force Logout button for stuck users */}
                {location.pathname === '/register' && (
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-sm font-medium text-red-300 hover:text-red-100 hover:bg-red-600/20 rounded-md transition-colors"
                    title="Force logout if stuck"
                  >
                    <i className="fas fa-sign-out-alt mr-1"></i>
                    Force Logout
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white shadow-xl rounded-b-lg overflow-hidden">
          {currentUser && (
            <div className="px-4 pt-4 pb-3 border-b border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-medium">
                    {userProfile?.data?.member?.firstName ? (
                      userProfile.data.member.firstName.charAt(0).toUpperCase()
                    ) : (
                      <i className="fas fa-user"></i>
                    )}
                  </div>
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-900">
                    {userProfile?.data?.member?.firstName || currentUser.displayName || currentUser.email}
                  </div>
                  <div className="text-sm text-gray-500">
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="px-2 pt-2 pb-3 space-y-1">
            {currentUser && (
              <>
                <Link
                  to="/dashboard"
                  className="block px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-100 mx-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <i className="fas fa-tachometer-alt mr-3 w-5 text-center"></i>
                  {t('navigation.dashboard')}
                </Link>
                
                {/* Admin link removed from mobile header */}
                {/* Outreach link removed from mobile; access via Dashboard Relationship Department card */}
                {/* SMS link removed from mobile menu; access via Dashboard Communications card */}
                
                {/* Profile link removed from mobile menu as requested */}
                
                <div className="border-t border-gray-200 my-2"></div>
                
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg text-base font-medium text-red-600 hover:bg-red-50 mx-2"
                >
                  <i className="fas fa-sign-out-alt mr-3 w-5 text-center"></i>
                  {t('sign.out')}
                </button>
              </>
            )}
            
            {!currentUser && (
              <div className="px-2 pt-2 space-y-2">
                <Link
                  to="/login"
                  className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg text-base font-medium text-white bg-primary-600 hover:bg-primary-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('sign.in')}
                </Link>
                {/* Mobile Sign Up button only shows when email auth is enabled */}
                {featureFlags.enableEmailPasswordAuth && (
                  <Link
                    to="/register"
                    className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-base font-medium text-primary-600 bg-white hover:bg-gray-50"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('sign.up')}
                  </Link>
                )}
                {/* Force Logout button for stuck users (mobile) */}
                {location.pathname === '/register' && (
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center px-4 py-3 border border-red-300 rounded-lg text-base font-medium text-red-600 bg-red-50 hover:bg-red-100"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i>
                    Force Logout
                  </button>
                )}
              </div>
            )}
            
            {/* Mobile Language Switcher */}
            <div className="px-4 pt-4 pb-3 border-t border-gray-200 mt-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                {t('language')}
              </p>
              <div className="flex rounded-lg overflow-hidden border border-gray-300">
                <button
                  className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center space-x-2 ${
                    lang === 'en' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    setLang('en');
                    setIsMenuOpen(false);
                  }}
                >
                  <span>English</span>
                </button>
                <div className="h-10 w-px bg-gray-300"></div>
                <button
                  className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center space-x-2 ${
                    lang === 'ti' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    setLang('ti');
                    setIsMenuOpen(false);
                  }}
                >
                  <span>ትግርኛ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;