import React, { createContext, useContext, useState, useEffect } from "react";
import { getAuth, signInWithEmailAndPassword, signInWithPhoneNumber, RecaptchaVerifier, User, signOut, onAuthStateChanged, updateProfile } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { normalizePhoneNumber } from "../utils/formatPhoneNumber";

const AuthContext = createContext<any>(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();

  // Listen for Firebase auth state changes
  useEffect(() => {
    let callCount = 0;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      callCount++;
      console.log(`🔥 Firebase auth state changed (call #${callCount}):`, firebaseUser);
      
      // Set the Firebase user state
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        // User is signed in with Firebase
        const uid = firebaseUser.uid;
        const email = firebaseUser.email;
        const phone = firebaseUser.phoneNumber;
        
        try {
          // Debug Firebase user data
          console.log(`🔍 Firebase user data (call #${callCount}):`, {
            uid,
            email,
            phone,
            emailVerified: firebaseUser.emailVerified,
            providerData: firebaseUser.providerData
          });
          
          // Detailed phone debugging
          if (phone) {
            console.log(`📞 Call #${callCount} - Phone found:`, phone, 'Type:', typeof phone);
          } else {
            console.log(`⚠️ Call #${callCount} - No phone number in Firebase user`);
          }
          
          // Check if user exists in backend
          const params = new URLSearchParams();
          if (email) {
            params.append("email", email);
            console.log('📧 Added email to params:', email);
          }
          if (phone) {
            // Normalize phone number before sending to backend
            const normalizedPhone = normalizePhoneNumber(phone);
            if (normalizedPhone) {
              params.append("phone", normalizedPhone);
              console.log('📞 Auth state change - normalized phone:', phone, '->', normalizedPhone);
            } else {
              console.log('⚠️ Phone normalization failed for:', phone);
            }
          }
          
          // Check if we have any parameters
          if (params.toString() === '') {
            console.log('⚠️ No email or phone available for backend lookup');
            console.log('⚠️ Firebase user might be incomplete or using a different auth method');
            // Only navigate to register if we're not already there
            const currentPath = window.location.pathname;
            if (currentPath === '/register') {
              console.log('⚠️ Already on registration page, not redirecting');
              return;
            }
            // If we're on the home page, stay there
            if (currentPath === '/') {
              console.log('⚠️ On home page, not redirecting to register');
              return;
            }
            // For any other page, redirect to home instead of register
            console.log('⚠️ Redirecting to home instead of register');
            navigate("/");
            return;
          }
          
          const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?${params.toString()}`;
          console.log(`🔍 Call #${callCount} - Checking backend for user:`, apiUrl);
          
          const res = await fetch(apiUrl);
          console.log(`🔍 Call #${callCount} - Backend response status:`, res.status);
          
          if (res.status === 200) {
            const member = await res.json();
            console.log(`✅ Call #${callCount} - Backend user found:`, member);
            // Ensure the user object has the uid property and preserves Firebase auth data
            const userWithUid = {
              ...member,
              uid: firebaseUser.uid, // Add the Firebase UID to the user object
              email: email, // Preserve Firebase email
              phoneNumber: phone // Preserve Firebase phone
            };
            setUser(userWithUid);
            console.log(`✅ Call #${callCount} - Auth state: Existing user found`);
            
            // Only navigate to dashboard if we're on a public route and not in the middle of registration
            const currentPath = window.location.pathname;
            const isPublicRoute = ['/', '/login', '/register'].includes(currentPath);
            const isRegistrationComplete = member?.registrationStatus === 'complete';
            
            if (isPublicRoute) {
              if (isRegistrationComplete) {
                console.log(`✅ Call #${callCount} - Registration complete, navigating to dashboard`);
                navigate("/dashboard");
              } else {
                console.log(`ℹ️ Call #${callCount} - On public route but registration not complete, staying`);
              }
            } else {
              console.log(`✅ Call #${callCount} - Staying on current protected route: ${currentPath}`);
            }
          } else {
            console.log(`❌ Call #${callCount} - Auth state: Backend user not found (status: ${res.status})`);
            const currentPath = window.location.pathname;
            
            // Special handling for post-registration case
            if (currentPath === '/register') {
              console.log(`🔄 Call #${callCount} - On registration page, user might be newly registered.`);
              // Don't automatically redirect, let the registration flow handle it
              return;
            } 
            
            // If we're on the home page, stay there
            if (currentPath === '/') {
              console.log(`ℹ️ Call #${callCount} - On home page, not redirecting to register`);
              return;
            }
            
            // For any other page, redirect to home instead of register
            console.log(`❌ Call #${callCount} - Redirecting to home instead of register`);
            navigate("/");
          }
        } catch (err) {
          console.error(`❌ Call #${callCount} - Error checking backend:`, err);
          console.log(`❌ Call #${callCount} - Auth state: Backend error`);
          // Only navigate to registration if we're not already there
          // This prevents interference with the registration completion flow
          if (window.location.pathname !== '/register') {
            console.log(`❌ Call #${callCount} - Auth state: Backend error, navigating to registration as fallback`);
            navigate("/register", { state: { email, phone } });
          } else {
            console.log(`❌ Call #${callCount} - Auth state: Already on registration page, not redirecting on error`);
          }
        }
      } else {
        // User is signed out
        console.log('🔥 User signed out');
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [auth]);

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

  // Phone sign-in
  const loginWithPhone = async (phone: string, appVerifier: any, otp?: string, confirmationResult?: any) => {
    setLoading(true);
    try {
      if (!confirmationResult) {
        // First step: send OTP
        console.log('🔥 AuthContext: Starting signInWithPhoneNumber');
        console.log('📞 Phone:', phone);
        console.log('🛡️ AppVerifier type:', typeof appVerifier);
        console.log('🔧 Auth object:', !!auth);
        
        const result = await signInWithPhoneNumber(auth, phone, appVerifier);
        
        console.log('✨ signInWithPhoneNumber completed successfully');
        console.log('📋 Result type:', typeof result);
        console.log('🎯 Result has confirm method:', typeof result?.confirm);
        
        setLoading(false);
        return result; // return confirmationResult for OTP entry
      } else {
        // Second step: verify OTP
        console.log('🔢 AuthContext: Verifying OTP:', otp);
        console.log('🔍 ConfirmationResult object:', confirmationResult);
        console.log('🔍 ConfirmationResult.confirm type:', typeof confirmationResult?.confirm);
        
        try {
          const cred = await confirmationResult.confirm(otp);
          console.log('✅ OTP verification successful');
          await handlePostSignIn(cred.user);
        } catch (confirmError) {
          console.error('💥 OTP confirmation error:', confirmError);
          console.error('💥 Confirm error type:', typeof confirmError);
          console.error('💥 Confirm error code:', (confirmError as any)?.code);
          console.error('💥 Confirm error message:', (confirmError as any)?.message);
          console.error('💥 Confirm error stack:', (confirmError as any)?.stack);
          
          // Re-throw the error with additional context
          throw confirmError;
        }
      }
    } catch (err) {
      console.error('💥 AuthContext: Phone login error:', err);
      console.error('💥 Error code:', (err as any).code);
      console.error('💥 Error message:', (err as any).message);
      setLoading(false);
      throw err; // Re-throw error to be handled by calling component
    }
    setLoading(false);
  };

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

  // Get user profile from backend
  const getUserProfile = async (uid: string) => {
    try {
      const params = new URLSearchParams();
      if (user?.email) params.append("email", user.email);
      if (user?.phoneNumber) {
        // Normalize phone number before sending to backend
        const normalizedPhone = normalizePhoneNumber(user.phoneNumber);
        if (normalizedPhone) {
          params.append("phone", normalizedPhone);
        }
      }
      
      const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?${params.toString()}`;
      const res = await fetch(apiUrl);
      
      if (res.status === 200) {
        const profile = await res.json();
        return profile;
      } else {
        console.error('Failed to fetch user profile:', res.status);
        return null;
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return null;
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

  // Update user profile data in backend
  const updateUserProfileData = async (uid: string, data: any) => {
    try {
      const params = new URLSearchParams();
      if (user?.email) params.append("email", user.email);
      if (user?.phoneNumber) {
        // Normalize phone number before sending to backend
        const normalizedPhone = normalizePhoneNumber(user.phoneNumber);
        if (normalizedPhone) {
          params.append("phone", normalizedPhone);
        }
      }
      
      const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?${params.toString()}`;
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (res.status === 200) {
        const updatedProfile = await res.json();
        // Preserve the existing user object structure and merge with updated data
        const updatedUser = {
          ...user, // Preserve existing user properties (uid, email, phoneNumber, etc.)
          ...updatedProfile.data.member, // Merge updated profile data from backend
          uid: user?.uid, // Ensure Firebase UID is preserved
          email: user?.email || updatedProfile.data.member.email, // Preserve Firebase email
          phoneNumber: user?.phoneNumber || updatedProfile.data.member.phoneNumber // Preserve Firebase phone
        };
        setUser(updatedUser);
        return updatedProfile;
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile data:', err);
      throw err;
    }
  };

  // After Firebase sign-in, check backend
  const handlePostSignIn = async (firebaseUser: User) => {
    const uid = firebaseUser.uid;
    const email = firebaseUser.email;
    const phone = firebaseUser.phoneNumber;
    console.log('🔍 handlePostSignIn called:', { uid, email, phone });
    
    try {
      const params = new URLSearchParams();
      if (email) params.append("email", email);
      if (phone) {
        // Normalize phone number before sending to backend
        const normalizedPhone = normalizePhoneNumber(phone);
        if (normalizedPhone) {
          params.append("phone", normalizedPhone);
          console.log('📞 Normalized phone number:', phone, '->', normalizedPhone);
        }
      }
      
      const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?${params.toString()}`;
      console.log('🔍 Making API call to:', apiUrl);
      
      const res = await fetch(apiUrl);
      console.log('🔍 API response status:', res.status);
      console.log('🔍 API response headers:', Object.fromEntries(res.headers.entries()));
      
      if (res.status === 200) {
        const member = await res.json();
        console.log('✅ Member data received:', member);
        // Ensure the user object has the uid property and preserves Firebase auth data
        const userWithUid = {
          ...member,
          uid: firebaseUser.uid, // Add the Firebase UID to the user object
          email: email, // Preserve Firebase email
          phoneNumber: phone // Preserve Firebase phone
        };
        setUser(userWithUid);
        console.log('✅ User set with UID, navigating to dashboard');
        navigate("/dashboard");
      } else {
        console.log('❌ Member not found, navigating to registration');
        // Not found, go to registration
        navigate("/register", { state: { email, phone } });
      }
    } catch (err) {
      console.error('❌ Error in handlePostSignIn:', err);
      alert("Error checking backend: " + (err as any).message);
    }
  };

  // Provide currentUser as the primary interface
  const contextValue = {
    currentUser: user,
    firebaseUser: firebaseUser, // Use the state instead of auth.currentUser
    loginWithEmail,
    loginWithPhone,
    logout,
    getUserProfile,
    updateUserProfile,
    updateUserProfileData,
    loading
  };

  console.log('🔄 AuthContext state:', { currentUser: user, loading });

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}; 