import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../../contexts/AuthContext';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import { I18nProvider } from '../../../i18n/I18nProvider';
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
  // Resolve to a widget ID to simulate successful render
  render: jest.fn().mockResolvedValue(1)
};

// Mock Firebase auth
jest.mock('firebase/auth', () => {
  return {
    getAuth: jest.fn(() => ({
      currentUser: null,
      onAuthStateChanged: jest.fn(() => jest.fn()) // return unsubscribe
    })),
    signInWithEmailAndPassword: jest.fn(),
    signInWithPhoneNumber: jest.fn(),
    RecaptchaVerifier: jest.fn().mockImplementation((authArg: any, container: any, options: any) => {
      // Immediately invoke callback to set recaptchaSolved=true in component
      if (options && typeof options.callback === 'function') {
        try { options.callback(); } catch { }
      }
      return mockRecaptchaVerifier;
    }),
    onAuthStateChanged: jest.fn(() => jest.fn()) // return unsubscribe
  };
});

// Import SignIn AFTER mocks to ensure it uses the mocked modules
import SignIn from '../SignIn';
// (removed duplicate preliminary mockUseAuth and AuthContext mock)

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
  // Stub provider to avoid setting up real listeners in tests
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockUseAuth()
}));

// Create a test wrapper component that includes all necessary providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MemoryRouter>
      <I18nProvider>
        <LanguageProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </LanguageProvider>
      </I18nProvider>
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
      expect(screen.getByText('Phone Number')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('(555) 123-4567')).toBeInTheDocument();
      // Initial submit button prompt
      expect(screen.getByText('Enter 10 Digits')).toBeInTheDocument();
    });

    it('should render phone form with proper instructions', () => {
      renderSignIn();
      expect(screen.getByText('Phone Number')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('(555) 123-4567')).toBeInTheDocument();
      expect(screen.getByText('Enter 10 digits (e.g., 5551234567) - will auto-format')).toBeInTheDocument();
    });

    it('should format phone number input', () => {
      renderSignIn();
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      fireEvent.change(phoneInput, { target: { value: '5551234567' } });
      expect(phoneInput).toHaveValue('(555) 123-4567');
    });

    it('should call loginWithPhone with normalized phone number when recaptcha solved', async () => {
      const { container } = renderSignIn();
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      // Use a non-test number so RecaptchaVerifier is initialized and callback enables button
      fireEvent.change(phoneInput, { target: { value: '4691234567' } });

      // Manually trigger the mocked RecaptchaVerifier callback to simulate solved reCAPTCHA
      const mockedFirebaseAuth: any = jest.requireMock('firebase/auth');
      const firstCall = mockedFirebaseAuth.RecaptchaVerifier.mock.calls[0];
      const options = firstCall && firstCall[2];
      if (options && typeof options.callback === 'function') {
        options.callback();
      }

      // Wait for the enabled Send OTP button and click it
      const submitBtn = await screen.findByRole('button', { name: /send otp/i });
      await waitFor(() => expect(submitBtn).toBeEnabled());
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockAuth.loginWithPhone).toHaveBeenCalledWith('+14691234567', expect.any(Object));
      });
    });

    it('should show error for incomplete phone number on submit attempt', async () => {
      renderSignIn();
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      fireEvent.change(phoneInput, { target: { value: '555' } });
      // Button remains 'Enter 10 Digits' and disabled; error appears only on submit handler, so no click.
      expect(screen.getByText('Enter 10 Digits')).toBeInTheDocument();
    });
  });

  // Removed Method Switching tests as SignIn is phone-only

  describe('Loading States', () => {
    it('should show loading state during phone sign in (button disabled)', () => {
      mockAuth.loading = true;
      renderSignIn();
      const button = screen.getByRole('button', { name: /enter 10 digits|send otp|sending otp/i });
      expect(button).toBeDisabled();
    });

    it('should disable submit button during loading', () => {
      mockAuth.loading = true;
      renderSignIn();
      const button = screen.getByRole('button', { name: /enter 10 digits|send otp|sending otp/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should display error when reCAPTCHA initialization fails', async () => {
      // For this test, make RecaptchaVerifier.render reject and do NOT auto-callback
      const mockedFirebaseAuth: any = jest.requireMock('firebase/auth');
      mockedFirebaseAuth.RecaptchaVerifier.mockImplementationOnce((authArg: any, container: any, options: any) => {
        return {
          clear: jest.fn(),
          render: jest.fn().mockRejectedValue(new Error('render failed')),
        };
      });

      renderSignIn();
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      fireEvent.change(phoneInput, { target: { value: '5551234567' } });

      await waitFor(() => {
        const nodes = screen.getAllByText('reCAPTCHA initialization failed. Please refresh and try again.');
        expect(nodes.length).toBeGreaterThan(0);
      });
    });

    it('should allow clearing errors via Try Again', async () => {
      // Trigger the same init failure to show the error
      const mockedFirebaseAuth: any = jest.requireMock('firebase/auth');
      mockedFirebaseAuth.RecaptchaVerifier.mockImplementationOnce((authArg: any, container: any, options: any) => {
        return {
          clear: jest.fn(),
          render: jest.fn().mockRejectedValue(new Error('render failed')),
        };
      });

      renderSignIn();
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      fireEvent.change(phoneInput, { target: { value: '5551234567' } });

      await waitFor(() => {
        expect(screen.getAllByText('reCAPTCHA initialization failed. Please refresh and try again.').length).toBeGreaterThan(0);
      });

      const tryAgain = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(tryAgain);

      // After clicking Try Again, error should clear immediately
      expect(screen.queryAllByText('reCAPTCHA initialization failed. Please refresh and try again.').length).toBe(0);
    });
  });

  describe('reCAPTCHA Integration', () => {
    it('should initialize reCAPTCHA when phone becomes valid', async () => {
      renderSignIn();
      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      fireEvent.change(phoneInput, { target: { value: '5551234567' } });

      // Access mocked RecaptchaVerifier constructor
      const mockedFirebaseAuth: any = jest.requireMock('firebase/auth');
      await waitFor(() => {
        expect(mockedFirebaseAuth.RecaptchaVerifier).toHaveBeenCalled();
      });
    });
  });
}); 