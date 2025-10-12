import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleDisplayName, UserRole } from '../../utils/roles';
import AddDependentModal from './AddDependentModal';
import EditDependentModal from './EditDependentModal';

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
  yearlyPledge?: number | string;
}

interface MemberEditModalProps {
  member: Member;
  onClose: () => void;
  onMemberUpdated: () => void;
  canEditMembers: boolean;
  canManageRoles: boolean;
}

const MemberEditModal: React.FC<MemberEditModalProps> = ({
  member,
  onClose,
  onMemberUpdated,
  canEditMembers,
  canManageRoles
}) => {
  const { t } = useLanguage();
  const { currentUser, firebaseUser } = useAuth();
  const [formData, setFormData] = useState<Member>(member);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'spiritual' | 'family'>('basic');
  const [dependents, setDependents] = useState<any[]>([]);
  const [showAddDependent, setShowAddDependent] = useState(false);
  const [editingDependent, setEditingDependent] = useState<any | null>(null);
  const [showEditDependent, setShowEditDependent] = useState(false);

  useEffect(() => {
    // Normalize gender and maritalStatus to lowercase to match dropdown options
    setFormData({
      ...member,
      gender: member.gender ? member.gender.toLowerCase() : member.gender,
      maritalStatus: member.maritalStatus ? member.maritalStatus.toLowerCase() : member.maritalStatus
    });
  }, [member]);

  // Fetch dependents to populate Family tab (children + spouse info)
  const refreshDependents = useCallback(async () => {
    if (!member?.id || !firebaseUser) return;
    try {
      const idToken = await firebaseUser.getIdToken(true);
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${member.id}/dependents`, {
        headers: {
          'Authorization': idToken ? `Bearer ${idToken}` : '',
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) return; // avoid blocking modal if dependents fetch fails
      const json = await res.json();
      const deps = Array.isArray(json?.data?.dependents) ? json.data.dependents : [];
      setDependents(deps);

      // Prefill spouse fields if not provided on member object
      const spouse = deps.find((d: any) => d.relationship === 'Spouse');
      // Children are Son/Daughter
      const children = deps
        .filter((d: any) => d.relationship === 'Son' || d.relationship === 'Daughter')
        .map((d: any) => ({
          firstName: d.firstName,
          lastName: d.lastName,
          dateOfBirth: d.dateOfBirth,
          gender: d.gender,
        }));

      setFormData(prev => ({
        ...prev,
        spouseName: prev.spouseName || spouse?.firstName || prev.spouseName,
        spouseEmail: prev.spouseEmail || spouse?.email || prev.spouseEmail,
        children,
      }));
    } catch (e) {
      // Silent fail; family tab will just show none
      console.warn('Failed to fetch dependents for member', member.id, e);
    }
  }, [member?.id, firebaseUser]);

  useEffect(() => {
    refreshDependents();
  }, [refreshDependents]);

  const handleDeleteDependent = async (dependentId: string) => {
    if (!window.confirm(t('confirm.delete') || 'Are you sure you want to delete this dependent?')) return;
    try {
      const idToken = firebaseUser ? await firebaseUser.getIdToken() : undefined;
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/members/dependents/${dependentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        }
      });
      if (res.ok) {
        await refreshDependents();
      } else {
        const data = await res.json().catch(() => ({} as any));
        setError(data.message || 'Failed to delete dependent');
      }
    } catch (e: any) {
      console.error('Failed to delete dependent', e);
      setError(e?.message || 'Failed to delete dependent');
    }
  };

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
      const payload: any = {
        ...formData,
        // Ensure lower-case strings for enums
        gender: formData.gender ? formData.gender.toLowerCase() : undefined,
        maritalStatus: formData.maritalStatus ? formData.maritalStatus.toLowerCase() : undefined,
        interestedInServing: formData.interestedInServing
          ? formData.interestedInServing.toLowerCase()
          : undefined,
        yearlyPledge: formData.yearlyPledge ? formData.yearlyPledge : undefined,
      };

      // Map camelCase to snake_case for backend fields that use snake_case
      if (payload.maritalStatus) {
        payload.marital_status = payload.maritalStatus;
        delete payload.maritalStatus;
      }

      // Ensure active status updates persist to backend (expects is_active)
      if (typeof payload.isActive === 'boolean') {
        payload.is_active = payload.isActive;
        delete payload.isActive;
      }

      // Map interestedInServing to interested_in_serving for backend
      if (payload.interestedInServing) {
        payload.interested_in_serving = payload.interestedInServing;
        delete payload.interestedInServing;
      }

      // Map common identity/contact fields to snake_case
      if (payload.firstName !== undefined) {
        payload.first_name = payload.firstName;
        delete payload.firstName;
      }
      if (payload.middleName !== undefined) {
        payload.middle_name = payload.middleName;
        delete payload.middleName;
      }
      if (payload.lastName !== undefined) {
        payload.last_name = payload.lastName;
        delete payload.lastName;
      }
      if (payload.phoneNumber !== undefined) {
        payload.phone_number = payload.phoneNumber;
        delete payload.phoneNumber;
      }
      if (payload.dateJoinedParish !== undefined) {
        payload.date_joined_parish = payload.dateJoinedParish;
        delete payload.dateJoinedParish;
      }
      if (payload.dateOfBirth !== undefined) {
        payload.date_of_birth = payload.dateOfBirth;
        delete payload.dateOfBirth;
      }
      if (payload.streetLine1 !== undefined) {
        payload.street_line1 = payload.streetLine1;
        delete payload.streetLine1;
      }
      if (payload.postalCode !== undefined) {
        payload.postal_code = payload.postalCode;
        delete payload.postalCode;
      }
      if (payload.spouseName !== undefined) {
        payload.spouse_name = payload.spouseName;
        delete payload.spouseName;
      }
      if (payload.emergencyContactName !== undefined) {
        payload.emergency_contact_name = payload.emergencyContactName;
        delete payload.emergencyContactName;
      }
      if (payload.emergencyContactPhone !== undefined) {
        payload.emergency_contact_phone = payload.emergencyContactPhone;
        delete payload.emergencyContactPhone;
      }

      // Map yearlyPledge to yearly_pledge expected by backend
      if (payload.yearlyPledge !== undefined && payload.yearlyPledge !== '') {
        const num = Number(payload.yearlyPledge);
        if (Number.isFinite(num)) {
          payload.yearly_pledge = num;
        }
        delete payload.yearlyPledge;
      }

      // If the user cannot manage roles, do not send role changes
      if (!canManageRoles) {
        delete payload.role;
      }

      // Include either email or phone for backend auth requirement
      const userIdentifier = currentUser?.email
        ? `email=${encodeURIComponent(currentUser.email)}`
        : `phone=${encodeURIComponent(currentUser?.phoneNumber || '')}`;
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${member.id}?${userIdentifier}`, {
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
                  {t('email')}
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
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
                  disabled={!canManageRoles}
                  title={!canManageRoles ? t('no.permission.to.change.role') : ''}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!canManageRoles ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                  <option value="member">Member</option>
                  <option value="secretary">Secretary</option>
                  <option value="treasurer">Treasurer</option>
                  <option value="church_leadership">Church Leadership</option>
                  <option value="relationship">Relationship</option>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('yearly.pledge') || 'Yearly Pledge'}
                </label>
                {(() => {
                  const amountPattern = /^[0-9]*([.][0-9]{0,2})?$/;
                  const onChange = (v: string) => {
                    if (v === '' || amountPattern.test(v)) {
                      setFormData(prev => ({ ...prev, yearlyPledge: v }));
                    }
                  };
                  const onBlur = () => {
                    const v = formData.yearlyPledge as string | number | undefined;
                    if (v === undefined || v === null || v === '') return;
                    const num = Number(v);
                    if (Number.isFinite(num)) {
                      setFormData(prev => ({ ...prev, yearlyPledge: num.toFixed(2) }));
                    }
                  };
                  return (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={(formData.yearlyPledge as string) || ''}
                      onChange={(e) => onChange(e.target.value)}
                      onBlur={onBlur}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g. 1200"
                      name="yearlyPledge"
                    />
                  );
                })()}
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
                  readOnly
                  title={t('read.only') || 'Read only'}
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
            <div className="space-y-6">
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
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium text-gray-900">
                  {t('dependents') || 'Dependents'} ({dependents.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddDependent(true)}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md"
                >
                  {t('add.dependent') || 'Add Dependent'}
                </button>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                {dependents.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">{t('no.dependents') || 'No dependents added yet.'}</div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('name') || 'Name'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('date.of.birth') || 'Date of Birth'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('gender') || 'Gender'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('relationship') || 'Relationship'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('baptized') || 'Baptized'}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('actions') || 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dependents.map((d: any) => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{d.firstName} {d.middleName} {d.lastName}</div>
                            {d.email && <div className="text-sm text-gray-500">{d.email}</div>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{d.dateOfBirth || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{d.gender || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{d.relationship || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${d.isBaptized ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {d.isBaptized ? (t('yes') || 'Yes') : (t('no') || 'No')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                            <button
                              type="button"
                              onClick={() => { setEditingDependent(d); setShowEditDependent(true); }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              {t('edit') || 'Edit'}
                            </button>
                            <button
                              type="button"
                              onClick={() => d.id && handleDeleteDependent(d.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              {t('delete') || 'Delete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
        {/* Dependent Modals */}
        {showAddDependent && (
          <AddDependentModal
            memberId={member.id}
            memberName={`${member.firstName} ${member.lastName}`}
            onClose={() => setShowAddDependent(false)}
            onCreated={async () => {
              setShowAddDependent(false);
              await refreshDependents();
            }}
          />
        )}

        {showEditDependent && editingDependent && (
          <EditDependentModal
            dependent={editingDependent}
            onClose={() => {
              setShowEditDependent(false);
              setEditingDependent(null);
            }}
            onUpdated={async () => {
              setShowEditDependent(false);
              setEditingDependent(null);
              await refreshDependents();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default MemberEditModal; 