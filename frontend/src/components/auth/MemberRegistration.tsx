import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  PersonalInfoStep,
  ContactAddressStep,
  FamilyInfoStep,
  SpiritualInfoStep,
  ContributionStep,
  AccountStep
} from './RegistrationSteps';

interface RegistrationForm {
  // Personal Information
  firstName: string;
  middleName: string;
  lastName: string;
  gender: 'Male' | 'Female';
  dateOfBirth: string;
  maritalStatus: string;
  
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

const translations = {
  en: {
    title: 'Member Registration',
    personalInfo: 'Personal Information',
    contactAddress: 'Contact & Address',
    familyInfo: 'Family Information',
    spiritualInfo: 'Spiritual Information',
    contributionInfo: 'Contribution Information',
    accountInfo: 'Account Information',
    submit: 'Submit Registration',
    next: 'Next',
    previous: 'Previous',
    required: 'Required',
    optional: 'Optional'
  },
  ti: {
    title: 'ደምድም ምዝገባ',
    personalInfo: 'ውልቃዊ ሓፈሻዊ',
    contactAddress: 'ኣድራሻ እንተሃልዩ',
    familyInfo: 'ስድራቤት ሓፈሻዊ',
    spiritualInfo: 'መንፈሳዊ ሓፈሻዊ',
    contributionInfo: 'ወፈራ ሓፈሻዊ',
    accountInfo: 'ኣካውንት ሓፈሻዊ',
    submit: 'ምዝገባ ስደድ',
    next: 'ቀጺሉ',
    previous: 'ቅድሚ',
    required: 'የድለ',
    optional: 'ኣማራጺ'
  }
};

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
  const { language } = useLanguage();
  const t = translations[language];
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationForm>({
    firstName: '',
    middleName: '',
    lastName: '',
    gender: 'Male',
    dateOfBirth: '',
    maritalStatus: 'Single',
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
        if (!formData.firstName) newErrors.firstName = 'First name is required';
        if (!formData.lastName) newErrors.lastName = 'Last name is required';
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
        break;
      
      case 2: // Contact & Address
        if (!formData.phoneNumber) newErrors.phoneNumber = 'Phone number is required';
        if (!formData.email) newErrors.email = 'Email is required';
        if (!formData.streetLine1) newErrors.streetLine1 = 'Street line 1 is required';
        if (!formData.city) newErrors.city = 'City is required';
        if (!formData.state) newErrors.state = 'State is required';
        if (!formData.postalCode) newErrors.postalCode = 'Postal code is required';
        if (!formData.country) newErrors.country = 'Country is required';
        break;
      
      case 3: // Family Information - No required fields for this step
        break;
      
      case 4: // Spiritual Information - No required fields for this step
        break;
      
      case 5: // Contribution - No required fields for this step
        break;
      
      case 6: // Account Information
        if (!formData.loginEmail) newErrors.loginEmail = 'Login email is required';
        if (!formData.password) newErrors.password = 'Password is required for Firebase authentication';
        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
        if (formData.password && formData.password.length < 8) {
          newErrors.password = 'Password must be at least 8 characters long';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(currentStep)) return;
    
    if (currentStep < 6) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Submit the form
      try {
        setLoading(true);
        
        // Create Firebase Auth account first
        const displayName = `${formData.firstName} ${formData.lastName}`;
        const userCredential = await signUp(formData.loginEmail, formData.password, displayName);
        
        // Prepare registration data with Firebase UID
        const registrationData = {
          // Personal Information
          firstName: formData.firstName,
          middleName: formData.middleName,
          lastName: formData.lastName,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth,
          maritalStatus: formData.maritalStatus,
          
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
        const response = await fetch('/api/members/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(registrationData),
        });
        
        if (response.ok) {
          // Handle successful registration
          console.log('Registration successful');
          navigate('/dashboard');
        } else {
          // Handle backend errors
          const errorData = await response.json();
          console.error('Backend registration failed:', errorData);
          
          // Show validation errors if any
          if (errorData.errors && Array.isArray(errorData.errors)) {
            const errorMessages = errorData.errors.map((err: any) => `${err.path}: ${err.msg}`).join(', ');
            setError(`Registration failed: ${errorMessages}`);
          } else {
            setError(errorData.message || 'Registration failed');
          }
        }
      } catch (error: any) {
        console.error('Registration error:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }
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
        return <SpiritualInfoStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />;
      case 5:
        return <ContributionStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />;
      case 6:
        return <AccountStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />;
      default:
        return <div>Step {currentStep}</div>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
          {t.title}
        </h2>
        
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {step}
                </div>
                {step < 6 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
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
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                {t.previous}
              </button>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : (currentStep === 6 ? t.submit : t.next)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MemberRegistration; 