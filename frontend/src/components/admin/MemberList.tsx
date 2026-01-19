import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleDisplayName, UserRole } from '../../utils/roles';
import { getDisplayEmail } from '../../utils/email';
import AddMemberModal from './AddMemberModal';
import AddDependentModal from './AddDependentModal';
import MemberDuesViewer from './MemberDuesViewer';

interface Member {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  phoneNumber?: string;
  // Member number (can come as memberId or member_id from backend)
  memberId?: string | number;
  member_id?: string | number;
  dateJoinedParish?: string;
  createdAt: string;
  dependents?: any[];
  dependentsCount?: number;
  familyId?: string | number;
  title?: {
    id: number;
    name: string;
    abbreviation: string | null;
  };
}

interface MemberListProps {
  onEditMember: (member: Member, initialTab?: 'basic' | 'contact' | 'spiritual' | 'family') => void;
  canEditMembers: boolean;
  canDeleteMembers: boolean;
  canRegisterMembers: boolean;
  canViewFinancialRecords: boolean;
  refreshToken?: number;
}

const MemberList: React.FC<MemberListProps> = ({
  onEditMember,
  canEditMembers,
  canDeleteMembers,
  canRegisterMembers,
  canViewFinancialRecords,
  refreshToken,
}) => {
  const { t } = useLanguage();
  const { currentUser, firebaseUser } = useAuth();
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [totalDependents, setTotalDependents] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddDependentFor, setShowAddDependentFor] = useState<Member | null>(null);
  const [showPaymentHistoryFor, setShowPaymentHistoryFor] = useState<Member | null>(null);
  const fetchedRef = React.useRef(false);

  // Calculate total unique households
  const totalHouseholds = useMemo(() => {
    const uniqueFamilies = new Set();
    allMembers.forEach(member => {
      // If member shares a familyId, they belong to that household
      // If not, their own ID defines their household
      const householdId = member.familyId || member.id;
      uniqueFamilies.add(householdId);
    });
    return uniqueFamilies.size;
  }, [allMembers]);

  // Client-side filtering and pagination
  const filteredMembers = useMemo(() => {
    return allMembers.filter(member => {
      const searchLower = searchTerm.toLowerCase();
      const memberNumberRaw = (member as any).memberId ?? (member as any).member_id ?? member.id ?? '';
      const memberNumber = String(memberNumberRaw).toLowerCase();
      const matchesSearch = !searchTerm ||
        (member.firstName?.toLowerCase() || '').includes(searchLower) ||
        (member.lastName?.toLowerCase() || '').includes(searchLower) ||
        (member.email?.toLowerCase() || '').includes(searchLower) ||
        (member.phoneNumber?.toLowerCase() || '').includes(searchLower) ||
        memberNumber.includes(searchLower);

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
    }
  };

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchAllMembers();
      fetchDependentsCount();
      fetchedRef.current = true;
    }
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
    if (!window.confirm(t('admin.common.confirmDelete'))) {
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
          {t('admin.common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex justify-between items-start">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('admin.members.title')}
        </h2>
        {canRegisterMembers && (
          <button
            onClick={() => setShowAddMember(true)}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            <i className="fas fa-user-plus mr-2"></i>
            {t('admin.members.addMember')}
          </button>
        )}
      </div>

      {/* Eye-catching Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Members (Households) Card */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium uppercase tracking-wide">
                {t('admin.members.stats.totalHouseholds')}
              </p>
              <p className="text-5xl font-bold mt-2">
                {totalHouseholds}
              </p>
              <p className="text-blue-100 text-sm mt-2">
                {t('admin.members.stats.registeredMembers')}
              </p>
            </div>
            <div className="bg-blue-400 bg-opacity-30 rounded-full p-4">
              <i className="fas fa-home text-4xl"></i>
            </div>
          </div>
        </div>

        {/* Total Dependents Card */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium uppercase tracking-wide">
                {t('admin.members.stats.totalDependents')}
              </p>
              <p className="text-5xl font-bold mt-2">
                {totalDependents}
              </p>
              <p className="text-purple-100 text-sm mt-2">
                {t('admin.members.stats.familyMembers')}
              </p>
            </div>
            <div className="bg-purple-400 bg-opacity-30 rounded-full p-4">
              <i className="fas fa-users text-4xl"></i>
            </div>
          </div>
        </div>

        {/* Total Congregation Card */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium uppercase tracking-wide">
                {t('admin.members.stats.totalCongregation')}
              </p>
              <p className="text-5xl font-bold mt-2">
                {allMembers.length + totalDependents}
              </p>
              <div className="mt-2">
                <p className="text-green-100 text-sm">
                  ({t('admin.members.stats.householdsAndDependents')})
                </p>
                <p className="text-green-200 text-xs mt-1 italic">
                  {t('admin.members.stats.description')}
                </p>
              </div>
            </div>
            <div className="bg-green-400 bg-opacity-30 rounded-full p-4">
              <i className="fas fa-church text-4xl"></i>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.common.search')}
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('admin.common.search') + '...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.common.role')}
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('admin.common.all')}</option>
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
              {t('admin.common.status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('admin.common.all')}</option>
              <option value="true">{t('admin.common.active')}</option>
              <option value="false">{t('admin.common.inactive')}</option>
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
                  {t('admin.members.table.name')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.members.table.email')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.members.table.role')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.members.table.phone')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('admin.members.table.status')}
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
                          {member.title ? `${member.title.abbreviation || member.title.name} ` : ''}
                          {member.firstName} {member.middleName} {member.lastName} {' '}
                          <span className="text-gray-500">(
                            {String((member as any).memberId ?? (member as any).member_id ?? member.id)}
                            )</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.dependentsCount ?? member.dependents?.length ?? 0} {t('admin.members.table.dependents')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getDisplayEmail(member.email) || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${member.role === 'admin' ? 'bg-red-100 text-red-800' :
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${member.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                      }`}>
                      {member.isActive ? t('admin.common.active') : t('admin.common.inactive')}
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
                          onClick={() => {
                            const hasDependent = (member.dependentsCount ?? 0) > 0;
                            if (hasDependent) {
                              // Open Edit Member modal with Family tab active
                              onEditMember(member, 'family');
                            } else {
                              // Open Add Dependent modal
                              setShowAddDependentFor(member);
                            }
                          }}
                          className="text-green-600 hover:text-green-900"
                          title={
                            (member.dependentsCount ?? 0) > 0
                              ? t('admin.members.manageDependents')
                              : t('admin.members.addDependent')
                          }
                        >
                          <i className="fas fa-user-friends"></i>
                        </button>
                      )}
                      {canViewFinancialRecords && (
                        <button
                          onClick={() => setShowPaymentHistoryFor(member)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Payment History"
                        >
                          <i className="fas fa-dollar-sign"></i>
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
                {t('admin.common.previous')}
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {t('admin.common.next')}
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  {t('admin.common.showing')} <span className="font-medium">{(currentPage - 1) * 10 + 1}</span> {t('admin.common.to')}{' '}
                  <span className="font-medium">{Math.min(currentPage * 10, totalMembers)}</span> {t('admin.common.of')}{' '}
                  <span className="font-medium">{totalMembers}</span> {t('admin.common.results')}
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
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === currentPage
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
      {showPaymentHistoryFor && (
        <MemberDuesViewer
          memberId={showPaymentHistoryFor.id}
          onClose={() => setShowPaymentHistoryFor(null)}
        />
      )}
    </div>
  );
};

export default MemberList; 