import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getRolePermissions, UserRole } from '../../utils/roles';

type RecipientType = 'individual' | 'department' | 'all';

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

  const [departmentId, setDepartmentId] = useState<string>('');
  const [departments, setDepartments] = useState<Array<{ id: string | number; name: string; type: string; member_count: number }>>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const [departmentsError, setDepartmentsError] = useState<string | null>(null);

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

  // Load active departments for authorized users
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!firebaseUser || !canSend) return;
      setDepartmentsLoading(true);
      setDepartmentsError(null);
      try {
        const idToken = await firebaseUser.getIdToken(true);
        const resp = await fetch(`${process.env.REACT_APP_API_URL}/api/departments?is_active=true&include_members=true`, {
          headers: { Authorization: `Bearer ${idToken}` },
          credentials: 'include',
        });
        const data = await resp.json().catch(() => ({} as any));
        if (!resp.ok) throw new Error(data?.message || 'Failed to load departments');
        const list: any[] = data?.data?.departments || [];
        setDepartments(list.map(d => ({ id: d.id, name: d.name, type: d.type, member_count: d.member_count || 0 })));
      } catch (e: any) {
        setDepartmentsError(e.message || 'Failed to load departments');
        setDepartments([]);
      } finally {
        setDepartmentsLoading(false);
      }
    };
    fetchDepartments();
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
        const url = new URL(`${process.env.REACT_APP_API_URL}/api/members/all/firebase`);
        // Backend expects 'search' and supports 'limit'
        if (memberQuery && memberQuery.trim().length > 0) {
          url.searchParams.set('search', memberQuery.trim());
        }
        url.searchParams.set('limit', '50');
        const resp = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${idToken}` },
          credentials: 'include',
        });
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
      } else if (recipientType === 'department') {
        if (!departmentId) throw new Error('Please select a department');
        endpoint = `${process.env.REACT_APP_API_URL}/api/sms/sendDepartment/${encodeURIComponent(departmentId)}`;
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
      } else if (recipientType === 'department') {
        setResultMsg(`Department message sent to "${data?.departmentName || 'Unknown'}". Success: ${data?.successCount ?? '-'} / ${data?.total ?? '-'}`);
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
              {(['individual','department','all'] as RecipientType[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setRecipientType(t)}
                  className={`px-3 py-1.5 rounded border ${recipientType === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {t === 'individual' ? 'Individual' : t === 'department' ? 'Department' : 'All Members'}
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

          {recipientType === 'department' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Department</label>
              {departmentsLoading && <div className="text-sm text-gray-500">Loading departments…</div>}
              {departmentsError && <div className="text-sm text-red-600">{departmentsError}</div>}
              {!departmentsLoading && !departmentsError && (
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- Select a department --</option>
                  {departments.map(d => (
                    <option key={String(d.id)} value={String(d.id)}>
                      {d.name} ({d.type}) - {d.member_count} members
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-500 mt-1">Only active departments with members are listed.</p>
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
