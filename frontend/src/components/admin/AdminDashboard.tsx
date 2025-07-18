import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getRolePermissions, hasPermission, UserRole } from '../../utils/roles';
import MemberList from './MemberList';
import MemberEditModal from './MemberEditModal';
import RoleManagement from './RoleManagement';
import AdminStats from './AdminStats';

interface AdminDashboardProps {}

const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  const { currentUser, getUserProfile } = useAuth();
  const { t } = useLanguage();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'roles' | 'stats'>('members');
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser) {
        try {
          const profile = await getUserProfile(currentUser.uid);
          setUserProfile(profile);
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

  const handleEditMember = (member: any) => {
    setSelectedMember(member);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedMember(null);
  };

  const handleMemberUpdated = () => {
    setShowEditModal(false);
    setSelectedMember(null);
    // Refresh member list
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  // Check if user has admin permissions
  const userRole = userProfile?.role || 'member';
  const permissions = getRolePermissions(userRole as UserRole);

  if (!permissions.canAccessAdminPanel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">
            {t('access.denied')}
          </div>
          <p className="text-gray-600 mb-4">
            {t('admin.access.required')}
          </p>
          <button 
            onClick={() => window.history.back()} 
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            {t('go.back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <i className="fas fa-shield-alt text-2xl text-primary-800 mr-3"></i>
              <h1 className="text-xl font-semibold text-gray-900">
                {t('admin.dashboard')}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {t('welcome')}, {userProfile?.displayName || currentUser?.displayName || 'Admin'}
              </span>
              <span className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded-full">
                {userRole}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('members')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'members'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className="fas fa-users mr-2"></i>
              {t('manage.members')}
            </button>
            
            {permissions.canManageRoles && (
              <button
                onClick={() => setActiveTab('roles')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'roles'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-user-tag mr-2"></i>
                {t('role.management')}
              </button>
            )}
            
            {permissions.canViewFinancialRecords && (
              <button
                onClick={() => setActiveTab('stats')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'stats'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className="fas fa-chart-bar mr-2"></i>
                {t('statistics')}
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {activeTab === 'members' && (
            <MemberList 
              onEditMember={handleEditMember}
              canEditMembers={permissions.canEditAllMembers}
              canDeleteMembers={permissions.canDeleteMembers}
            />
          )}
          
          {activeTab === 'roles' && permissions.canManageRoles && (
            <RoleManagement />
          )}
          
          {activeTab === 'stats' && permissions.canViewFinancialRecords && (
            <AdminStats />
          )}
        </div>
      </main>

      {/* Edit Member Modal */}
      {showEditModal && selectedMember && (
        <MemberEditModal
          member={selectedMember}
          onClose={handleCloseEditModal}
          onMemberUpdated={handleMemberUpdated}
          canEditMembers={permissions.canEditAllMembers}
        />
      )}
    </div>
  );
};

export default AdminDashboard; 