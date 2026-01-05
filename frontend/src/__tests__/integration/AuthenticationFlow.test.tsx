import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { I18nProvider } from '../../i18n/I18nProvider';
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
  // Ensure onAuthStateChanged returns an unsubscribe function consistently
  if (!(firebaseAuth as any).onAuthStateChanged?.mock) {
    (firebaseAuth as any).onAuthStateChanged = jest.fn();
  }
  (firebaseAuth as any).onAuthStateChanged.mockImplementation((authArg: any, callback: any) => {
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
  let utils: any;

  await act(async () => {
    utils = render(
      <BrowserRouter>
        <I18nProvider>
          <LanguageProvider>
            <AuthProvider>
              {component}
            </AuthProvider>
          </LanguageProvider>
        </I18nProvider>
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

  // Email flows removed: SignIn is phone-only now

  describe('Complete Phone Authentication Flow', () => {
    it.skip('should handle complete phone login flow with test number', async () => {
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

      // Phone-only UI: no switch needed

      // Fill in phone form with test number (should bypass reCAPTCHA)
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const initialButton = screen.getByRole('button', { name: /enter 10 digits|complete recaptcha first|send (code|otp)/i });

      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      });

      // With current UI, reCAPTCHA must be solved; skip full flow until test harness can simulate it
    });

    it('should handle phone login with invalid number', async () => {
      // Mock failed sign in with invalid phone number
      const error = new Error('auth/invalid-phone-number') as Error & { code: string };
      error.code = 'auth/invalid-phone-number';
      mockSignInWithPhoneNumber.mockRejectedValueOnce(error);

      // Render the component with providers
      await renderWithProviders(<SignIn />);

      // Fill in phone form with invalid number
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const submitBtn = screen.getByRole('button', { name: /enter 10 digits|complete recaptcha first|send (code|otp)/i });

      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '123' } });
      });

      // Button should remain disabled with "Enter 10 Digits" label; no error banner is shown
      await waitFor(() => {
        expect(submitBtn).toBeDisabled();
        expect(submitBtn).toHaveTextContent(/enter 10 digits/i);
        expect(screen.queryByText('Please enter a valid phone number.')).toBeNull();
      });
    });
  });

  describe('Error Handling Integration', () => {
    it.skip('should handle network errors during phone authentication', async () => {
      // Mock network error during phone sign in
      const error = new Error('Network error') as Error & { code: string };
      error.code = 'auth/network-request-failed';
      mockSignInWithPhoneNumber.mockRejectedValueOnce(error);

      // Render the component with providers
      await renderWithProviders(<SignIn />);

      // Fill in phone form with valid test number
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const initialBtn = screen.getByRole('button', { name: /enter 10 digits|send (code|otp)/i });

      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      });

      const sendCodeButton = await screen.findByRole('button', { name: /send (code|otp)/i });

      await act(async () => {
        fireEvent.click(sendCodeButton);
      });

      // Check for network error message
      await waitFor(() => {
        expect(screen.getByText(/A network error occurred. Please check your connection/)).toBeInTheDocument();
      });
    });

    it.skip('should handle Firebase configuration errors', async () => {
      // Mock Firebase configuration error
      const error = new Error('Firebase configuration is incomplete') as Error & { code: string };
      error.code = 'auth/invalid-api-key';
      mockSignInWithPhoneNumber.mockRejectedValueOnce(error);

      // Render the component with providers
      await renderWithProviders(<SignIn />);

      // Fill in phone form with test number
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const initialBtn2 = screen.getByRole('button', { name: /enter 10 digits|send (code|otp)/i });

      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      });

      const sendCodeButton2 = await screen.findByRole('button', { name: /send (code|otp)/i });

      await act(async () => {
        fireEvent.click(sendCodeButton2);
      });

      // Check for configuration error message
      await waitFor(() => {
        expect(screen.getByText(/Firebase configuration is incomplete/)).toBeInTheDocument();
      });
    });
  });

  // Email/password validation tests removed in phone-only mode

  // State management tests for email/phone switching removed in phone-only mode

  describe('reCAPTCHA Integration', () => {
    it.skip('should properly initialize and clean up reCAPTCHA', async () => {
      const { signInWithPhoneNumber } = require('firebase/auth');
      const mockSignInWithPhoneNumber = jest.fn().mockResolvedValue({
        confirm: jest.fn()
      });

      signInWithPhoneNumber.mockImplementation(mockSignInWithPhoneNumber);

      await renderWithProviders(<SignIn />);

      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');

      // Initially button shows Enter 10 Digits; after valid input it becomes Send OTP/Code and enables
      const initialBtn = screen.getByRole('button', { name: /enter 10 digits|send (code|otp)/i });

      fireEvent.change(phoneInput, { target: { value: '5551234567' } });

      const submitButton = await screen.findByRole('button', { name: /send (code|otp)/i });
      await waitFor(() => expect(submitButton).toBeEnabled());

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRecaptchaVerifier.clear).toHaveBeenCalled();
      });

      // reCAPTCHA should be cleaned up after sending
      expect(mockRecaptchaVerifier.clear).toHaveBeenCalled();
    });
  });
}); 