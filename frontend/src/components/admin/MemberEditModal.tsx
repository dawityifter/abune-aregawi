import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleDisplayName, UserRole } from '../../utils/roles';

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
  gender?: string;
  maritalStatus?: string;
  dateOfBirth?: string;
  streetLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  spouseName?: string;
  spouseEmail?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  baptismName?: string;
  interestedInServing?: string; // 'yes' | 'no' | 'maybe'
  ministries?: string;
  languagePreference?: string;
  preferredGivingMethod?: string;
  titheParticipation?: boolean;
  children?: any[];
}

interface MemberEditModalProps {
  member: Member;
  onClose: () => void;
  onMemberUpdated: () => void;
  canEditMembers: boolean;
}

const MemberEditModal: React.FC<MemberEditModalProps> = ({
  member,
  onClose,
  onMemberUpdated,
  canEditMembers
}) => {
  const { t } = useLanguage();
  const { currentUser, firebaseUser } = useAuth();
  const [formData, setFormData] = useState<Member>(member);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'spiritual' | 'family'>('basic');

  useEffect(() => {
    setFormData(member);
  }, [member]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMembers) {
      setError(t('no.permission.to.edit'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const idToken = firebaseUser ? await firebaseUser.getIdToken() : null;
      // Prepare payload with correct formats expected by backend
      const payload = {
        ...formData,
        interestedInServing: formData.interestedInServing
          ? formData.interestedInServing.toLowerCase()
          : undefined,
      };

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${member.id}?email=${encodeURIComponent(currentUser?.email || '')}`, {
        method: 'PUT',
        headers: {
          'Authorization': idToken ? `Bearer ${idToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update member');
      }

      onMemberUpdated();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'basic', label: t('basic.info'), icon: 'fas fa-user' },
    { id: 'contact', label: t('contact.info'), icon: 'fas fa-address-book' },
    { id: 'spiritual', label: t('spiritual.info'), icon: 'fas fa-pray' },
    { id: 'family', label: t('family.info'), icon: 'fas fa-users' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            {t('edit.member')}: {member.firstName} {member.lastName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className={`${tab.icon} mr-2`}></i>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Basic Information Tab */}
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('first.name')} *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('middle.name')}
                </label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('last.name')} *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('email')} *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('role')} *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('status')}
                </label>
                <select
                  name="isActive"
                  value={formData.isActive.toString()}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="true">{t('active')}</option>
                  <option value="false">{t('inactive')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('gender')}
                </label>
                <select
                  name="gender"
                  value={formData.gender || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">{t('select.gender')}</option>
                  <option value="male">{t('male')}</option>
                  <option value="female">{t('female')}</option>
                  <option value="other">{t('other')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('date.of.birth')}
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('marital.status')}
                </label>
                <select
                  name="maritalStatus"
                  value={formData.maritalStatus || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">{t('select.marital.status')}</option>
                  <option value="single">{t('single')}</option>
                  <option value="married">{t('married')}</option>
                  <option value="divorced">{t('divorced')}</option>
                  <option value="widowed">{t('widowed')}</option>
                </select>
              </div>
            </div>
          )}

          {/* Contact Information Tab */}
          {activeTab === 'contact' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('phone.number')}
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber || ''}
                  onChange={e => {
                    let value = e.target.value.replace(/[^\d]/g, '');
                    if (value.length > 10) value = value.slice(0, 10);
                    let formatted = value;
                    if (value.length > 6) {
                      formatted = `${value.slice(0,3)}-${value.slice(3,6)}-${value.slice(6,10)}`;
                    } else if (value.length > 3) {
                      formatted = `${value.slice(0,3)}-${value.slice(3,6)}`;
                    }
                    // Create a synthetic event for handleInputChange
                    handleInputChange({
                      target: {
                        name: 'phoneNumber',
                        value: formatted,
                        type: 'tel'
                      }
                    } as React.ChangeEvent<HTMLInputElement>);
                  }}
                  maxLength={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('emergency.contact.name')}
                </label>
                <input
                  type="text"
                  name="emergencyContactName"
                  value={formData.emergencyContactName || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('emergency.contact.phone')}
                </label>
                <input
                  type="tel"
                  name="emergencyContactPhone"
                  value={formData.emergencyContactPhone || ''}
                  onChange={e => {
                    let value = e.target.value.replace(/[^\d]/g, '');
                    if (value.length > 10) value = value.slice(0, 10);
                    let formatted = value;
                    if (value.length > 6) {
                      formatted = `${value.slice(0,3)}-${value.slice(3,6)}-${value.slice(6,10)}`;
                    } else if (value.length > 3) {
                      formatted = `${value.slice(0,3)}-${value.slice(3,6)}`;
                    }
                    // Create a synthetic event for handleInputChange
                    handleInputChange({
                      target: {
                        name: 'emergencyContactPhone',
                        value: formatted,
                        type: 'tel'
                      }
                    } as React.ChangeEvent<HTMLInputElement>);
                  }}
                  maxLength={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('street.address')}
                </label>
                <input
                  type="text"
                  name="streetLine1"
                  value={formData.streetLine1 || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('city')}
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('state')}
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('postal.code')}
                </label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('country')}
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* Spiritual Information Tab */}
          {activeTab === 'spiritual' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('date.joined.parish')}
                </label>
                <input
                  type="date"
                  name="dateJoinedParish"
                  value={formData.dateJoinedParish || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('baptism.name')}
                </label>
                <input
                  type="text"
                  name="baptismName"
                  value={formData.baptismName || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('language.preference')}
                </label>
                <select
                  name="languagePreference"
                  value={formData.languagePreference || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">{t('select.language')}</option>
                  <option value="English">English</option>
                  <option value="Tigrigna">Tigrigna</option>
                  <option value="Amharic">Amharic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('preferred.giving.method')}
                </label>
                <select
                  name="preferredGivingMethod"
                  value={formData.preferredGivingMethod || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">{t('select.giving.method')}</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="online">Online</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('interested.in.serving')}
                </label>
                <select
                  name="interestedInServing"
                  value={formData.interestedInServing || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">{t('select.option')}</option>
                  <option value="yes">{t('yes')}</option>
                  <option value="no">{t('no')}</option>
                  <option value="maybe">{t('maybe')}</option>
                </select>
              </div>
            </div>
          )}

          {/* Family Information Tab */}
          {activeTab === 'family' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('spouse.name')}
                </label>
                <input
                  type="text"
                  name="spouseName"
                  value={formData.spouseName || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('spouse.email')}
                </label>
                <input
                  type="email"
                  name="spouseEmail"
                  value={formData.spouseEmail || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  {t('children')} ({formData.children?.length || 0})
                </h4>
                {formData.children && formData.children.length > 0 ? (
                  <div className="space-y-4">
                    {formData.children.map((child, index) => (
                      <div key={index} className="border border-gray-200 rounded-md p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('child.name')}
                            </label>
                            <input
                              type="text"
                              value={child.firstName || ''}
                              readOnly
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('date.of.birth')}
                            </label>
                            <input
                              type="date"
                              value={child.dateOfBirth || ''}
                              readOnly
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {t('gender')}
                            </label>
                            <input
                              type="text"
                              value={child.gender || ''}
                              readOnly
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">{t('no.children.registered')}</p>
                )}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !canEditMembers}
              className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? t('saving') : t('save.changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MemberEditModal; 