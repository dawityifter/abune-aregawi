import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateForDisplay } from '../../utils/dateUtils';

interface Department {
  id: number;
  name: string;
}

interface DepartmentMember {
  id: number;
  member_id: number;
  role_in_department: string;
  joined_at: string;
  status: string;
  member: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  };
}

interface ManageDepartmentMembersModalProps {
  department: Department;
  onClose: () => void;
  onUpdate: () => void;
}

const ManageDepartmentMembersModal: React.FC<ManageDepartmentMembersModalProps> = ({
  department,
  onClose,
  onUpdate
}) => {
  const { t } = useLanguage();
  const { firebaseUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<DepartmentMember[]>([]);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  useEffect(() => {
    fetchDepartmentMembers();
    fetchAllMembers();
  }, []);

  const fetchDepartmentMembers = async () => {
    try {
      setLoading(true);
      const idToken = await firebaseUser?.getIdToken();

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/departments/${department.id}/members`,
        {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMembers(data.data.members || []);
      }
    } catch (error) {
      console.error('Error fetching department members:', error);
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMembers = async () => {
    try {
      const idToken = await firebaseUser?.getIdToken();
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/members/all/firebase?limit=500`,
        {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAllMembers(data.data.members || []);
      }
    } catch (error) {
      console.error('Error fetching all members:', error);
    }
  };

  const handleAddMembers = async () => {
    if (selectedMembers.length === 0) {
      alert('Please select at least one member');
      return;
    }

    try {
      const idToken = await firebaseUser?.getIdToken();

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/departments/${department.id}/members`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            member_ids: selectedMembers,
            role_in_department: 'member'
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add members');
      }

      setSelectedMembers([]);
      setShowAddMembers(false);
      fetchDepartmentMembers();
      onUpdate();
    } catch (error) {
      console.error('Error adding members:', error);
      alert('Failed to add members');
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!window.confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      const idToken = await firebaseUser?.getIdToken();

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/departments/${department.id}/members/${memberId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to remove member');
      }

      fetchDepartmentMembers();
      onUpdate();
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  };

  const handleUpdateMemberRole = async (memberId: number, newRole: string) => {
    try {
      const idToken = await firebaseUser?.getIdToken();

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/departments/${department.id}/members/${memberId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            role_in_department: newRole
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update member role');
      }

      fetchDepartmentMembers();
      onUpdate();
    } catch (error) {
      console.error('Error updating member role:', error);
      alert('Failed to update member role');
    }
  };

  const toggleMemberSelection = (memberId: number) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Filter out members already in the department
  const availableMembers = allMembers.filter(
    m => !members.some(dm => dm.member_id === m.id)
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'leader':
      case 'chairperson':
      case 'chairman':
        return 'bg-purple-100 text-purple-800';
      case 'co-leader':
      case 'vice chairperson':
      case 'vice chairman':
        return 'bg-blue-100 text-blue-800';
      case 'coordinator':
      case 'secretary':
        return 'bg-green-100 text-green-800';
      case 'treasurer':
      case 'financial guardian':
        return 'bg-yellow-100 text-yellow-800';
      case 'auditor':
        return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white mb-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {t('manage.members') || 'Manage Members'}
            </h3>
            <p className="text-sm text-gray-500">{department.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Add Members Section */}
        {!showAddMembers ? (
          <div className="mb-4">
            <button
              onClick={() => setShowAddMembers(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              <i className="fas fa-plus mr-2"></i>
              {t('add.members') || 'Add Members'}
            </button>
          </div>
        ) : (
          <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-900">
                {t('select.members.to.add') || 'Select Members to Add'}
              </h4>
              <button
                onClick={() => {
                  setShowAddMembers(false);
                  setSelectedMembers([]);
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                {t('cancel') || 'Cancel'}
              </button>
            </div>

            {/* Search box for filtering members */}
            <div className="mb-3">
              <div className="relative">
                <input
                  type="text"
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  placeholder={t('search.members') || 'Search by name, ID, phone, or email...'}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <i className="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                {memberSearchTerm && (
                  <button
                    onClick={() => setMemberSearchTerm('')}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 mb-3">
              {(() => {
                const filteredMembers = availableMembers.filter(member => {
                  if (!memberSearchTerm) return true;
                  const searchLower = memberSearchTerm.toLowerCase();
                  const firstName = (member.firstName || member.first_name || '').toLowerCase();
                  const lastName = (member.lastName || member.last_name || '').toLowerCase();
                  const email = (member.email || '').toLowerCase();
                  const memberId = String(member.memberId || member.member_id || member.id).toLowerCase();
                  const phoneNumber = (member.phoneNumber || member.phone_number || '').toLowerCase();
                  return firstName.includes(searchLower) ||
                    lastName.includes(searchLower) ||
                    email.includes(searchLower) ||
                    memberId.includes(searchLower) ||
                    phoneNumber.includes(searchLower);
                });

                if (availableMembers.length === 0) {
                  return (
                    <p className="text-sm text-gray-500 text-center py-4">
                      {t('all.members.already.added') || 'All members have been added to this department'}
                    </p>
                  );
                }

                if (filteredMembers.length === 0) {
                  return (
                    <p className="text-sm text-gray-500 text-center py-4">
                      {t('no.members.found') || 'No members found matching your search'}
                    </p>
                  );
                }

                return filteredMembers.map(member => {
                  const firstName = member.firstName || member.first_name || '';
                  const lastName = member.lastName || member.last_name || '';
                  const memberId = member.memberId || member.member_id || member.id;
                  const phoneNumber = member.phoneNumber || member.phone_number || '';
                  const familyId = member.familyId || member.family_id;
                  // Head of household: family_id is null or equals their own id
                  const isHeadOfHousehold = !familyId || familyId === member.id;

                  return (
                    <label
                      key={member.id}
                      className="flex items-center p-2 hover:bg-gray-100 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => toggleMemberSelection(member.id)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className={`ml-3 text-sm text-gray-700 ${isHeadOfHousehold ? 'font-bold' : ''}`}>
                        {firstName} {lastName} [{memberId}] ({phoneNumber})
                      </span>
                    </label>
                  );
                });
              })()}
            </div>

            {selectedMembers.length > 0 && (
              <button
                onClick={handleAddMembers}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                {t('add.selected') || `Add ${selectedMembers.length} Selected Member(s)`}
              </button>
            )}
          </div>
        )}

        {/* Current Members List */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">
            {t('current.members') || 'Current Members'} ({members.length})
          </h4>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-800 mx-auto"></div>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <i className="fas fa-users text-4xl text-gray-300 mb-2"></i>
              <p className="text-gray-500">
                {t('no.members.yet') || 'No members in this department yet'}
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('member') || 'Member'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('role') || 'Role'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('joined') || 'Joined'}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('actions') || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((membership) => (
                    <tr key={membership.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {membership.member.first_name} {membership.member.last_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {membership.member.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(membership.role_in_department)}`}>
                          {membership.role_in_department}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateForDisplay(membership.joined_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {['admin', 'church_leadership', 'secretary'].includes((firebaseUser as any)?.role || '') && (
                            <select
                              value={membership.role_in_department}
                              onChange={(e) => handleUpdateMemberRole(membership.member_id, e.target.value)}
                              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              title="Change role"
                            >
                              <option value="member">Member</option>
                              <option value="leader">Leader</option>
                              <option value="co-leader">Co-Leader</option>
                              <option value="coordinator">Coordinator</option>
                              <option value="assistant">Assistant</option>
                              <option value="chairperson">Chairperson</option>
                              <option value="vice chairperson">Vice Chairperson</option>
                              <option value="secretary">Secretary</option>
                              <option value="treasurer">Treasurer</option>
                              <option value="auditor">Auditor</option>
                            </select>
                          )}
                          <button
                            onClick={() => handleRemoveMember(membership.member_id)}
                            className="text-red-600 hover:text-red-900"
                            title="Remove member"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('close') || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageDepartmentMembersModal;
