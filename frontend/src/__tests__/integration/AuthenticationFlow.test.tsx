import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import SignIn from '../../components/auth/SignIn';
import { User } from 'firebase/auth';
import * as firebaseAuth from 'firebase/auth';

// Mock the entire firebase/auth module
jest.mock('firebase/auth');

// Create and export mockRecaptchaVerifier for use in tests
export const mockRecaptchaVerifier = {
  clear: jest.fn(),
  render: jest.fn()
};

// Mock window.recaptchaVerifier
global.window.recaptchaVerifier = mockRecaptchaVerifier;

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock Firebase Auth methods
const mockSignInWithEmailAndPassword = jest.fn();
const mockSignInWithPhoneNumber = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();
const mockGetAuth = jest.fn();

// Mock Firebase User
const mockFirebaseUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  phoneNumber: '+1234567890',
  displayName: 'Test User',
  getIdToken: jest.fn().mockResolvedValue('test-token')
};

// Mock the Firebase auth module implementation
const mockAuth = {
  currentUser: mockFirebaseUser,
  onAuthStateChanged: mockOnAuthStateChanged,
  signOut: mockSignOut
};

// Set up the mock implementations
beforeEach(() => {
  jest.clearAllMocks();
  
  // Mock the Firebase auth module
  (firebaseAuth as any).getAuth.mockReturnValue(mockAuth);
  (firebaseAuth as any).signInWithEmailAndPassword = mockSignInWithEmailAndPassword;
  (firebaseAuth as any).signInWithPhoneNumber = mockSignInWithPhoneNumber;
  (firebaseAuth as any).signOut = mockSignOut;
  (firebaseAuth as any).onAuthStateChanged = mockOnAuthStateChanged;
  
  // Set up the default mock implementation for onAuthStateChanged
  mockOnAuthStateChanged.mockImplementation((callback) => {
    // Call the callback with null user initially
    callback(null);
    // Return the unsubscribe function
    return jest.fn();
  });
  
  // Mock successful API responses
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      success: true,
      data: {}
    })
  });
});

const renderWithProviders = async (component: React.ReactElement) => {
  let utils;
  
  await act(async () => {
    utils = render(
      <BrowserRouter>
        <AuthProvider>
          {component}
        </AuthProvider>
      </BrowserRouter>
    );
  });
  
  return utils!;
};

// Helper function to simulate auth state change
const simulateAuthStateChange = (user: any = null) => {
  // Update the mock implementation to call the callback with the provided user
  mockOnAuthStateChanged.mockImplementationOnce((callback) => {
    callback(user);
    return jest.fn();
  });
};

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock document.getElementById for reCAPTCHA
    document.getElementById = jest.fn().mockReturnValue({
      innerHTML: '',
      firstChild: null,
      removeChild: jest.fn()
    });
    
    // Reset all mocks to their initial state
    mockSignInWithEmailAndPassword.mockReset();
    mockSignInWithPhoneNumber.mockReset();
    mockSignOut.mockReset();
    mockOnAuthStateChanged.mockReset();
    
    // Set up the default mock implementation for onAuthStateChanged
    mockOnAuthStateChanged.mockImplementation((callback) => {
      // Call the callback with null user initially
      callback(null);
      // Return the unsubscribe function
      return jest.fn();
    });
    
    // Mock successful API responses
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

  describe('Complete Email Authentication Flow', () => {
    it('should handle complete email login flow', async () => {
      // Mock successful sign in
      mockSignInWithEmailAndPassword.mockResolvedValueOnce({
        user: {
          ...mockFirebaseUser,
          getIdToken: jest.fn().mockResolvedValue('mock-token')
        }
      });
      
      // Mock the fetch response for profile data
      const mockProfileData = {
        id: 'test-member-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '+1234567890'
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { member: mockProfileData }
        })
      });

      // Render the component with providers
      await renderWithProviders(<SignIn />);

      // Fill in login form
      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByText('Sign In');

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Verify Firebase auth was called with correct credentials
      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
          mockAuth,
          'test@example.com',
          'password123'
        );
      });
      
      // Verify profile fetch was called with correct user ID
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/members/profile/firebase/test-uid'),
          expect.objectContaining({
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer mock-token'
            }
          })
        );
      });
    });

    it('should handle email login with invalid credentials', async () => {
      // Mock failed sign in with invalid credentials
      const error = new Error('auth/user-not-found') as Error & { code: string };
      error.code = 'auth/user-not-found';
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(error);

      // Render the component with providers
      await renderWithProviders(<SignIn />);

      // Fill in login form with invalid credentials
      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'nonexistent@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
        fireEvent.click(submitButton);
      });

      // Check for error message
      await waitFor(() => {
        expect(screen.getByText('User not found. Please check your email or sign up.')).toBeInTheDocument();
      });
      
      // Verify Firebase auth was called with the provided credentials
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'nonexistent@example.com',
        'wrongpassword'
      );
    });
  });

  describe('Complete Phone Authentication Flow', () => {
    it('should handle complete phone login flow with test number', async () => {
      // Mock the confirmation result for the OTP verification
      const mockConfirmationResult = {
        confirm: jest.fn().mockResolvedValue({
          user: {
            ...mockFirebaseUser,
            phoneNumber: '+15551234567',
            getIdToken: jest.fn().mockResolvedValue('mock-token')
          }
        })
      };
      
      // Mock the signInWithPhoneNumber to return the confirmation result
      mockSignInWithPhoneNumber.mockResolvedValueOnce(mockConfirmationResult);
      
      // Mock the fetch response for profile data
      const mockProfileData = {
        id: 'test-member-id',
        phoneNumber: '+15551234567',
        firstName: 'Test',
        lastName: 'User'
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { member: mockProfileData }
        })
      });

      // Render the component with providers
      await renderWithProviders(<SignIn />);

      // Switch to phone method
      const phoneButton = screen.getByRole('button', { name: /phone/i });
      await act(async () => {
        fireEvent.click(phoneButton);
      });

      // Fill in phone form with test number (should bypass reCAPTCHA)
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const sendCodeButton = screen.getByRole('button', { name: /send code/i });
      
      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      });
      
      // Verify the button is enabled for test numbers (bypassing reCAPTCHA)
      expect(sendCodeButton).not.toBeDisabled();
      
      // Submit the phone number
      await act(async () => {
        fireEvent.click(sendCodeButton);
      });

      // Verify Firebase auth was called with the correct phone number
      await waitFor(() => {
        expect(mockSignInWithPhoneNumber).toHaveBeenCalledWith(
          mockAuth,
          '+15551234567',
          expect.any(Object) // recaptchaVerifier
        );
      });
    });

    it('should handle phone login with invalid number', async () => {
      // Mock failed sign in with invalid phone number
      const error = new Error('auth/invalid-phone-number') as Error & { code: string };
      error.code = 'auth/invalid-phone-number';
      mockSignInWithPhoneNumber.mockRejectedValueOnce(error);

      // Render the component with providers
      await renderWithProviders(<SignIn />);

      // Switch to phone method
      const phoneButton = screen.getByRole('button', { name: /phone/i });
      await act(async () => {
        fireEvent.click(phoneButton);
      });

      // Fill in phone form with invalid number
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const sendCodeButton = screen.getByRole('button', { name: /send code/i });
      
      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '123' } });
        fireEvent.click(sendCodeButton);
      });

      // Check for error message
      await waitFor(() => {
        expect(screen.getByText('Please enter a complete phone number.')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network errors during authentication', async () => {
      // Mock network error during sign in
      const error = new Error('Network error') as Error & { code: string };
      error.code = 'auth/network-request-failed';
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(error);

      // Render the component with providers
      await renderWithProviders(<SignIn />);

      // Fill in login form
      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Check for network error message
      await waitFor(() => {
        expect(screen.getByText(/A network error occurred. Please check your connection/)).toBeInTheDocument();
      });
    });

    it('should handle Firebase configuration errors', async () => {
      // Mock Firebase configuration error
      const error = new Error('Firebase configuration is incomplete') as Error & { code: string };
      error.code = 'auth/invalid-api-key';
      mockSignInWithPhoneNumber.mockRejectedValueOnce(error);

      // Render the component with providers
      await renderWithProviders(<SignIn />);

      // Switch to phone method
      const phoneButton = screen.getByRole('button', { name: /phone/i });
      await act(async () => {
        fireEvent.click(phoneButton);
      });

      // Fill in phone form with test number
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const sendCodeButton = screen.getByRole('button', { name: /send code/i });
      
      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '5551234567' } });
        fireEvent.click(sendCodeButton);
      });

      // Check for configuration error message
      await waitFor(() => {
        expect(screen.getByText(/Firebase configuration is incomplete/)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation Integration', () => {
    it('should validate email format', async () => {
      // Render the component with providers
      await renderWithProviders(<SignIn />);

      // Get form elements
      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Submit form with invalid email
      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });
        fireEvent.click(submitButton);
      });

      // Check for validation error
      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid email address/)).toBeInTheDocument();
      });
      
      // Verify no API calls were made
      expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('should validate password length', async () => {
      // Render the component with providers
      await renderWithProviders(<SignIn />);

      // Get form elements
      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Submit form with short password
      await act(async () => {
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: '123' } });
        fireEvent.click(submitButton);
      });

      // Check for validation error
      await waitFor(() => {
        expect(screen.getByText(/Password must be at least 6 characters/)).toBeInTheDocument();
      });
      
      // Verify no API calls were made
      expect(mockSignInWithEmailAndPassword).not.toHaveBeenCalled();
    });
  });

  describe('State Management Integration', () => {
    it('should maintain form state during method switching', async () => {
      await renderWithProviders(<SignIn />);

      // Fill email form
      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      // Switch to phone
      const phoneButton = screen.getByText('Phone');
      fireEvent.click(phoneButton);

      // Switch back to email
      const emailButton = screen.getByText('Email/Password');
      fireEvent.click(emailButton);

      // Form should be cleared
      expect(emailInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');
    });

    it('should clear errors when switching methods', async () => {
      await renderWithProviders(<SignIn />);

      // Trigger an error
      const submitButton = screen.getByText('Sign In');
      fireEvent.click(submitButton);

      // Switch methods
      const phoneButton = screen.getByText('Phone');
      fireEvent.click(phoneButton);

      // Error should be cleared
      expect(screen.queryByText('Please enter both email and password.')).not.toBeInTheDocument();
    });
  });

  describe('reCAPTCHA Integration', () => {
    it('should properly initialize and clean up reCAPTCHA', async () => {
      const { signInWithPhoneNumber } = require('firebase/auth');
      const mockSignInWithPhoneNumber = jest.fn().mockResolvedValue({
        confirm: jest.fn()
      });
      
      signInWithPhoneNumber.mockImplementation(mockSignInWithPhoneNumber);

      await renderWithProviders(<SignIn />);

      // Switch to phone method
      const phoneButton = screen.getByText('Phone');
      fireEvent.click(phoneButton);

      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const submitButton = screen.getByText('Send Code');

      fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRecaptchaVerifier.clear).toHaveBeenCalled();
      });

      // Switch back to email
      const emailButton = screen.getByText('Email/Password');
      fireEvent.click(emailButton);

      // reCAPTCHA should be cleaned up
      expect(mockRecaptchaVerifier.clear).toHaveBeenCalled();
    });
  });
}); 