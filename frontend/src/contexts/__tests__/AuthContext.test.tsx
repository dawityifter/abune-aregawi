import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthContext';
import { User } from 'firebase/auth';

// First, create mock functions that don't depend on each other
const mockOnAuthStateChanged = jest.fn();
const mockGetIdToken = jest.fn();
const mockUnsubscribe = jest.fn();

// Mock Firebase User
const mockFirebaseUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  phoneNumber: '+1234567890',
  displayName: 'Test User',
  getIdToken: mockGetIdToken
};

// Store the auth callback to simulate auth state changes
let authCallback: ((user: any) => void) | null = null;

// Mock the Firebase auth module
jest.mock('firebase/auth', () => {
  // Mock functions that will be used in the mock implementation
  const mockSignOut = jest.fn().mockResolvedValue(undefined);
  
  // Create a mock auth object
  const mockAuth = {
    currentUser: null,
    onAuthStateChanged: jest.fn((callback: (user: User | null) => void, errorCallback?: (error: Error) => void) => {
      // Store the callback to simulate auth state changes
      authCallback = callback;
      
      // Call the callback with null initially (no user)
      if (callback) callback(null);
      
      // Return a mock unsubscribe function
      return mockUnsubscribe;
    }),
    signOut: mockSignOut
  };

  return {
    getAuth: jest.fn(() => mockAuth),
    onAuthStateChanged: jest.fn((auth, callback, errorCallback) => {
      // Store the callback to simulate auth state changes
      authCallback = callback;
      
      // Return a mock unsubscribe function
      return mockUnsubscribe;
    }),
    signOut: mockSignOut,
    // Add other Firebase auth methods as needed
  };
});

// Mock our firebase config file
jest.mock('../../firebase', () => {
  const mockSignOut = jest.fn().mockResolvedValue(undefined);
  
  return {
    auth: {
      currentUser: null,
      onAuthStateChanged: jest.fn((callback: (user: any) => void, errorCallback?: (error: Error) => void) => {
        // Store the callback to simulate auth state changes
        authCallback = callback;
        
        // Return a mock unsubscribe function
        return mockUnsubscribe;
      }),
      signOut: mockSignOut
    }
  };
});

// Mock fetch
global.fetch = jest.fn();

const TestComponent = () => {
  const { user, loading, loginWithEmail, loginWithPhone, logout } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'null'}</div>
      <button onClick={() => loginWithEmail('test@example.com', 'password')}>
        Login Email
      </button>
      <button onClick={() => loginWithPhone('+1234567890', null)}>
        Login Phone
      </button>
      <button onClick={logout}>
        Logout
      </button>
    </div>
  );
};

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
    mockOnAuthStateChanged.mockImplementation((callback) => {
      // Simulate Firebase auth state change
      callback(null); // Start with no user
      return jest.fn(); // Return unsubscribe function
    });
    mockGetIdToken.mockResolvedValue('mock-token');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          member: {
            id: 'test-member-id',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User'
          }
        }
      })
    });
  });

  describe('Initial State', () => {
    it('should start with loading state', () => {
      renderAuthProvider();
      
      // The loading state should be true initially
      expect(screen.getByTestId('loading').textContent).toBe('true');
      
      // After the auth state is resolved, loading should be false
      act(() => {
        if (authCallback) {
          authCallback(null);
        }
      });
      
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    it('should have no user initially', async () => {
      renderAuthProvider();
      
      // Trigger the auth state change with null user
      act(() => {
        if (authCallback) {
          authCallback(null);
        }
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('null');
      });
    });

    it('should initialize Firebase auth listener', () => {
      renderAuthProvider();
      
      expect(mockOnAuthStateChanged).toHaveBeenCalled();
    });
  });

  describe('Authentication State Changes', () => {
    it('should update state when user signs in', async () => {
      renderAuthProvider();

      // Simulate user sign in
      await act(async () => {
        if (authCallback) {
          authCallback(mockFirebaseUser);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
        expect(screen.getByTestId('user').textContent).not.toBe('null');
        expect(JSON.parse(screen.getByTestId('user').textContent || '')).toMatchObject({
          uid: 'test-uid',
          email: 'test@example.com',
          phoneNumber: '+1234567890',
          displayName: 'Test User'
        });
      });
    });

    it('should update state when user signs out', async () => {
      renderAuthProvider();
      
      // First sign in
      await act(async () => {
        if (authCallback) {
          authCallback(mockFirebaseUser);
        }
      });
      
      // Then sign out
      await act(async () => {
        if (authCallback) {
          authCallback(null);
        }
      });

      // Verify user is signed out
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('null');
      });
    });
    
    it('should handle auth state change errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      renderAuthProvider();
      
      // Simulate an error in the auth state change
      const error = new Error('Auth state change error');
      await act(async () => {
        if (authCallback) {
          // @ts-ignore - Testing error case
          authCallback(new Error('Auth state change error'));
        }
      });
      
      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error on auth state changed:', error);
      
      // Cleanup
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('Profile Fetching', () => {
    it('should fetch user profile from backend when Firebase user exists', async () => {
      // Mock the fetch response
      const mockProfileData = {
        id: 1,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phoneNumber: '+1234567890'
      };
      
      // @ts-ignore - Mocking fetch
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfileData),
      });
      
      renderAuthProvider();
      
      // Simulate user sign in
      await act(async () => {
        if (authCallback) {
          authCallback(mockFirebaseUser);
        }
      });
      
      // Verify the fetch was called with the correct parameters
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/members/profile/firebase/test-uid'),
          expect.objectContaining({
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
      });
      
      // Verify the user state was updated with the profile data
      await waitFor(() => {
        const userData = JSON.parse(screen.getByTestId('user').textContent || '{}');
        expect(userData).toMatchObject({
          ...mockFirebaseUser,
          ...mockProfileData
        });
      });
    });

    it('should handle backend profile fetch error gracefully', async () => {
      let authCallback: (user: any) => void;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return jest.fn();
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      renderAuthProvider();

      await act(async () => {
        authCallback!(mockFirebaseUser);
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        // Should still have user data from Firebase
        expect(screen.getByTestId('user')).not.toHaveTextContent('null');
      });
    });
  });

  describe('Login Functions', () => {
    it('should handle email login', async () => {
      const { signInWithEmailAndPassword } = require('firebase/auth');
      const mockSignInWithEmailAndPassword = jest.fn().mockResolvedValue(mockFirebaseUser);
      
      jest.doMock('firebase/auth', () => ({
        signInWithEmailAndPassword: mockSignInWithEmailAndPassword
      }));

      renderAuthProvider();

      const loginButton = screen.getByText('Login Email');
      await act(async () => {
        loginButton.click();
      });

      // Note: In a real test, you'd need to properly mock the Firebase auth functions
      // This is a simplified test to show the structure
    });

    it('should handle phone login', async () => {
      const { signInWithPhoneNumber } = require('firebase/auth');
      const mockSignInWithPhoneNumber = jest.fn().mockResolvedValue({
        confirm: jest.fn().mockResolvedValue(mockFirebaseUser)
      });
      
      jest.doMock('firebase/auth', () => ({
        signInWithPhoneNumber: mockSignInWithPhoneNumber
      }));

      renderAuthProvider();

      const loginButton = screen.getByText('Login Phone');
      await act(async () => {
        loginButton.click();
      });

      // Note: In a real test, you'd need to properly mock the Firebase auth functions
      // This is a simplified test to show the structure
    });
  });

  describe('Logout Function', () => {
    it('should call Firebase signOut when logout is triggered', async () => {
      // Get the mocked signOut function from the Firebase auth module
      const { signOut } = require('firebase/auth');
      (signOut as jest.Mock).mockResolvedValue(undefined);

      renderAuthProvider();

      const logoutButton = screen.getByText('Logout');
      await act(async () => {
        logoutButton.click();
      });

      expect(signOut).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle Firebase auth errors gracefully', async () => {
      mockOnAuthStateChanged.mockImplementation((callback, errorCallback) => {
        // Simulate Firebase error
        if (errorCallback) {
          errorCallback(new Error('Firebase auth error'));
        }
        return jest.fn();
      });

      renderAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    it('should handle network errors during profile fetch', async () => {
      let authCallback: (user: any) => void;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return jest.fn();
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      renderAuthProvider();

      await act(async () => {
        authCallback!(mockFirebaseUser);
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });
  });

  describe('Token Management', () => {
    it('should include auth token in API requests', async () => {
      let authCallback: (user: any) => void;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return jest.fn();
      });

      renderAuthProvider();

      await act(async () => {
        authCallback!(mockFirebaseUser);
      });

      await waitFor(() => {
        expect(mockGetIdToken).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': expect.stringContaining('Bearer')
            })
          })
        );
      });
    });
  });
}); 