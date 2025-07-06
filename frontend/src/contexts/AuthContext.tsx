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
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<UserCredential>;
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
      
      // Create user profile in Firestore
      try {
        await setDoc(doc(db, 'users', result.user.uid), {
          email,
          displayName,
          createdAt: new Date().toISOString(),
          role: 'member',
          isActive: true
        });
        console.log('User profile created in Firestore');
      } catch (firestoreError: any) {
        console.warn('Could not create user profile in Firestore:', firestoreError.message);
        // Continue even if Firestore fails - user is still created in Firebase Auth
      }
      
      return result;
    } catch (error: any) {
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
      const userDoc = await getDoc(doc(db, 'users', uid));
      console.log('User document exists:', userDoc.exists());
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log('User profile data:', data);
        return data;
      }
      console.log('User document does not exist, creating default profile');
      // If user doesn't exist in Firestore, create a default profile
      const defaultProfile = {
        email: currentUser?.email || '',
        displayName: currentUser?.displayName || 'User',
        createdAt: new Date().toISOString(),
        role: 'member',
        isActive: true
      };
      await setDoc(doc(db, 'users', uid), defaultProfile);
      return defaultProfile;
    } catch (error: any) {
      console.error('Error in getUserProfile:', error);
      
      // If Firestore is not available, return a default profile
      if (error.message.includes('offline') || error.message.includes('permission') || error.code === 'unavailable') {
        console.log('Firestore not available, using default profile');
        return {
          email: currentUser?.email || '',
          displayName: currentUser?.displayName || 'User',
          createdAt: new Date().toISOString(),
          role: 'member',
          isActive: true
        };
      }
      
      throw new Error(error.message);
    }
  };

  const updateUserProfileData = async (uid: string, data: any) => {
    try {
      await updateDoc(doc(db, 'users', uid), data);
    } catch (error: any) {
      throw new Error(error.message);
    }
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    signUp,
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