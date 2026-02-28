import React, { useEffect, useState } from 'react';
import ModalWelcomeNote from './ModalWelcomeNote';
import { useAuth } from '../../contexts/AuthContext';
import { getMergedPermissions, UserRole } from '../../utils/roles';
import { formatE164ToDisplay } from '../../utils/formatPhoneNumber';
import { useI18n } from '../../i18n/I18nProvider';
import AnnouncementsPanel from './AnnouncementsPanel';
import ChurchTvView from './ChurchTvView';

const OutreachDashboard: React.FC = () => {
  const { currentUser, firebaseUser, getUserProfile } = useAuth();
  const { t } = useI18n();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [welcomed, setWelcomed] = useState<any[]>([]);
  const [welcomedLoading, setWelcomedLoading] = useState(false);
  const [welcomedError, setWelcomedError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'pending' | 'welcomed' | 'announcements'>('pending');
  const [actionBusyId, setActionBusyId] = useState<string | number | null>(null);
  const [modalMember, setModalMember] = useState<any | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isTvView, setIsTvView] = useState(false);
  const [tvInterval, setTvInterval] = useState(30);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Helper: request with timeout to prevent hanging requests
  const requestWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(input, { ...init, signal: controller.signal });
      return resp;
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        const err: any = new Error('Request timed out');
        err.code = 'TIMEOUT';
        throw err;
      }
      throw e;
    } finally {
      clearTimeout(id);
    }
  };

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

  // Load TV rotation interval and active announcements
  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const token = await firebaseUser.getIdToken(true);
        const headers = { Authorization: `Bearer ${token}` };
        const [intervalRes, announcementsRes] = await Promise.all([
          fetch(`${process.env.REACT_APP_API_URL}/api/settings/tv-rotation-interval`, { headers, credentials: 'include' }),
          fetch(`${process.env.REACT_APP_API_URL}/api/announcements/active`, { headers, credentials: 'include' }),
        ]);
        if (intervalRes.ok) {
          const d = await intervalRes.json();
          if (d?.data?.seconds) setTvInterval(d.data.seconds);
        }
        if (announcementsRes.ok) {
          const d = await announcementsRes.json();
          setAnnouncements(d?.data || []);
        }
      } catch (e) {
        // non-critical; TV view still works with defaults
      }
    })();
  }, [firebaseUser]);

  const handleIntervalChange = async (seconds: number) => {
    setTvInterval(seconds);
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken(true);
      await fetch(`${process.env.REACT_APP_API_URL}/api/settings/tv-rotation-interval`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ seconds }),
      });
    } catch (e) {
      // best-effort persist
    }
  };

  // Fetch pending welcomes from backend
  const loadPendingWelcomes = async () => {
    if (!firebaseUser) return;
    setPendingLoading(true);
    setPendingError(null);
    try {
      const idToken = await firebaseUser.getIdToken(true);
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/members/onboarding/pending`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        credentials: 'include',
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data?.message || 'Failed to load pending welcomes');
      }
      const data = await resp.json();
      // Expecting data like { success: true, data: { members: [...], total, page, pageSize } }
      const members = data?.data?.members || data?.data || [];
      setPending(members);
    } catch (e: any) {
      setPendingError(e.message || 'Failed to load pending welcomes');
    } finally {
      setPendingLoading(false);
    }
  };

  // Fetch welcomed members from backend
  const loadWelcomedMembers = async () => {
    if (!firebaseUser) return;
    setWelcomedLoading(true);
    setWelcomedError(null);
    try {
      const idToken = await firebaseUser.getIdToken(true);
      const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/members/onboarding/welcomed`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        credentials: 'include',
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data?.message || 'Failed to load welcomed members');
      }
      const data = await resp.json();
      const members = data?.data?.members || data?.data || [];
      setWelcomed(members);
    } catch (e: any) {
      setWelcomedError(e.message || 'Failed to load welcomed members');
    } finally {
      setWelcomedLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') {
      loadPendingWelcomes();
    } else if (activeTab === 'welcomed') {
      loadWelcomedMembers();
    }
    // 'announcements' tab manages its own data via AnnouncementsPanel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  const member = userProfile?.data?.member || userProfile;
  const roles: UserRole[] = member?.roles || [member?.role || 'member'];
  const permissions = getMergedPermissions(roles);

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
    <div className="min-h-screen bg-gray-50 flex flex-col pt-16">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex flex-col sm:flex-row justify-between items-center py-4 space-y-4 sm:space-y-0">
            <div className="flex items-center">
              <i className="fas fa-hands-helping text-2xl text-primary-800 mr-3"></i>
              <h1 className="text-xl font-semibold text-gray-900">{t('outreachDashboard.title')}</h1>
            </div>
            <div className="flex items-center space-x-6">


              {/* TV View Toggle */}
              <div className="flex items-center">
                <span className="mr-3 text-sm font-medium text-gray-900">{t('outreachDashboard.churchTvView')}</span>
                <button
                  type="button"
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 ${isTvView ? 'bg-primary-600' : 'bg-gray-200'}`}
                  role="switch"
                  aria-checked={isTvView}
                  aria-label={t('outreachDashboard.churchTvView')}
                  onClick={() => setIsTvView(!isTvView)}
                >
                  <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isTvView ? 'translate-x-5' : 'translate-x-0'}`}></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 w-full">
        {isTvView ? (
          <ChurchTvView
            pendingWelcomes={pending}
            announcements={announcements}
            rotationIntervalSeconds={tvInterval}
            onIntervalChange={handleIntervalChange}
          />
        ) : (
          /* ========================================= */
          /* Standard Outreach Committee View Layout   */
          /* ========================================= */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Pending welcome summary */}
            <section className="bg-white shadow-sm rounded-lg p-4 border h-fit">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <i className="fas fa-bell mr-2 text-primary-700"></i>
                {t('outreachDashboard.pendingWelcomes')}
              </h2>
              <p className="text-sm text-gray-600 mb-3">{t('outreachDashboard.pendingDesc')}</p>
              {pendingLoading && (
                <div className="text-sm text-gray-500">{t('common.loading')}</div>
              )}
              {pendingError && (
                <div className="text-sm text-red-600">{pendingError}</div>
              )}
              {!pendingLoading && !pendingError && (
                <div className="text-2xl font-semibold text-primary-800">{pending.length}</div>
              )}
              <button
                onClick={loadPendingWelcomes}
                className="mt-3 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                {t('outreachDashboard.refresh')}
              </button>
            </section>

            {/* Right: Detailed list with actions */}
            <section className="bg-white shadow-sm rounded-lg p-0 border lg:col-span-2">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 px-4" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('pending')}
                    className={`whitespace-nowrap flex py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'pending' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                  >
                    <i className="fas fa-user-clock mr-2 self-center"></i>
                    {t('outreachDashboard.tabs.pending')}
                  </button>
                  <button
                    onClick={() => setActiveTab('welcomed')}
                    className={`whitespace-nowrap flex py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'welcomed' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                  >
                    <i className="fas fa-user-check mr-2 self-center"></i>
                    {t('outreachDashboard.tabs.welcomed')}
                  </button>
                  <button
                    onClick={() => setActiveTab('announcements')}
                    className={`whitespace-nowrap flex py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'announcements' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                  >
                    <i className="fas fa-bullhorn mr-2 self-center"></i>
                    {t('outreachDashboard.tabs.announcements')}
                  </button>
                </nav>
              </div>

              <div className="p-4">
                {activeTab === 'pending' && (
                  <>
                    <p className="text-sm text-gray-600 mb-4">{t('outreachDashboard.onboardingDesc')}</p>
                    {pendingLoading && (
                      <div className="text-sm text-gray-500">{t('outreachDashboard.loadingPending')}</div>
                    )}
                    {pendingError && (
                      <div className="text-sm text-red-600">{pendingError}</div>
                    )}
                    {!pendingLoading && !pendingError && pending.length === 0 && (
                      <div className="text-sm text-gray-500">{t('outreachDashboard.allCaughtUp')}</div>
                    )}

                    {!pendingLoading && !pendingError && pending.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('outreachDashboard.table.name')}</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('outreachDashboard.table.contact')}</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('outreachDashboard.table.action')}</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {pending.map((m: any) => (
                              <tr key={m.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                  {m.firstName} {m.middleName ? `${m.middleName} ` : ''}{m.lastName}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                                  <div>{m.phoneNumber || '-'}</div>
                                  <div className="text-gray-500">{m.email || '-'}</div>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm">
                                  {permissions.canManageOnboarding ? (
                                    <button
                                      disabled={actionBusyId === m.id}
                                      onClick={() => {
                                        setModalError(null);
                                        setModalMember(m);
                                      }}
                                      className={`px-3 py-1.5 rounded text-white ${actionBusyId === m.id ? 'bg-gray-400' : 'bg-primary-600 hover:bg-primary-700'}`}
                                    >
                                      {t('outreachDashboard.markWelcomed')}
                                    </button>
                                  ) : (
                                    <span className="text-gray-400">{t('outreachDashboard.noPermission')}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'announcements' && (
                  <AnnouncementsPanel
                    canManage={permissions.canManageAnnouncements}
                    getIdToken={() => firebaseUser!.getIdToken(true)}
                  />
                )}

                {activeTab === 'welcomed' && (
                  <>
                    {welcomedLoading && (
                      <div className="text-sm text-gray-500">{t('outreachDashboard.loadingWelcomed')}</div>
                    )}
                    {welcomedError && (
                      <div className="text-sm text-red-600">{welcomedError}</div>
                    )}
                    {!welcomedLoading && !welcomedError && welcomed.length === 0 && (
                      <div className="text-sm text-gray-500">{t('outreachDashboard.noWelcomedMembers')}</div>
                    )}

                    {!welcomedLoading && !welcomedError && welcomed.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('outreachDashboard.welcomedColumns.memberNumber')}</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('outreachDashboard.table.name')}</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('outreachDashboard.welcomedColumns.familySize')}</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('outreachDashboard.welcomedColumns.dateJoined')}</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('outreachDashboard.welcomedColumns.welcomedBy')}</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('outreachDashboard.welcomedColumns.welcomeNote')}</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {welcomed.map((m: any) => (
                              <tr key={m.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  #{m.id}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-medium">
                                  {m.firstName} {m.middleName ? `${m.middleName} ` : ''}{m.lastName}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {m.familySize}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(m.dateJoined || m.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {m.welcomedBy || '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate" title={m.welcomeNote}>
                                  {m.welcomeNote || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {modalMember && !isTvView && (
        <ModalWelcomeNote
          memberId={modalMember.id}
          memberName={`${modalMember.firstName} ${modalMember.middleName ? modalMember.middleName + ' ' : ''}${modalMember.lastName}`}
          memberPhone={formatE164ToDisplay(modalMember.phoneNumber || '')}
          busy={actionBusyId === modalMember.id}
          error={modalError}
          onClose={async (success: boolean, note?: string) => {
            if (!success) {
              setModalMember(null);
              return;
            }
            if (!firebaseUser) return;
            setActionBusyId(modalMember.id);
            setModalError(null);
            try {
              const idToken = await firebaseUser.getIdToken(true);
              // 1) Create outreach note
              const respCreate = await requestWithTimeout(`${process.env.REACT_APP_API_URL}/api/members/${encodeURIComponent(modalMember.id)}/outreach`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
                credentials: 'include',
                body: JSON.stringify({ note })
              });
              if (!respCreate.ok) {
                const data = await respCreate.json().catch(() => ({} as any));
                throw new Error(data?.message || 'Failed to save outreach note');
              }
              // 2) Mark welcomed
              const respMark = await requestWithTimeout(`${process.env.REACT_APP_API_URL}/api/members/${encodeURIComponent(modalMember.id)}/mark-welcomed`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
                credentials: 'include',
              });
              if (!respMark.ok) {
                const data = await respMark.json().catch(() => ({} as any));
                throw new Error(data?.message || 'Failed to mark welcomed');
              }
              // Update UI
              setPending(prev => prev.filter(x => x.id !== modalMember.id));
              alert(t('outreachDashboard.welcomedSuccess'));
              setModalMember(null);
            } catch (e: any) {
              if (e?.code === 'TIMEOUT') {
                // Suppress timeout error in UI; allow the user to retry silently
                // eslint-disable-next-line no-console
                console.warn('Outreach/mark-welcomed request timed out; suppressing error to user.');
              } else {
                setModalError(e?.message || 'Failed to complete outreach');
              }
            } finally {
              setActionBusyId(null);
            }
          }}
        />
      )}
    </div>
  );
}
  ;

export default OutreachDashboard;
