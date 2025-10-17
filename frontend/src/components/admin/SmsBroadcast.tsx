import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getRolePermissions, UserRole } from '../../utils/roles';

type RecipientType = 'individual' | 'department' | 'all' | 'pending_pledges' | 'fulfilled_pledges';

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

  const [departmentRecipients, setDepartmentRecipients] = useState<any[]>([]);
  const [departmentRecipientsCount, setDepartmentRecipientsCount] = useState(0);
  const [departmentRecipientsLoading, setDepartmentRecipientsLoading] = useState(false);
  const [showDepartmentRecipientsList, setShowDepartmentRecipientsList] = useState(false);

  const [pledgeRecipients, setPledgeRecipients] = useState<any[]>([]);
  const [pledgeRecipientsCount, setPledgeRecipientsCount] = useState(0);
  const [pledgeRecipientsLoading, setPledgeRecipientsLoading] = useState(false);
  const [showPledgeRecipientsList, setShowPledgeRecipientsList] = useState(false);

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

  // Load department recipients when a department is selected
  useEffect(() => {
    const fetchDepartmentRecipients = async () => {
      if (!firebaseUser || !canSend || !departmentId) {
        setDepartmentRecipients([]);
        setDepartmentRecipientsCount(0);
        return;
      }

      setDepartmentRecipientsLoading(true);
      try {
        const idToken = await firebaseUser.getIdToken(true);
        const resp = await fetch(
          `${process.env.REACT_APP_API_URL}/api/sms/departmentRecipients/${encodeURIComponent(departmentId)}`,
          {
            headers: { Authorization: `Bearer ${idToken}` },
            credentials: 'include',
          }
        );
        
        const data = await resp.json().catch(() => ({} as any));
        if (!resp.ok) throw new Error(data?.message || 'Failed to load department members');
        
        setDepartmentRecipients(data?.data?.recipients || []);
        setDepartmentRecipientsCount(data?.data?.totalCount || 0);
      } catch (e: any) {
        console.error('Failed to load department recipients:', e);
        setDepartmentRecipients([]);
        setDepartmentRecipientsCount(0);
      } finally {
        setDepartmentRecipientsLoading(false);
      }
    };
    fetchDepartmentRecipients();
  }, [firebaseUser, canSend, departmentId]);

  // Load pledge recipients when pledge types are selected
  useEffect(() => {
    const fetchPledgeRecipients = async () => {
      if (!firebaseUser || !canSend) return;
      if (recipientType !== 'pending_pledges' && recipientType !== 'fulfilled_pledges') {
        setPledgeRecipients([]);
        setPledgeRecipientsCount(0);
        return;
      }

      setPledgeRecipientsLoading(true);
      try {
        const idToken = await firebaseUser.getIdToken(true);
        const endpoint = recipientType === 'pending_pledges' 
          ? `${process.env.REACT_APP_API_URL}/api/sms/pendingPledgesRecipients`
          : `${process.env.REACT_APP_API_URL}/api/sms/fulfilledPledgesRecipients`;
        
        const resp = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${idToken}` },
          credentials: 'include',
        });
        
        const data = await resp.json().catch(() => ({} as any));
        if (!resp.ok) throw new Error(data?.message || 'Failed to load recipients');
        
        setPledgeRecipients(data?.data?.recipients || []);
        setPledgeRecipientsCount(data?.data?.totalCount || 0);
      } catch (e: any) {
        console.error('Failed to load pledge recipients:', e);
        setPledgeRecipients([]);
        setPledgeRecipientsCount(0);
      } finally {
        setPledgeRecipientsLoading(false);
      }
    };
    fetchPledgeRecipients();
  }, [firebaseUser, canSend, recipientType]);

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
      } else if (recipientType === 'pending_pledges') {
        endpoint = `${process.env.REACT_APP_API_URL}/api/sms/sendPendingPledges`;
      } else if (recipientType === 'fulfilled_pledges') {
        endpoint = `${process.env.REACT_APP_API_URL}/api/sms/sendFulfilledPledges`;
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
      } else if (recipientType === 'pending_pledges') {
        setResultMsg(`Message sent to members with pending pledges. Success: ${data?.successCount ?? '-'} / ${data?.total ?? '-'}`);
      } else if (recipientType === 'fulfilled_pledges') {
        setResultMsg(`Message sent to members with fulfilled pledges. Success: ${data?.successCount ?? '-'} / ${data?.total ?? '-'}`);
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
              {(['individual','department','pending_pledges','fulfilled_pledges','all'] as RecipientType[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setRecipientType(t)}
                  className={`px-3 py-1.5 rounded border ${recipientType === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {t === 'individual' ? 'Individual' 
                   : t === 'department' ? 'Department' 
                   : t === 'pending_pledges' ? 'Pending Pledges'
                   : t === 'fulfilled_pledges' ? 'Fulfilled Pledges'
                   : 'All Members'}
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
              
              {/* Department Members Preview */}
              {departmentId && (
                <div className="mt-3 bg-purple-50 border border-purple-200 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-purple-900">
                      Department Members
                    </h4>
                    {departmentRecipientsLoading && <span className="text-xs text-purple-600">Loading...</span>}
                  </div>
                  
                  {!departmentRecipientsLoading && (
                    <>
                      <p className="text-sm text-purple-800 mb-2">
                        <strong>{departmentRecipientsCount}</strong> member{departmentRecipientsCount !== 1 ? 's' : ''} will receive this message
                      </p>
                      
                      {departmentRecipientsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowDepartmentRecipientsList(!showDepartmentRecipientsList)}
                          className="text-xs text-purple-600 hover:text-purple-800 underline"
                        >
                          {showDepartmentRecipientsList ? 'Hide' : 'Show'} member list
                        </button>
                      )}
                      
                      {showDepartmentRecipientsList && departmentRecipients.length > 0 && (
                        <div className="mt-3 max-h-48 overflow-y-auto bg-white border border-purple-200 rounded p-2">
                          <ul className="text-xs space-y-1">
                            {departmentRecipients.map((recipient, idx) => (
                              <li key={recipient.id || idx} className="py-1 border-b border-gray-100 last:border-0">
                                <div className="font-medium text-gray-900">
                                  {recipient.firstName} {recipient.lastName}
                                  {recipient.roleInDepartment && (
                                    <span className="ml-2 text-purple-600 text-xs">({recipient.roleInDepartment})</span>
                                  )}
                                </div>
                                <div className="text-gray-500">
                                  {recipient.phoneNumber} {recipient.email && `• ${recipient.email}`}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {departmentRecipientsCount === 0 && (
                        <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                          No active members with phone numbers found in this department.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {(recipientType === 'pending_pledges' || recipientType === 'fulfilled_pledges') && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-blue-900">
                  {recipientType === 'pending_pledges' ? 'Pending Pledges Recipients' : 'Fulfilled Pledges Recipients'}
                </h4>
                {pledgeRecipientsLoading && <span className="text-xs text-blue-600">Loading...</span>}
              </div>
              
              {!pledgeRecipientsLoading && (
                <>
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>{pledgeRecipientsCount}</strong> member{pledgeRecipientsCount !== 1 ? 's' : ''} will receive this message
                  </p>
                  
                  {pledgeRecipientsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPledgeRecipientsList(!showPledgeRecipientsList)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      {showPledgeRecipientsList ? 'Hide' : 'Show'} recipient list
                    </button>
                  )}
                  
                  {showPledgeRecipientsList && pledgeRecipients.length > 0 && (
                    <div className="mt-3 max-h-48 overflow-y-auto bg-white border border-blue-200 rounded p-2">
                      <ul className="text-xs space-y-1">
                        {pledgeRecipients.map((recipient, idx) => (
                          <li key={recipient.id || idx} className="py-1 border-b border-gray-100 last:border-0">
                            <div className="font-medium text-gray-900">
                              {recipient.firstName} {recipient.lastName}
                            </div>
                            <div className="text-gray-500">
                              {recipient.phoneNumber} {recipient.email && `• ${recipient.email}`}
                            </div>
                            {recipientType === 'pending_pledges' && recipient.pendingPledges && (
                              <div className="text-blue-600 mt-0.5">
                                {recipient.pendingPledges.length} pending pledge{recipient.pendingPledges.length !== 1 ? 's' : ''} 
                                (Total: ${recipient.pendingPledges.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0).toFixed(2)})
                              </div>
                            )}
                            {recipientType === 'fulfilled_pledges' && recipient.fulfilledPledges && (
                              <div className="text-green-600 mt-0.5">
                                {recipient.fulfilledPledges.length} fulfilled pledge{recipient.fulfilledPledges.length !== 1 ? 's' : ''} 
                                (Total: ${recipient.fulfilledPledges.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0).toFixed(2)})
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {pledgeRecipientsCount === 0 && (
                    <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                      No members found with {recipientType === 'pending_pledges' ? 'pending' : 'fulfilled'} pledges.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            
            {(recipientType === 'pending_pledges' || recipientType === 'fulfilled_pledges') && (
              <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                <p className="font-medium text-green-800 mb-1">💡 Available Template Variables:</p>
                <div className="grid grid-cols-2 gap-1 text-green-700">
                  <span><code className="bg-white px-1 rounded">{'{firstName}'}</code> - First name</span>
                  <span><code className="bg-white px-1 rounded">{'{lastName}'}</code> - Last name</span>
                  <span><code className="bg-white px-1 rounded">{'{fullName}'}</code> - Full name</span>
                  <span><code className="bg-white px-1 rounded">{'{amount}'}</code> - Pledge amount (single)</span>
                  <span><code className="bg-white px-1 rounded">{'{totalAmount}'}</code> - Total of all pledges</span>
                  <span><code className="bg-white px-1 rounded">{'{pledgeCount}'}</code> - Number of pledges</span>
                  {recipientType === 'pending_pledges' && (
                    <span><code className="bg-white px-1 rounded">{'{dueDate}'}</code> - Due date (single)</span>
                  )}
                </div>
                <p className="text-green-600 mt-1 italic">Each member will receive a personalized message!</p>
              </div>
            )}
            
            <textarea
              rows={5}
              placeholder={
                recipientType === 'pending_pledges' 
                  ? "Example: Hi {firstName}, reminder about your pending pledge of {amount}. Due: {dueDate}. Thank you!"
                  : recipientType === 'fulfilled_pledges'
                  ? "Example: Thank you {firstName} for fulfilling your pledge of {amount}! God bless you."
                  : "Type your SMS message…"
              }
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
