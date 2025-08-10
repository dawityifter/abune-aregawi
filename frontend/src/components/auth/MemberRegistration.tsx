import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from '../../contexts/LanguageContext';
import { normalizePhoneNumber, isValidPhoneNumber } from '../../utils/formatPhoneNumber';
import { useAuth } from '../../contexts/AuthContext';
import { Dependent } from '../../utils/relationshipTypes';
// import { Transition } from '@headlessui/react'; // Removed due to React 19 compatibility
import {
  PersonalInfoStep,
  ContactAddressStep,
  FamilyInfoStep,
  DependentsStep,
  SpiritualInfoStep,
  ContributionStep,
  AccountStep
} from './RegistrationSteps';



const MemberRegistration: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { currentUser, getUserProfile, clearNewUserCache } = useAuth();
  const { email, phone } = location.state || {};
  
  // State to track if we're still checking user status
  const [checkingUser, setCheckingUser] = useState(true);
  const [userStatus, setUserStatus] = useState<'new' | 'existing' | 'error'>('new');
  
  // Track window width for responsive behavior
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // Registration form state
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  
  const [formData, setFormData] = useState({
    // Personal Information
    firstName: '',
    middleName: '',
    lastName: '',
    gender: 'Male',
    maritalStatus: 'Single',
    isHeadOfHousehold: true,
    headOfHouseholdPhone: '',
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
    yearlyPledge: '',
    
    // Account Information
    preferredLanguage: 'English',
    communicationPreferences: [],
    privacySettings: {
      shareContactInfo: false,
      receiveNewsletter: true,
      receiveEventNotifications: true
    }
  });
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isMobile = windowWidth < 768;
  
  // Check if user exists when component mounts
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        setCheckingUser(true);
        
        // If we have a current user, check if they have a profile
        if (currentUser) {
          try {
            // Try to get the user profile
            const profile = await getUserProfile(
              currentUser.uid,
              currentUser.email || '',
              currentUser.phoneNumber || ''
            );
            
            if (profile) {
              // User has a profile, they are an existing user
              console.log('User profile found, redirecting to dashboard');
              setUserStatus('existing');
              navigate('/dashboard');
            } else {
              // No profile found, this is a new user
              console.log('No user profile found, showing registration form');
              setUserStatus('new');
            }
          } catch (error: any) {
            // If we get a 404, it means the user is new
            if (error.response?.status === 404) {
              console.log('User not found in backend, showing registration form');
              setUserStatus('new');
            } else {
              console.error('Error checking user profile:', error);
              setUserStatus('error');
            }
          }
        } else {
          // No current user, redirect to login
          console.log('No current user, redirecting to login');
          navigate('/login');
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        setUserStatus('error');
      } finally {
        setCheckingUser(false);
      }
    };
    
    checkUserStatus();
  }, [currentUser, navigate, getUserProfile]);
  
  // Loading and error are rendered conditionally in JSX below to keep hooks order consistent

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: typeof formData) => ({
      ...prev,
      [field]: value
    }));
    
    // Handle hasDependents change - adjust current step if needed
    if (field === 'hasDependents') {
          // If user unchecks hasDependents and is currently on or past the dependents step
    if (!value && currentStep >= 4) {
      // If currently on dependents step (4), move to next step (spiritual info)
      if (currentStep === 4) {
        setCurrentStep(4); // This will now show spiritual info due to getStepContent logic
      }
      // Clear any dependents data since they won't be submitted
      setDependents([]);
    }
    // If user checks hasDependents and is currently past where dependents step should be
    else if (value && currentStep >= 4) {
      // Adjust current step to account for the newly included dependents step
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

  // Validate head of household phone number
  const validateHeadOfHouseholdPhone = async (phoneNumber: string) => {
    if (!phoneNumber.trim()) return false;
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/validate-head-of-household/${encodeURIComponent(phoneNumber)}`);
      const data = await response.json();
      
      if (data.success) {
        return true;
      } else {
        setErrors((prev: any) => ({
          ...prev,
          headOfHouseholdPhone: data.message || t('head.of.household.phone.not.found')
        }));
        return false;
      }
    } catch (error) {
      console.error('Error validating head of household phone:', error);
      setErrors((prev: any) => ({
        ...prev,
        headOfHouseholdPhone: t('head.of.household.phone.validation.error')
      }));
      return false;
    }
  };

  const validateStep = async (step: number): Promise<boolean> => {
    const newErrors: any = {};
    
    console.log('🔍 validateStep called for step:', step);
    
    switch (step) {
      case 1: // Personal Information
        if (!formData.firstName.trim()) newErrors.firstName = t('first.name.required');
        if (!formData.lastName.trim()) newErrors.lastName = t('last.name.required');
        if (!formData.isHeadOfHousehold && !formData.headOfHouseholdPhone.trim()) {
          newErrors.headOfHouseholdPhone = t('head.of.household.phone.required');
        } else if (!formData.isHeadOfHousehold && formData.headOfHouseholdPhone.trim()) {
          // Validate head of household phone number
          const isValid = await validateHeadOfHouseholdPhone(formData.headOfHouseholdPhone);
          if (!isValid) {
            return false; // Error already set in validateHeadOfHouseholdPhone
          }
        }
        break;
        
      case 2: // Contact & Address
        console.log('🔍 Validating step 2 - Contact & Address');
        console.log('🔍 Email:', formData.email, 'Phone:', formData.phoneNumber);
        console.log('🔍 Address fields:', {
          streetLine1: formData.streetLine1,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country
        });
        
        // Email is optional for phone sign-in users, but required if no phone
        if (!formData.email.trim() && !formData.phoneNumber.trim()) {
          newErrors.email = t('email.or.phone.required');
          console.log('🔍 Email/phone validation failed');
        }
        if (!formData.phoneNumber.trim() && !formData.email.trim()) {
          newErrors.phoneNumber = t('email.or.phone.required');
          console.log('🔍 Phone/email validation failed');
        }
        // Validate phone number format if provided
        if (formData.phoneNumber.trim() && !isValidPhoneNumber(formData.phoneNumber)) {
          newErrors.phoneNumber = t('phone.number.invalid');
          console.log('🔍 Phone number format validation failed');
        }
        if (!formData.streetLine1.trim()) {
          newErrors.streetLine1 = t('address.required');
          console.log('🔍 Street address validation failed');
        }
        if (!formData.city.trim()) {
          newErrors.city = t('city.required');
          console.log('🔍 City validation failed');
        }
        if (!formData.state.trim()) {
          newErrors.state = t('state.required');
          console.log('🔍 State validation failed');
        }
        if (!formData.postalCode.trim()) {
          newErrors.postalCode = t('zip.code.required');
          console.log('🔍 Postal code validation failed');
        }
        if (!formData.country.trim()) {
          newErrors.country = t('country.required');
          console.log('🔍 Country validation failed');
        }
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
    console.log('🔍 Validation errors set:', newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = async () => {
    console.log('🔍 nextStep called for step:', currentStep);
    console.log('🔍 formData for step 2:', {
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      streetLine1: formData.streetLine1,
      city: formData.city,
      state: formData.state,
      postalCode: formData.postalCode,
      country: formData.country
    });
    
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      console.log('🔍 Validation failed for step:', currentStep);
      console.log('🔍 Current errors:', errors);
      return;
    }
    const nextStepNumber = currentStep + 1;
    if (nextStepNumber > totalSteps) {
      // We've reached the end, submit the form
      handleSubmit();
    } else {
      setCurrentStep(nextStepNumber);
    }
  };

  const prevStep = () => {
    const prevStepNumber = currentStep - 1;
    setCurrentStep(Math.max(prevStepNumber, 1));
  };

  const handleSubmit = async () => {
    const isValid = await validateStep(currentStep);
    if (!isValid) return;
    
    setIsSubmitting(true);
    try {
      // Normalize phone numbers before submission
      const normalizedPhoneNumber = formData.phoneNumber ? normalizePhoneNumber(formData.phoneNumber) : '';
      const normalizedSpousePhone = formData.spousePhone ? normalizePhoneNumber(formData.spousePhone) : '';
      const normalizedEmergencyPhone = formData.emergencyContactPhone ? normalizePhoneNumber(formData.emergencyContactPhone) : '';
      
      // Normalize and sanitize dependents data (phone and dates)
      const normalizedDependents = dependents.map((dependent) => {
        // Normalize phone
        const phone = dependent.phone ? normalizePhoneNumber(dependent.phone) : '';

        // Relationship guard for DOB: only for Son/Daughter
        const isChild = dependent.relationship === 'Son' || dependent.relationship === 'Daughter';

        // Coerce date strings into YYYY-MM-DD or null
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const cleanDate = (val?: string) => {
          const v = (val || '').trim();
          if (!v) return null;
          return dateRegex.test(v) ? v : null;
        };

        const dateOfBirth = isChild ? cleanDate(dependent.dateOfBirth) : null;
        const baptismDate = cleanDate(dependent.baptismDate);

        // Remove empty-string fields so backend doesn't get "" for optional fields
        const cleaned: any = {
          ...dependent,
          phone,
          // Dates handled explicitly
          dateOfBirth,
          baptismDate,
        };

        Object.keys(cleaned).forEach((k) => {
          const val = cleaned[k as keyof typeof cleaned] as any;
          if (val === '') {
            delete cleaned[k];
          }
        });

        return cleaned;
      });
      
      // Normalize head of household phone number
      const normalizedHeadOfHouseholdPhone = formData.headOfHouseholdPhone ? normalizePhoneNumber(formData.headOfHouseholdPhone) : '';
      
      // Prepare registration data with proper validation and normalized phone numbers
      const registrationData: any = {
        ...formData,
        // Add Firebase UID which is required by backend
        firebaseUid: currentUser?.uid,
        // Normalize all phone number fields to E.164 format
        phoneNumber: normalizedPhoneNumber,
        spousePhone: normalizedSpousePhone,
        emergencyContactPhone: normalizedEmergencyPhone,
        headOfHouseholdPhone: normalizedHeadOfHouseholdPhone,
        dependents: normalizedDependents,

        // For phone sign-in users, loginEmail should be optional
        loginEmail: email || formData.email || undefined,
        // Convert language preference to backend format
        languagePreference: formData.languagePreference === 'English' ? 'en' : 'ti',
        // Convert gender to lowercase to match backend validation
        gender: formData.gender?.toLowerCase(),
        // Convert marital status to lowercase to match backend validation
        maritalStatus: formData.maritalStatus?.toLowerCase(),
        // Convert preferred giving method to lowercase to match backend validation
        preferredGivingMethod: formData.preferredGivingMethod?.toLowerCase(),
        // Ensure interestedInServing matches backend enum ('yes','no','maybe')
        interestedInServing: typeof formData.interestedInServing === 'string' 
          ? formData.interestedInServing.toLowerCase() 
          : undefined
      };

      // Ensure yearlyPledge is sent as a number when provided
      if (formData.yearlyPledge !== '' && formData.yearlyPledge !== null && formData.yearlyPledge !== undefined) {
        registrationData.yearlyPledge = Number(formData.yearlyPledge);
      }
      
      // Remove undefined/null/empty string values to let backend use defaults
      Object.keys(registrationData).forEach(key => {
        const value = (registrationData as any)[key];
        if (value === undefined || value === null || value === '') {
          delete (registrationData as any)[key];
        }
      });
      
      console.log('🔍 Sending registration data to backend:', registrationData);
      
      let res;
      try {
        res = await fetch(`${process.env.REACT_APP_API_URL}/api/members/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(registrationData),
        });
      } catch (fetchError) {
        console.error('🔴 Fetch error during registration:', fetchError);
        setErrors({ submit: 'Failed to connect to the server. Please check your internet connection and try again.' });
        return;
      }
      
      // Parse the response data
      let responseData;
      try {
        responseData = await res.json();
        console.log('🔍 Registration response status:', res.status);
        console.log('🔍 Registration response data:', responseData);
      } catch (parseError) {
        console.error('🔴 Error parsing response:', parseError);
        setErrors({ submit: 'Error processing server response. Please try again.' });
        return;
      }
      
      if (res.status === 201) {
        // Registration successful - show success message and navigate to dashboard
        alert("Registration successful! You will be redirected to your dashboard.");
        
        // Clear the new user cache to force a fresh profile check
        clearNewUserCache();
        
        // Force a re-check of the auth state by triggering the auth state listener
        // This will update the user state from temporary to permanent
        try {
          // Trigger a profile check to update the user state
          const profileResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${currentUser?.uid}?email=${encodeURIComponent(currentUser?.email || '')}&phone=${encodeURIComponent(phone || '')}`);
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            console.log('✅ Profile fetched after registration:', profileData);
            
            // Force a re-check of the auth state to ensure the user is properly authenticated
            // This is important for new users to get their profile data
            window.location.reload();
          } else {
            console.log('⚠️ Profile fetch failed after registration, navigating anyway');
            navigate('/dashboard');
          }
        } catch (error) {
          console.error('Error fetching profile after registration:', error);
          // Navigate to dashboard even if profile fetch fails
          navigate('/dashboard');
        }
      } else {
        console.log('🔍 Backend registration error:', responseData);
        console.log('🔍 Backend error status:', res.status);
        console.log('🔍 Backend validation errors:', responseData.errors);
        
        // Format and display validation errors to the user
        if (responseData.errors && Array.isArray(responseData.errors)) {
          // Combine all validation error messages
          const errorMessages = responseData.errors.map((err: any) => {
            if (typeof err === 'string') return err;
            if (err.msg) return err.msg;
            if (err.message) return err.message;
            return JSON.stringify(err);
          }).join('\n');
          
          setErrors({ 
            submit: `Please fix the following errors:\n${errorMessages}` 
          });
        } else if (responseData.message) {
          setErrors({ submit: responseData.message });
        } else {
          setErrors({ submit: 'Registration failed. Please check your information and try again.' });
        }
      }
    } catch (err) {
      setErrors({ submit: "Registration failed: " + (err as any).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Note: redirect logic handled within checkUserStatus effect to avoid conditional hook ordering issues

  const renderStep = () => {
    // Calculate the actual step based on whether dependents should be shown
    const actualStep = formData.hasDependents ? currentStep : 
      (currentStep >= 4 ? currentStep + 1 : currentStep);
    
    switch (actualStep) {
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
      case 7:
        return (
          <DependentsStep
            dependents={dependents}
            onDependentsChange={setDependents}
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

  // Build dynamic step configuration
  const stepConfig = useMemo(() => {
    const steps: Array<{ key: string; titleKey: string; render: () => React.ReactNode }> = [
      { key: 'personal', titleKey: 'personal.info', render: () => (
        <PersonalInfoStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />) },
      { key: 'contact', titleKey: 'contact.address', render: () => (
        <ContactAddressStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />) },
      { key: 'family', titleKey: 'family.info', render: () => (
        <FamilyInfoStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />) },
      { key: 'spiritual', titleKey: 'spiritual.info', render: () => (
        <SpiritualInfoStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />) },
      { key: 'contribution', titleKey: 'contribution.giving', render: () => (
        <ContributionStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />) },
    ];
    if (!isPhoneSignIn) {
      steps.push({ key: 'account', titleKey: 'account.info', render: () => (
        <AccountStep formData={formData} handleInputChange={handleInputChange} errors={errors} t={t} />) });
    }
    if (formData.hasDependents) {
      steps.push({ key: 'dependents', titleKey: 'dependents', render: () => (
        <DependentsStep dependents={dependents} onDependentsChange={setDependents} errors={errors} t={t} />) });
    }
    return steps;
  }, [formData, errors, t, dependents, isPhoneSignIn]);

  // Derive titles and total steps
  const stepTitles = stepConfig.map(s => t(s.titleKey));
  const totalSteps = stepConfig.length;
  
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
    const idx = Math.max(0, Math.min(currentStep - 1, stepConfig.length - 1));
    return stepConfig[idx]?.render() ?? null;
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
              onClick={nextStep}
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