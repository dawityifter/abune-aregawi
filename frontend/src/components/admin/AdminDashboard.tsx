import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getRolePermissions, getMergedPermissions, UserRole } from '../../utils/roles';
import MemberList from './MemberList';
import MemberEditModal from './MemberEditModal';
import RoleManagement from './RoleManagement';
import DepartmentList from './DepartmentList';
import ActivityLogViewer from './ActivityLogViewer';
import VoicemailInbox from './VoicemailInbox';

const AdminDashboard: React.FC = () => {
  const { currentUser, getUserProfile } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'members' | 'roles' | 'departments' | 'activity-logs' | 'voicemails'>('members');
  const [canAccess, setCanAccess] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Member Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [editModalInitialTab, setEditModalInitialTab] = useState<'basic' | 'contact' | 'spiritual' | 'family'>('basic');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser) {
        try {
          // Handle different user object structures
          const uid = currentUser.uid || (currentUser as any).id;
          const email = currentUser.email;
          const phone = currentUser.phoneNumber;

          if (uid) {
            const profile = await getUserProfile(uid, email, phone);
            setUserProfile(profile);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [currentUser, getUserProfile]);

  const memberData = userProfile?.data?.member || userProfile;
  const userRoles: UserRole[] = memberData?.roles || [(memberData?.role || 'member') as UserRole];
  const permissions = getMergedPermissions(userRoles);

  useEffect(() => {
    // Only admins, leadership, and secretary can access the dashboard generally, 
    // but we can refine access per tab via permissions.
    if (permissions.canAccessAdminPanel || userRoles.some(r => ['admin', 'church_leadership', 'secretary'].includes(r))) {
      setCanAccess(true);
    } else {
      setCanAccess(false);
    }
  }, [userRoles, permissions]);

  // Handle URL hash for tab navigation
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'members' || hash === 'roles' || hash === 'departments' || hash === 'activity-logs' || hash === 'voicemails') {
      setActiveTab(hash as any);
    }
  }, []);

  // Update URL hash when tab changes
  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  const handleEditMember = (member: any, initialTab: 'basic' | 'contact' | 'spiritual' | 'family' = 'basic') => {
    setSelectedMember(member);
    setEditModalInitialTab(initialTab);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedMember(null);
  };

  const handleMemberUpdated = () => {
    setShowEditModal(false);
    setSelectedMember(null);
    setRefreshToken((prev) => prev + 1);
  };

  if (!canAccess) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <i className="fas fa-lock text-red-500 text-5xl mb-4"></i>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('treasurerDashboard.access.denied')}</h2>
          <p className="text-gray-600">
            {t('treasurerDashboard.access.deniedDesc')}
          </p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'roles':
        return permissions.canManageRoles ? <RoleManagement /> : <div className="p-4 text-center text-gray-500">Access Denied</div>;
      case 'departments':
        return <DepartmentList />;
      case 'activity-logs':
        return <ActivityLogViewer />;
      case 'voicemails':
        return <VoicemailInbox />;
      default: // 'members' is the default tab
        return (
          <MemberList
            onEditMember={handleEditMember}
            canEditMembers={permissions.canEditAllMembers}
            canDeleteMembers={permissions.canDeleteMembers}
            canRegisterMembers={permissions.canRegisterMembers}
            refreshToken={refreshToken}
          />
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{t('admin.dashboard')}</h1>
        <p className="mt-2 text-gray-600">
          {t('admin.welcome')}, <span className="font-semibold">{currentUser?.displayName || currentUser?.email}</span> ({userRoles.join(', ')})
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <div className="-mb-px flex items-center justify-between overflow-x-auto">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('members')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'members'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <i className="fas fa-users mr-2"></i>
              {t('admin.manageMembers')}
            </button>

            {permissions.canManageRoles && (
              <button
                onClick={() => setActiveTab('roles')}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'roles'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <i className="fas fa-user-tag mr-2"></i>
                {t('admin.roleManagement')}
              </button>
            )}

            <button
              onClick={() => setActiveTab('departments')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'departments'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <i className="fas fa-building mr-2"></i>
              {t('admin.departments')}
            </button>

            <button
              onClick={() => setActiveTab('activity-logs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'activity-logs'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <i className="fas fa-history mr-2"></i>
              {t('admin.activity.logs')}
            </button>
            <button
              onClick={() => setActiveTab('voicemails')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === 'voicemails'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <i className="fas fa-envelope mr-2"></i>
              {t('admin.messages')}
            </button>
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="transition-opacity duration-200">
        {renderContent()}
      </div>

      {/* Edit Member Modal */}
      {showEditModal && selectedMember && (
        <MemberEditModal
          member={selectedMember}
          onClose={handleCloseEditModal}
          onMemberUpdated={handleMemberUpdated}
          canEditMembers={permissions.canEditAllMembers}
          canManageRoles={permissions.canManageRoles}
          initialTab={editModalInitialTab}
        />
      )}
    </div>
  );
};

export default AdminDashboard;