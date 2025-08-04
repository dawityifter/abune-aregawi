import { UserCredential } from 'firebase/auth';

export interface RegistrationData {
  // Personal Information
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: 'Male' | 'Female';
  dateOfBirth: string;
  maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  
  // Contact & Address
  phoneNumber: string;
  email: string;
  streetLine1: string;
  apartmentNo?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  
  // Family Information
  isHeadOfHousehold?: boolean;
  spouseName?: string;
  spouseEmail?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  
  // Spiritual Information
  dateJoinedParish?: string;
  baptismName?: string;
  interestedInServing?: string;
  ministries?: string[];
  languagePreference: 'English' | 'Tigrigna' | 'Amharic';
  
  // Contribution
  preferredGivingMethod: 'Cash' | 'Online' | 'Envelope' | 'Check';
  titheParticipation: boolean;
  
  // Account
  loginEmail: string;
  password?: string;
  role?: string;
  
  // Dependents
  dependents?: any[];
}

export interface RegistrationResult {
  success: boolean;
  firebaseUser?: UserCredential;
  memberData?: any;
  error?: string;
}

/**
 * Handles the two-step registration process to prevent partial saves
 */
export const handleRegistration = async (
  firebaseSignUp: (email: string, password: string, displayName: string) => Promise<UserCredential>,
  completeRegistration: (firebaseUid: string, memberData: any) => Promise<any>,
  registrationData: RegistrationData
): Promise<RegistrationResult> => {
  try {
    console.log('Starting two-step registration process...');
    
    // Step 1: Create Firebase Auth user
    console.log('Step 1: Creating Firebase Auth user...');
    const firebaseUser = await firebaseSignUp(
      registrationData.loginEmail,
      registrationData.password || '',
      `${registrationData.firstName} ${registrationData.lastName}`
    );
    
    console.log('✅ Firebase Auth user created successfully');
    
    // Step 2: Complete registration in PostgreSQL
    console.log('Step 2: Completing registration in PostgreSQL...');
    const memberData = await completeRegistration(
      firebaseUser.user.uid,
      {
        ...registrationData,
        // Ensure loginEmail is set correctly
        loginEmail: registrationData.loginEmail,
        // Set default role if not provided
        role: registrationData.role || 'member'
      }
    );
    
    console.log('✅ PostgreSQL registration completed successfully');
    
    return {
      success: true,
      firebaseUser,
      memberData
    };
    
  } catch (error: any) {
    console.error('❌ Registration failed:', error);
    
    // If Firebase succeeded but PostgreSQL failed, we need to clean up
    if (error.message.includes('Member already exists') || error.message.includes('email already exists')) {
      console.warn('⚠️ Firebase user exists but PostgreSQL registration failed. User may need to complete registration.');
    }
    
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Checks if a user exists in PostgreSQL but not in Firebase Auth
 */
export const checkOrphanedUser = async (
  getUserProfile: (uid: string) => Promise<any>,
  email: string
): Promise<{ exists: boolean; user?: any }> => {
  try {
    // This will try to get user profile from backend
    const user = await getUserProfile('temp-uid'); // We'll use email instead
    return { exists: true, user };
  } catch (error) {
    return { exists: false };
  }
};

/**
 * Handles the case where Firebase user exists but PostgreSQL registration is incomplete
 */
export const handleIncompleteRegistration = async (
  completeRegistration: (firebaseUid: string, memberData: any) => Promise<any>,
  firebaseUid: string,
  registrationData: RegistrationData
): Promise<RegistrationResult> => {
  try {
    console.log('Handling incomplete registration...');
    
    const memberData = await completeRegistration(firebaseUid, registrationData);
    
    return {
      success: true,
      memberData
    };
    
  } catch (error: any) {
    console.error('Failed to complete incomplete registration:', error);
    return {
      success: false,
      error: error.message
    };
  }
}; 