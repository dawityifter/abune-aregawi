import React, { createContext, useContext, useState, useEffect } from "react";
import { getAuth, signInWithEmailAndPassword, signInWithPhoneNumber, RecaptchaVerifier, User, signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext<any>(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔥 Firebase auth state changed:', firebaseUser);
      
      if (firebaseUser) {
        // User is signed in with Firebase
        const uid = firebaseUser.uid;
        const email = firebaseUser.email;
        const phone = firebaseUser.phoneNumber;
        
        try {
          // Check if user exists in backend
          const params = new URLSearchParams();
          if (email) params.append("email", email);
          if (phone) params.append("phone", phone);
          
          const apiUrl = `/api/members/profile/firebase/${uid}?${params.toString()}`;
          console.log('🔍 Checking backend for user:', apiUrl);
          
          const res = await fetch(apiUrl);
          
          if (res.status === 200) {
            const member = await res.json();
            console.log('✅ Backend user found:', member);
            // Ensure the user object has the uid property
            const userWithUid = {
              ...member,
              uid: firebaseUser.uid // Add the Firebase UID to the user object
            };
            setUser(userWithUid);
          } else {
            console.log('❌ Backend user not found, setting Firebase user as fallback');
            // Set Firebase user as fallback if backend user not found
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              phoneNumber: firebaseUser.phoneNumber,
              role: 'member' // Default role
            });
          }
        } catch (err) {
          console.error('❌ Error checking backend:', err);
          // Set Firebase user as fallback on error
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            phoneNumber: firebaseUser.phoneNumber,
            role: 'member' // Default role
          });
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
      alert("Login failed: " + (err as any).message);
    }
    setLoading(false);
  };

  // Phone sign-in
  const loginWithPhone = async (phone: string, appVerifier: any, otp?: string, confirmationResult?: any) => {
    setLoading(true);
    try {
      if (!confirmationResult) {
        // First step: send OTP
        const result = await signInWithPhoneNumber(auth, phone, appVerifier);
        setLoading(false);
        return result; // return confirmationResult for OTP entry
      } else {
        // Second step: verify OTP
        const cred = await confirmationResult.confirm(otp);
        await handlePostSignIn(cred.user);
      }
    } catch (err) {
      alert("Phone login failed: " + (err as any).message);
    }
    setLoading(false);
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
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
      if (user?.phoneNumber) params.append("phone", user.phoneNumber);
      
      const apiUrl = `/api/members/profile/firebase/${uid}?${params.toString()}`;
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
        // @ts-ignore - Firebase User type doesn't include updateProfile but it exists
        await authUser.updateProfile(updates);
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
      if (user?.phoneNumber) params.append("phone", user.phoneNumber);
      
      const apiUrl = `/api/members/profile/firebase/${uid}?${params.toString()}`;
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (res.status === 200) {
        const updatedProfile = await res.json();
        setUser(updatedProfile);
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
      if (phone) params.append("phone", phone);
      
      const apiUrl = `/api/members/profile/firebase/${uid}?${params.toString()}`;
      console.log('🔍 Making API call to:', apiUrl);
      
      const res = await fetch(apiUrl);
      console.log('🔍 API response status:', res.status);
      console.log('🔍 API response headers:', Object.fromEntries(res.headers.entries()));
      
      if (res.status === 200) {
        const member = await res.json();
        console.log('✅ Member data received:', member);
        // Ensure the user object has the uid property
        const userWithUid = {
          ...member,
          uid: firebaseUser.uid // Add the Firebase UID to the user object
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

  // Provide both user and currentUser for backward compatibility
  const contextValue = {
    user,
    currentUser: user, // For backward compatibility
    loginWithEmail,
    loginWithPhone,
    logout,
    getUserProfile,
    updateUserProfile,
    updateUserProfileData,
    loading
  };

  console.log('🔄 AuthContext state:', { user, currentUser: user, loading });

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}; 