import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock Firebase Auth
const mockOnAuthStateChanged = jest.fn();
const mockGetIdToken = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../firebase', () => ({
  auth: {
    onAuthStateChanged: mockOnAuthStateChanged,
    signOut: mockSignOut
  }
}));

// Mock Firebase User
const mockFirebaseUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  phoneNumber: '+1234567890',
  displayName: 'Test User',
  getIdToken: mockGetIdToken
};

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
      
      expect(screen.getByTestId('loading')).toHaveTextContent('true');
      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });

    it('should initialize Firebase auth listener', () => {
      renderAuthProvider();
      
      expect(mockOnAuthStateChanged).toHaveBeenCalled();
    });
  });

  describe('Authentication State Changes', () => {
    it('should update state when user signs in', async () => {
      let authCallback: (user: any) => void;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return jest.fn();
      });

      renderAuthProvider();

      // Simulate user sign in
      await act(async () => {
        authCallback!(mockFirebaseUser);
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
        expect(screen.getByTestId('user')).not.toHaveTextContent('null');
      });
    });

    it('should update state when user signs out', async () => {
      let authCallback: (user: any) => void;
      mockOnAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return jest.fn();
      });

      renderAuthProvider();

      // Simulate user sign in
      await act(async () => {
        authCallback!(mockFirebaseUser);
      });

      // Simulate user sign out
      await act(async () => {
        authCallback!(null);
      });

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('null');
      });
    });

    it('should fetch user profile from backend when Firebase user exists', async () => {
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
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/members/profile/firebase/test-uid'),
          expect.any(Object)
        );
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
      mockSignOut.mockResolvedValue(undefined);

      renderAuthProvider();

      const logoutButton = screen.getByText('Logout');
      await act(async () => {
        logoutButton.click();
      });

      expect(mockSignOut).toHaveBeenCalled();
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