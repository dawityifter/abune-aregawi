import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAuth, signInWithEmailAndPassword, signInWithPhoneNumber, RecaptchaVerifier, User, signOut, onAuthStateChanged, updateProfile, Auth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { normalizePhoneNumber } from "../utils/formatPhoneNumber";

interface AuthContextType {
  user: any;
  currentUser: any; // Alias for user for backward compatibility
  firebaseUser: User | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithPhone: (phone: string, appVerifier: any, otp?: string, confirmationResult?: any) => Promise<any>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: any) => Promise<void>;
  getUserProfile: (uid: string, email?: string, phoneNumber?: string) => Promise<any>;
  updateUserProfileData: (uid: string, updates: any) => Promise<void>;
  clearError: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const auth = getAuth();

  // Utility function to reliably extract phone number from Firebase user
  const getPhoneNumber = (firebaseUser: User): string | null => {
    // First try the main phoneNumber property
    if (firebaseUser.phoneNumber) {
      console.log('📞 Found phone number in main property:', firebaseUser.phoneNumber);
      return firebaseUser.phoneNumber;
    }
    
    // Fallback: try to get phone from provider data
    if (firebaseUser.providerData) {
      const phoneProvider = firebaseUser.providerData.find(provider => 
        provider.providerId === 'phone' && provider.phoneNumber
      );
      if (phoneProvider) {
        console.log('📞 Found phone number in provider data:', phoneProvider.phoneNumber);
        return phoneProvider.phoneNumber;
      }
    }
    
    console.log('⚠️ No phone number found in Firebase user data');
    return null;
  };

  // Check user profile in backend
  const checkUserProfile = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setUser(null);
      return null;
    }

    const uid = firebaseUser.uid;
    const email = firebaseUser.email;
    const phone = getPhoneNumber(firebaseUser);
    
    console.log('🔍 checkUserProfile - Firebase user data:', {
      uid,
      email,
      phone,
      phoneType: typeof phone,
      phoneExists: !!phone
    });
    
    try {
      // Check if user exists in backend
      const params = new URLSearchParams();
      if (email) {
        params.append("email", email);
        console.log('✅ Added email parameter:', email);
      }
      
      if (phone) {
        const normalizedPhone = normalizePhoneNumber(phone);
        if (normalizedPhone) {
          params.append("phone", normalizedPhone);
          console.log('✅ Added phone parameter:', normalizedPhone);
        } else {
          console.log('⚠️ Phone normalization failed for:', phone);
        }
      } else {
        console.log('⚠️ No phone number available from Firebase user');
      }
      
      if (params.toString() === '') {
        console.log('❌ No email or phone available for backend lookup');
        return null;
      }
      
      const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?${params.toString()}`;
      console.log('🔍 Backend API call:', apiUrl);
      const res = await fetch(apiUrl);
      
      if (res.status === 200) {
        const profile = await res.json();
        console.log('✅ User profile found in backend');
        return profile;
      } else {
        console.error('❌ Failed to fetch user profile:', res.status);
        return null;
      }
    } catch (error: any) {
      console.error('❌ Error checking backend:', error);
      return null;
    }
  }, [normalizePhoneNumber]);

  // Email sign-in
  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await handlePostSignIn(cred.user);
    } catch (err) {
      setLoading(false);
      throw err; // Re-throw error to be handled by calling component
    }
    setLoading(false);
  };

  // Phone sign-in with OTP verification
  const loginWithPhone = useCallback(async (phone: string, appVerifier: any, otp?: string, confirmationResult?: any) => {
    setLoading(true);
    setError(null);
    
    try {
      if (confirmationResult && otp) {
        // Second step: verify OTP
        console.log('Verifying OTP...');
        const result = await confirmationResult.confirm(otp);
        const user = result.user;
        
        // Get the ID token
        const idToken = await user.getIdToken();
        
        // Immediately set the user in state to prevent login page flash
        setFirebaseUser(user);
        
        // Check if user exists in our system
        const profile = await checkUserProfile(user);
        
        if (profile) {
          // User exists, navigate to dashboard
          setUser(profile);
          navigate('/dashboard');
        } else {
          // New user, navigate to registration
          navigate('/register');
        }
        
        return { user, idToken };
      } else {
        // First step: send OTP
        console.log('Sending OTP to:', phone);
        const result = await signInWithPhoneNumber(auth, phone, appVerifier);
        return result; // Return confirmation result for OTP entry
      }
    } catch (error: any) {
      console.error('Phone login error:', error);
      
      // Handle specific error types
      if (error.code === 'auth/invalid-phone-number') {
        setError('The phone number is not valid.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else if (error.code === 'auth/code-expired') {
        setError('The verification code has expired. Please request a new one.');
      } else if (error.code === 'auth/invalid-verification-code') {
        setError('The verification code is invalid. Please try again.');
      } else {
        setError(error.message || 'An error occurred during phone authentication.');
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [auth, checkUserProfile, navigate]);

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Update user profile
  const updateUserProfile = async (updates: any) => {
    try {
      const authUser = auth.currentUser;
      if (authUser) {
        // Use the imported updateProfile function from Firebase Auth
        await updateProfile(authUser, updates);
        setUser({ ...user, ...updates });
      }
    } catch (err) {
      console.error('Error updating user profile:', err);
      throw err;
    }
  };

  // Get user profile from backend
  const getUserProfile = async (uid: string, email?: string, phoneNumber?: string) => {
    try {
      const params = new URLSearchParams();
      if (email) params.append("email", email);
      if (phoneNumber) {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        if (normalizedPhone) params.append("phone", normalizedPhone);
      }
      
      const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?${params.toString()}`;
      const res = await fetch(apiUrl);
      
      if (res.status === 200) {
        return await res.json();
      } else {
        console.error('Failed to fetch user profile:', res.status);
        return null;
      }
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Update user profile data in backend
  const updateUserProfileData = async (uid: string, updates: any) => {
    try {
      const params = new URLSearchParams();
      if (user?.email) params.append("email", user.email);
      if (user?.phoneNumber) {
        const normalizedPhone = normalizePhoneNumber(user.phoneNumber);
        if (normalizedPhone) params.append("phone", normalizedPhone);
      }
      
      const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?${params.toString()}`;
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });
      
      if (res.status === 200) {
        const updatedProfile = await res.json();
        setUser({ ...user, ...updatedProfile });
        return updatedProfile;
      } else {
        console.error('Failed to update user profile:', res.status);
        throw new Error('Failed to update profile');
      }
    } catch (error: any) {
      console.error('Error updating user profile data:', error);
      throw error;
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // After Firebase sign-in, check backend
  const handlePostSignIn = async (firebaseUser: User) => {
    const uid = firebaseUser.uid;
    const email = firebaseUser.email;
    const phone = getPhoneNumber(firebaseUser);
    console.log('handlePostSignIn called:', { uid, email, phone });
    
    // Immediately set a basic user object to trigger auth state
    const tempUser = {
      uid,
      email,
      phoneNumber: phone,
      role: 'member',
      _temp: true, // Mark as temporary until we fetch full profile
      // Add empty data structure to prevent undefined errors in components
      data: {
        member: {
          id: uid,
          firstName: 'Loading...',
          lastName: '',
          role: 'member',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          registrationStatus: 'pending'
        }
      }
    };
    
    // Update user state immediately for instant redirect
    setUser(tempUser);
    
    // Navigate to dashboard immediately for better UX
    console.log('Fast-tracking to dashboard...');
    navigate("/dashboard");
    
    // Fetch user profile in the background
    const fetchUserProfile = async () => {
      try {
        const params = new URLSearchParams();
        if (email) params.append("email", email);
        if (phone) {
          const normalizedPhone = normalizePhoneNumber(phone);
          if (normalizedPhone) params.append("phone", normalizedPhone);
        }
        
        const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?${params.toString()}`;
        console.log('Fetching user profile in background:', apiUrl);
        
        const res = await fetch(apiUrl);
        
        if (res.status === 200) {
          const memberData = await res.json();
          console.log('User profile updated:', memberData);
          
          // Update user with full profile data
          setUser({
            ...memberData,
            uid,
            email,
            phoneNumber: phone,
            _temp: false
          });
          
          // If user is not fully registered, redirect to registration
          if (memberData?.data?.member?.registrationStatus !== 'complete') {
            console.log('User not fully registered, redirecting to registration');
            navigate("/register");
          }
        } else {
          console.log('User not found in backend, redirecting to registration');
          navigate("/register");
        }
      } catch (err) {
        console.error('Background profile fetch error:', err);
        // Keep the temporary user even if profile fetch fails
      }
    };
    
    // Start fetching profile in the background
    fetchUserProfile();
  };

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔥 Firebase auth state changed:', firebaseUser ? 'User signed in' : 'User signed out');
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        const phoneNumber = getPhoneNumber(firebaseUser);
        
        console.log('🔍 onAuthStateChanged - Firebase user data:', {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          phoneNumber: phoneNumber,
          phoneType: typeof phoneNumber,
          phoneExists: !!phoneNumber,
          providerData: firebaseUser.providerData?.map(p => p.providerId)
        });
        
        // Immediately set a temporary user for instant navigation
        const tempUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          phoneNumber: phoneNumber,
          _temp: true
        };
        setUser(tempUser);
        
        // Check user profile in the background with retry mechanism
        const checkProfileWithRetry = async (retryCount = 0) => {
          try {
            const profile = await checkUserProfile(firebaseUser);
            if (profile) {
              console.log('✅ User profile loaded, updating state');
              setUser(profile);
            } else {
              console.log('❌ User profile not found, keeping temp user');
            }
          } catch (error) {
            console.error('Error checking user profile:', error);
            // Keep the temp user even if profile check fails
          }
        };
        
        // Try immediately, then retry after a short delay if phone number is missing
        checkProfileWithRetry();
        
        // If phone number is missing, retry after a delay to allow Firebase to load data
        if (!phoneNumber) {
          console.log('⏳ Phone number missing, retrying after delay...');
          setTimeout(() => {
            checkProfileWithRetry(1);
          }, 1000);
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [auth, checkUserProfile]);

  // Provide auth context
  const value = {
    user,
    currentUser: user, // Alias for backward compatibility
    firebaseUser,
    loading,
    loginWithEmail,
    loginWithPhone,
    logout,
    updateUserProfile,
    getUserProfile,
    updateUserProfileData,
    clearError,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 