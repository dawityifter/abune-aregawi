import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getRolePermissions, UserRole } from '../../utils/roles';

type RecipientType = 'individual' | 'group' | 'all';

interface MemberOption {
  id: string | number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phoneNumber?: string;
}

const SmsBroadcast: React.FC = () => {
  const { currentUser, firebaseUser, getUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [recipientType, setRecipientType] = useState<RecipientType>('individual');
  const [message, setMessage] = useState('');

  const [memberQuery, setMemberQuery] = useState('');
  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [groupId, setGroupId] = useState<string>('');
  const [groups, setGroups] = useState<Array<{ id: string | number; name: string; label?: string }>>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load profile for role and permissions
  useEffect(() => {
    const run = async () => {
      if (!currentUser) { setLoadingProfile(false); return; }
      try {
        const uid = (currentUser as any).uid || (currentUser as any).id;
        const email = (currentUser as any).email;
        const phone = (currentUser as any).phoneNumber;
        const profile = await getUserProfile(uid, email, phone);
        setUserProfile(profile);
      } catch (e) {
        console.error('SmsBroadcast: profile load failed', e);
      } finally {
        setLoadingProfile(false);
      }
    };
    run();
  }, [currentUser, getUserProfile]);

  const userRole: UserRole = (userProfile?.data?.member?.role || 'member') as UserRole;
  const permissions = useMemo(() => getRolePermissions(userRole), [userRole]);
  const canSend = permissions.canSendCommunications || userRole === 'admin' || userRole === 'church_leadership' || userRole === 'secretary';

  // Load active groups for authorized users (RBAC enforced in backend)
  useEffect(() => {
    const fetchGroups = async () => {
      if (!firebaseUser || !canSend) return;
      setGroupsLoading(true);
      setGroupsError(null);
      try {
        const idToken = await firebaseUser.getIdToken(true);
        const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/groups/active?includeCounts=true`, {
          headers: { Authorization: `Bearer ${idToken}` },
          credentials: 'include',
        });
        const data = await resp.json().catch(() => ({} as any));
        if (!resp.ok) throw new Error(data?.message || 'Failed to load groups');
        const list: any[] = data?.data || [];
        setGroups(list.map(g => ({ id: g.id, name: g.name, label: g.label })));
      } catch (e: any) {
        setGroupsError(e.message || 'Failed to load groups');
        setGroups([]);
      } finally {
        setGroupsLoading(false);
      }
    };
    fetchGroups();
  }, [firebaseUser, canSend]);

  // Debounced members search
  useEffect(() => {
    let timeout: any;
    const fetchMembers = async () => {
      if (!firebaseUser) return;
      setMembersLoading(true);
      setMembersError(null);
      try {
        const idToken = await firebaseUser.getIdToken(true);
        const url = new URL(`${process.env.REACT_APP_API_URL}/api/members/all`);
        if (memberQuery && memberQuery.trim().length > 0) {
          // Backend expects 'search' query param
          url.searchParams.set('search', memberQuery.trim());
        } else {
          url.searchParams.set('limit', '50');
        }
        const resp = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${idToken}` },
          credentials: 'include',
        });
        // Some environments may return 204 No Content for empty result sets
        if (resp.status === 204) {
          setMemberOptions([]);
          return;
        }
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({} as any));
          throw new Error(data?.message || 'Failed to load members');
        }
        const data = await resp.json();
        const members: any[] = data?.data?.members || data?.data || [];
        setMemberOptions(members);
      } catch (e: any) {
        setMembersError(e.message || 'Failed to load members');
        setMemberOptions([]);
      } finally {
        setMembersLoading(false);
      }
    };

    timeout = setTimeout(fetchMembers, 350);
    return () => clearTimeout(timeout);
  }, [memberQuery, firebaseUser]);

  const fullName = (m: MemberOption) => `${m.firstName || ''} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName || ''}`.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setResultMsg(null);

    try {
      if (!firebaseUser) throw new Error('Not authenticated');
      if (!message || !message.trim()) throw new Error('Message is required');

      const idToken = await firebaseUser.getIdToken(true);
      let endpoint = '';
      if (recipientType === 'individual') {
        if (!selectedMemberId) throw new Error('Please select a member');
        endpoint = `${process.env.REACT_APP_API_URL}/api/sms/sendIndividual/${encodeURIComponent(selectedMemberId)}`;
      } else if (recipientType === 'group') {
        if (!groupId) throw new Error('Please enter a group ID');
        endpoint = `${process.env.REACT_APP_API_URL}/api/sms/sendGroup/${encodeURIComponent(groupId)}`;
      } else {
        endpoint = `${process.env.REACT_APP_API_URL}/api/sms/sendAll`;
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ message }),
      });

      const data = await resp.json().catch(() => ({} as any));
      if (!resp.ok) {
        throw new Error(data?.message || 'Failed to send SMS');
      }
      if (recipientType === 'individual') {
        setResultMsg('Message sent successfully to the selected member.');
      } else if (recipientType === 'group') {
        setResultMsg(`Group message request queued. Success: ${data?.successCount ?? '-'} / ${data?.total ?? '-'}`);
      } else {
        setResultMsg(`Broadcast request queued. Success: ${data?.successCount ?? '-'} / ${data?.total ?? '-'}`);
      }
      setMessage('');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to send SMS');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (!canSend) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-2">Access Denied</div>
          <p className="text-gray-600">You don't have permission to send SMS communications.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <i className="fas fa-sms text-2xl text-primary-800 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">SMS Communications</h1>
            </div>
            <span className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded-full">{userRole}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="bg-white border rounded-lg shadow-sm p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
            <div className="flex flex-wrap gap-2">
              {(['individual','group','all'] as RecipientType[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setRecipientType(t)}
                  className={`px-3 py-1.5 rounded border ${recipientType === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {t === 'individual' ? 'Individual' : t === 'group' ? 'Group' : 'All Members'}
                </button>
              ))}
            </div>
          </div>

          {recipientType === 'individual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Member</label>
              <input
                type="text"
                placeholder="Search members by name or phone…"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-2"
              />
              {membersLoading && <div className="text-sm text-gray-500">Loading members…</div>}
              {membersError && <div className="text-sm text-red-600">{membersError}</div>}
              {!membersLoading && !membersError && (
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- Select a member --</option>
                  {memberOptions.map((m) => (
                    <option key={String(m.id)} value={String(m.id)}>
                      {fullName(m)} {m.phoneNumber ? `(${m.phoneNumber})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {recipientType === 'group' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Group</label>
              {groupsLoading && <div className="text-sm text-gray-500">Loading groups…</div>}
              {groupsError && <div className="text-sm text-red-600">{groupsError}</div>}
              {!groupsLoading && !groupsError && (
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- Select a group --</option>
                  {groups.map(g => (
                    <option key={String(g.id)} value={String(g.id)}>{g.label || g.name}</option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-500 mt-1">Only active groups you are authorized to target are listed.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              rows={5}
              placeholder="Type your SMS message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border rounded px-3 py-2"
              maxLength={800}
            />
            <div className="text-xs text-gray-500 mt-1">Max ~800 chars. Avoid sensitive info. Phone numbers are pulled from the database automatically.</div>
          </div>

          {errorMsg && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{errorMsg}</div>
          )}
          {resultMsg && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">{resultMsg}</div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 rounded text-white ${submitting ? 'bg-gray-400' : 'bg-primary-600 hover:bg-primary-700'}`}
            >
              {submitting ? 'Sending…' : 'Send SMS'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default SmsBroadcast;
