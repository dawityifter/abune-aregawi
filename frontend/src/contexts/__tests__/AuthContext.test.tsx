import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthContext';
import * as firebaseAuth from 'firebase/auth';

// Mock the Firebase auth module. Define jest.fn()s inside the factory to avoid TDZ.
jest.mock('firebase/auth', () => {
  const mockOnAuthStateChanged = jest.fn();
  const mockSignInWithEmailAndPassword = jest.fn();
  const mockSignInWithPhoneNumber = jest.fn();
  const mockSignOut = jest.fn();
  const mockUpdateProfile = jest.fn();
  const RecaptchaVerifier = jest.fn(() => ({
    render: jest.fn(),
    verify: jest.fn().mockResolvedValue('test-verification-id')
  }));

  return {
    getAuth: jest.fn(() => ({
      currentUser: null,
      onAuthStateChanged: mockOnAuthStateChanged,
      signOut: mockSignOut
    })),
    signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
    signInWithPhoneNumber: mockSignInWithPhoneNumber,
    signOut: mockSignOut,
    onAuthStateChanged: mockOnAuthStateChanged,
    updateProfile: mockUpdateProfile,
    RecaptchaVerifier
  };
});

// Note: Access mocked exports directly via (firebaseAuth as any) to avoid TS parsing issues

// Mock Firebase User (we'll inject getIdToken per-test)
const mockFirebaseUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  phoneNumber: '+1234567890',
  displayName: 'Test User',
  _temp: false
};

// Mock fetch
global.fetch = jest.fn();

// Test component that uses the auth context
const TestComponent = () => {
  const { user, loading, error } = useAuth();
  
  if (loading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">{error}</div>;
  
  return (
    <div>
      {user ? (
        <div>
          <div data-testid="user-email">{user.email}</div>
          <div data-testid="user-role">{user.role || 'no-role'}</div>
        </div>
      ) : (
        <div data-testid="no-user">No user</div>
      )}
    </div>
  );
};

// Helper to render the auth provider with router
const renderAuthProvider = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default fetch mock
    (global.fetch).mockImplementation((url) => {
      if (url.includes('/api/members/profile/firebase/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              member: {
                id: 'test-uid',
                email: 'test@example.com',
                phone: '+1234567890',
                role: 'member',
                firstName: 'Test',
                lastName: 'User'
              }
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      });
    });
    
    // Set up auth state changed mock (matches firebase signature: (auth, callback))
    // Do not auto-invoke callback to let each test control timing
    (firebaseAuth as any).onAuthStateChanged.mockImplementation((auth, callback) => {
      return jest.fn(); // Return unsubscribe function
    });
    
    // Reset mocks
    const mockGetIdToken = jest.fn().mockResolvedValue('test-token');
    mockFirebaseUser.getIdToken = mockGetIdToken;
    (firebaseAuth as any).signInWithEmailAndPassword.mockClear().mockResolvedValue({ user: mockFirebaseUser });
    (firebaseAuth as any).signInWithPhoneNumber.mockClear().mockResolvedValue({ 
      confirm: jest.fn().mockResolvedValue({ user: mockFirebaseUser }) 
    });
  });

  it('should show no user initially (loading is false by default)', () => {
    renderAuthProvider();
    expect(screen.getByTestId('no-user')).toBeInTheDocument();
  });

  it('should handle user sign in', async () => {
    const { getByTestId } = renderAuthProvider();
    
    // Simulate user sign in
    await act(async () => {
      // Get the auth callback (second arg)
      const authCallback = (firebaseAuth as any).onAuthStateChanged.mock.calls[0][1];
      // Call with mock user
      await authCallback(mockFirebaseUser);
    });

    // Wait for loading to complete and verify user data
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('user-role')).toHaveTextContent('member');
    });
  });

  it('should call backend profile endpoint after sign in', async () => {
    const { getByTestId } = renderAuthProvider();

    // Simulate user sign in
    await act(async () => {
      const authCallback = (firebaseAuth as any).onAuthStateChanged.mock.calls[0][1];
      await authCallback(mockFirebaseUser);
    });

    // Wait for loading to complete and verify user data
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    // Verify backend profile endpoint was called (URL contains expected path)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/members/profile/firebase/test-uid')
    );
  });

  it('should handle sign out', async () => {
    const { getByTestId } = renderAuthProvider();
    
    // First sign in
    await act(async () => {
      const authCallback = (firebaseAuth as any).onAuthStateChanged.mock.calls[0][1];
      await authCallback(mockFirebaseUser);
    });

    // Then sign out
    await act(async () => {
      const authCallback = (firebaseAuth as any).onAuthStateChanged.mock.calls[0][1];
      await authCallback(null);
    });

    // Verify no user is shown
    await waitFor(() => {
      expect(screen.getByTestId('no-user')).toBeInTheDocument();
    });
  });
});
