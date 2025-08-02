import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../../contexts/AuthContext';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import SignIn from '../SignIn';
import '@testing-library/jest-dom';

// Mock translations for testing
interface Translations {
  [key: string]: string;
}

const mockTranslations: Translations = {
  'auth.signIn.title': 'Sign In',
  'auth.signIn.phoneNumber': 'Phone Number',
  'auth.signIn.phonePlaceholder': 'Enter your phone number',
  'auth.signIn.continue': 'Continue with Phone',
  'auth.phone.placeholder': 'Phone Number',
  'auth.phone.required': 'Phone number is required',
  'auth.phone.invalid': 'Please enter a valid phone number',
  'auth.verificationCode.placeholder': 'Verification Code',
  'auth.verificationCode.required': 'Verification code is required',
  'auth.verificationCode.invalid': 'Please enter a valid verification code',
  'auth.sendCode': 'Send Code',
  'auth.verify': 'Verify',
  'auth.signInWithPhone': 'Sign in with Phone',
  'auth.signInWithEmail': 'Sign in with Email',
  'auth.email.placeholder': 'Email',
  'auth.email.required': 'Email is required',
  'auth.email.invalid': 'Please enter a valid email',
  'auth.password.placeholder': 'Password',
  'auth.password.required': 'Password is required',
  'auth.password.tooShort': 'Password must be at least 8 characters',
  'auth.signIn': 'Sign In',
  'auth.dontHaveAccount': "Don't have an account?",
  'auth.registerHere': 'Register here',
  'auth.or': 'OR',
  'auth.switchToPhone': 'Switch to phone sign in',
  'auth.switchToEmail': 'Switch to email sign in',
  'auth.verificationCode.sent': 'Verification code sent',
  'auth.verificationCode.failed': 'Failed to send verification code',
  'auth.signIn.success': 'Successfully signed in',
  'auth.signIn.failed': 'Failed to sign in',
  'auth.invalidCode': 'Invalid verification code',
  'auth.tooManyRequests': 'Too many requests. Please try again later.',
  'auth.userNotFound': 'No account found with this phone number',
  'auth.wrongPassword': 'Incorrect password',
  'auth.invalidEmail': 'Invalid email address',
  'auth.accountExists': 'An account already exists with this email',
  'auth.weakPassword': 'Password is too weak',
  'auth.operationNotAllowed': 'This operation is not allowed',
  'auth.networkRequestFailed': 'Network error. Please check your connection.',
  'auth.unknownError': 'An unknown error occurred',
};


// Mock Firebase Auth
jest.mock('../../../firebase', () => ({
  auth: {
    app: {
      options: {
        apiKey: 'test-api-key'
      }
    },
    currentUser: null,
    onAuthStateChanged: jest.fn()
  }
}));

// Mock RecaptchaVerifier
const mockRecaptchaVerifier = {
  clear: jest.fn(),
  render: jest.fn()
};

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
    onAuthStateChanged: jest.fn()
  })),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPhoneNumber: jest.fn(),
  RecaptchaVerifier: jest.fn().mockImplementation(() => mockRecaptchaVerifier),
  onAuthStateChanged: jest.fn()
}));

// Mock the useAuth hook
const mockUseAuth = jest.fn();

// Mock the AuthContext module
jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => mockUseAuth()
}));

// Default mock implementation for useAuth with phone login only
const mockAuth = {
  loginWithPhone: jest.fn().mockResolvedValue({}),
  loginWithEmail: jest.fn().mockResolvedValue({}),
  logout: jest.fn(),
  clearError: jest.fn(),
  loading: false,
  currentUser: null,
  user: null,
  error: null as string | null
};

// Mock useAuth hook
const mockUseAuth = jest.fn(() => mockAuth);

// Mock the AuthContext module
jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => mockUseAuth()
}));

// Create a test wrapper component that includes all necessary providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MemoryRouter>
      <LanguageProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
};



const renderSignIn = (props = {}) => {
  // Reset mock implementations
  mockUseAuth.mockImplementation(() => ({
    ...mockAuth,
    loading: false,
    error: null,
  }));
  
  // Mock the useLanguage hook
  jest.mock('../../../contexts/LanguageContext', () => ({
    ...jest.requireActual('../../../contexts/LanguageContext'),
    useLanguage: () => ({
      t: (key: string) => mockTranslations[key] || key,
      language: 'en',
      currentLanguage: 'en',
      setLanguage: jest.fn(),
      changeLanguage: jest.fn()
    })
  }));
  
  return render(
    <TestWrapper>
      <SignIn {...props} />
    </TestWrapper>
  );
};

describe('SignIn Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockAuth.loginWithPhone.mockClear().mockResolvedValue({});
    mockAuth.clearError.mockImplementation(() => {
      mockAuth.error = null;
    });
    
    // Mock document.getElementById for recaptcha container
    document.getElementById = jest.fn().mockImplementation((id) => {
      if (id === 'recaptcha-container') {
        return {
          innerHTML: '',
          firstChild: null,
          removeChild: jest.fn()
        };
      }
      return null;
    });
    
    // Reset the mock implementation for useAuth
    mockUseAuth.mockImplementation(() => ({
      ...mockAuth,
      loading: false,
      error: null,
    }));
  });

  describe('Phone Authentication', () => {
    it('should render phone form by default', () => {
      renderSignIn();
      
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('(555) 123-4567')).toBeInTheDocument();
    });

    it('should render phone form with proper instructions', () => {
      renderSignIn();
      expect(screen.getByText('Phone Number')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('(555) 123-4567')).toBeInTheDocument();
      expect(screen.getByText('Enter 10 digits (e.g., 5551234567) - will auto-format')).toBeInTheDocument();
    });

    it('should format phone number input', () => {
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      
      fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      
      expect(phoneInput).toHaveValue('(555) 123-4567');
    });

    it('should call loginWithPhone with correct phone number', async () => {
      renderSignIn();
      
      // Switch to phone login
      fireEvent.click(screen.getByText('signin.phoneLogin'));
      
      // Fill in the phone number
      fireEvent.change(screen.getByLabelText(/phone number/i), {
        target: { value: '+1234567890' }
      });
      
      // Submit the form
      fireEvent.click(screen.getByText('signin.sendVerificationCode'));
      
      // Check if loginWithPhone was called with the right arguments
      expect(mockAuth.loginWithPhone).toHaveBeenCalledWith('+1234567890');
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
      // Set loading state to true
      mockAuth.loading = true;
      
      renderSignIn();

      // The button text should be 'Signing In...' when loading
      expect(screen.getByText('signin.signingIn')).toBeInTheDocument();
    });

    it('should disable submit button during loading', () => {
      // Set loading state to true
      mockAuth.loading = true;
      
      renderSignIn();

      const submitButton = screen.getByText('signin.signingIn');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display authentication errors', async () => {
      // Set error state
      mockAuth.error = 'Authentication failed';
      
      renderSignIn();

      // Error message should be displayed
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    });

    it('should clear errors when switching methods', () => {
      // Set up mock clearError function
      const mockClearError = jest.fn();
      mockAuth.clearError = mockClearError;
      mockAuth.error = 'Authentication failed';
      
      renderSignIn();

      // Switch to phone method
      const phoneButton = screen.getByText('Phone');
      fireEvent.click(phoneButton);

      // Should call clearError when switching methods
      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('reCAPTCHA Integration', () => {
    it('should initialize reCAPTCHA for phone authentication', async () => {
      // Mock successful phone login
      mockAuth.loginWithPhone.mockResolvedValue({ confirm: jest.fn() });
      
      renderSignIn();
      
      // Switch to phone method
      const phoneButton = screen.getByText('Sign in with Phone Number');
      fireEvent.click(phoneButton);

      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const submitButton = screen.getByText('Send Code');

      fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      fireEvent.click(submitButton);

      // Verify reCAPTCHA was cleared after submission
      await waitFor(() => {
        expect(mockRecaptchaVerifier.clear).toHaveBeenCalled();
      });
    });
  });
}); 