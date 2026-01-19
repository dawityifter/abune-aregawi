import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import EditDepartmentModal from './EditDepartmentModal';
import ManageDepartmentMembersModal from './ManageDepartmentMembersModal';

interface Department {
  id: number;
  name: string;
  description: string;
  type: string;
  leader_id: number | null;
  meeting_schedule: string;
  is_active: boolean;
  is_public: boolean;
  max_members: number | null;
  member_count: number;
  leader?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  subDepartments?: Department[];
}

interface DepartmentCardProps {
  department: Department;
  onUpdate: () => void;
  getTypeColor: (type: string) => string;
  icon?: string;
}

const DepartmentCard: React.FC<DepartmentCardProps> = ({ department, onUpdate, getTypeColor, icon }) => {
  const { t } = useLanguage();
  const { firebaseUser } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to deactivate "${department.name}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const idToken = await firebaseUser?.getIdToken();

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/departments/${department.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to deactivate department');
      }

      onUpdate();
    } catch (error) {
      console.error('Error deactivating department:', error);
      alert('Failed to deactivate department');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    onUpdate();
  };

  const handleMembersUpdate = () => {
    onUpdate();
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100 group">
        {/* Header */}
        <div className="p-5 border-b border-gray-50">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {icon && (
                <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center text-primary-600 flex-shrink-0 group-hover:bg-primary-50 transition-colors">
                  <i className={`${icon} text-xl`}></i>
                </div>
              )}
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-1 leading-tight group-hover:text-primary-700 transition-colors">
                  {department.name}
                </h4>
                <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full items-center ${getTypeColor(department.type)}`}>
                  {department.type}
                </span>
              </div>
            </div>

            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setShowEditModal(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-primary-600 hover:bg-gray-50 transition-colors"
                title="Edit"
              >
                <i className="fas fa-edit"></i>
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Deactivate"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Description */}
          {department.description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {department.description}
            </p>
          )}

          {/* Leader */}
          {department.leader && (
            <div className="flex items-center text-sm">
              <i className="fas fa-user-tie text-gray-400 mr-2"></i>
              <span className="text-gray-700">
                {department.leader.first_name} {department.leader.last_name}
              </span>
            </div>
          )}

          {/* Meeting Schedule */}
          {department.meeting_schedule && (
            <div className="flex items-center text-sm">
              <i className="fas fa-calendar text-gray-400 mr-2"></i>
              <span className="text-gray-600 text-xs">
                {department.meeting_schedule}
              </span>
            </div>
          )}

          {/* Member Count */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center text-sm">
              <i className="fas fa-users text-gray-400 mr-2"></i>
              <span className="text-gray-700 font-medium">
                {department.member_count || 0} {t('members') || 'members'}
              </span>
              {department.max_members && (
                <span className="text-gray-500 ml-1">
                  / {department.max_members}
                </span>
              )}
            </div>

            {department.is_public && (
              <span className="text-xs text-green-600 font-medium">
                <i className="fas fa-globe mr-1"></i>
                {t('public') || 'Public'}
              </span>
            )}
          </div>

          {/* Sub-departments */}
          {department.subDepartments && department.subDepartments.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">
                {t('sub.departments') || 'Sub-departments'}:
              </p>
              <div className="flex flex-wrap gap-1">
                {department.subDepartments.map((sub) => (
                  <span
                    key={sub.id}
                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                  >
                    {sub.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => setShowMembersModal(true)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <i className="fas fa-users mr-1"></i>
            {t('manage.members') || 'Manage Members'}
          </button>
          <button
            className="text-sm text-gray-600 hover:text-gray-700"
            title="Send SMS"
          >
            <i className="fas fa-sms"></i>
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditDepartmentModal
          department={department}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Manage Members Modal */}
      {showMembersModal && (
        <ManageDepartmentMembersModal
          department={department}
          onClose={() => setShowMembersModal(false)}
          onUpdate={handleMembersUpdate}
        />
      )}
    </>
  );
};

export default DepartmentCard;
