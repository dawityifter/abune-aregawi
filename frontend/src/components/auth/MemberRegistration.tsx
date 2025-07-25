import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from '../../contexts/LanguageContext';
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
}

const MemberRegistration: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { email, phone } = location.state || {};
  
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dependants, setDependants] = useState<Dependant[]>([]);
  
  const [formData, setFormData] = useState({
    // Personal Information
    firstName: '',
    middleName: '',
    lastName: '',
    gender: 'Male',
    dateOfBirth: '',
    maritalStatus: 'Single',
    isHeadOfHousehold: true,
    headOfHouseholdEmail: '',
    hasDependents: false,
    
    // Contact & Address
    email: email || '',
    phoneNumber: phone || '',
    streetLine1: '',
    apartmentNo: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    
    // Family Information
    spouseName: '',
    spousePhone: '',
    spouseEmail: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    
    // Spiritual Information
    baptismName: '',
    isBaptized: false,
    baptismDate: '',
    baptismPlace: '',
    confirmationDate: '',
    confirmationPlace: '',
    dateJoinedParish: '',
    interestedInServing: '',
    languagePreference: 'English',
    
    // Contribution & Giving
    preferredGivingMethod: 'Cash',
    monthlyContribution: '',
    specialContributions: [],
    titheParticipation: false,
    
    // Account Information
    preferredLanguage: 'English',
    communicationPreferences: [],
    privacySettings: {
      shareContactInfo: false,
      receiveNewsletter: true,
      receiveEventNotifications: true
    }
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: typeof formData) => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev: any) => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: any = {};
    
    switch (step) {
      case 1: // Personal Information
        if (!formData.firstName.trim()) newErrors.firstName = t('first.name.required');
        if (!formData.lastName.trim()) newErrors.lastName = t('last.name.required');
        if (!formData.dateOfBirth) newErrors.dateOfBirth = t('date.of.birth.required');
        if (!formData.isHeadOfHousehold && !formData.headOfHouseholdEmail.trim()) {
          newErrors.headOfHouseholdEmail = t('head.of.household.email.required');
        }
        break;
        
      case 2: // Contact & Address
        // Email is optional for phone sign-in users, but required if no phone
        if (!formData.email.trim() && !formData.phoneNumber.trim()) {
          newErrors.email = t('email.or.phone.required');
        }
        if (!formData.phoneNumber.trim() && !formData.email.trim()) {
          newErrors.phoneNumber = t('email.or.phone.required');
        }
        if (!formData.streetLine1.trim()) newErrors.streetLine1 = t('address.required');
        if (!formData.city.trim()) newErrors.city = t('city.required');
        if (!formData.state.trim()) newErrors.state = t('state.required');
        if (!formData.postalCode.trim()) newErrors.postalCode = t('zip.code.required');
        if (!formData.country.trim()) newErrors.country = t('country.required');
        break;
        
      case 3: // Family Information
        if (formData.maritalStatus === 'Married' && !formData.spouseName.trim()) {
          newErrors.spouseName = t('spouse.name.required');
        }
        if (!formData.emergencyContactName.trim()) newErrors.emergencyContactName = t('emergency.contact.required');
        if (!formData.emergencyContactPhone.trim()) newErrors.emergencyContactPhone = t('emergency.phone.required');
        break;
        
      // Steps 4-7 are optional or have minimal validation
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      // Skip step 7 (Account Information) for phone sign-in users
      const isPhoneSignIn = phone && !email;
      const maxStep = isPhoneSignIn ? 6 : 7;
      
      if (currentStep === 6 && isPhoneSignIn) {
        // Phone sign-in users go directly to submission after step 6
        handleSubmit();
      } else {
        setCurrentStep(prev => Math.min(prev + 1, maxStep));
      }
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setIsSubmitting(true);
    try {
      // Prepare registration data with proper validation
      const registrationData = {
        ...formData,
        dependants: dependants,
        // Ensure baptismDate is either a valid date or null/undefined
        baptismDate: formData.baptismDate || undefined,
        // For phone sign-in users, loginEmail should be optional
        loginEmail: email || formData.email || undefined,
        // Ensure titheParticipation is boolean
        titheParticipation: Boolean(formData.titheParticipation),
        // Ensure languagePreference has a valid default
        languagePreference: formData.languagePreference || 'English'
      };
      
      // Remove undefined/null/empty string values to let backend use defaults
      Object.keys(registrationData).forEach(key => {
        const value = (registrationData as any)[key];
        if (value === undefined || value === null || value === '') {
          delete (registrationData as any)[key];
        }
      });
      
      const res = await fetch("/api/members/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationData),
      });
      
      if (res.status === 201) {
        navigate("/dashboard");
      } else {
        const data = await res.json();
        setErrors({ submit: data.message || "Registration failed" });
      }
    } catch (err) {
      setErrors({ submit: "Registration failed: " + (err as any).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!email && !phone) {
    navigate("/login");
    return null;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <PersonalInfoStep
            formData={formData}
            handleInputChange={handleInputChange}
            errors={errors}
            t={t}
          />
        );
      case 2:
        return (
          <ContactAddressStep
            formData={formData}
            handleInputChange={handleInputChange}
            errors={errors}
            t={t}
          />
        );
      case 3:
        return (
          <FamilyInfoStep
            formData={formData}
            handleInputChange={handleInputChange}
            errors={errors}
            t={t}
          />
        );
      case 4:
        return (
          <DependantsStep
            dependants={dependants}
            onDependantsChange={setDependants}
            errors={errors}
            t={t}
          />
        );
      case 5:
        return (
          <SpiritualInfoStep
            formData={formData}
            handleInputChange={handleInputChange}
            errors={errors}
            t={t}
          />
        );
      case 6:
        return (
          <ContributionStep
            formData={formData}
            handleInputChange={handleInputChange}
            errors={errors}
            t={t}
          />
        );
      case 7:
        return (
          <AccountStep
            formData={formData}
            handleInputChange={handleInputChange}
            errors={errors}
            t={t}
          />
        );
      default:
        return null;
    }
  };

  // Determine if this is a phone sign-in user
  const isPhoneSignIn = phone && !email;
  const totalSteps = isPhoneSignIn ? 6 : 7;
  
  const stepTitles = [
    t('personal.information'),
    t('contact.address'),
    t('family.information'),
    t('dependants'),
    t('spiritual.information'),
    t('contribution.giving'),
    ...(isPhoneSignIn ? [] : [t('account.information')])
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('member.registration')}</h1>
          <p className="mt-2 text-gray-600">{t('complete.registration.to.join')}</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {stepTitles.map((title, index) => (
              <div
                key={index}
                className={`flex items-center ${
                  index < stepTitles.length - 1 ? 'flex-1' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep > index + 1
                      ? 'bg-green-500 text-white'
                      : currentStep === index + 1
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {currentStep > index + 1 ? '✓' : index + 1}
                </div>
                {index < stepTitles.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > index + 1 ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <span className="text-sm font-medium text-gray-900">
              {t('step')} {currentStep} {t('of')} {totalSteps}: {stepTitles[currentStep - 1]}
            </span>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          {renderStep()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('previous')}
          </button>
          
          <div className="flex space-x-4">
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {t('next')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t('submitting') : t('complete.registration')}
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {errors.submit && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600">{errors.submit}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberRegistration; 