import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatPhoneNumber } from '../utils/formatPhoneNumber';
import { formatDateForDisplay } from '../utils/dateUtils';
import { Dependent, getRelationshipOptions, Relationship } from '../utils/relationshipTypes';

interface HouseholdContext {
  householdMemberId?: string | number;
  headOfHouseholdName?: string;
  isDependent: boolean;
  isHouseholdLinked: boolean;
}

const resolveHouseholdContext = (member: any): HouseholdContext => {
  const isDependent = member?.role === 'dependent';
  const householdMemberId = isDependent ? member?.linkedMember?.id : (member?.familyId || member?.id);
  const headOfHousehold = member?.linkedMember || member?.headOfHousehold || null;
  const headOfHouseholdName = headOfHousehold
    ? `${(headOfHousehold.firstName || '').trim()} ${(headOfHousehold.lastName || '').trim()}`.trim()
    : (member?.headOfHouseholdName || '');

  return {
    householdMemberId,
    headOfHouseholdName: headOfHouseholdName || undefined,
    isDependent,
    isHouseholdLinked: isDependent || (!!member?.familyId && String(member.familyId) !== String(member.id))
  };
};


const DependentsManagement: React.FC = () => {
  const { currentUser, firebaseUser, getUserProfile } = useAuth();
  const { t } = useLanguage();
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [householdContext, setHouseholdContext] = useState<HouseholdContext>({
    householdMemberId: undefined,
    headOfHouseholdName: undefined,
    isDependent: false,
    isHouseholdLinked: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);
  const [formData, setFormData] = useState<Dependent>({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'Male',
    relationship: undefined,
    phone: '',
    email: '',
    baptismName: '',
    isBaptized: false,
    medicalConditions: '',
    allergies: '',
    medications: '',
    dietaryRestrictions: '',
    notes: ''
  });

  // Explicit form validity for enabling submit (DOB optional)
  const isSubmitDisabled = !formData.firstName?.trim() || !formData.lastName?.trim() || !formData.gender;

  const fetchDependents = useCallback(async () => {
    try {
      // First get the member profile (handles members and dependent logins)
      if (!currentUser?.uid) return;
      const profile = await getUserProfile(currentUser.uid, currentUser.email || null, currentUser.phoneNumber || null);
      if (!profile || !profile.data?.member) return;

      const profileMember = profile.data.member;
      const resolvedHouseholdContext = resolveHouseholdContext(profileMember);
      setHouseholdContext(resolvedHouseholdContext);
      const memberId = resolvedHouseholdContext.householdMemberId;
      if (!memberId) return;

      // Now fetch dependents using the resolved member ID (head of household)
      const idToken = await firebaseUser?.getIdToken();
      const dependentsResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/members/${memberId}/dependents`, {
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        }
      });

      if (dependentsResponse.ok) {
        const data = await dependentsResponse.json();
        setDependents(data.data.dependents || []);
      }
    } catch (error) {
      console.error('Error fetching dependents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, firebaseUser, getUserProfile]);

  useEffect(() => {
    if (currentUser) {
      fetchDependents();
    }
  }, [currentUser, fetchDependents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Get the member (or linked member for dependent) ID first
      if (!currentUser?.uid) throw new Error(t('dependentsPage.errors.notAuthenticated'));
      const profile = await getUserProfile(currentUser.uid, currentUser.email || null, currentUser.phoneNumber || null);
      if (!profile || !profile.data?.member) throw new Error(t('dependentsPage.errors.profileFailed'));

      const profileMember = profile.data.member;
      const memberId = resolveHouseholdContext(profileMember).householdMemberId;
      if (!memberId) throw new Error(t('dependentsPage.errors.resolveIdFailed'));
      
      const url = editingDependent 
        ? `${process.env.REACT_APP_API_URL}/api/members/dependents/${editingDependent.id}`
        : `${process.env.REACT_APP_API_URL}/api/members/${memberId}/dependents`;
      
      const method = editingDependent ? 'PUT' : 'POST';

      const idToken = await firebaseUser?.getIdToken();
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchDependents();
        resetForm();
        setIsAdding(false);
        setEditingDependent(null);
      } else {
        const error = await response.json();
        alert(`${t('dependentsPage.errors.prefix')} ${error.message}`);
      }
    } catch (error) {
      console.error('Error saving dependent:', error);
      alert(t('dependentsPage.errors.saveError'));
    }
  };

  const handleDelete = async (dependentId: string) => {
    if (!window.confirm(t('dependentsPage.errors.deleteConfirm'))) return;

    try {
      const idToken = await firebaseUser?.getIdToken();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/dependents/${dependentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        }
      });

      if (response.ok) {
        await fetchDependents();
      } else {
        const error = await response.json();
        alert(`${t('dependentsPage.errors.prefix')} ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting dependent:', error);
      alert(t('dependentsPage.errors.deleteError'));
    }
  };

  const handleEdit = (dependent: Dependent) => {
    setEditingDependent(dependent);
    setFormData(dependent);
    setIsAdding(true);
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'Male',
      relationship: undefined,
      phone: '',
      email: '',
      baptismName: '',
      isBaptized: false,
      medicalConditions: '',
      allergies: '',
      medications: '',
      dietaryRestrictions: '',
      notes: ''
    });
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingDependent(null);
    resetForm();
  };

  if (isLoading) {
    return <div className="text-center py-8">{t('dependentsPage.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('dependentsPage.title')}</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            {t('dependentsPage.add')}
          </button>
        )}
      </div>

      {householdContext.headOfHouseholdName && (
        <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-900">
          <div className="font-semibold">{t('dependentsPage.householdRecord')}</div>
          <p className="mt-1">
            {t('dependentsPage.managedUnderPre')}<span className="font-semibold">{householdContext.headOfHouseholdName}</span>{t('dependentsPage.managedUnderPost')}
            {householdContext.isDependent
              ? t('dependentsPage.dependentNote')
              : t('dependentsPage.headNote')}
          </p>
        </div>
      )}

      {/* Add/Edit Form */}
      {isAdding && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingDependent ? t('dependentsPage.editTitle') : t('dependentsPage.addTitle')}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dependentsPage.firstName')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dependentsPage.middleName')}
                </label>
                <input
                  type="text"
                  value={formData.middleName || ''}
                  onChange={(e) => setFormData({...formData, middleName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dependentsPage.lastName')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dependentsPage.dob')}
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">{t('dependentsPage.optional')}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dependentsPage.gender')}
                </label>
                <select
                  required
                  value={formData.gender}
                  onChange={(e) => setFormData({...formData, gender: e.target.value as 'Male' | 'Female'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Male">{t('dependentsPage.male')}</option>
                  <option value="Female">{t('dependentsPage.female')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dependentsPage.relationship')}
                </label>
                <select
                  value={formData.relationship || ''}
                  onChange={(e) => setFormData({...formData, relationship: e.target.value as Relationship || undefined})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('dependentsPage.selectRelationship')}</option>
                  {getRelationshipOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {t(`relationship.${option.value.toLowerCase()}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dependentsPage.phone')}
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({...formData, phone: formatPhoneNumber(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dependentsPage.email')}
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('dependentsPage.baptismName')}
                </label>
                <input
                  type="text"
                  value={formData.baptismName || ''}
                  onChange={(e) => setFormData({...formData, baptismName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              

              

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isBaptized"
                  checked={formData.isBaptized}
                  onChange={(e) => setFormData({...formData, isBaptized: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isBaptized" className="ml-2 block text-sm text-gray-900">
                  {t('dependentsPage.isBaptized')}
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t('dependentsPage.cancel')}
              </button>
              <button
                type="submit"
                disabled={!!isSubmitDisabled}
                className={`px-4 py-2 rounded-md text-white ${isSubmitDisabled ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {editingDependent ? t('dependentsPage.update') : t('dependentsPage.add')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dependents List */}
      <div className="bg-white rounded-lg shadow-md">
        {dependents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>{t('dependentsPage.noneYet')}</p>
            <p className="text-sm mt-2">{t('dependentsPage.getStarted')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('dependentsPage.col.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('dependentsPage.col.dob')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('dependentsPage.col.gender')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('dependentsPage.col.relationship')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('dependentsPage.col.baptismName')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('dependentsPage.col.baptized')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('dependentsPage.col.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dependents.map((dependent) => (
                  <tr key={dependent.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {dependent.firstName} {dependent.middleName} {dependent.lastName}
                      </div>
                      {dependent.email && (
                        <div className="text-sm text-gray-500">{dependent.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependent.dateOfBirth ? formatDateForDisplay(dependent.dateOfBirth) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependent.gender}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependent.relationship ? t(`relationship.${dependent.relationship.toLowerCase()}`) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dependent.baptismName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        dependent.isBaptized 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {dependent.isBaptized ? t('dependentsPage.yes') : t('dependentsPage.no')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(dependent)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        {t('dependentsPage.edit')}
                      </button>
                      <button
                        onClick={() => dependent.id && handleDelete(dependent.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        {t('dependentsPage.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default DependentsManagement; 
