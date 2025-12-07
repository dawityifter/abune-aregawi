import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

interface CreateDepartmentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useLanguage();
  const { firebaseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [leaderSearchTerm, setLeaderSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'ministry',
    parent_department_id: '',
    leader_id: '',
    contact_email: '',
    contact_phone: '',
    meeting_schedule: '',
    is_public: true,
    max_members: ''
  });

  useEffect(() => {
    fetchMembers();
    fetchDepartments();
  }, []);

  const fetchMembers = async () => {
    try {
      const idToken = await firebaseUser?.getIdToken();
      console.log('Fetching members for leader dropdown...');

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/members/all/firebase?limit=500`,
        {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Members response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Members data:', data);
        const membersList = data.data?.members || data.members || [];
        console.log('Loaded members count:', membersList.length);
        console.log('First member structure:', membersList[0]);
        console.log('Sample member names:', membersList.slice(0, 3).map((m: any) => ({
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          firstName: m.firstName,
          lastName: m.lastName
        })));
        setMembers(membersList);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch members:', errorData);
        setError(`Failed to load members: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      setError('Failed to load members. Please try again.');
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
        setDepartments(data.data.departments || []);
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
        `${process.env.REACT_APP_API_URL}/api/departments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create department');
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
            {t('admin.departmentModal.create')}
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
              {t('admin.departmentModal.fields.name')} *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., Youth Ministry"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.departmentModal.fields.description')}
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Brief description of the department..."
            />
          </div>

          {/* Type and Parent Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.departmentModal.fields.type')} *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="ministry">{t('admin.departmentModal.types.ministry')}</option>
                <option value="committee">{t('admin.departmentModal.types.committee')}</option>
                <option value="service">{t('admin.departmentModal.types.service')}</option>
                <option value="social">{t('admin.departmentModal.types.social')}</option>
                <option value="administrative">{t('admin.departmentModal.types.administrative')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.departmentModal.fields.parent')}
              </label>
              <select
                name="parent_department_id"
                value={formData.parent_department_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">{t('admin.departmentModal.placeholders.none')}</option>
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
              {t('admin.departmentModal.fields.leader')}
            </label>

            {/* Search input for filtering leaders */}
            <div className="relative mb-2">
              <input
                type="text"
                value={leaderSearchTerm}
                onChange={(e) => setLeaderSearchTerm(e.target.value)}
                placeholder={t('admin.departmentModal.placeholders.searchLeader')}
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
              <option value="">{t('admin.departmentModal.placeholders.selectLeader')}</option>
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
              {t('admin.departmentModal.fields.meetingSchedule')}
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
                {t('admin.memberModal.tabs.contact')}
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

          {/* Max Members and Public */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('admin.departmentModal.fields.maxMembers')}
              </label>
              <input
                type="number"
                name="max_members"
                value={formData.max_members}
                onChange={handleChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Leave empty for unlimited"
              />
            </div>

            <div className="flex items-center pt-6">
              <input
                type="checkbox"
                name="is_public"
                id="is_public"
                checked={formData.is_public}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="is_public" className="ml-2 block text-sm text-gray-700">
                {t('admin.departmentModal.fields.public')}
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
              {t('admin.common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? (t('admin.common.loading')) : (t('admin.common.create'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDepartmentModal;
