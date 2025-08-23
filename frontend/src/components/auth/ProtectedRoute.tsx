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
  const { currentUser, firebaseUser, loading, authReady, error } = useAuth();
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

  // If Firebase user exists but app user profile hasn't been resolved yet
  if (firebaseUser && !currentUser) {
    // If we have finalized auth and are not actively loading, show an error fallback if present
    if (authReady && !loading && error) {
      console.log('⚠️ ProtectedRoute: Auth ready but no app user; showing error fallback');
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="bg-white rounded-lg shadow p-6 max-w-md w-full text-center">
            <div className="text-red-600 text-lg mb-4">{error}</div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Retry
              </button>
              <a
                href="/register"
                className="px-4 py-2 border rounded hover:bg-gray-50 inline-flex items-center justify-center"
              >
                Go to Registration
              </a>
            </div>
          </div>
        </div>
      );
    }

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

  // Handle temporary users (wait instead of redirecting), except for unlinked dependents
  if (currentUser && currentUser._temp) {
    if (currentUser.unlinkedDependent) {
      console.log('ℹ️ ProtectedRoute: Allowing unlinked dependent temp user through to show tailored banner');
      // Allow access so the Dashboard can render the unlinked dependent banner
    } else if (!allowTempUser) {
      console.log('⏳ ProtectedRoute: Temporary user detected, waiting for full profile before allowing access');
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-800"></div>
        </div>
      );
    }
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