import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from '../../contexts/LanguageContext';
import { normalizePhoneNumber, isValidPhoneNumber } from '../../utils/formatPhoneNumber';
// import { Transition } from '@headlessui/react'; // Removed due to React 19 compatibility
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
  
  // Track window width for responsive behavior
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isMobile = windowWidth < 768;
  
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
    
    // Handle hasDependents change - adjust current step if needed
    if (field === 'hasDependents') {
      // If user unchecks hasDependents and is currently on or past the dependants step
      if (!value && currentStep >= 4) {
        // If currently on dependants step (4), move to next step (spiritual info)
        if (currentStep === 4) {
          setCurrentStep(4); // This will now show spiritual info due to getStepContent logic
        }
        // Clear any dependants data since they won't be submitted
        setDependants([]);
      }
      // If user checks hasDependents and is currently past where dependants step should be
      else if (value && currentStep >= 4) {
        // Adjust current step to account for the newly included dependants step
        // No automatic navigation needed - user can navigate manually
      }
    }
    
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
      // Validate phone number format if provided
      if (formData.phoneNumber.trim() && !isValidPhoneNumber(formData.phoneNumber)) {
        newErrors.phoneNumber = t('phone.number.invalid');
      }
      if (!formData.streetLine1.trim()) newErrors.streetLine1 = t('address.required');
      if (!formData.city.trim()) newErrors.city = t('city.required');
      if (!formData.state.trim()) newErrors.state = t('state.required');
      if (!formData.postalCode.trim()) newErrors.postalCode = t('zip.code.required');
      if (!formData.country.trim()) newErrors.country = t('country.required');
      break;
        
      case 3: // Family Information
        if (formData.maritalStatus === 'Married') {
          // For married users, only spouse name is required
          if (!formData.spouseName.trim()) {
            newErrors.spouseName = t('spouse.name.required');
          }
        } else {
          // For non-married users, emergency contact info is required
          if (!formData.emergencyContactName.trim()) {
            newErrors.emergencyContactName = t('emergency.contact.required');
          }
          if (!formData.emergencyContactPhone.trim()) {
            newErrors.emergencyContactPhone = t('emergency.phone.required');
          }
        }
        break;
        
      // Steps 4-7 are optional or have minimal validation
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      const isPhoneSignIn = phone && !email;
      const baseTotalSteps = isPhoneSignIn ? 6 : 7;
      const maxStep = formData.hasDependents ? baseTotalSteps : baseTotalSteps - 1;
      
      let nextStepNumber = currentStep + 1;
      
      // Skip dependants step (4) if user doesn't have dependents
      if (!formData.hasDependents && nextStepNumber === 4) {
        nextStepNumber = 5;
      }
      
      if (nextStepNumber > maxStep) {
        // We've reached the end, submit the form
        handleSubmit();
      } else {
        setCurrentStep(nextStepNumber);
      }
    }
  };

  const prevStep = () => {
    let prevStepNumber = currentStep - 1;
    
    // Skip dependants step (4) if user doesn't have dependents when going backwards
    if (!formData.hasDependents && prevStepNumber === 4) {
      prevStepNumber = 3;
    }
    
    setCurrentStep(Math.max(prevStepNumber, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    
    setIsSubmitting(true);
    try {
      // Normalize phone numbers before submission
      const normalizedPhoneNumber = formData.phoneNumber ? normalizePhoneNumber(formData.phoneNumber) : '';
      const normalizedSpousePhone = formData.spousePhone ? normalizePhoneNumber(formData.spousePhone) : '';
      const normalizedEmergencyPhone = formData.emergencyContactPhone ? normalizePhoneNumber(formData.emergencyContactPhone) : '';
      
      // Normalize dependant phone numbers
      const normalizedDependants = dependants.map(dependant => ({
        ...dependant,
        phone: dependant.phone ? normalizePhoneNumber(dependant.phone) : ''
      }));
      
      // Prepare registration data with proper validation and normalized phone numbers
      const registrationData = {
        ...formData,
        // Normalize all phone number fields to E.164 format
        phoneNumber: normalizedPhoneNumber,
        spousePhone: normalizedSpousePhone,
        emergencyContactPhone: normalizedEmergencyPhone,
        dependants: normalizedDependants,

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
      
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/members/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationData),
      });
      
      if (res.status === 201) {
        // Registration successful - show success message and let auth flow handle navigation
        alert("Registration successful! You will be redirected to your dashboard.");
        
        // The Firebase auth state listener will automatically handle the navigation to dashboard
        // after it successfully fetches the user profile from backend (with retry logic)
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
  
  // Define step titles based on conditions
  const getStepTitles = () => {
    const titles = [
      t('personal.info'),
      t('contact.address'),
      t('family.info'),
    ];
    
    // Add dependents step if needed
    if (formData.hasDependents) {
      titles.push(t('dependants'));
    }
    
    // Add remaining steps
    titles.push(
      t('spiritual.info'),
      t('contribution.giving')
    );
    
    // Add account info step for non-phone sign-ins
    if (!isPhoneSignIn) {
      titles.push(t('account.info'));
    }
    
    return titles;
  };
  
  // Get current step titles and calculate total steps
  const stepTitles = getStepTitles();
  const totalSteps = stepTitles.length;
  
  // Navigation functions
  const handleNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const renderProgressSteps = () => (
    <div className="mb-8">
      {/* Desktop Progress Steps */}
      <div className="hidden md:block">
        <div className="flex justify-between mb-2">
          {stepTitles.map((title, index) => (
            <div key={index} className="text-center">
              <div
                className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep > index + 1
                    ? 'bg-green-100 text-green-600'
                    : currentStep === index + 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {currentStep > index + 1 ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <div className="mt-2 text-xs text-center text-gray-600">{title}</div>
            </div>
          ))}
        </div>
        <div className="relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2"></div>
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-blue-600 -translate-y-1/2 transition-all duration-300 ease-in-out"
            style={{
              width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
              maxWidth: '100%'
            }}
          ></div>
        </div>
      </div>

      {/* Mobile Progress Bar */}
      <div className="md:hidden mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium text-gray-700">
            {t('step')} {currentStep} {t('of')} {totalSteps}
          </div>
          <div className="text-sm font-medium text-blue-600">
            {stepTitles[currentStep - 1]}
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
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
          <SpiritualInfoStep
            formData={formData}
            handleInputChange={handleInputChange}
            errors={errors}
            t={t}
          />
        );
      case 5:
        return (
          <ContributionStep
            formData={formData}
            handleInputChange={handleInputChange}
            errors={errors}
            t={t}
          />
        );
      case 6:
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

  // Main render function
  return (
    <div className="min-h-screen bg-gray-50 pt-16 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {t('member.registration')}
          </h2>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600">
            {t('complete.registration.to.join')}
          </p>
        </div>

        {/* Progress Steps */}
        {renderProgressSteps()}

        {/* Step Content */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          {renderStepContent()}
          
          {errors.submit && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row justify-between space-y-3 sm:space-y-0 sm:space-x-4">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('previous')}
              </button>
            )}
            <button
              type="button"
              onClick={handleNextStep}
              className={`w-full sm:w-auto px-6 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {currentStep === totalSteps ? t('submitting') : t('next')}
                </span>
              ) : currentStep === totalSteps ? (
                t('submit')
              ) : (
                t('next')
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberRegistration; 