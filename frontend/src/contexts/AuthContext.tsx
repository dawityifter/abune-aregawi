import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User, 
  UserCredential,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';
import { auth } from '../firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<UserCredential>;
  completeRegistration: (firebaseUid: string, memberData: any) => Promise<any>;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (displayName: string) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  getUserProfile: (uid: string) => Promise<any>;
  updateUserProfileData: (uid: string, data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      
      // Return the Firebase user result - registration completion will be handled separately
      console.log('Firebase Auth user created successfully. UID:', result.user.uid);
      
      return result;
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  // Complete registration in PostgreSQL after Firebase Auth
  const completeRegistration = async (firebaseUid: string, memberData: any) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/complete-registration/${firebaseUid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(memberData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete registration');
      }

      const data = await response.json();
      console.log('Registration completed in PostgreSQL:', data);
      return data;
    } catch (error: any) {
      console.error('Complete registration error:', error);
      throw new Error(error.message);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const updateUserProfile = async (displayName: string) => {
    if (!currentUser) throw new Error('No user logged in');
    
    try {
      await updateProfile(currentUser, { displayName });
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    if (!currentUser || !currentUser.email) throw new Error('No user logged in');
    
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const getUserProfile = async (uid: string) => {
    try {
      console.log('Getting user profile for UID:', uid);
      
      // Get profile from backend API (PostgreSQL) - Single source of truth
      if (currentUser?.email) {
        try {
          const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?email=${encodeURIComponent(currentUser.email)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Backend profile data:', data.data.member);
            
            // Return profile with PostgreSQL role (single source of truth)
            return {
              email: data.data.member.email,
              displayName: `${data.data.member.firstName} ${data.data.member.lastName}`,
              createdAt: data.data.member.createdAt,
              role: data.data.member.role, // PostgreSQL role
              isActive: data.data.member.isActive,
              // Include other fields from backend
              firstName: data.data.member.firstName,
              lastName: data.data.member.lastName,
              phoneNumber: data.data.member.phoneNumber,
              memberId: data.data.member.memberId
            };
          } else {
            console.warn('Backend API returned error:', response.status);
          }
        } catch (apiError) {
          console.error('Error fetching from backend API:', apiError);
        }
      }
      
      // Fallback: Return basic profile from Firebase Auth only
      console.log('Using Firebase Auth fallback profile');
      return {
        email: currentUser?.email || '',
        displayName: currentUser?.displayName || 'User',
        createdAt: new Date().toISOString(),
        role: 'member', // Default role
        isActive: true
      };
    } catch (error: any) {
      console.error('Error in getUserProfile:', error);
      
      // Final fallback
      return {
        email: currentUser?.email || '',
        displayName: currentUser?.displayName || 'User',
        createdAt: new Date().toISOString(),
        role: 'member',
        isActive: true
      };
    }
  };

  const updateUserProfileData = async (uid: string, data: any) => {
    try {
      // Update backend API (PostgreSQL) - Single source of truth
      if (currentUser?.email) {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/members/profile/firebase/${uid}?email=${encodeURIComponent(currentUser.email)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          throw new Error(`Backend API error: ${response.status}`);
        }
        
        console.log('Profile updated in PostgreSQL via backend API');
      } else {
        throw new Error('No user email available for profile update');
      }
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      throw new Error(error.message);
    }
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    signUp,
    completeRegistration,
    signIn,
    logout,
    resetPassword,
    updateUserProfile,
    updateUserPassword,
    getUserProfile,
    updateUserProfileData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 