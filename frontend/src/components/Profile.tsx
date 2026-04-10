import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatDateForDisplay } from '../utils/dateUtils';
import { UserRole } from '../utils/roles';
import { getDisplayEmail } from '../utils/email';

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
  yearlyPledge?: number;
  streetLine1?: string;
  apartmentNo?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  dependents?: BackendDependentData[];
  headOfHouseholdName?: string;
  headOfHousehold?: HouseholdMemberSummary;
  householdMemberId?: string | number;
  isDependent?: boolean;
  isHouseholdLinked?: boolean;
}

interface HouseholdMemberSummary {
  id: string | number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  streetLine1?: string;
  apartmentNo?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
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
  medicalConditions?: string;
  allergies?: string;
  medications?: string;
  dietaryRestrictions?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const emptyProfileData: ProfileData = {
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
  yearlyPledge: undefined,
  streetLine1: '',
  apartmentNo: '',
  city: '',
  state: '',
  postalCode: '',
  dependents: []
};

const getFullName = (person?: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  displayName?: string;
}) => {
  const name = [person?.firstName, person?.middleName, person?.lastName].filter(Boolean).join(' ').trim();
  return name || person?.displayName || 'Profile';
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'P';

const formatCurrency = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return 'Not provided';
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getLocationLine = (profile: ProfileData) => {
  const parts = [profile.city, profile.state, profile.postalCode].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '';
};

const getAgeFromDate = (dateString?: string) => {
  if (!dateString) return '';

  const birth = new Date(dateString);
  if (Number.isNaN(birth.getTime())) return '';

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age} years old` : '';
};

const getDependentCardTone = (gender?: string) => {
  const normalizedGender = gender?.toLowerCase();

  if (normalizedGender === 'female') {
    return {
      cardClass: 'border-rose-100 bg-[linear-gradient(135deg,rgba(255,250,250,0.98),rgba(255,241,242,0.95))]',
      badgeClass: 'bg-rose-50 text-rose-700',
      avatarClass: 'bg-rose-50 text-rose-700',
      noteClass: 'border-rose-100 bg-white/85',
    };
  }

  if (normalizedGender === 'male') {
    return {
      cardClass: 'border-sky-100 bg-[linear-gradient(135deg,rgba(249,252,255,0.98),rgba(239,246,255,0.95))]',
      badgeClass: 'bg-sky-50 text-sky-700',
      avatarClass: 'bg-sky-50 text-sky-700',
      noteClass: 'border-sky-100 bg-white/85',
    };
  }

  return {
    cardClass: 'border-accent-100 bg-[#fffdfa]',
    badgeClass: 'bg-accent-50 text-accent-700',
    avatarClass: 'bg-primary-50 text-primary-700',
    noteClass: 'border-accent-100 bg-white',
  };
};

const FieldValue: React.FC<{ value?: React.ReactNode; fallback?: string }> = ({ value, fallback = 'Not provided' }) => {
  const hasValue =
    value !== undefined &&
    value !== null &&
    !(typeof value === 'string' && value.trim() === '');

  return (
    <p className={`profile-detail-value ${hasValue ? '' : 'profile-muted-value'}`}>
      {hasValue ? value : fallback}
    </p>
  );
};

const hasDisplayValue = (value?: React.ReactNode) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

const resolveHouseholdMemberId = (member: any) => {
  if (member?.role === 'dependent') return member?.linkedMember?.id;
  return member?.familyId || member?.id;
};

const Profile: React.FC = () => {
  const { currentUser, getUserProfile, updateUserProfileData, updateUserProfile } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfileData>(emptyProfileData);

  const bgStyle: React.CSSProperties = {
    backgroundImage: `url(${process.env.PUBLIC_URL}/bylaws/TigrayOrthodox-background.png)`,
    backgroundRepeat: 'repeat',
    backgroundPosition: 'top left',
    backgroundSize: 'auto',
  };

  useEffect(() => {
    const fetchProfile = async () => {
      console.log('🔍 Profile component - currentUser:', currentUser);

      if (currentUser && currentUser.uid) {
        try {
          console.log('🔍 Fetching profile for UID:', currentUser.uid);

          const userProfile = await getUserProfile(currentUser.uid, currentUser.email, currentUser.phoneNumber);
          setProfile(userProfile);
          setFormData((userProfile as ProfileData) || emptyProfileData);

          try {
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
              const profileMember = result?.data?.member || {};
              const linked = profileMember.linkedMember || null;
              const headOfHousehold = linked || profileMember.headOfHousehold || null;
              const householdMemberId = resolveHouseholdMemberId(profileMember);
              const isDep = profileMember.role === 'dependent';
              const isHouseholdLinked =
                isDep ||
                (!!profileMember.familyId && String(profileMember.familyId) !== String(profileMember.id));
              const hohName = headOfHousehold
                ? `${(headOfHousehold.firstName || '').trim()} ${(headOfHousehold.lastName || '').trim()}`.trim()
                : (profileMember.headOfHouseholdName || '');
              let householdDependents = profileMember.dependents || [];

              if (householdMemberId) {
                try {
                  const dependentsResponse = await fetch(
                    `${process.env.REACT_APP_API_URL}/api/members/${householdMemberId}/dependents`,
                    {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                    }
                  );

                  if (dependentsResponse.ok) {
                    const dependentsResult = await dependentsResponse.json();
                    householdDependents = dependentsResult?.data?.dependents || householdDependents;
                  }
                } catch (dependentsError) {
                  console.warn('Failed to load household dependents for profile view', dependentsError);
                }
              }

              const addressSource = isHouseholdLinked ? headOfHousehold : null;
              const mergedData = {
                ...userProfile,
                firstName: profileMember.firstName,
                middleName: profileMember.middleName,
                lastName: profileMember.lastName,
                email: profileMember.email,
                role: profileMember.role,
                createdAt: profileMember.createdAt,
                phoneNumber: profileMember.phoneNumber,
                dateOfBirth: profileMember.dateOfBirth,
                gender: profileMember.gender,
                maritalStatus: profileMember.maritalStatus,
                emergencyContact: profileMember.emergencyContactName,
                emergencyPhone: profileMember.emergencyContactPhone,
                ministries: profileMember.ministries ? JSON.parse(profileMember.ministries) : [],
                languagePreference: profileMember.languagePreference,
                dateJoinedParish: profileMember.dateJoinedParish,
                baptismName: profileMember.baptismName,
                interestedInServing: profileMember.interestedInServing,
                yearlyPledge: profileMember.yearlyPledge,
                streetLine1: addressSource?.streetLine1 ?? profileMember.streetLine1,
                apartmentNo: addressSource?.apartmentNo ?? profileMember.apartmentNo,
                city: addressSource?.city ?? profileMember.city,
                state: addressSource?.state ?? profileMember.state,
                postalCode: addressSource?.postalCode ?? profileMember.postalCode,
                headOfHouseholdName: hohName || undefined,
                headOfHousehold: headOfHousehold || undefined,
                householdMemberId,
                isDependent: isDep,
                isHouseholdLinked,
                dependents: householdDependents
              };

              setProfile(mergedData);
              setFormData(mergedData);
            } else {
              console.warn('Backend profile not found, using Firebase data only');
              setError('You are logged in with Firebase but need to complete your member registration. Some features may not be available.');
              setProfile(userProfile);
              setFormData((userProfile as ProfileData) || emptyProfileData);
            }
          } catch (backendError) {
            console.error('Error fetching backend profile:', backendError);
            setError('Failed to fetch complete profile data. Please try again.');
          }
        } catch (fetchError) {
          console.error('Error fetching profile:', fetchError);
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
        newValue = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
      } else if (digits.length > 3) {
        newValue = `${digits.slice(0, 3)}-${digits.slice(3, 6)}`;
      } else {
        newValue = digits;
      }
    }

    setFormData((prev) => ({
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
      const displayName = `${formData.firstName || ''} ${formData.middleName || ''} ${formData.lastName || ''}`.replace(/\s+/g, ' ').trim();

      if (displayName && displayName !== currentUser.displayName) {
        await updateUserProfile({ displayName });
      }

      await updateUserProfileData(currentUser.uid, {
        displayName,
        email: formData.email,
        role: formData.role,
        updatedAt: new Date().toISOString()
      });

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
        yearlyPledge: formData.yearlyPledge,
        ...(profile?.isDependent
        || profile?.isHouseholdLinked
          ? {}
          : {
            streetLine1: formData.streetLine1,
            apartmentNo: formData.apartmentNo,
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
          }),
        dependents: formData.dependents || null
      };

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

      setProfile((prev) => (prev ? { ...prev, ...formData } as ProfileData : null));
      setEditing(false);
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (saveError: any) {
      console.error('Error updating profile:', saveError);
      setError('Failed to update profile: ' + saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(profile || emptyProfileData);
    setEditing(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <div className="profile-card mx-4 max-w-lg p-10 text-center">
          <div className="text-red-600 text-lg mb-4">Profile not found</div>
          <p className="text-gray-600 mb-6">
            You are logged in with Firebase but haven't completed your member registration yet.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => window.location.reload()}
              className="rounded-2xl bg-primary-600 px-4 py-3 text-white hover:bg-primary-700"
            >
              Retry
            </button>
            <button
              onClick={() => { window.location.href = '/register'; }}
              className="rounded-2xl bg-green-600 px-4 py-3 text-white hover:bg-green-700"
            >
              Complete Registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName = getFullName(profile);
  const displayEmail = getDisplayEmail(profile.email);
  const memberSince = profile.dateJoinedParish
    ? formatDateForDisplay(profile.dateJoinedParish)
    : profile.createdAt
      ? formatDateForDisplay(profile.createdAt)
      : 'Not available';
  const birthDate = profile.dateOfBirth ? formatDateForDisplay(profile.dateOfBirth) : '';
  const ageText = getAgeFromDate(profile.dateOfBirth);
  const addressLine = [profile.streetLine1, profile.apartmentNo].filter(Boolean).join(', ');
  const locationLine = getLocationLine(profile);
  const dependents = profile.dependents || [];
  const householdSummary = profile.isDependent
    ? 'Your household details are managed through the head of household.'
    : profile.isHouseholdLinked
      ? 'You are connected to a household record. Family members and children shown here are managed together.'
    : dependents.length > 0
      ? `${dependents.length} ${dependents.length === 1 ? 'dependent' : 'dependents'} on file`
      : 'No dependents on file yet.';

  const renderTextField = (
    label: string,
    value: React.ReactNode,
    fallback?: string,
    hideWhenEmpty = false
  ) => (
    hideWhenEmpty && !hasDisplayValue(value) ? null : (
    <div className="profile-detail-row">
      <span className="profile-detail-label">{label}</span>
      <FieldValue value={value} fallback={fallback} />
    </div>
    )
  );

  const renderInputField = (
    label: string,
    name: keyof ProfileData,
    type: string = 'text',
    required = false,
    placeholder?: string,
    maxLength?: number,
    disabled = false
  ) => (
    <label className="block">
      <span className="profile-label">{label}</span>
      <input
        type={type}
        name={name}
        value={(formData[name] as string | number | undefined) || ''}
        onChange={handleInputChange}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        className={`profile-input ${disabled ? 'cursor-not-allowed bg-accent-50 text-accent-400' : ''}`}
      />
    </label>
  );

  const renderSelectField = (
    label: string,
    name: keyof ProfileData,
    options: Array<{ label: string; value: string }>,
    placeholder?: string
  ) => (
    <label className="block">
      <span className="profile-label">{label}</span>
      <select
        name={name}
        value={(formData[name] as string | undefined) || ''}
        onChange={handleInputChange}
        className="profile-input"
      >
        <option value="">{placeholder || 'Select an option'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="profile-shell min-h-screen" style={bgStyle}>
      <main className="profile-surface mx-auto max-w-6xl px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-accent-200 bg-white text-accent-600 transition hover:border-accent-300 hover:text-accent-700"
              aria-label="Go back"
            >
              <i className="fas fa-arrow-left text-sm"></i>
            </button>
            <div>
              <p className="profile-section-kicker">{t('profile')}</p>
              <h1 className="text-2xl font-serif text-accent-700">{displayName}</h1>
            </div>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="hidden items-center justify-center gap-2 self-start rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 sm:inline-flex"
            >
              <i className="fas fa-edit text-xs"></i>
              <span>{t('edit')}</span>
            </button>
          )}
        </section>

        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-green-800 shadow-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800 shadow-sm">
            {error}
          </div>
        )}

        <section className="profile-card mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-[#fff8f1] via-white to-[#faf1e6] px-6 py-8 sm:px-8">
            <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start">
              <div className="flex gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-xl font-bold text-primary-700 shadow-sm">
                  {getInitials(displayName)}
                </div>
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="profile-chip-accent">{profile.role || 'member'}</span>
                    {profile.isDependent && <span className="profile-chip">Dependent account</span>}
                    {!profile.isDependent && profile.isHouseholdLinked && <span className="profile-chip">Household-linked account</span>}
                    {profile.languagePreference && <span className="profile-chip">{profile.languagePreference}</span>}
                  </div>
                  <h2 className="text-3xl font-serif text-accent-700">{displayName}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-accent-500">
                    {profile.isDependent
                      ? 'A clear snapshot of your household-linked member profile, contact details, and parish information.'
                      : profile.isHouseholdLinked
                        ? 'A refined overview of your profile within the shared household record, including the family details tied to the head of household.'
                      : 'A refined overview of your member profile, household details, and church participation information.'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-accent-600">
                    <span className="inline-flex items-center gap-2">
                      <i className="fas fa-phone text-xs text-primary-600"></i>
                      {profile.phoneNumber || 'Phone not provided'}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <i className="fas fa-envelope text-xs text-primary-600"></i>
                      {displayEmail || 'Email not provided'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="profile-stat">
                  <div className="profile-stat-label">Member Since</div>
                  <div className="profile-stat-value">{memberSince}</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-label">Household</div>
                  <div className="profile-stat-value">
                    {profile.isDependent
                      ? 'Linked profile'
                      : profile.isHouseholdLinked
                        ? 'Shared household'
                        : `${dependents.length} ${dependents.length === 1 ? 'Dependent' : 'Dependents'}`}
                  </div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-label">Birth Date</div>
                  <div className="profile-stat-value">{birthDate || 'Not provided'}</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-label">Yearly Pledge</div>
                  <div className="profile-stat-value">{formatCurrency(profile.yearlyPledge)}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="profile-card p-6 sm:p-7">
            <div className="mb-6">
              <p className="profile-section-kicker">{editing ? t('edit.profile') : t('profile.information')}</p>
              <h3 className="profile-section-title mt-2">{t('basic.information')}</h3>
            </div>

            <div className="space-y-1">
              {editing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {renderInputField(t('first.name'), 'firstName', 'text', true)}
                  {renderInputField(t('middle.name'), 'middleName')}
                  {renderInputField(t('last.name'), 'lastName', 'text', true)}
                  {renderInputField(t('phone.number'), 'phoneNumber', 'tel', false, undefined, 12)}
                  {renderInputField(t('email'), 'email', 'email')}
                  {renderInputField(t('date.of.birth'), 'dateOfBirth', 'date')}
                  {renderSelectField(t('gender'), 'gender', [
                    { label: t('male'), value: 'Male' },
                    { label: t('female'), value: 'Female' }
                  ], t('select.gender'))}
                  {!profile.isDependent && renderSelectField(t('marital.status'), 'maritalStatus', [
                    { label: t('single'), value: 'Single' },
                    { label: t('married'), value: 'Married' },
                    { label: t('divorced'), value: 'Divorced' },
                    { label: t('widowed'), value: 'Widowed' }
                  ], t('select.marital.status'))}
                </div>
              ) : (
                <>
                  {renderTextField(t('first.name'), profile.firstName)}
                  {renderTextField(t('middle.name'), profile.middleName, t('not.provided'), true)}
                  {renderTextField(t('last.name'), profile.lastName)}
                  {renderTextField(t('phone.number'), profile.phoneNumber, t('not.provided'))}
                  {renderTextField(t('email'), displayEmail, t('not.provided'))}
                  {renderTextField(t('role'), profile.role || 'Member')}
                  {renderTextField(t('date.of.birth'), birthDate ? `${birthDate}${ageText ? ` • ${ageText}` : ''}` : '', t('not.provided'))}
                  {renderTextField(t('gender'), profile.gender, t('not.provided'))}
                  {!profile.isDependent && renderTextField(t('marital.status'), profile.maritalStatus, t('not.provided'), true)}
                </>
              )}
            </div>
          </section>

          <section className="profile-card p-6 sm:p-7">
            <div className="mb-6">
              <p className="profile-section-kicker">Contact</p>
              <h3 className="profile-section-title mt-2">Contact & Address</h3>
            </div>

            {profile.isHouseholdLinked && (
              <div className="mb-5 rounded-2xl border border-secondary-200 bg-secondary-50/70 px-4 py-3 text-sm text-accent-600">
                Address information is inherited from the head of household.
              </div>
            )}

            <div className="space-y-1">
              {editing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {renderInputField(t('street.line1'), 'streetLine1', 'text', !profile.isHouseholdLinked, undefined, undefined, !!profile.isHouseholdLinked)}
                  {renderInputField(t('apartment.no'), 'apartmentNo', 'text', false, undefined, undefined, !!profile.isHouseholdLinked)}
                  {renderInputField(t('city'), 'city', 'text', false, undefined, undefined, !!profile.isHouseholdLinked)}
                  {renderInputField(t('state'), 'state', 'text', false, undefined, undefined, !!profile.isHouseholdLinked)}
                  {renderInputField(t('zip.code'), 'postalCode', 'text', !profile.isHouseholdLinked, undefined, undefined, !!profile.isHouseholdLinked)}
                  {renderInputField(t('emergency.contact'), 'emergencyContact', 'text', false, t('emergency.contact.name'))}
                  {renderInputField(t('emergency.phone'), 'emergencyPhone', 'tel', false, t('emergency.phone.number'), 12)}
                </div>
              ) : (
                <>
                  {renderTextField(t('street.line1'), profile.streetLine1, t('not.provided'))}
                  {renderTextField(t('apartment.no'), profile.apartmentNo, t('not.provided'), true)}
                  {renderTextField('Address summary', addressLine || locationLine ? `${addressLine}${addressLine && locationLine ? ' • ' : ''}${locationLine}` : '', t('not.provided'))}
                  {renderTextField(t('city'), profile.city, t('not.provided'), true)}
                  {renderTextField(t('state'), profile.state, t('not.provided'), true)}
                  {renderTextField(t('zip.code'), profile.postalCode, t('not.provided'), true)}
                  {renderTextField(t('emergency.contact'), profile.emergencyContact, t('not.provided'), true)}
                  {renderTextField(t('emergency.phone'), profile.emergencyPhone, t('not.provided'), true)}
                </>
              )}
            </div>
          </section>

          <section className="profile-card p-6 sm:p-7">
            <div className="mb-6">
              <p className="profile-section-kicker">Church</p>
              <h3 className="profile-section-title mt-2">{t('church.information')}</h3>
            </div>

            <div className="space-y-1">
              {editing ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="profile-label">{t('yearly.pledge')} ($)</span>
                    <input
                      type="number"
                      name="yearlyPledge"
                      value={formData.yearlyPledge || ''}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="profile-input"
                    />
                  </label>
                  {renderSelectField(t('language.preference'), 'languagePreference', [
                    { label: 'English', value: 'English' },
                    { label: 'Tigrigna', value: 'Tigrigna' },
                    { label: 'Amharic', value: 'Amharic' }
                  ])}
                  {renderInputField(t('baptism.name'), 'baptismName', 'text', false, t('baptism.name.placeholder'))}
                  {profile.role !== 'member'
                    ? renderInputField(t('date.joined.parish'), 'dateJoinedParish', 'date')
                    : (
                      <div className="rounded-2xl border border-accent-100 bg-accent-50/60 px-4 py-3">
                        <div className="profile-label">{t('date.joined.parish')}</div>
                        <div className="mt-2 text-sm font-medium text-accent-700">
                          {profile.dateJoinedParish ? formatDateForDisplay(profile.dateJoinedParish) : t('not.provided')}
                        </div>
                      </div>
                    )}
                  {renderSelectField(t('interested.in.serving'), 'interestedInServing', [
                    { label: t('yes'), value: 'Yes' },
                    { label: t('no'), value: 'No' }
                  ], t('select.option'))}
                </div>
              ) : (
                <>
                  {renderTextField(t('yearly.pledge'), formatCurrency(profile.yearlyPledge), 'Not provided')}
                  {renderTextField(t('language.preference'), profile.languagePreference || 'English')}
                  {renderTextField(t('baptism.name'), profile.baptismName, t('not.provided'), true)}
                  {renderTextField(t('date.joined.parish'), profile.dateJoinedParish ? formatDateForDisplay(profile.dateJoinedParish) : '', t('not.provided'), true)}
                  {renderTextField(t('interested.in.serving'), profile.interestedInServing, t('not.provided'), true)}
                </>
              )}
            </div>
          </section>

          <section className="profile-card-muted p-6 sm:p-7">
            <div className="mb-6">
              <p className="profile-section-kicker">Household</p>
              <h3 className="profile-section-title mt-2">{t('children.and.dependents')}</h3>
            </div>

            <div className="space-y-4">
              {profile.headOfHouseholdName && (
                <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                  <div className="profile-detail-label">Head of Household</div>
                  <div className="mt-2 text-lg font-semibold text-accent-700">
                    {profile.headOfHouseholdName || 'Not available'}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                <div className="profile-detail-label">Household Summary</div>
                <p className="mt-2 text-sm leading-6 text-accent-600">{householdSummary}</p>
                <div className="mt-4 rounded-2xl border border-secondary-200 bg-secondary-50/70 px-4 py-3 text-sm text-accent-600">
                  Dependent information is view-only on this profile page. To add, edit, or remove dependents, use the dependents card in your dashboard.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="profile-chip">{dependents.length} {dependents.length === 1 ? 'dependent' : 'dependents'}</span>
                  {profile.isHouseholdLinked && <span className="profile-chip">Address inherited</span>}
                  {!profile.isDependent && <span className="profile-chip">Family updates available in Dependents</span>}
                  {!profile.isHouseholdLinked && dependents.length === 0 && <span className="profile-chip">Household ready for updates</span>}
                </div>
              </div>
            </div>
          </section>
        </div>

        {dependents.length > 0 && (
          <section className="profile-card mt-6 p-6 sm:p-7">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="profile-section-kicker">Household Records</p>
                <h3 className="profile-section-title mt-2">Dependents on File</h3>
                <p className="mt-2 text-sm text-accent-500">
                  A read-only summary of each child or dependent linked to this household. Updates should be made from the dependents card in your dashboard.
                </p>
              </div>
              <span className="profile-chip-accent">
                {dependents.length} {dependents.length === 1 ? 'dependent' : 'dependents'}
              </span>
            </div>

            <div className="space-y-4">
              {dependents.map((dependent) => {
                const dependentName = getFullName(dependent);
                const dependentAge = getAgeFromDate(dependent.dateOfBirth);
                const dependentDob = dependent.dateOfBirth ? formatDateForDisplay(dependent.dateOfBirth) : '';
                const dependentEmail = getDisplayEmail(dependent.email);
                const tone = getDependentCardTone(dependent.gender);
                const summaryBits = [
                  dependent.relationship,
                  dependent.gender,
                  dependentAge
                ].filter(Boolean);

                return (
                  <article
                    key={dependent.id}
                    className={`rounded-3xl border p-5 shadow-[0_10px_30px_rgba(69,26,3,0.06)] ${tone.cardClass}`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${tone.avatarClass}`}>
                          {getInitials(dependentName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-xl font-serif text-accent-700">{dependentName}</h4>
                            <span className={dependent.isBaptized ? 'profile-chip-accent' : 'profile-chip'}>
                              {dependent.isBaptized ? t('yes') : t('no')} {t('baptized')}
                            </span>
                          </div>
                          {summaryBits.length > 0 && (
                            <p className="mt-2 text-sm text-accent-500">
                              {summaryBits.join(' • ')}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {dependentDob && <span className={`profile-chip border-transparent ${tone.badgeClass}`}>{dependentDob}</span>}
                            {dependent.baptismName && <span className={`profile-chip border-transparent ${tone.badgeClass}`}>{dependent.baptismName}</span>}
                            {dependent.phone && <span className={`profile-chip border-transparent ${tone.badgeClass}`}>{dependent.phone}</span>}
                            {dependentEmail && <span className={`profile-chip border-transparent ${tone.badgeClass}`}>{dependentEmail}</span>}
                          </div>
                        </div>
                      </div>

                      {(dependent.medicalConditions || dependent.allergies || dependent.notes) && (
                        <div className={`w-full rounded-2xl border p-4 lg:max-w-sm ${tone.noteClass}`}>
                          <div className="profile-detail-label">Care Notes</div>
                          <div className="mt-3 space-y-3 text-sm text-accent-600">
                            {dependent.medicalConditions && (
                              <div>
                                <div className="font-semibold text-accent-700">{t('medical.conditions')}</div>
                                <p className="mt-1">{dependent.medicalConditions}</p>
                              </div>
                            )}
                            {dependent.allergies && (
                              <div>
                                <div className="font-semibold text-accent-700">{t('allergies')}</div>
                                <p className="mt-1">{dependent.allergies}</p>
                              </div>
                            )}
                            {dependent.notes && (
                              <div>
                                <div className="font-semibold text-accent-700">{t('notes')}</div>
                                <p className="mt-1">{dependent.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {editing && (
          <div className="profile-card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <div className="profile-detail-label">Editing</div>
              <p className="mt-1 text-sm text-accent-600">
                Review your updates, then save them to refresh your member profile.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleCancel}
                className="rounded-2xl border border-accent-200 bg-white px-5 py-3 text-sm font-semibold text-accent-700 transition hover:bg-accent-50"
                disabled={saving}
              >
                <i className="fas fa-times mr-2"></i>
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-2xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
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
          </div>
        )}
      </main>

      {!editing && (
        <div className="fixed bottom-6 right-6 sm:hidden">
          <button
            onClick={() => setEditing(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition hover:bg-primary-700"
            aria-label="Edit Profile"
          >
            <i className="fas fa-edit text-lg"></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;
