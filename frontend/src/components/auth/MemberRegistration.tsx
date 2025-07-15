import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  PersonalInfoStep,
  ContactAddressStep,
  FamilyInfoStep,
  DependantsStep,
  SpiritualInfoStep,
  ContributionStep,
  AccountStep
} from './RegistrationSteps';

interface Dependant {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  phone?: string;
  email?: string;
  baptismName?: string;
  isBaptized: boolean;
  baptismDate?: string;
  nameDay?: string;
}

interface RegistrationForm {
  // Personal Information
  firstName: string;
  middleName: string;
  lastName: string;
  gender: 'Male' | 'Female';
  dateOfBirth: string;
  maritalStatus: string;
  // Head of Household
  isHeadOfHousehold: boolean;
  spouseEmail: string;
  headOfHouseholdEmail: string;
  hasDependants: boolean;
  
  // Contact & Address
  phoneNumber: string;
  email: string;
  streetLine1: string;
  apartmentNo: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  
  // Family Information
  spouseName: string;
  spouseContactPhone: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  
  // Dependants Information
  dependants: Dependant[];
  
  // Spiritual Information
  dateJoinedParish: string;
  baptismName: string;
  interestedInServing: string;
  ministries: string[];
  languagePreference: string;
  
  // Contribution
  preferredGivingMethod: string;
  titheParticipation: boolean;
  
  // Account
  loginEmail: string;
  password: string;
  confirmPassword: string;
}

// Phone number formatter
export function formatPhoneNumber(value: string) {
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

const MemberRegistration: React.FC = () => {
  const { t } = useLanguage();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationForm>({
    firstName: '',
    middleName: '',
    lastName: '',
    gender: 'Male',
    dateOfBirth: '',
    maritalStatus: 'Single',
    isHeadOfHousehold: true,
    spouseEmail: '',
    headOfHouseholdEmail: '',
    hasDependants: false,
    phoneNumber: '',
    email: '',
    streetLine1: '',
    apartmentNo: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    spouseName: '',
    spouseContactPhone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    dependants: [],
    dateJoinedParish: '',
    baptismName: '',
    interestedInServing: '',
    ministries: [],
    languagePreference: 'English',
    preferredGivingMethod: 'Cash',
    titheParticipation: false,
    loginEmail: '',
    password: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState<Partial<RegistrationForm>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-populate loginEmail with email when entering step 7
  useEffect(() => {
    if (currentStep === 7 && !formData.loginEmail && formData.email) {
      setFormData(prev => ({ ...prev, loginEmail: prev.email }));
    }
  }, [currentStep, formData.loginEmail, formData.email]);

  const handleInputChange = (field: keyof RegistrationForm, value: any) => {
    // Auto-format phone number
    if (field === 'phoneNumber') {
      value = formatPhoneNumber(value);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<RegistrationForm> = {};

    switch (step) {
      case 1: // Personal Information
        if (!formData.firstName) newErrors.firstName = t('first.name.required');
        if (!formData.lastName) newErrors.lastName = t('last.name.required');
        if (!formData.dateOfBirth) newErrors.dateOfBirth = t('date.of.birth.required');
        // Validate head of household email if not head of household
        if (!formData.isHeadOfHousehold && !formData.headOfHouseholdEmail) {
          newErrors.headOfHouseholdEmail = t('head.of.household.email.not.found');
        }
        break;
      
      case 2: // Contact & Address
        if (!formData.phoneNumber) newErrors.phoneNumber = t('phone.number.required');
        if (!formData.email) newErrors.email = t('email.required');
        if (!formData.streetLine1) newErrors.streetLine1 = t('street.line1.required');
        if (!formData.city) newErrors.city = t('city.required');
        if (!formData.state) newErrors.state = t('state.required');
        if (!formData.postalCode) newErrors.postalCode = t('postal.code.required');
        if (!formData.country) newErrors.country = t('country.required');
        break;
      
      case 3: // Family Information - No required fields for this step
        break;
      
      case 4: // Dependants Information - No required fields for this step
        break;
      
      case 5: // Spiritual Information - No required fields for this step
        break;
      
      case 6: // Contribution - No required fields for this step
        break;
      
      case 7: // Account Information
        if (!formData.loginEmail) newErrors.loginEmail = t('login.email.required');
        if (!formData.password) newErrors.password = t('password.required');
        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = t('passwords.dont.match');
        }
        if (formData.password && formData.password.length < 8) {
          newErrors.password = t('password.too.short');
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(currentStep)) return;
    
    if (currentStep < 7) {
      // Handle conditional step navigation
      let nextStep = currentStep + 1;
      
      // If moving from step 3 to step 4, check if we should skip step 4
      if (currentStep === 3 && !(formData.isHeadOfHousehold && formData.hasDependants)) {
        nextStep = 5; // Skip step 4 (Dependants) and go to step 5 (Spiritual)
      }
      
      setCurrentStep(nextStep);
    } else {
      // Submit the form
      let createdFirebaseUid = null;
      try {
        setLoading(true);
        
        // Create Firebase Auth account first
        const displayName = `${formData.firstName} ${formData.lastName}`;
        const userCredential = await signUp(formData.loginEmail, formData.password, displayName);
        createdFirebaseUid = userCredential.user.uid;
        
        // Prepare registration data with Firebase UID
        const registrationData = {
          // Personal Information
          firstName: formData.firstName,
          middleName: formData.middleName,
          lastName: formData.lastName,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth,
          maritalStatus: formData.maritalStatus,
          // Head of Household
          isHeadOfHousehold: formData.isHeadOfHousehold,
          spouseEmail: formData.maritalStatus === 'Married' ? formData.spouseEmail : null,
          headOfHouseholdEmail: formData.headOfHouseholdEmail,
          // Contact & Address
          phoneNumber: formData.phoneNumber,
          email: formData.email,
          streetLine1: formData.streetLine1,
          apartmentNo: formData.apartmentNo,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country,
          // Family Information - Handle married vs single differently
          spouseName: formData.maritalStatus === 'Married' ? formData.spouseName : null,
          emergencyContactName: formData.maritalStatus === 'Married' ? formData.spouseName : formData.emergencyContactName,
          emergencyContactPhone: formData.maritalStatus === 'Married' ? formData.spouseContactPhone : formData.emergencyContactPhone,
          // Dependants Information
          dependants: formData.dependants,
          // Spiritual Information
          dateJoinedParish: formData.dateJoinedParish,
          baptismName: formData.baptismName,
          interestedInServing: formData.interestedInServing,
          ministries: formData.ministries,
          languagePreference: formData.languagePreference,
          // Contribution
          preferredGivingMethod: formData.preferredGivingMethod,
          titheParticipation: formData.titheParticipation,
          // Account
          firebaseUid: userCredential.user.uid,
          loginEmail: formData.loginEmail,
          role: 'member'
        };
        
        // Also register with backend API for additional member data
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(registrationData),
        });
        
        if (response.ok) {
          // Handle successful registration
          navigate('/dashboard');
        } else {
          // Handle backend errors
          const errorData = await response.json();
          
          // Rollback: delete Firebase user if backend registration fails
          if (createdFirebaseUid) {
            try {
              await fetch(`${process.env.REACT_APP_API_URL}/api/members/firebase/delete-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: createdFirebaseUid }),
              });
            } catch (deleteErr) {
              // Failed to delete Firebase user after backend failure
            }
          }
          // Show validation errors if any
          if (errorData.errors && Array.isArray(errorData.errors)) {
            const errorMessages = errorData.errors.map((err: any) => `${err.path}: ${err.msg}`).join(', ');
            setError(`Registration failed: ${errorMessages}`);
          } else {
            setError(errorData.message || 'Registration failed');
          }
        }
      } catch (error: any) {
        // If Firebase user was created but error happened after, try to delete
        if (createdFirebaseUid) {
          try {
            await fetch(`${process.env.REACT_APP_API_URL}/api/members/firebase/delete-user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uid: createdFirebaseUid }),
            });
          } catch (deleteErr) {
            // Failed to delete Firebase user after error
          }
        }
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const getDisplayStepNumber = (step: number): number => {
    // If step 4 (Dependants) should be skipped, adjust the display
    if (step >= 4 && !(formData.isHeadOfHousehold && formData.hasDependants)) {
      return step + 1;
    }
    return step;
  };

  const getTotalSteps = (): number => {
    return formData.isHeadOfHousehold && formData.hasDependants ? 7 : 6;
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <PersonalInfoStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />;
      case 2:
        return <ContactAddressStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />;
      case 3:
        return <FamilyInfoStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />;
      case 4:
        if (formData.isHeadOfHousehold && formData.hasDependants) {
          return <DependantsStep dependants={formData.dependants} onDependantsChange={(dependants: Dependant[]) => handleInputChange('dependants', dependants)} errors={errors} t={t} />;
        } else {
          // If not head of household or no dependants, skip to spiritual info
          return <SpiritualInfoStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />;
        }
      case 5:
        return <SpiritualInfoStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />;
      case 6:
        return <ContributionStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />;
      case 7:
        return <AccountStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />;
      default:
        return <div>Step {currentStep}</div>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
          {t('title')}
        </h2>
        
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {(() => {
              const totalSteps = getTotalSteps();
              const steps = [];
              for (let i = 1; i <= totalSteps; i++) {
                const displayStep = getDisplayStepNumber(i);
                const isActive = displayStep <= currentStep;
                steps.push(
                  <div key={i} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {displayStep}
                    </div>
                    {i < totalSteps && (
                      <div className={`w-16 h-1 mx-2 ${
                        isActive ? 'bg-blue-600' : 'bg-gray-300'
                      }`} />
                    )}
                  </div>
                );
              }
              return steps;
            })()}
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {renderStep()}
          
          <div className="flex justify-between pt-6">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => {
                  let prevStep = currentStep - 1;
                  
                  // If moving from step 5 to step 4, check if we should skip step 4
                  if (currentStep === 5 && !(formData.isHeadOfHousehold && formData.hasDependants)) {
                    prevStep = 3; // Skip step 4 (Dependants) and go to step 3 (Family)
                  }
                  
                  setCurrentStep(prevStep);
                }}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t('previous')}
              </button>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : (currentStep === 7 ? t('submit') : t('next'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MemberRegistration; 