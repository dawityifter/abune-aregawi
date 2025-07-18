import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleDisplayName, UserRole } from '../../utils/roles';

interface RoleManagementProps {
  // Add any props if needed
}

const RoleManagement: React.FC<RoleManagementProps> = () => {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [newRole, setNewRole] = useState<UserRole>('member');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      
      if (!currentUser || !currentUser.email) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/all/firebase?limit=100&email=${encodeURIComponent(currentUser.email)}`, {
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      setMembers(data.data.members);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleUpdate = async () => {
    if (!selectedMember) return;

    setUpdating(true);
    try {
      const idToken = currentUser ? await currentUser.getIdToken() : null;
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${selectedMember.id}?email=${encodeURIComponent(currentUser?.email || '')}`, {
        method: 'PUT',
        headers: {
          'Authorization': idToken ? `Bearer ${idToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...selectedMember,
          role: newRole
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update role');
      }

      // Update local state
      setMembers(prev => prev.map(member => 
        member.id === selectedMember.id 
          ? { ...member, role: newRole }
          : member
      ));

      setSelectedMember(null);
      setNewRole('member');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setUpdating(false);
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'church_leadership': return 'bg-purple-100 text-purple-800';
      case 'treasurer': return 'bg-green-100 text-green-800';
      case 'secretary': return 'bg-blue-100 text-blue-800';
      case 'member': return 'bg-gray-100 text-gray-800';
      case 'guest': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const roleStats = members.reduce((acc, member) => {
    acc[member.role] = (acc[member.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 text-lg mb-4">{error}</div>
        <button 
          onClick={fetchMembers} 
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {t('role.management')}
        </h2>
        <p className="text-gray-600">
          {t('manage.member.roles.and.permissions')}
        </p>
      </div>

      {/* Role Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {(['admin', 'church_leadership', 'treasurer', 'secretary', 'member', 'guest'] as UserRole[]).map((role) => (
          <div key={role} className="bg-white p-4 rounded-lg shadow text-center">
            <div className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getRoleColor(role)}`}>
              {getRoleDisplayName(role)}
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {roleStats[role] || 0}
            </div>
            <div className="text-sm text-gray-500">
              {t('members')}
            </div>
          </div>
        ))}
      </div>

      {/* Role Descriptions */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('role.descriptions')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['admin', 'church_leadership', 'treasurer', 'secretary', 'member', 'guest'] as UserRole[]).map((role) => (
            <div key={role} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(role)}`}>
                  {getRoleDisplayName(role)}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {/* getRoleDescription(role) removed as per new_code */}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Member Role Management */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('update.member.roles')}
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('member')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('current.role')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-800">
                            {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(member.role)}`}>
                      {getRoleDisplayName(member.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedMember(member);
                        setNewRole(member.role);
                      }}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <i className="fas fa-edit mr-1"></i>
                      {t('change.role')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Update Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {t('update.role')}
              </h3>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                {t('updating.role.for')}: <strong>{selectedMember.firstName} {selectedMember.lastName}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {t('current.role')}: <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(selectedMember.role)}`}>
                  {getRoleDisplayName(selectedMember.role)}
                </span>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('new.role')}
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="member">Member</option>
                <option value="secretary">Secretary</option>
                <option value="treasurer">Treasurer</option>
                <option value="church_leadership">Church Leadership</option>
                <option value="admin">Admin</option>
                <option value="guest">Guest</option>
              </select>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">
                {/* getRoleDescription(newRole) removed as per new_code */}
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setSelectedMember(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleRoleUpdate}
                disabled={updating || newRole === selectedMember.role}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {updating ? t('updating') : t('update.role')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement; 