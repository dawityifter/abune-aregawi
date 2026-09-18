import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getMergedPermissions, UserRole } from '../utils/roles';
import { getDisplayEmail } from '../utils/email';
import { formatMemberName } from '../utils/formatName';
import ParishAnnouncements from './ParishAnnouncements';
import LiturgicalToday from './LiturgicalToday';
import BaptismalNamePrompt from './BaptismalNamePrompt';
import MemberStanding from './MemberStanding';
import NextService from './NextService';

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
  const [error] = useState<string | null>(null);
  // Temp user CTA timer should be declared at top-level, not conditionally
  const [showTempCta, setShowTempCta] = useState(false);
  useEffect(() => {
    if (!(user?._temp)) {
      setShowTempCta(false);
      return;
    }
    const timer = setTimeout(() => setShowTempCta(true), 10000);
    return () => clearTimeout(timer);
  }, [user]);

  // Check if user has admin permissions
  const memberData = user?.data?.member || user;
  const userRoles: UserRole[] = useMemo(
    () => memberData?.roles || [memberData?.role || 'member'],
    [memberData]
  );
  const permissions = getMergedPermissions(userRoles);
  const isTempUser = user?._temp || false;
  // Treat backend-returned 'dependent' as a restricted role for UI visibility
  const isDependent = (user?.data?.member?.role || user?.role) === 'dependent';

  // Debug logging for role and permissions
  useEffect(() => {
    console.log('Dashboard - User state:', {
      isTempUser,
      userRoles,
      permissions,
      hasUserProfile: !!user,
      userData: user
    });
  }, [user, isTempUser, userRoles, permissions]);

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  // Tailored banner for unlinked dependent logins
  if (user?.unlinkedDependent) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
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
      <div className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
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

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

  const member = userProfile?.data?.member;

  type DashLink = { to: string; icon: string; title: string; desc: string };

  const memberLinks: DashLink[] = [
    { to: '/profile', icon: 'fas fa-user', title: t('dashboard.profile.title'), desc: (member ? formatMemberName(member) : getDisplayEmail(firebaseUser?.email)) || '' },
    { to: '/dues', icon: 'fas fa-dollar-sign', title: t('dashboard.dues.title'), desc: isDependent ? t('dashboard.dues.dependentView') : t('dashboard.dues.viewAndPay') },
    { to: '/donate', icon: 'fas fa-heart', title: t('dashboard.give.title'), desc: t('dashboard.give.desc') },
    ...(isDependent ? [] : [{ to: '/dependents', icon: 'fas fa-child', title: t('dashboard.family.title'), desc: t('dashboard.family.desc') }]),
    { to: '/departments', icon: 'fas fa-users', title: t('dashboard.service.title'), desc: t('dashboard.service.desc') },
    { to: '/gallery', icon: 'fas fa-images', title: t('dashboard.gallery.title'), desc: t('dashboard.gallery.desc') },
    { to: '/board-members', icon: 'fas fa-church', title: t('board.title'), desc: t('board.card.desc') },
    { to: '/church-bylaw', icon: 'fas fa-book-open', title: t('dashboard.bylaw.title'), desc: t('dashboard.bylaw.desc') },
  ];

  // Same permission gates as before, just collected rather than interleaved
  // with the member's own destinations.
  const adminLinks: DashLink[] = [
    ...(permissions.canSendCommunications ? [{ to: '/sms', icon: 'fas fa-sms', title: t('dashboard.communications.title'), desc: t('dashboard.communications.desc') }] : []),
    ...(permissions.canAccessOutreachDashboard || permissions.canManageOnboarding ? [{ to: '/outreach', icon: 'fas fa-hands-helping', title: t('dashboard.relationships.title'), desc: t('dashboard.relationships.desc') }] : []),
    ...(permissions.canViewFinancialRecords || permissions.canEditFinancialRecords ? [{ to: '/treasurer', icon: 'fas fa-coins', title: t('dashboard.treasurer.title'), desc: t('dashboard.treasurer.desc') }] : []),
    ...(permissions.canAccessAdminPanel ? [{ to: '/admin', icon: 'fas fa-shield-alt', title: t('dashboard.admin.title'), desc: t('dashboard.admin.desc') }] : []),
  ];

  return (
    <div className="min-h-screen bg-neutral-50 pt-top-nav">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* The member's own situation, before any navigation. */}
          <MemberStanding firstName={member?.firstName} />
          {/* The one thing that is different every time they open it. */}
          <LiturgicalToday variant="dashboard" />
          <NextService />
          {/* Below the liturgical band, so the member is given something before
              being asked for something. Renders nothing once answered or
              declined. */}
          <BaptismalNamePrompt />
          <ParishAnnouncements variant="dashboard" />
          {/* Twelve near-identical cards in twelve unrelated Tailwind hues
              became two lists. Colour no longer encodes category — it had no
              meaning to encode — and administration is separated out rather
              than sitting among a member's own destinations at equal weight. */}
          <nav aria-label={t('dashboard.nav.member')} className="card divide-y divide-accent-200 p-0">
            {memberLinks.map((link) => (
              <button
                key={link.to}
                type="button"
                onClick={() => navigate(link.to)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-accent-100 transition-colors"
              >
                <i className={`${link.icon} w-5 text-center text-primary-700`} aria-hidden="true" />
                <span className="flex-1">
                  <span className="block font-semibold text-accent-700">{link.title}</span>
                  <span className="block text-sm text-accent-500">{link.desc}</span>
                </span>
                <i className="fas fa-chevron-right text-accent-400" aria-hidden="true" />
              </button>
            ))}
          </nav>

          {adminLinks.length > 0 && (
            <section className="mt-8">
              <h2 className="font-serif text-h4 text-accent-500 mb-2">
                {t('dashboard.nav.administration')}
              </h2>
              <nav aria-label={t('dashboard.nav.administration')} className="card divide-y divide-accent-200 p-0">
                {adminLinks.map((link) => (
                  <button
                    key={link.to}
                    type="button"
                    onClick={() => navigate(link.to)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-accent-100 transition-colors"
                  >
                    <i className={`${link.icon} w-5 text-center text-accent-500`} aria-hidden="true" />
                    <span className="flex-1">
                      <span className="block font-semibold text-accent-700">{link.title}</span>
                      <span className="block text-sm text-accent-500">{link.desc}</span>
                    </span>
                    <i className="fas fa-chevron-right text-accent-400" aria-hidden="true" />
                  </button>
                ))}
              </nav>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 
