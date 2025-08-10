import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatDateForDisplay } from '../utils/dateUtils';
import { Dependent } from '../utils/relationshipTypes';
import { UserRole } from '../utils/roles';

interface ProfileData {
  displayName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
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
  dependents?: BackendDependentData[];
}

interface BackendDependentData {
  id: string;
  memberId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  relationship?: string;
  phone?: string;
  email?: string;
  baptismName?: string;
  isBaptized: boolean;
  baptismDate?: string;
  nameDay?: string;
  medicalConditions?: string;
  allergies?: string;
  medications?: string;
  dietaryRestrictions?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Phone number formatter - removed unused function

const Profile: React.FC = () => {
  const { currentUser, getUserProfile, updateUserProfileData, updateUserProfile } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<ProfileData>({
    displayName: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    role: 'member',
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
      console.log('🔍 Profile component - currentUser:', currentUser);
      
      if (currentUser && currentUser.uid) {
        try {
          console.log('🔍 Fetching profile for UID:', currentUser.uid);
          
          // Fetch Firebase profile
          const userProfile = await getUserProfile(currentUser.uid, currentUser.email, currentUser.phoneNumber);
          setProfile(userProfile);
          setFormData(userProfile as ProfileData || {
            displayName: '',
            firstName: '',
            middleName: '',
            lastName: '',
            email: '',
            role: 'member',
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
            // Build query parameters based on available user data
            const params = new URLSearchParams();
            console.log('🔍 currentUser object:', currentUser);
            console.log('🔍 currentUser.email:', currentUser.email);
            console.log('🔍 currentUser.phoneNumber:', currentUser.phoneNumber);
            
            if (currentUser.email) {
              params.append('email', currentUser.email);
              console.log('✅ Added email parameter:', currentUser.email);
            }
            if (currentUser.phoneNumber) {
              params.append('phone', currentUser.phoneNumber);
              console.log('✅ Added phone parameter:', currentUser.phoneNumber);
            }
            
            const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${currentUser.uid}?${params.toString()}`;
            console.log('🔍 Making backend API call to:', apiUrl);
            
            const response = await fetch(apiUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const result = await response.json();
              
              // Merge backend data with Firebase data
              const mergedData = {
                ...userProfile,
                firstName: result.data.member.firstName,
                middleName: result.data.member.middleName,
                lastName: result.data.member.lastName,
                email: result.data.member.email,
                role: result.data.member.role,
                createdAt: result.data.member.createdAt,
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
                dependents: result.data.member.dependents || []
              };
              
              setProfile(mergedData);
              setFormData(mergedData);
            } else {
              console.warn('Backend profile not found, using Firebase data only');
              // Show a warning that registration is needed
              setError('You are logged in with Firebase but need to complete your member registration. Some features may not be available.');
              setProfile(userProfile);
              setFormData(userProfile as ProfileData || {
                displayName: '',
                firstName: '',
                middleName: '',
                lastName: '',
                email: '',
                role: 'member',
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
            console.error('Error fetching backend profile:', backendError);
            setError('Failed to fetch complete profile data. Please try again.');
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          setError('Failed to fetch profile data. Please try again.');
        } finally {
          setLoading(false);
        }
      } else {
        console.warn('❌ No currentUser or currentUser.uid found:', currentUser);
        setError('User not authenticated. Please sign in again.');
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser, getUserProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let newValue = value;
    if (name === 'phoneNumber' || name === 'emergencyPhone') {
      let digits = value.replace(/[^\d]/g, '');
      if (digits.length > 10) digits = digits.slice(0, 10);
      if (digits.length > 6) {
        newValue = `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;
      } else if (digits.length > 3) {
        newValue = `${digits.slice(0,3)}-${digits.slice(3,6)}`;
      } else {
        newValue = digits;
      }
    }
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  const handleSave = async () => {
    if (!currentUser || !currentUser.uid) {
      setError('User not authenticated. Please sign in again.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Create display name from separate name fields
      const displayName = `${formData.firstName || ''} ${formData.middleName || ''} ${formData.lastName || ''}`.replace(/\s+/g, ' ').trim();
      
      // Update display name in Firebase Auth if it changed
      if (displayName && displayName !== currentUser.displayName) {
        await updateUserProfile({ displayName });
      }

      // Update profile data in Firestore (only basic info)
      await updateUserProfileData(currentUser.uid, {
        displayName: displayName,
        email: formData.email,
        role: formData.role,
        updatedAt: new Date().toISOString()
      });

      // Update detailed profile data in backend API
      const backendUpdateData = {
        firstName: formData.firstName,
        middleName: formData.middleName,
        lastName: formData.lastName,
        email: formData.email,
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
        interestedInServing: formData.interestedInServing
          ? formData.interestedInServing.toLowerCase()
          : undefined,
        streetLine1: formData.streetLine1,
        apartmentNo: formData.apartmentNo,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        dependents: formData.dependents || null
      };

      // Send update to backend API
      // Build query parameters based on available user data
      const params = new URLSearchParams();
      if (currentUser.email) {
        params.append('email', currentUser.email);
      }
      if (currentUser.phoneNumber) {
        params.append('phone', currentUser.phoneNumber);
      }
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${currentUser.uid}?${params.toString()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendUpdateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === 'REGISTRATION_REQUIRED') {
          throw new Error('Please complete your registration first. You are logged in with Firebase but need to register your member profile.');
        }
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
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      role: 'member',
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
          <p className="text-gray-600 mb-4">
            You are logged in with Firebase but haven't completed your member registration yet.
          </p>
          <div className="space-x-4">
            <button 
              onClick={() => window.location.reload()} 
              className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
            >
              Retry
            </button>
            <button 
              onClick={() => window.location.href = '/register'} 
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Complete Registration
            </button>
          </div>
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
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Edit button moved to profile header */}
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
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">
                {editing ? t('edit.profile') : t('profile.information')}
              </h2>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="bg-primary-600 text-white px-3 py-1.5 rounded-md hover:bg-primary-700 text-sm flex items-center"
                >
                  <i className="fas fa-edit mr-1.5"></i>
                  <span>{t('edit')}</span>
                </button>
              )}
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-gray-900 border-b pb-2">
                    {t('basic.information')}
                  </h3>

                  {/* First Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('first.name')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    ) : (
                      <p className="text-gray-900">{profile.firstName || 'Not provided'}</p>
                    )}
                  </div>

                  {/* Middle Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('middle.name')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="middleName"
                        value={formData.middleName || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.middleName || 'Not provided'}</p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('last.name')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    ) : (
                      <p className="text-gray-900">{profile.lastName || 'Not provided'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('email')}
                    </label>
                    {editing ? (
                      <input
                        type="email"
                        name="email"
                        value={formData.email || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    ) : (
                      <p className="text-gray-900">{profile.email || 'Not provided'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('role')}
                    </label>
                    <p className="text-gray-900">{profile.role || 'Member'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('member.since')}
                    </label>
                    <p className="text-gray-900">
                      {profile.createdAt ? formatDateForDisplay(profile.createdAt) : 'Not available'}
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
                        maxLength={12}
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
                        {profile.dateOfBirth ? formatDateForDisplay(profile.dateOfBirth) : t('not.provided')}
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
                        maxLength={12}
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
                        {profile.dateJoinedParish ? formatDateForDisplay(profile.dateJoinedParish) : t('not.provided')}
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

              {/* Children Information - Full Width */}
              {profile.dependents && profile.dependents.length > 0 && (
                <div className="mt-8 space-y-4">
                  <h3 className="text-md font-medium text-gray-900 border-b pb-2">
                    {t('children.and.dependents')}
                  </h3>
                  <div className="flex flex-col gap-4">
                    {profile.dependents.map((dependent: BackendDependentData) => (
                                              <div key={dependent.id} className="bg-gray-50 p-4 rounded-lg w-full">
                          <h4 className="font-medium text-gray-900 mb-3">
                            {dependent.firstName} {dependent.middleName} {dependent.lastName}
                          </h4>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('date.of.birth')}</label>
                                <p className="text-gray-900">{formatDateForDisplay(dependent.dateOfBirth)}</p>
                              </div>
                                                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">{t('gender')}</label>
                              <p className="text-gray-900">{dependent.gender}</p>
                            </div>
                            {dependent.relationship && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('relationship')}</label>
                                <p className="text-gray-900">{dependent.relationship}</p>
                              </div>
                            )}
                                                      </div>
                          <div className="space-y-4">
                            {dependent.phone && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('phone')}</label>
                                <p className="text-gray-900">{dependent.phone}</p>
                              </div>
                            )}
                            {dependent.email && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
                                <p className="text-gray-900">{dependent.email}</p>
                              </div>
                            )}
                            {dependent.baptismName && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('baptism.name')}</label>
                                <p className="text-gray-900">{dependent.baptismName}</p>
                              </div>
                            )}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">{t('baptized')}</label>
                              <p className="text-gray-900">{dependent.isBaptized ? t('yes') : t('no')}</p>
                            </div>
                            {dependent.baptismDate && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('baptism.date')}</label>
                                <p className="text-gray-900">{dependent.baptismDate}</p>
                              </div>
                            )}
                            {dependent.nameDay && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('name.day')}</label>
                                <p className="text-gray-900">{dependent.nameDay}</p>
                              </div>
                            )}
                            {dependent.medicalConditions && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('medical.conditions')}</label>
                                <p className="text-gray-900">{dependent.medicalConditions}</p>
                              </div>
                            )}
                            {dependent.allergies && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('allergies')}</label>
                                <p className="text-gray-900">{dependent.allergies}</p>
                              </div>
                            )}
                            {dependent.notes && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('notes')}</label>
                                <p className="text-gray-900">{dependent.notes}</p>
                              </div>
                            )}
                            </div>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {editing && (
                <div className="mt-8 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={handleCancel}
                    className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-base font-medium"
                    disabled={saving}
                  >
                    <i className="fas fa-times mr-2"></i>
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-base font-medium"
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

      {/* Floating Action Button for Mobile */}
      {!editing && (
        <div className="fixed bottom-6 right-6 sm:hidden">
          <button
            onClick={() => setEditing(true)}
            className="bg-primary-600 text-white p-4 rounded-full shadow-lg hover:bg-primary-700 transition-colors"
            aria-label="Edit Profile"
          >
            <i className="fas fa-edit text-xl"></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile; 