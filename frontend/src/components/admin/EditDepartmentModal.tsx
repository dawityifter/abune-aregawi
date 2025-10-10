import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

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
  parent_department_id?: number | null;
  contact_email?: string;
  contact_phone?: string;
}

interface EditDepartmentModalProps {
  department: Department;
  onClose: () => void;
  onSuccess: () => void;
}

const EditDepartmentModal: React.FC<EditDepartmentModalProps> = ({ department, onClose, onSuccess }) => {
  const { t } = useLanguage();
  const { firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [leaderSearchTerm, setLeaderSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: department.name || '',
    description: department.description || '',
    type: department.type || 'ministry',
    parent_department_id: department.parent_department_id?.toString() || '',
    leader_id: department.leader_id?.toString() || '',
    contact_email: department.contact_email || '',
    contact_phone: department.contact_phone || '',
    meeting_schedule: department.meeting_schedule || '',
    is_public: department.is_public ?? true,
    is_active: department.is_active ?? true,
    max_members: department.max_members?.toString() || ''
  });

  useEffect(() => {
    fetchMembers();
    fetchDepartments();
  }, []);

  const fetchMembers = async () => {
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
        const membersList = data.data?.members || data.members || [];
        setMembers(membersList);
      } else {
        console.error('Failed to fetch members:', await response.json());
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const idToken = await firebaseUser?.getIdToken();
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/departments?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Filter out current department and its descendants to prevent circular references
        setDepartments(data.data.departments.filter((d: any) => d.id !== department.id) || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const idToken = await firebaseUser?.getIdToken();
      
      const payload = {
        ...formData,
        parent_department_id: formData.parent_department_id || null,
        leader_id: formData.leader_id || null,
        max_members: formData.max_members ? parseInt(formData.max_members) : null
      };

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/departments/${department.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update department');
      }

      onSuccess();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white mb-10">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {t('edit.department') || 'Edit Department'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('name') || 'Name'} *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('description') || 'Description'}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Type and Parent Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('type') || 'Type'} *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="ministry">Ministry</option>
                <option value="committee">Committee</option>
                <option value="service">Service</option>
                <option value="social">Social</option>
                <option value="administrative">Administrative</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('parent.department') || 'Parent Department'}
              </label>
              <select
                name="parent_department_id"
                value={formData.parent_department_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t('none') || 'None (Top Level)'}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Leader */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('leader') || 'Leader'}
            </label>
            
            {/* Search input for filtering leaders */}
            <div className="relative mb-2">
              <input
                type="text"
                value={leaderSearchTerm}
                onChange={(e) => setLeaderSearchTerm(e.target.value)}
                placeholder={t('search.leader') || 'Search by name, ID, or phone...'}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <i className="fas fa-search absolute left-3 top-3 text-gray-400 text-sm"></i>
              {leaderSearchTerm && (
                <button
                  onClick={() => setLeaderSearchTerm('')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <i className="fas fa-times text-sm"></i>
                </button>
              )}
            </div>
            
            <select
              name="leader_id"
              value={formData.leader_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">{t('select.leader') || 'Select Leader'}</option>
              {(() => {
                const filteredMembers = members.filter(member => {
                  if (!leaderSearchTerm) return true;
                  const searchLower = leaderSearchTerm.toLowerCase();
                  const firstName = (member.firstName || member.first_name || '').toLowerCase();
                  const lastName = (member.lastName || member.last_name || '').toLowerCase();
                  const memberId = String(member.memberId || member.member_id || member.id).toLowerCase();
                  const phoneNumber = (member.phoneNumber || member.phone_number || '').toLowerCase();
                  return firstName.includes(searchLower) || 
                         lastName.includes(searchLower) || 
                         memberId.includes(searchLower) || 
                         phoneNumber.includes(searchLower);
                });
                
                return filteredMembers.map(member => {
                  const firstName = member.firstName || member.first_name || '';
                  const lastName = member.lastName || member.last_name || '';
                  const memberId = member.memberId || member.member_id || member.id;
                  const phoneNumber = member.phoneNumber || member.phone_number || '';
                  
                  return (
                    <option key={member.id} value={member.id}>
                      {firstName} {lastName} [{memberId}] ({phoneNumber})
                    </option>
                  );
                });
              })()}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {members.filter(member => {
                if (!leaderSearchTerm) return true;
                const searchLower = leaderSearchTerm.toLowerCase();
                const firstName = (member.firstName || member.first_name || '').toLowerCase();
                const lastName = (member.lastName || member.last_name || '').toLowerCase();
                const memberId = String(member.memberId || member.member_id || member.id).toLowerCase();
                const phoneNumber = (member.phoneNumber || member.phone_number || '').toLowerCase();
                return firstName.includes(searchLower) || lastName.includes(searchLower) || memberId.includes(searchLower) || phoneNumber.includes(searchLower);
              }).length} of {members.length} members {leaderSearchTerm ? 'matching' : 'available'}
            </p>
          </div>

          {/* Meeting Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('meeting.schedule') || 'Meeting Schedule'}
            </label>
            <input
              type="text"
              name="meeting_schedule"
              value={formData.meeting_schedule}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., Every Sunday at 10:00 AM"
            />
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                {t('department.contact.info') || 'Department Contact Info'}
              </label>
              <span className="text-xs text-gray-500 italic">
                (Optional - for public/ministry inquiries)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="youth@church.org"
                />
                <p className="text-xs text-gray-500 mt-1">Public email for this department</p>
              </div>

              <div>
                <input
                  type="tel"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="+1 (555) 123-4567"
                />
                <p className="text-xs text-gray-500 mt-1">Public phone for this department</p>
              </div>
            </div>
          </div>

          {/* Max Members, Public, and Active */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('max.members') || 'Max Members'}
              </label>
              <input
                type="number"
                name="max_members"
                value={formData.max_members}
                onChange={handleChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                name="is_public"
                id="is_public_edit"
                checked={formData.is_public}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="is_public_edit" className="ml-2 block text-sm text-gray-700">
                {t('public') || 'Public'}
              </label>
            </div>

            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                name="is_active"
                id="is_active_edit"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active_edit" className="ml-2 block text-sm text-gray-700">
                {t('active') || 'Active'}
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? (t('saving') || 'Saving...') : (t('save') || 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDepartmentModal;
