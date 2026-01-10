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
  backendStarting?: boolean;
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
  const [backendStarting, setBackendStarting] = useState<boolean>(false);
  const navigate = useNavigate();
  const auth = getAuth();

  // Configurable timeout for backend profile fetch (default 20s)
  const PROFILE_FETCH_TIMEOUT_MS = Number(process.env.REACT_APP_PROFILE_FETCH_TIMEOUT_MS || 20000);
  const READY_PROBE_TIMEOUT_MS = 8000;
  const READY_BACKOFFS_MS = [3000, 7000, 15000, 25000, 30000]; // ~80s total

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
          const token = await firebaseUser.getIdToken();
          const headers: any = { 'Authorization': `Bearer ${token}` };
          if (token === 'MAGIC_DEMO_TOKEN' && email) {
            headers['X-Demo-Email'] = email;
          }

          const response = await fetch(apiUrl, {
            headers,
            signal: controller.signal
          });

          // Always clear timeout even if parsing/logic throws later
          clearTimeout(timeoutId);
          console.log(`🔍 Backend response status (attempt ${attempt}):`, response.status);

          if (response.status === 200) {
            const responseData = await response.json();
            console.log('✅ Backend user found:', responseData);
            // Handle both structure formats:
            // 1. { data: { member: { ... } } } - Node.js style
            // 2. { data: { ... } } - Java style (MemberDTO directly in data)
            // 3. { ... } - Fallback
            return responseData.data?.member || responseData.data || responseData;
          }

          if (response.status === 404) {
            let body: any = null;
            try {
              body = await response.json();
            } catch { }
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
          } catch { }
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

  // Probe backend readiness with short exponential backoff
  const probeBackendReady = useCallback(async (): Promise<boolean> => {
    try {
      const baseUrl = process.env.REACT_APP_API_URL;
      if (!baseUrl) return false;
      for (let i = 0; i < READY_BACKOFFS_MS.length; i++) {
        // Try probe
        try {
          const controller = new AbortController();
          const to = setTimeout(() => controller.abort(), READY_PROBE_TIMEOUT_MS);
          const res = await fetch(`${baseUrl}/api/ready`, { signal: controller.signal });
          clearTimeout(to);
          if (res.ok) {
            return true;
          }
        } catch (_) {
          // ignore and backoff
        }
        // Backoff delay
        const delay = READY_BACKOFFS_MS[i];
        await new Promise(r => setTimeout(r, delay));
      }
      return false;
    } catch (_) {
      return false;
    }
  }, []);

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
      localStorage.removeItem('magic_demo_mode'); // Clear magic mode on logout
      localStorage.removeItem('magic_new_user_mode');
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
      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : '';
      const headers: any = { 'Authorization': `Bearer ${token}` };
      if (token === 'MAGIC_DEMO_TOKEN' && (email || currentUser?.email)) {
        headers['X-Demo-Email'] = email || currentUser?.email;
      }

      const res = await fetch(apiUrl, {
        headers
      });

      if (res.status === 200) {
        const responseData = await res.json();
        // Handle both structure formats:
        // 1. { data: { member: { ... } } } - Node.js style
        // 2. { data: { ... } } - Java style (MemberDTO directly in data)
        // 3. { ... } - Fallback
        return responseData.data?.member || responseData.data || responseData;
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
      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : '';
      const headers: any = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      if (token === 'MAGIC_DEMO_TOKEN' && currentUser?.email) {
        headers['X-Demo-Email'] = currentUser.email;
      }

      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers,
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
      // Magic Demo Mode Bypass
      if ((localStorage.getItem('magic_demo_mode') === 'true' || localStorage.getItem('magic_new_user_mode') === 'true') && process.env.REACT_APP_ENABLE_DEMO_MODE === 'true') {
        console.log('✨ Magic Demo Mode Active');
        const isNewUser = localStorage.getItem('magic_new_user_mode') === 'true';
        const magicPhone = isNewUser ? '+14699078230' : '+14699078229';

        const magicUser: any = {
          uid: isNewUser ? 'magic-new-user-uid' : 'magic-demo-uid',
          phoneNumber: magicPhone,
          email: isNewUser ? 'newuser@example.com' : 'demo@admin.com',
          getIdToken: async () => 'MAGIC_DEMO_TOKEN',
          providerData: [{ providerId: 'phone', phoneNumber: magicPhone }]
        };
        handlePostSignIn(magicUser); // Set internal firebaseUser state

        // If it's the "New User" mode, we skip the backend check and force "new user" state
        if (isNewUser) {
          console.log('✨ Magic NEW USER Mode - Forcing 404/New User state');
          setFirebaseUser(magicUser);
          // Force "New User" state
          setUser({
            uid: magicUser.uid,
            email: '',
            phoneNumber: magicPhone,
            _temp: true,
            role: 'member',
            roles: ['member']
          });
          navigate('/register', { state: { phone: magicPhone } });
          setAuthReady(true);
          return;
        }

        // Otherwise proceed to load profile as normal (will hit backend with magic token)
        firebaseUser = magicUser;
      }

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
        let profile = await checkUserProfile(firebaseUser);

        if (profile) {
          console.log('✅ User profile loaded, updating state');
          setUser({
            ...profile,
            uid: firebaseUser.uid,
            // Prefer backend profile email if present (email not used for login)
            email: (profile as any).email || '',
            phoneNumber,
            role: profile.role,
            roles: profile.roles || [profile.role],
            _temp: false
          });

          // Only navigate to dashboard if on login page or public pages
          // Don't redirect if user is already on a protected page (let them stay there)
          const REDIRECT_TO_DASHBOARD_PATHS = new Set<string>([
            '/login',
            '/',
            '/credits',
            '/church-bylaw',
            '/donate',
            '/member-status',
            '/parish-pulse-sign-up',
          ]);
          const currentPath = window.location.pathname;
          if (REDIRECT_TO_DASHBOARD_PATHS.has(currentPath)) {
            console.log('🔄 Navigating to dashboard from public/login page');
            navigate('/dashboard');
          } else {
            console.log('✅ User already on protected route, staying on:', currentPath);
          }
        } else {
          // Before treating as new user, attempt readiness warm-up with exponential backoff
          console.log('ℹ️ Profile not found or backend unavailable. Probing readiness...');
          setBackendStarting(true);
          const ready = await probeBackendReady();
          if (ready) {
            console.log('✅ Backend reports ready. Retrying profile fetch...');
            profile = await checkUserProfile(firebaseUser);
          }
          setBackendStarting(false);

          if (profile) {
            console.log('✅ User profile loaded after warm-up, updating state');
            setUser({
              ...profile,
              uid: firebaseUser.uid,
              email: (profile as any).email || '',
              phoneNumber,
              role: profile.role,
              roles: profile.roles || [profile.role],
              _temp: false
            });
            // Only navigate to dashboard if on login page or public pages
            const REDIRECT_TO_DASHBOARD_PATHS = new Set<string>([
              '/login', '/', '/credits', '/church-bylaw', '/donate', '/member-status', '/parish-pulse-sign-up',
            ]);
            const currentPath = window.location.pathname;
            if (REDIRECT_TO_DASHBOARD_PATHS.has(currentPath)) {
              console.log('🔄 Navigating to dashboard from public/login page after warm-up');
              navigate('/dashboard');
            } else {
              console.log('✅ User already on protected route after warm-up, staying on:', currentPath);
            }
          } else {
            console.log('❌ Still no profile after warm-up, treating as new user');
            setUser({
              uid: firebaseUser.uid,
              email: '',
              phoneNumber,
              _temp: true,
              role: 'member',
              roles: ['member']
            });
            if (window.location.pathname !== '/register') {
              navigate('/register', { state: { phone: phoneNumber } });
            }
          }
        }
      } catch (error: any) {
        console.error('Error in auth state change handler:', error);
        // Tailored handling for dependents that exist but are not linked
        if (error && error.code === 'DEPENDENT_NOT_LINKED') {
          console.log('ℹ️ Detected unlinked dependent login. Setting tailored state.');
          setUser((prev: any) => ({
            ...(prev || {}),
            uid: firebaseUser?.uid,
            email: '',
            phoneNumber,
            role: 'dependent',
            roles: ['member'], // Dependents don't have special roles yet, default to member
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

  // Client warm-up: background health ping on app load (prod-only, once per session)
  useEffect(() => {
    try {
      // Only run in production; allow opt-out via env flag
      if (process.env.NODE_ENV !== 'production') return;
      if (process.env.REACT_APP_ENABLE_WARMUP === 'false') return;

      const baseUrl = process.env.REACT_APP_API_URL;
      if (!baseUrl) return;

      // Throttle: once per session or when TTL has expired
      const KEY = 'warmup.health.lastPingAt';
      const TTL_MS = Number(process.env.REACT_APP_WARMUP_TTL_MS || 30 * 60 * 1000); // 30 minutes default
      const now = Date.now();
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (last && now - last < TTL_MS) return;

      const doPing = () => {
        const controller = new AbortController();
        const timeoutMs = Number(process.env.REACT_APP_WARMUP_TIMEOUT_MS || 2500);
        const to = setTimeout(() => controller.abort(), timeoutMs);
        fetch(`${baseUrl}/api/health`, { method: 'GET', signal: controller.signal })
          .catch(() => { /* ignore network errors; purely best-effort */ })
          .finally(() => {
            clearTimeout(to);
            try { sessionStorage.setItem(KEY, String(Date.now())); } catch { }
          });
      };

      // Truly background: schedule when idle if possible; otherwise next tick
      if (typeof (window as any).requestIdleCallback === 'function') {
        (window as any).requestIdleCallback(doPing, { timeout: 1000 });
      } else {
        setTimeout(doPing, 0);
      }
    } catch {
      // Never surface errors to UI
    }
  }, []);

  // Provide auth context
  const value = {
    user,
    currentUser: user, // Alias for backward compatibility
    firebaseUser,
    loading,
    authReady,
    backendStarting,
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
      {/* Warm-up banner during backend startup */}
      {backendStarting && (
        <div role="status" aria-live="polite" className="fixed top-0 inset-x-0 z-50">
          <div className="mx-auto max-w-4xl mt-2 px-4 py-2 rounded-md shadow bg-yellow-50 border border-yellow-200 text-yellow-900 flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-yellow-700" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span>Backend starting… give us a minute. We’ll continue automatically once it’s ready.</span>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}; 