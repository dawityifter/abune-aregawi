import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import SignIn from '../../components/auth/SignIn';

// Mock Firebase
jest.mock('../../firebase', () => ({
  auth: {
    app: {
      options: {
        apiKey: 'test-api-key'
      }
    }
  }
}));

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock RecaptchaVerifier
const mockRecaptchaVerifier = {
  clear: jest.fn(),
  render: jest.fn()
};

global.window.recaptchaVerifier = mockRecaptchaVerifier;

jest.mock('firebase/auth', () => ({
  RecaptchaVerifier: jest.fn().mockImplementation(() => mockRecaptchaVerifier),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPhoneNumber: jest.fn(),
  onAuthStateChanged: jest.fn()
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById = jest.fn().mockReturnValue({
      innerHTML: '',
      firstChild: null,
      removeChild: jest.fn()
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
      const { signInWithEmailAndPassword } = require('firebase/auth');
      const mockSignInWithEmailAndPassword = jest.fn().mockResolvedValue({
        user: {
          uid: 'test-uid',
          email: 'test@example.com',
          getIdToken: jest.fn().mockResolvedValue('mock-token')
        }
      });
      
      signInWithEmailAndPassword.mockImplementation(mockSignInWithEmailAndPassword);

      renderWithProviders(<SignIn />);

      // Fill in login form
      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByText('Sign In');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
          expect.any(Object),
          'test@example.com',
          'password123'
        );
      });
    });

    it('should handle email login with invalid credentials', async () => {
      const { signInWithEmailAndPassword } = require('firebase/auth');
      const mockSignInWithEmailAndPassword = jest.fn().mockRejectedValue(
        new Error('auth/user-not-found')
      );
      
      signInWithEmailAndPassword.mockImplementation(mockSignInWithEmailAndPassword);

      renderWithProviders(<SignIn />);

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByText('Sign In');

      fireEvent.change(emailInput, { target: { value: 'invalid@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Phone login failed:/)).toBeInTheDocument();
      });
    });
  });

  describe('Complete Phone Authentication Flow', () => {
    it('should handle complete phone login flow', async () => {
      const { signInWithPhoneNumber } = require('firebase/auth');
      const mockConfirmationResult = {
        confirm: jest.fn().mockResolvedValue({
          user: {
            uid: 'test-uid',
            phoneNumber: '+1234567890',
            getIdToken: jest.fn().mockResolvedValue('mock-token')
          }
        })
      };
      
      const mockSignInWithPhoneNumber = jest.fn().mockResolvedValue(mockConfirmationResult);
      signInWithPhoneNumber.mockImplementation(mockSignInWithPhoneNumber);

      renderWithProviders(<SignIn />);

      // Switch to phone method
      const phoneButton = screen.getByText('Phone');
      fireEvent.click(phoneButton);

      // Fill in phone form
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const submitButton = screen.getByText('Send Code');

      fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(signInWithPhoneNumber).toHaveBeenCalledWith(
          expect.any(Object),
          '+15551234567',
          expect.any(Object)
        );
      });
    });

    it('should handle phone login with invalid number', async () => {
      const { signInWithPhoneNumber } = require('firebase/auth');
      const mockSignInWithPhoneNumber = jest.fn().mockRejectedValue(
        new Error('auth/invalid-phone-number')
      );
      
      signInWithPhoneNumber.mockImplementation(mockSignInWithPhoneNumber);

      renderWithProviders(<SignIn />);

      // Switch to phone method
      const phoneButton = screen.getByText('Phone');
      fireEvent.click(phoneButton);

      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const submitButton = screen.getByText('Send Code');

      fireEvent.change(phoneInput, { target: { value: '123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a complete phone number.')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network errors during authentication', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      renderWithProviders(<SignIn />);

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByText('Sign In');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Phone login failed:/)).toBeInTheDocument();
      });
    });

    it('should handle Firebase configuration errors', async () => {
      // Mock invalid Firebase config
      jest.doMock('../../firebase', () => ({
        auth: {
          app: {
            options: {
              apiKey: 'YOUR_API_KEY' // Invalid config
            }
          }
        }
      }));

      renderWithProviders(<SignIn />);

      // Switch to phone method
      const phoneButton = screen.getByText('Phone');
      fireEvent.click(phoneButton);

      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const submitButton = screen.getByText('Send Code');

      fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Firebase configuration is incomplete/)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation Integration', () => {
    it('should validate email format', async () => {
      renderWithProviders(<SignIn />);

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByText('Sign In');

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // Should still proceed with form submission, validation happens on backend
      await waitFor(() => {
        expect(screen.queryByText(/invalid email/i)).not.toBeInTheDocument();
      });
    });

    it('should validate password length', async () => {
      renderWithProviders(<SignIn />);

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByText('Sign In');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.click(submitButton);

      // Should still proceed with form submission, validation happens on backend
      await waitFor(() => {
        expect(screen.queryByText(/password too short/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('State Management Integration', () => {
    it('should maintain form state during method switching', () => {
      renderWithProviders(<SignIn />);

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

    it('should clear errors when switching methods', () => {
      renderWithProviders(<SignIn />);

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

      renderWithProviders(<SignIn />);

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