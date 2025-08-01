// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock Firebase Auth
const mockGetAuth = jest.fn(() => ({
  app: {
    options: {
      apiKey: 'test-api-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project',
      storageBucket: 'test.appspot.com',
      messagingSenderId: '1234567890',
      appId: '1:1234567890:web:abcdef123456'
    }
  },
  currentUser: null
}));

const mockSignInWithEmailAndPassword = jest.fn();
const mockSignInWithPhoneNumber = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
const mockConfirmPasswordReset = jest.fn();
const mockVerifyPasswordResetCode = jest.fn();

// Mock Firebase Auth module
jest.mock('firebase/auth', () => ({
  getAuth: mockGetAuth,
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  signInWithPhoneNumber: mockSignInWithPhoneNumber,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  confirmPasswordReset: mockConfirmPasswordReset,
  verifyPasswordResetCode: mockVerifyPasswordResetCode,
  RecaptchaVerifier: jest.fn().mockImplementation(() => ({
    clear: jest.fn(),
    render: jest.fn()
  })),
  // Add other Firebase Auth methods as needed
}));

// Mock the Firebase app and its exports
const mockAuth = mockGetAuth();

jest.mock('./firebase', () => ({
  __esModule: true,
  default: jest.fn(),
  auth: mockAuth,
  initializeApp: jest.fn(() => ({
    // Mock Firebase app methods if needed
  })),
  getAuth: jest.fn(() => mockAuth)
}));

// Set up environment variables for Firebase
process.env.REACT_APP_FIREBASE_API_KEY = 'test-api-key';
process.env.REACT_APP_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.REACT_APP_FIREBASE_PROJECT_ID = 'test-project';
process.env.REACT_APP_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID = '1234567890';
process.env.REACT_APP_FIREBASE_APP_ID = '1:1234567890:web:abcdef123456';

// Export the mocks for use in test files
export {
  mockGetAuth,
  mockSignInWithEmailAndPassword,
  mockSignInWithPhoneNumber,
  mockSignOut,
  mockOnAuthStateChanged,
  mockSendPasswordResetEmail,
  mockConfirmPasswordReset,
  mockVerifyPasswordResetCode
};
