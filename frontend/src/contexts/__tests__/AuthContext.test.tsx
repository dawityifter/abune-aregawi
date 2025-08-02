import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock Firebase Auth
const mockOnAuthStateChanged = jest.fn();
const mockGetIdToken = jest.fn().mockResolvedValue('test-token');
const mockSignInWithEmailAndPassword = jest.fn();
const mockSignInWithPhoneNumber = jest.fn();
const mockSignOut = jest.fn();
const mockUpdateProfile = jest.fn();

// Mock Firebase User
const mockFirebaseUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  phoneNumber: '+1234567890',
  displayName: 'Test User',
  getIdToken: mockGetIdToken,
  _temp: false
};

// Mock the Firebase auth module
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: mockFirebaseUser,
    onAuthStateChanged: mockOnAuthStateChanged,
    signOut: mockSignOut
  })),
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  signInWithPhoneNumber: mockSignInWithPhoneNumber,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
  updateProfile: mockUpdateProfile,
  RecaptchaVerifier: jest.fn(() => ({
    render: jest.fn(),
    verify: jest.fn().mockResolvedValue('test-verification-id')
  }))
}));

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

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
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/auth/profile')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              member: {
                id: 'test-uid',
                email: 'test@example.com',
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
        json: async () => ({ success: true })
      });
    });
    
    // Set up auth state changed mock
    mockOnAuthStateChanged.mockImplementation((callback) => {
      // Initial call with null user
      callback(null);
      return jest.fn(); // Return unsubscribe function
    });
    
    // Reset mocks
    mockGetIdToken.mockClear().mockResolvedValue('test-token');
    mockSignInWithEmailAndPassword.mockClear().mockResolvedValue({ user: mockFirebaseUser });
    mockSignInWithPhoneNumber.mockClear().mockResolvedValue({ 
      confirm: jest.fn().mockResolvedValue({ user: mockFirebaseUser }) 
    });
  });

  it('should render loading state initially', () => {
    renderAuthProvider();
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('should handle user sign in', async () => {
    const { getByTestId } = renderAuthProvider();
    
    // Simulate user sign in
    await act(async () => {
      // Get the auth callback
      const authCallback = mockOnAuthStateChanged.mock.calls[0][0];
      // Call with mock user
      await authCallback(mockFirebaseUser);
    });

    // Wait for loading to complete and verify user data
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('user-role')).toHaveTextContent('member');
    });
  });

  it('should include auth token in API requests', async () => {
    const { getByTestId } = renderAuthProvider();

    // Simulate user sign in
    await act(async () => {
      const authCallback = mockOnAuthStateChanged.mock.calls[0][0];
      await authCallback(mockFirebaseUser);
    });

    // Wait for loading to complete and verify user data
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });

    // Verify the token was included in the API request
    expect(mockGetIdToken).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/profile'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    );
  });

  it('should handle sign out', async () => {
    const { getByTestId } = renderAuthProvider();
    
    // First sign in
    await act(async () => {
      const authCallback = mockOnAuthStateChanged.mock.calls[0][0];
      await authCallback(mockFirebaseUser);
    });

    // Then sign out
    await act(async () => {
      const authCallback = mockOnAuthStateChanged.mock.calls[0][0];
      await authCallback(null);
    });

    // Verify no user is shown
    await waitFor(() => {
      expect(screen.getByTestId('no-user')).toBeInTheDocument();
    });
  });
});
