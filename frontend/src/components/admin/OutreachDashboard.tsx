import React, { useEffect, useState } from 'react';
import ModalWelcomeNote from './ModalWelcomeNote';
import { useAuth } from '../../contexts/AuthContext';
import { getRolePermissions, UserRole } from '../../utils/roles';
import { formatE164ToDisplay } from '../../utils/formatPhoneNumber';

const OutreachDashboard: React.FC = () => {
  const { currentUser, firebaseUser, getUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | number | null>(null);
  const [modalMember, setModalMember] = useState<any | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

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

  useEffect(() => {
    loadPendingWelcomes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

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
          {/* Left: Pending welcome summary */}
          <section className="bg-white shadow-sm rounded-lg p-4 border">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <i className="fas fa-bell mr-2 text-primary-700"></i>
              Pending Welcomes
            </h2>
            <p className="text-sm text-gray-600 mb-3">Members who registered but haven't been welcomed yet.</p>
            {pendingLoading && (
              <div className="text-sm text-gray-500">Loading…</div>
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
              Refresh
            </button>
          </section>

          {/* Right: Detailed list with actions */}
          <section className="bg-white shadow-sm rounded-lg p-0 border lg:col-span-2">
            <div className="p-4 border-b">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <i className="fas fa-user-friends mr-2 text-primary-700"></i>
                Onboarding Queue
              </h2>
              <p className="text-sm text-gray-600">Mark a member as welcomed after contact is made.</p>
            </div>

            <div className="p-4">
              {pendingLoading && (
                <div className="text-sm text-gray-500">Loading pending members…</div>
              )}
              {pendingError && (
                <div className="text-sm text-red-600">{pendingError}</div>
              )}
              {!pendingLoading && !pendingError && pending.length === 0 && (
                <div className="text-sm text-gray-500">All caught up! No pending welcomes.</div>
              )}

              {!pendingLoading && !pendingError && pending.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
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
                                Mark Welcomed
                              </button>
                            ) : (
                              <span className="text-gray-400">No permission</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {modalMember && (
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
              alert('Welcomed note saved and member marked welcomed.');
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
