import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface ProfileData {
  displayName: string;
  email: string;
  role: string;
  createdAt: string;
  isActive: boolean;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  ministries?: string[];
  languagePreference?: string;
  dateJoinedParish?: string;
  baptismName?: string;
  interestedInServing?: string;
  streetLine1?: string;
  apartmentNo?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

interface BackendMemberData {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  maritalStatus: string;
  phoneNumber: string;
  email: string;
  streetLine1: string;
  apartmentNo?: string;
  city?: string;
  state?: string;
  postalCode: string;
  country: string;
  spouseName?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  dateJoinedParish?: string;
  baptismName?: string;
  interestedInServing?: string;
  ministries?: string;
  languagePreference: string;
  memberId?: string;
  preferredGivingMethod: string;
  titheParticipation: boolean;
  loginEmail: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

// Phone number formatter
function formatPhoneNumber(value: string) {
  const cleaned = value.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
  if (!match) return value;
  let formatted = '';
  if (match[1]) {
    formatted = `(${match[1]}`;
    if (match[1].length === 3) {
      formatted += ')';
    }
  }
  if (match[2]) {
    formatted += match[2].length > 0 ? ` ${match[2]}` : '';
  }
  if (match[3]) {
    formatted += match[3].length > 0 ? `-${match[3]}` : '';
  }
  return formatted.trim();
}

const Profile: React.FC = () => {
  const { currentUser, getUserProfile, updateUserProfileData, updateUserProfile } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [backendData, setBackendData] = useState<BackendMemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<ProfileData>({
    displayName: '',
    email: '',
    role: '',
    createdAt: '',
    isActive: true,
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    emergencyContact: '',
    emergencyPhone: '',
    ministries: [],
    languagePreference: 'English',
    dateJoinedParish: '',
    baptismName: '',
    interestedInServing: '',
    streetLine1: '',
    apartmentNo: '',
    city: '',
    state: '',
    postalCode: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (currentUser) {
        try {
          // Fetch Firebase profile
          const userProfile = await getUserProfile(currentUser.uid);
          setProfile(userProfile);
          setFormData(userProfile as ProfileData || {
            displayName: '',
            email: '',
            role: '',
            createdAt: '',
            isActive: true,
            phoneNumber: '',
            dateOfBirth: '',
            gender: '',
            maritalStatus: '',
            emergencyContact: '',
            emergencyPhone: '',
            ministries: [],
            languagePreference: 'English',
            dateJoinedParish: '',
            baptismName: '',
            interestedInServing: '',
            streetLine1: '',
            apartmentNo: '',
            city: '',
            state: '',
            postalCode: ''
          });

          // Fetch backend member data
          try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${currentUser.uid}?email=${currentUser.email}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const result = await response.json();
              setBackendData(result.data.member);
              
              // Merge backend data with Firebase data
              const mergedData = {
                ...userProfile,
                phoneNumber: result.data.member.phoneNumber,
                dateOfBirth: result.data.member.dateOfBirth,
                gender: result.data.member.gender,
                maritalStatus: result.data.member.maritalStatus,
                emergencyContact: result.data.member.emergencyContactName,
                emergencyPhone: result.data.member.emergencyContactPhone,
                ministries: result.data.member.ministries ? JSON.parse(result.data.member.ministries) : [],
                languagePreference: result.data.member.languagePreference,
                dateJoinedParish: result.data.member.dateJoinedParish,
                baptismName: result.data.member.baptismName,
                interestedInServing: result.data.member.interestedInServing,
                streetLine1: result.data.member.streetLine1,
                apartmentNo: result.data.member.apartmentNo,
                city: result.data.member.city,
                state: result.data.member.state,
                postalCode: result.data.member.postalCode,
              };
              
              setProfile(mergedData);
              setFormData(mergedData);
            } else {
              console.warn('Backend profile not found, using Firebase data only');
              setProfile(userProfile);
              setFormData(userProfile as ProfileData || {
                displayName: '',
                email: '',
                role: '',
                createdAt: '',
                isActive: true,
                phoneNumber: '',
                dateOfBirth: '',
                gender: '',
                maritalStatus: '',
                emergencyContact: '',
                emergencyPhone: '',
                ministries: [],
                languagePreference: 'English',
                dateJoinedParish: '',
                baptismName: '',
                interestedInServing: '',
                streetLine1: '',
                apartmentNo: '',
                city: '',
                state: '',
                postalCode: ''
              });
            }
          } catch (backendError) {
            console.warn('Could not fetch backend data:', backendError);
            // Continue with Firebase data only
          }
        } catch (error: any) {
          console.error('Error fetching profile:', error);
          setError('Failed to load profile');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchProfile();
  }, [currentUser, getUserProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let newValue = value;
    if (name === 'phoneNumber') {
      newValue = formatPhoneNumber(value);
    }
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  const handleSave = async () => {
    if (!currentUser) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Update display name in Firebase Auth
      if (formData.displayName && formData.displayName !== currentUser.displayName) {
        await updateUserProfile(formData.displayName);
      }

      // Update profile data in Firestore (only basic info)
      await updateUserProfileData(currentUser.uid, {
        displayName: formData.displayName,
        email: formData.email,
        role: formData.role,
        updatedAt: new Date().toISOString()
      });

      // Update detailed profile data in backend API
      const backendUpdateData = {
        phoneNumber: formData.phoneNumber,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        maritalStatus: formData.maritalStatus,
        emergencyContactName: formData.emergencyContact,
        emergencyContactPhone: formData.emergencyPhone,
        ministries: formData.ministries ? JSON.stringify(formData.ministries) : null,
        languagePreference: formData.languagePreference,
        dateJoinedParish: formData.dateJoinedParish,
        baptismName: formData.baptismName,
        interestedInServing: formData.interestedInServing,
        streetLine1: formData.streetLine1,
        apartmentNo: formData.apartmentNo,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode
      };

      // Send update to backend API
      const response = await fetch(`/api/members/profile/firebase/${currentUser.uid}?email=${encodeURIComponent(currentUser.email || '')}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendUpdateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile in backend');
      }

      setProfile(prev => prev ? { ...prev, ...formData } as ProfileData : null);
      setEditing(false);
      setSuccess('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(profile || {
      displayName: '',
      email: '',
      role: '',
      createdAt: '',
      isActive: true,
      phoneNumber: '',
      dateOfBirth: '',
      gender: '',
      maritalStatus: '',
      emergencyContact: '',
      emergencyPhone: '',
      ministries: [],
      languagePreference: 'English',
      dateJoinedParish: '',
      baptismName: '',
      interestedInServing: '',
      streetLine1: '',
      apartmentNo: '',
      city: '',
      state: '',
      postalCode: ''
    });
    setEditing(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">Profile not found</div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
          >
            Retry
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
              <button
                onClick={() => window.history.back()}
                className="mr-4 text-gray-600 hover:text-gray-800"
              >
                <i className="fas fa-arrow-left text-xl"></i>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                {t('profile')}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
                >
                  <i className="fas fa-edit mr-2"></i>
                  {t('edit')}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Success/Error Messages */}
          {success && (
            <div className="mb-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}
          {error && (
            <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                {editing ? t('edit.profile') : t('profile.information')}
              </h2>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-gray-900 border-b pb-2">
                    {t('basic.information')}
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('full.name')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="displayName"
                        value={formData.displayName || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.displayName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('email')}
                    </label>
                    <p className="text-gray-900">{profile.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('role')}
                    </label>
                    <p className="text-gray-900">{profile.role}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('member.since')}
                    </label>
                    <p className="text-gray-900">
                      {new Date(profile.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('phone.number')}
                    </label>
                    {editing ? (
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={formData.phoneNumber || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.phoneNumber || t('not.provided')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('date.of.birth')}
                    </label>
                    {editing ? (
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : t('not.provided')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('gender')}
                    </label>
                    {editing ? (
                      <select
                        name="gender"
                        value={formData.gender || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">{t('select.gender')}</option>
                        <option value="Male">{t('male')}</option>
                        <option value="Female">{t('female')}</option>
                        <option value="Other">{t('other')}</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{profile.gender || t('not.provided')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('marital.status')}
                    </label>
                    {editing ? (
                      <select
                        name="maritalStatus"
                        value={formData.maritalStatus || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">{t('select.marital.status')}</option>
                        <option value="Single">{t('single')}</option>
                        <option value="Married">{t('married')}</option>
                        <option value="Divorced">{t('divorced')}</option>
                        <option value="Widowed">{t('widowed')}</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{profile.maritalStatus || t('not.provided')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('street.line1')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="streetLine1"
                        value={formData.streetLine1 || ''}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.streetLine1 || t('not.provided')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('apartment.no')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="apartmentNo"
                        value={formData.apartmentNo || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.apartmentNo || t('not.provided')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('city')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="city"
                        value={formData.city || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.city || t('not.provided')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('state')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="state"
                        value={formData.state || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.state || t('not.provided')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('zip.code')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="postalCode"
                        value={formData.postalCode || ''}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.postalCode || t('not.provided')}</p>
                    )}
                  </div>
                </div>

                {/* Church Information */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-gray-900 border-b pb-2">
                    {t('church.information')}
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('language.preference')}
                    </label>
                    {editing ? (
                      <select
                        name="languagePreference"
                        value={formData.languagePreference || 'English'}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="English">English</option>
                        <option value="Tigrigna">Tigrigna</option>
                        <option value="Amharic">Amharic</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{profile.languagePreference || 'English'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('emergency.contact')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="emergencyContact"
                        value={formData.emergencyContact || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder={t('emergency.contact.name')}
                      />
                    ) : (
                      <p className="text-gray-900">{profile.emergencyContact || t('not.provided')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('emergency.phone')}
                    </label>
                    {editing ? (
                      <input
                        type="tel"
                        name="emergencyPhone"
                        value={formData.emergencyPhone || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder={t('emergency.phone.number')}
                      />
                    ) : (
                      <p className="text-gray-900">{profile.emergencyPhone || t('not.provided')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('baptism.name')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="baptismName"
                        value={formData.baptismName || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder={t('baptism.name.placeholder')}
                      />
                    ) : (
                      <p className="text-gray-900">{profile.baptismName || t('not.provided')}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('date.joined.parish')}
                    </label>
                    {editing ? (
                      <input
                        type="date"
                        name="dateJoinedParish"
                        value={formData.dateJoinedParish || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {profile.dateJoinedParish ? new Date(profile.dateJoinedParish).toLocaleDateString() : t('not.provided')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('interested.in.serving')}
                    </label>
                    {editing ? (
                      <select
                        name="interestedInServing"
                        value={formData.interestedInServing || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">{t('select.option')}</option>
                        <option value="Yes">{t('yes')}</option>
                        <option value="No">{t('no')}</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">{profile.interestedInServing || t('not.provided')}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {editing && (
                <div className="mt-8 flex justify-end space-x-4">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={saving}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        {t('saving')}
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save mr-2"></i>
                        {t('save')}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile; 