import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleDisplayName, UserRole } from '../../utils/roles';
import { getDisplayEmail } from '../../utils/email';
import AddMemberModal from './AddMemberModal';
import AddDependentModal from './AddDependentModal';

interface Member {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  phoneNumber?: string;
  dateJoinedParish?: string;
  createdAt: string;
  dependents?: any[];
}

interface MemberListProps {
  onEditMember: (member: Member) => void;
  canEditMembers: boolean;
  canDeleteMembers: boolean;
  canRegisterMembers: boolean;
  refreshToken?: number;
}

const MemberList: React.FC<MemberListProps> = ({ 
  onEditMember, 
  canEditMembers, 
  canDeleteMembers,
  canRegisterMembers,
  refreshToken,
}) => {
  const { t } = useLanguage();
  const { currentUser, firebaseUser } = useAuth();
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddDependentFor, setShowAddDependentFor] = useState<Member | null>(null);

  // Client-side filtering and pagination
  const filteredMembers = useMemo(() => {
    return allMembers.filter(member => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        (member.firstName?.toLowerCase() || '').includes(searchLower) ||
        (member.lastName?.toLowerCase() || '').includes(searchLower) ||
        (member.email?.toLowerCase() || '').includes(searchLower) ||
        (member.phoneNumber?.toLowerCase() || '').includes(searchLower);
      
      const matchesRole = !roleFilter || member.role === roleFilter;
      const matchesStatus = !statusFilter || member.isActive.toString() === statusFilter;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [allMembers, searchTerm, roleFilter, statusFilter]);

  // Pagination
  const totalMembers = filteredMembers.length;
  const totalPages = Math.ceil(totalMembers / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMembers = filteredMembers.slice(startIndex, endIndex);

  const fetchAllMembers = async () => {
    try {
      setLoading(true);
      
      if (!firebaseUser) {
        throw new Error('Firebase user not authenticated');
      }

      // Get a fresh ID token
      const idToken = await firebaseUser.getIdToken(true);
      
      // Debug logging for authentication
      console.log('🔍 MemberList Debug Info:');
      console.log('Current User:', currentUser);
      console.log('Firebase User UID:', firebaseUser.uid);
      console.log('ID Token (first 20 chars):', idToken ? `${idToken.substring(0, 20)}...` : 'null');

      // Fetch all members at once (no pagination on backend)
      const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/all/firebase?limit=1000`;
      console.log('API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      console.log('Response Status:', response.status);
      console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      setAllMembers(data.data.members);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllMembers();
  }, []);

  // Refetch when parent signals a refresh (e.g., after save)
  useEffect(() => {
    if (typeof refreshToken === 'number') {
      fetchAllMembers();
    }
  }, [refreshToken]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  const handleDeleteMember = async (memberId: string) => {
    if (!window.confirm(t('confirm.delete.member'))) {
      return;
    }

    try {
      const idToken = firebaseUser ? await firebaseUser.getIdToken() : null;
      const userIdentifier = currentUser?.email ? `email=${encodeURIComponent(currentUser.email)}` : `phone=${encodeURIComponent(currentUser?.phoneNumber || '')}`;
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${memberId}?${userIdentifier}`, {
        method: 'DELETE',
        headers: {
          'Authorization': idToken ? `Bearer ${idToken}` : '',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete member');
      }

      // Refresh the member list
      fetchAllMembers();
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is now handled by debounced effect
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
          onClick={() => fetchAllMembers()} 
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {t('manage.members')}
          </h2>
          <p className="text-gray-600">
            {t('total.members')}: {totalMembers}
          </p>
        </div>
        <div>
          {canRegisterMembers && (
            <button
              onClick={() => setShowAddMember(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              <i className="fas fa-user-plus mr-2"></i>
              {t('add.member') || 'Add Member'}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('search')}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('search.members')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('role')}
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('all.roles')}</option>
              <option value="admin">Admin</option>
              <option value="church_leadership">Church Leadership</option>
              <option value="treasurer">Treasurer</option>
              <option value="secretary">Secretary</option>
              <option value="member">Member</option>
              <option value="guest">Guest</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('all.statuses')}</option>
              <option value="true">{t('active')}</option>
              <option value="false">{t('inactive')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('email')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('role')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('phone')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('actions')}
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
                          {member.firstName} {member.middleName} {member.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.dependents?.length || 0} {t('dependents')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getDisplayEmail(member.email) || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      member.role === 'admin' ? 'bg-red-100 text-red-800' :
                      member.role === 'church_leadership' ? 'bg-purple-100 text-purple-800' :
                      member.role === 'treasurer' ? 'bg-green-100 text-green-800' :
                      member.role === 'secretary' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getRoleDisplayName(member.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {member.phoneNumber || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      member.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {member.isActive ? t('active') : t('inactive')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {canEditMembers && (
                        <button
                          onClick={() => onEditMember(member)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      )}
                      {canEditMembers && (
                        <button
                          onClick={() => setShowAddDependentFor(member)}
                          className="text-green-600 hover:text-green-900"
                          title={t('add.dependent') || 'Add Dependent'}
                        >
                          <i className="fas fa-user-friends"></i>
                        </button>
                      )}
                      {canDeleteMembers && (
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {t('previous')}
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {t('next')}
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  {t('showing')} <span className="font-medium">{(currentPage - 1) * 10 + 1}</span> {t('to')}{' '}
                  <span className="font-medium">{Math.min(currentPage * 10, totalMembers)}</span> {t('of')}{' '}
                  <span className="font-medium">{totalMembers}</span> {t('results')}
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        page === currentPage
                          ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddMember && (
        <AddMemberModal
          onClose={() => setShowAddMember(false)}
          onCreated={() => {
            setShowAddMember(false);
            fetchAllMembers();
          }}
        />
      )}
      {showAddDependentFor && (
        <AddDependentModal
          memberId={showAddDependentFor.id}
          memberName={`${showAddDependentFor.firstName} ${showAddDependentFor.lastName}`}
          onClose={() => setShowAddDependentFor(null)}
          onCreated={() => {
            setShowAddDependentFor(null);
            fetchAllMembers();
          }}
        />
      )}
    </div>
  );
};

export default MemberList; 