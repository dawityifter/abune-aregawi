import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleDisplayName, UserRole } from '../../utils/roles';

interface RoleManagementProps {
  // Add any props if needed
}

const RoleManagement: React.FC<RoleManagementProps> = () => {
  const { t } = useLanguage();
  const { currentUser, firebaseUser } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [totalDependents, setTotalDependents] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [newRoles, setNewRoles] = useState<UserRole[]>([]);
  const [updating, setUpdating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  // Filters and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'member' | 'role'>('member');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchMembers();
    fetchDependentsCount();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);

      if (!firebaseUser) {
        throw new Error('User not authenticated');
      }

      const idToken = await firebaseUser.getIdToken();
      const pageSize = 200;
      let page = 1;
      let allMembers: any[] = [];

      while (true) {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/all/firebase?page=${page}&limit=${pageSize}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch members');
        }

        const data = await response.json();
        const pageMembers = (data?.data?.members) || [];
        allMembers = allMembers.concat(pageMembers);

        const hasNext = Boolean(data?.data?.pagination?.hasNext);
        if (!hasNext) break;
        page += 1;
      }

      setMembers(allMembers);
      setCurrentPage(1);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependentsCount = async () => {
    try {
      if (!firebaseUser) return;

      const idToken = await firebaseUser.getIdToken();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/dependents/count`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTotalDependents(data?.data?.count || 0);
      }
    } catch (error) {
      console.error('Failed to fetch dependents count:', error);
      // Don't set error state - this is non-critical
    }
  };

  const handleRoleUpdate = async () => {
    if (!selectedMember) return;

    setUpdating(true);
    try {
      const idToken = firebaseUser ? await firebaseUser.getIdToken() : null;
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${selectedMember.id}/role`, {
        method: 'PATCH',
        headers: {
          'Authorization': idToken ? `Bearer ${idToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roles: newRoles })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update role');
      }

      // Update local state
      setMembers(prev => prev.map(member =>
        member.id === selectedMember.id
          ? { ...member, role: newRoles[0], roles: newRoles }
          : member
      ));

      setSelectedMember(null);
      setNewRoles([]);
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
      case 'relationship': return 'bg-teal-100 text-teal-800';
      case 'member': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const roleStats = members.reduce((acc, member) => {
    acc[member.role] = (acc[member.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Derived list: filter -> sort -> paginate
  const filteredMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return members.filter((m) => {
      const matchesTerm = !term ||
        `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase().includes(term) ||
        (m.email || '').toLowerCase().includes(term);
      const matchesRole = !roleFilter || m.role === roleFilter;
      return matchesTerm && matchesRole;
    });
  }, [members, searchTerm, roleFilter]);

  const sortedMembers = useMemo(() => {
    const arr = [...filteredMembers];
    arr.sort((a, b) => {
      if (sortBy === 'member') {
        const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
        const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
        return sortDir === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
      }
      const aRole = (a.role || '').toLowerCase();
      const bRole = (b.role || '').toLowerCase();
      return sortDir === 'asc' ? aRole.localeCompare(bRole) : bRole.localeCompare(aRole);
    });
    return arr;
  }, [filteredMembers, sortBy, sortDir]);

  const totalMembers = sortedMembers.length;
  const totalPages = Math.max(1, Math.ceil(totalMembers / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalMembers);
  const paginatedMembers = sortedMembers.slice(startIndex, endIndex);

  const toggleSort = (column: 'member' | 'role') => {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

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
          {t('admin.common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {t('admin.roles.title')}
        </h2>
        <p className="text-gray-600">
          {t('admin.roles.description')}
        </p>
      </div>

      {/* Role Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {(['admin', 'church_leadership', 'treasurer', 'secretary', 'relationship', 'member'] as UserRole[]).map((role) => (
          <div key={role} className="bg-white p-4 rounded-lg shadow text-center">
            <div className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getRoleColor(role)}`}>
              {getRoleDisplayName(role)}
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {roleStats[role] || 0}
            </div>
            <div className="text-sm text-gray-500">
              {t('admin.roles.stats.members')}
            </div>
          </div>
        ))}
      </div>

      {/* Dependents Count */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {t('admin.members.stats.totalDependents')}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {t('admin.members.stats.description')}
            </p>
          </div>
          <div className="text-4xl font-bold text-blue-600">
            {totalDependents}
          </div>
        </div>
      </div>

      {/* Member Role Management */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {t('admin.roles.updateRole')}
        </h3>
        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.common.search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder={t('admin.common.search') + '...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.common.role')}</label>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('admin.common.all')}</option>
              <option value="admin">Admin</option>
              <option value="church_leadership">Church Leadership</option>
              <option value="treasurer">Treasurer</option>
              <option value="secretary">Secretary</option>
              <option value="relationship">Relationship</option>
              <option value="member">Member</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('member')}>
                  {t('admin.members.table.name')}
                  <span className="ml-1 text-gray-400">{sortBy === 'member' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('role')}>
                  {t('admin.roles.currentRole')}
                  <span className="ml-1 text-gray-400">{sortBy === 'role' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.common.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedMembers.map((member) => (
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
                    <div className="flex flex-wrap gap-1">
                      {(member.roles || [member.role]).map((r: UserRole) => (
                        <span key={r} className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(r)}`}>
                          {getRoleDisplayName(r)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedMember(member);
                        setNewRoles(member.roles || [member.role]);
                      }}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <i className="fas fa-edit mr-1"></i>
                      {t('admin.roles.changeRole')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {totalMembers > 0
              ? `${startIndex + 1}-${endIndex} ${t('admin.common.of')} ${totalMembers}`
              : `${t('admin.roles.stats.members')}: 0`}
          </div>
          <div className="space-x-2">
            <button
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className={`px-3 py-1 rounded border ${safePage <= 1 ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {t('admin.common.previous')}
            </button>
            <span className="text-sm text-gray-700">
              {t('admin.common.page')} {safePage} {t('admin.common.of')} {totalPages}
            </span>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className={`px-3 py-1 rounded border ${safePage >= totalPages ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {t('admin.common.next')}
            </button>
          </div>
        </div>
      </div>

      {/* Role Update Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {t('admin.roles.updateRole')}
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
                {t('admin.roles.updatingFor')}: <strong>{selectedMember.firstName} {selectedMember.lastName}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {t('admin.roles.currentRole')}: <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(selectedMember.role)}`}>
                  {getRoleDisplayName(selectedMember.role)}
                </span>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.roles.newRole')}
              </label>
              <div className="space-y-2 border border-gray-200 rounded-md p-3 max-h-48 overflow-y-auto">
                {(['admin', 'church_leadership', 'treasurer', 'secretary', 'relationship', 'member'] as UserRole[]).map((role) => (
                  <label key={role} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={newRoles.includes(role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewRoles([...newRoles, role]);
                        } else {
                          // Prevent removing all roles
                          if (newRoles.length > 1) {
                            setNewRoles(newRoles.filter(r => r !== role));
                          }
                        }
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{getRoleDisplayName(role)}</span>
                  </label>
                ))}
              </div>
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
                {t('admin.common.cancel')}
              </button>
              <button
                onClick={handleRoleUpdate}
                disabled={updating || JSON.stringify(newRoles.sort()) === JSON.stringify((selectedMember.roles || [selectedMember.role]).sort())}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {updating ? t('admin.roles.updating') : t('admin.roles.updateRole')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement; 