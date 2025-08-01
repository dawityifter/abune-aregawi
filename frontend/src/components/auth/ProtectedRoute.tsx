import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  console.log('🛡️ ProtectedRoute check:', { user: !!currentUser, loading, userUid: currentUser?.uid });

  if (loading) {
    console.log('🔄 ProtectedRoute: Still loading, showing spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-800"></div>
      </div>
    );
  }

  if (!currentUser) {
    console.log('❌ ProtectedRoute: No user found, redirecting to login');
    // Redirect to login page with the return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('✅ ProtectedRoute: User authenticated, allowing access');
  console.log('👤 User details:', { uid: currentUser.uid, email: currentUser.email, phone: currentUser.phoneNumber, role: currentUser.role });

  // If a specific role is required, check if user has that role
  if (requiredRole) {
    // This would need to be implemented based on your user role system
    // For now, we'll just check if the user exists
    // You can extend this to check user roles from Firestore
  }

  return <>{children}</>;
};

export default ProtectedRoute; 