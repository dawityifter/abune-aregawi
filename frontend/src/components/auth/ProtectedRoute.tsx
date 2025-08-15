import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  allowTempUser?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole,
  allowTempUser = false // Default to false for most routes
}) => {
  const { currentUser, firebaseUser, loading, authReady } = useAuth();
  const location = useLocation();

  console.log('🛡️ ProtectedRoute check:', { 
    user: !!currentUser, 
    loading, 
    userUid: currentUser?.uid,
    isTempUser: currentUser?._temp,
    currentPath: location.pathname
  });

  // Block routing until the initial Firebase auth state is resolved
  if (!authReady) {
    console.log('🔄 ProtectedRoute: Waiting for initial auth state');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  // Show loading state during active operations
  if (loading && (!currentUser || !allowTempUser)) {
    console.log('🔄 ProtectedRoute: Still loading auth state');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  // If Firebase user exists but app user profile hasn't been resolved yet, wait
  if (firebaseUser && !currentUser) {
    console.log('⏳ ProtectedRoute: Firebase user present but app user not ready; showing loader');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  // Handle unauthenticated users
  if (!firebaseUser && !currentUser) {
    console.log('❌ ProtectedRoute: No user found, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Handle temporary users (wait instead of redirecting)
  if (currentUser && currentUser._temp && !allowTempUser) {
    console.log('⏳ ProtectedRoute: Temporary user detected, waiting for full profile before allowing access');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  // Log user details for debugging
  console.log('✅ ProtectedRoute: User authenticated', {
    uid: currentUser.uid,
    email: currentUser.email,
    phone: currentUser.phoneNumber,
    role: currentUser.role,
    isTemp: currentUser._temp
  });

  // Check for required role if specified
  if (requiredRole) {
    const userRole = currentUser.role || 'member';
    if (userRole !== requiredRole) {
      console.log(`🚫 ProtectedRoute: User role ${userRole} does not have required role ${requiredRole}`);
      // Redirect to dashboard or another safe route
      return <Navigate to="/dashboard" replace />;
    }
  }
  
  // If all checks pass, render the children
  return <>{children}</>;
};

export default ProtectedRoute; 