import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../../contexts/AuthContext';
import SignIn from '../SignIn';

// Mock Firebase Auth
jest.mock('../../../firebase', () => ({
  auth: {
    app: {
      options: {
        apiKey: 'test-api-key'
      }
    }
  }
}));

// Mock AuthContext
const mockLoginWithEmail = jest.fn();
const mockLoginWithPhone = jest.fn();
const mockLoading = false;

jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    loginWithEmail: mockLoginWithEmail,
    loginWithPhone: mockLoginWithPhone,
    loading: mockLoading
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock RecaptchaVerifier
const mockRecaptchaVerifier = {
  clear: jest.fn(),
  render: jest.fn()
};

global.window.recaptchaVerifier = mockRecaptchaVerifier;

// Mock RecaptchaVerifier constructor
jest.mock('firebase/auth', () => ({
  RecaptchaVerifier: jest.fn().mockImplementation(() => mockRecaptchaVerifier)
}));

const renderSignIn = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <SignIn />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('SignIn Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock document.getElementById for recaptcha container
    document.getElementById = jest.fn().mockReturnValue({
      innerHTML: '',
      firstChild: null,
      removeChild: jest.fn()
    });
  });

  describe('Email/Password Authentication', () => {
    it('should render email/password form by default', () => {
      renderSignIn();
      
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByText('Email/Password')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    });

    it('should handle email/password form submission', async () => {
      mockLoginWithEmail.mockResolvedValue(true);
      renderSignIn();

      const emailInput = screen.getByPlaceholderText('Email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByText('Sign In');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLoginWithEmail).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should show error for empty email and password', async () => {
      renderSignIn();

      const submitButton = screen.getByText('Sign In');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter both email and password.')).toBeInTheDocument();
      });
    });

    it('should show error for empty email only', async () => {
      renderSignIn();

      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByText('Sign In');

      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter both email and password.')).toBeInTheDocument();
      });
    });

    it('should show error for empty password only', async () => {
      renderSignIn();

      const emailInput = screen.getByPlaceholderText('Email');
      const submitButton = screen.getByText('Sign In');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter both email and password.')).toBeInTheDocument();
      });
    });
  });

  describe('Phone Authentication', () => {
    beforeEach(() => {
      // Switch to phone method
      renderSignIn();
      const phoneButton = screen.getByText('Phone');
      fireEvent.click(phoneButton);
    });

    it('should render phone form when phone method is selected', () => {
      expect(screen.getByText('Phone Number')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('(555) 123-4567')).toBeInTheDocument();
      expect(screen.getByText('Enter 10 digits (e.g., 5551234567) - will auto-format')).toBeInTheDocument();
    });

    it('should format phone number input', () => {
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      
      fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      
      expect(phoneInput).toHaveValue('(555) 123-4567');
    });

    it('should handle phone number submission', async () => {
      mockLoginWithPhone.mockResolvedValue({ confirm: jest.fn() });
      
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const submitButton = screen.getByText('Send Code');

      fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLoginWithPhone).toHaveBeenCalledWith('+15551234567', expect.any(Object));
      });
    });

    it('should show error for incomplete phone number', async () => {
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const submitButton = screen.getByText('Send Code');

      fireEvent.change(phoneInput, { target: { value: '555' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a complete phone number.')).toBeInTheDocument();
      });
    });

    it('should show error for invalid phone number format', async () => {
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const submitButton = screen.getByText('Send Code');

      fireEvent.change(phoneInput, { target: { value: '123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a complete phone number.')).toBeInTheDocument();
      });
    });
  });

  describe('Method Switching', () => {
    it('should switch between email and phone methods', () => {
      renderSignIn();

      // Initially email method
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();

      // Switch to phone
      const phoneButton = screen.getByText('Phone');
      fireEvent.click(phoneButton);
      expect(screen.getByPlaceholderText('(555) 123-4567')).toBeInTheDocument();

      // Switch back to email
      const emailButton = screen.getByText('Email/Password');
      fireEvent.click(emailButton);
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });

    it('should clear form data when switching methods', () => {
      renderSignIn();

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
  });

  describe('Loading States', () => {
    it('should show loading state during authentication', () => {
      // Mock loading state
      jest.spyOn(require('../../../contexts/AuthContext'), 'useAuth').mockReturnValue({
        loginWithEmail: mockLoginWithEmail,
        loginWithPhone: mockLoginWithPhone,
        loading: true
      });

      renderSignIn();

      expect(screen.getByText('Signing In...')).toBeInTheDocument();
    });

    it('should disable submit button during loading', () => {
      // Mock loading state
      jest.spyOn(require('../../../contexts/AuthContext'), 'useAuth').mockReturnValue({
        loginWithEmail: mockLoginWithEmail,
        loginWithPhone: mockLoginWithPhone,
        loading: true
      });

      renderSignIn();

      const submitButton = screen.getByText('Signing In...');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display authentication errors', async () => {
      mockLoginWithEmail.mockRejectedValue(new Error('Invalid credentials'));
      renderSignIn();

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

    it('should clear errors when switching methods', () => {
      renderSignIn();

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
    it('should initialize reCAPTCHA for phone authentication', async () => {
      mockLoginWithPhone.mockResolvedValue({ confirm: jest.fn() });
      
      renderSignIn();
      
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
    });
  });
}); 