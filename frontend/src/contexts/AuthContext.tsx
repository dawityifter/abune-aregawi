import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier, User, signOut, onAuthStateChanged, updateProfile, Auth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { normalizePhoneNumber } from "../utils/formatPhoneNumber";

interface AuthContextType {
  user: any;
  currentUser: any; // Alias for user for backward compatibility
  firebaseUser: User | null;
  loading: boolean;
  authReady: boolean;
  loginWithPhone: (phone: string, appVerifier: any, otp?: string, confirmationResult?: any) => Promise<any>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: any) => Promise<void>;
  getUserProfile: (uid: string, email?: string | null, phoneNumber?: string | null) => Promise<any>;
  updateUserProfileData: (uid: string, updates: any) => Promise<void>;
  clearError: () => void;
  clearNewUserCache: () => void; // Add this function
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
  // Indicates the first Firebase auth state has been resolved
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const auth = getAuth();

  // Configurable timeout for backend profile fetch (default 20s)
  const PROFILE_FETCH_TIMEOUT_MS = Number(process.env.REACT_APP_PROFILE_FETCH_TIMEOUT_MS || 20000);

  // Cache for 404 results to prevent retry storms
  const [newUserCache, setNewUserCache] = useState<Set<string>>(new Set());

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
  const checkUserProfile = useCallback(async (firebaseUser: User) => {
    const uid = firebaseUser.uid;
    const phone = getPhoneNumber(firebaseUser);
    const email = firebaseUser.email || null;
    
    console.log('🔍 Checking user profile:', { 
      uid, 
      email,
      phone,
      phoneType: typeof phone,
      phoneExists: !!phone
    });

    // Check if this user is already known to be new
    if (newUserCache.has(uid)) {
      console.log('🔄 User already known to be new, skipping backend check');
      return null;
    }
    
    try {
      // If we have neither email nor phone, assume new user and skip backend 400s
      if (!phone && !email) {
        console.log('⚠️ No phone or email available; treating as new user');
        setNewUserCache(prev => new Set([...Array.from(prev), uid]));
        return null;
      }

      const params = new URLSearchParams();
      // Include email if present
      if (email) {
        params.append('email', email);
      }
      // Include phone if present
      if (phone) {
        const normalizedPhone = normalizePhoneNumber(phone);
        if (normalizedPhone) {
          params.append("phone", normalizedPhone);
        } else {
          console.log('⚠️ Could not normalize phone number:', phone);
        }
      }
      
      const apiUrl = `${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?${params.toString()}`;
      console.log('🔍 Backend check URL:', apiUrl);
      
      // Retry/backoff for transient errors (kept low to avoid long waits)
      const maxAttempts = 2;
      let lastError: any = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          // Timeout per attempt to avoid indefinite hangs
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), PROFILE_FETCH_TIMEOUT_MS);
          const response = await fetch(apiUrl, { signal: controller.signal });
          
          // Always clear timeout even if parsing/logic throws later
          clearTimeout(timeoutId);
          console.log(`🔍 Backend response status (attempt ${attempt}):`, response.status);

          if (response.status === 200) {
            const responseData = await response.json();
            console.log('✅ Backend user found:', responseData);
            return responseData.data?.member || responseData;
          }

          if (response.status === 404) {
            let body: any = null;
            try {
              body = await response.json();
            } catch {}
            const code = body?.code;
            console.log('❌ Backend user not found (status: 404)', code ? `code=${code}` : '');
            if (body) {
              try {
                console.log('🧾 404 response body:', JSON.stringify(body));
              } catch {
                console.log('🧾 404 response body (non-JSON):', body);
              }
            }
            if (code === 'DEPENDENT_NOT_LINKED') {
              const err: any = new Error('Dependent exists but not linked');
              err.code = 'DEPENDENT_NOT_LINKED';
              throw err;
            }
            setNewUserCache(prev => new Set([...Array.from(prev), uid]));
            return null;
          }

          if (response.status === 400) {
            // Treat 400 (e.g., missing identifiers) as new user to avoid hangs
            console.log('⚠️ Backend returned 400; treating as new user');
            setNewUserCache(prev => new Set([...Array.from(prev), uid]));
            return null;
          }

          if (response.status === 429 || response.status >= 500) {
            const err: any = new Error(`Transient backend error: ${response.status}`);
            err.status = response.status;
            throw err;
          }

          // Other unexpected statuses: throw without retrying
          const err: any = new Error(`Backend error: ${response.status}`);
          err.status = response.status;
          throw err;
        } catch (err) {
          // If aborted due to timeout, annotate and bubble up
          if ((err as any)?.name === 'AbortError') {
            const timeoutErr: any = new Error('Backend profile check timed out');
            timeoutErr.code = 'TIMEOUT';
            lastError = timeoutErr;
          } else if ((err as any) instanceof TypeError) {
            // Failed to fetch / network error in fetch API is typically a TypeError - treat as transient
            const netErr: any = new Error('Network error during backend profile check');
            netErr.code = 'NETWORK';
            lastError = netErr;
          } else {
            lastError = err;
          }
          if (attempt < maxAttempts) {
            const delay = 500 * Math.pow(2, attempt - 1); // 500ms, 1000ms
            console.log(`⏳ Retry backend profile check in ${delay}ms (attempt ${attempt} failed)`);
            await new Promise(res => setTimeout(res, delay));
            continue;
          }
          break;
        } finally {
          // Best-effort cleanup if an exception happens before clearTimeout is called
          try {
            // Note: timeoutId is in scope; clearTimeout is idempotent
            // @ts-ignore - ignore if not defined due to earlier exceptions
            clearTimeout(timeoutId);
          } catch {}
        }
      }
      // If we exhausted retries and it's a timeout or network issue, treat as transient
      if (lastError && (lastError.code === 'TIMEOUT' || lastError.code === 'NETWORK')) {
        console.log('⏱️ checkUserProfile giving up after timeout/network; treating as transient and returning null');
        return null;
      }
      throw lastError;
    } catch (error) {
      console.error('Error checking user profile:', error);
      // Re-throw so caller can decide navigation behavior
      throw error;
    }
  }, [newUserCache]);

  // Clear new user cache when user logs out
  const clearNewUserCache = useCallback(() => {
    setNewUserCache(new Set());
  }, []);

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
        
        // Set Firebase user - onAuthStateChanged will handle the rest
        setFirebaseUser(user);
        
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
  }, [auth]);

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setFirebaseUser(null);
      navigate("/");
      clearNewUserCache(); // Clear cache on logout
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
  const getUserProfile = async (uid: string, email?: string | null, phoneNumber?: string | null) => {
    // Null-check guard to avoid calling with undefined uid
    if (!uid) {
      console.error('❌ getUserProfile called with undefined uid');
      return null;
    }
    
    try {
      const params = new URLSearchParams();
      if (email) {
        params.append('email', email);
      }
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

  // After Firebase sign-in, set Firebase user (onAuthStateChanged will handle the rest)
  const handlePostSignIn = async (firebaseUser: User) => {
    console.log('handlePostSignIn called - setting Firebase user');
    setFirebaseUser(firebaseUser);
  };

  // Listen for Firebase auth state changes
  useEffect(() => {
    console.log('🔌 Setting up auth state listener');

    const handleAuthStateChange = async (firebaseUser: User | null) => {
      console.log('🔥 Firebase auth state changed:', firebaseUser ? 'User signed in' : 'User signed out');
      setFirebaseUser(firebaseUser);
      
      if (!firebaseUser) {
        setUser(null);
        clearNewUserCache();
        // Mark auth initialized even if signed out
        setAuthReady(true);
        return;
      }

      const phoneNumber = getPhoneNumber(firebaseUser);
      
      console.log('🔍 onAuthStateChanged - Firebase user data:', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        phoneNumber,
        phoneType: typeof phoneNumber,
        phoneExists: !!phoneNumber,
        providerData: firebaseUser.providerData?.map(p => p.providerId)
      });

      try {
        // Always check profile first, don't navigate until we know the result
        const profile = await checkUserProfile(firebaseUser);

        if (profile) {
          console.log('✅ User profile loaded, updating state');
          setUser({
            ...profile,
            uid: firebaseUser.uid,
            // Prefer backend profile email if present (email not used for login)
            email: (profile as any).email || '',
            phoneNumber,
            role: profile.role, // Explicitly set the role
            _temp: false
          });

          // Only navigate to dashboard if we're not already there and not on public pages
          const NO_REDIRECT_PATHS = new Set<string>([
            '/',
            '/credits',
            '/church-bylaw',
            '/donate',
            '/member-status',
            '/parish-pulse-sign-up',
          ]);
          const currentPath = window.location.pathname;
          if (!NO_REDIRECT_PATHS.has(currentPath) && currentPath !== '/dashboard') {
            console.log('🔄 Navigating to dashboard for existing user');
            navigate('/dashboard');
          }
        } else {
          console.log('❌ User profile not found, setting as new user');
          setUser({
            uid: firebaseUser.uid,
            email: '',
            phoneNumber,
            _temp: true,
            role: 'member'
          });

          // Only navigate to register if we're not already there
          if (window.location.pathname !== '/register') {
            console.log('🔄 Navigating to register for new user');
            navigate('/register', {
              state: {
                phone: phoneNumber
              }
            });
          }
        }
      } catch (error: any) {
        console.error('Error in auth state change handler:', error);
        // Tailored handling for dependents that exist but are not linked
        if (error && error.code === 'DEPENDENT_NOT_LINKED') {
          console.log('ℹ️ Detected unlinked dependent login. Setting tailored state.');
          setUser((prev: any) => ({
            ...(prev || {}),
            uid: firebaseUser.uid,
            email: '',
            phoneNumber,
            role: 'dependent',
            _temp: true,
            unlinkedDependent: true
          }));
          setError('We found your dependent profile, but it is not yet linked to a head of household. Please contact them to link your profile or use the self-claim flow.');
          // Avoid navigation to register; allow UI to present tailored CTA
          setAuthReady(true);
          return;
        }
        if (error && error.code === 'TIMEOUT') {
          setError('The server is waking up. Please try again in a moment.');
          setAuthReady(true);
          return;
        }
        // Do not force temp user on transient errors; surface error and let UI handle it
        setError('Failed to load profile. Please try again.');
        // Leave user unchanged to avoid permanent temp/spinner state
      }
      // Initial auth state has been processed
      setAuthReady(true);
    };

    // Set up the auth state listener
    const unsubscribe = onAuthStateChanged(auth, handleAuthStateChange);

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up auth state listener');
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []); // Empty dependency array ensures listener is only registered once

  // Provide auth context
  const value = {
    user,
    currentUser: user, // Alias for backward compatibility
    firebaseUser,
    loading,
    authReady,
    loginWithPhone,
    logout,
    updateUserProfile,
    getUserProfile,
    updateUserProfileData,
    clearError,
    clearNewUserCache,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 