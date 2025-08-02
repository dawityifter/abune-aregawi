import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { LanguageProvider } from '../../contexts/LanguageContext';
import Profile from '../Profile';
import '@testing-library/jest-dom';

// Mock the useLanguage hook
const mockUseLanguage = jest.fn().mockImplementation(() => ({
  t: (key: string) => key, // Return the key as the translation
  language: 'en',
  changeLanguage: jest.fn()
}));

// Mock the LanguageContext module
jest.mock('../../contexts/LanguageContext', () => ({
  ...jest.requireActual('../../contexts/LanguageContext'),
  useLanguage: () => mockUseLanguage()
}));

// Define mock data first
const mockCurrentUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  phoneNumber: '+15555555555',
  firstName: 'Test',
  lastName: 'User',
  displayName: 'Test User',
  reload: jest.fn().mockResolvedValue(undefined),
  getIdToken: jest.fn().mockResolvedValue('test-token'),
  emailVerified: true,
  metadata: {},
  providerData: [],
  delete: jest.fn(),
  getIdTokenResult: jest.fn(),
  refreshToken: 'test-refresh-token',
  tenantId: null,
  toJSON: jest.fn()
};

const mockUserProfile = {
  id: 'test-uid',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  phoneNumber: '+15555555555',
  role: 'member',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Initialize mock functions
const mockGetUserProfile = jest.fn().mockResolvedValue(mockUserProfile);
const mockUpdateUserProfileData = jest.fn().mockResolvedValue({});
const mockUpdateUserProfile = jest.fn().mockResolvedValue({});
const mockLoginWithPhone = jest.fn();
const mockLogout = jest.fn();
const mockClearError = jest.fn();

// Mock the useAuth hook
const mockUseAuth = jest.fn().mockImplementation(() => ({
  currentUser: mockCurrentUser,
  user: mockUserProfile,
  loading: false,
  error: null,
  loginWithPhone: mockLoginWithPhone,
  logout: mockLogout,
  clearError: mockClearError,
  getUserProfile: mockGetUserProfile,
  updateUserProfile: mockUpdateUserProfile,
  updateUserProfileData: mockUpdateUserProfileData
}));

// Mock the AuthContext module
jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => mockUseAuth()
}));

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: mockCurrentUser,
    onAuthStateChanged: jest.fn((callback) => {
      callback(mockCurrentUser);
      return jest.fn(); // Return mock unsubscribe function
    }),
    signOut: jest.fn().mockResolvedValue(undefined),
    updateProfile: jest.fn().mockResolvedValue(undefined),
    updateEmail: jest.fn().mockResolvedValue(undefined),
    updatePassword: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    confirmPasswordReset: jest.fn().mockResolvedValue(undefined),
    verifyPasswordResetCode: jest.fn().mockResolvedValue(undefined),
    applyActionCode: jest.fn().mockResolvedValue(undefined),
    checkActionCode: jest.fn().mockResolvedValue(undefined),
    onIdTokenChanged: jest.fn((callback) => {
      callback(mockCurrentUser);
      return jest.fn(); // Return mock unsubscribe function
    })
  })),
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({ user: mockCurrentUser }),
  createUserWithEmailAndPassword: jest.fn().mockResolvedValue({ user: mockCurrentUser }),
  signInWithPhoneNumber: jest.fn().mockResolvedValue({
    confirm: jest.fn().mockResolvedValue({ user: mockCurrentUser })
  }),
  signOut: jest.fn().mockResolvedValue(undefined),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(mockCurrentUser);
    return jest.fn(); // Return mock unsubscribe function
  }),
  updateProfile: jest.fn().mockResolvedValue(undefined),
  updateEmail: jest.fn().mockResolvedValue(undefined),
  updatePassword: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  confirmPasswordReset: jest.fn().mockResolvedValue(undefined),
  verifyPasswordResetCode: jest.fn().mockResolvedValue(undefined),
  applyActionCode: jest.fn().mockResolvedValue(undefined),
  checkActionCode: jest.fn().mockResolvedValue(undefined),
  GoogleAuthProvider: jest.fn(() => ({
    setCustomParameters: jest.fn(),
    addScope: jest.fn()
  })),
  signInWithPopup: jest.fn().mockResolvedValue({ user: mockCurrentUser }),
  signInWithRedirect: jest.fn().mockResolvedValue(undefined),
  getRedirectResult: jest.fn().mockResolvedValue({ user: mockCurrentUser }),
  onIdTokenChanged: jest.fn((auth, callback) => {
    callback(mockCurrentUser);
    return jest.fn(); // Return mock unsubscribe function
  })
}));

// Mock the fetch API
global.fetch = jest.fn().mockImplementation((url, options) => {
  // Mock successful responses for different endpoints
  if (url.includes('/api/members/profile')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockUserProfile)
    });
  }
  
  // Mock successful update
  if (url.includes('/api/members/update') && options?.method === 'PUT') {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true })
    });
  }
  
  // Default response for any other requests
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
});

// Create a test wrapper component that includes all necessary providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <LanguageProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </LanguageProvider>
  </BrowserRouter>
);

const renderProfile = () => {
  return render(
    <TestWrapper>
      <Profile />
    </TestWrapper>
  );
};

describe('Profile Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: {
          member: {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            role: 'member',
            createdAt: '2024-01-01T00:00:00Z',
            isActive: true,
            phoneNumber: '+15555555555',
            dateOfBirth: '1990-01-01',
            gender: 'Male',
            maritalStatus: 'Single',
            emergencyContactName: 'Jane Doe',
            emergencyContactPhone: '555-555-5555',
            ministries: '["Choir"]',
            languagePreference: 'English',
            dateJoinedParish: '2020-01-01',
            baptismName: 'TestBaptism',
            interestedInServing: 'Yes',
            streetLine1: '123 Main St',
            apartmentNo: '1A',
            city: 'Testville',
            state: 'CA',
            postalCode: '12345',
            dependants: [],
          },
        },
      }),
    });
    mockGetUserProfile.mockResolvedValue({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      role: 'member',
      createdAt: '2024-01-01T00:00:00Z',
      isActive: true,
      phoneNumber: '+15555555555',
    });
  });

  it('renders profile information', async () => {
    renderProfile();
    expect(await screen.findByText('profile')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('member')).toBeInTheDocument();
  });

  it('enters edit mode and updates profile', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByText('edit')).toBeInTheDocument());
    fireEvent.click(screen.getByText('edit'));
    const firstNameInput = screen.getByLabelText('first.name');
    fireEvent.change(firstNameInput, { target: { value: 'Updated' } });
    const saveButton = screen.getByText('save');
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
    fireEvent.click(saveButton);
    await waitFor(() => expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument());
  });

  it('shows error on failed profile update', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByText('edit')).toBeInTheDocument());
    fireEvent.click(screen.getByText('edit'));
    const saveButton = screen.getByText('save');
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ message: 'Update failed' }) });
    fireEvent.click(saveButton);
    await waitFor(() => expect(screen.getByText(/Failed to update profile/)).toBeInTheDocument());
  });

  it('shows loading spinner while loading', () => {
    // Mock loading state
    jest.spyOn(require('../../contexts/AuthContext'), 'useAuth').mockImplementation(() => ({
      currentUser: mockCurrentUser,
      loading: true,
      error: null,
      user: null,
      getUserProfile: mockGetUserProfile,
    }));
    
    renderProfile();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows registration prompt if profile not found', async () => {
    mockGetUserProfile.mockResolvedValue(null);
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });
    renderProfile();
    await waitFor(() => expect(screen.getByText('Profile not found')).toBeInTheDocument());
    expect(screen.getByText(/complete your member registration/i)).toBeInTheDocument();
  });

  it('cancels edit mode and resets form', async () => {
    renderProfile();
    await waitFor(() => expect(screen.getByText('edit')).toBeInTheDocument());
    fireEvent.click(screen.getByText('edit'));
    const firstNameInput = screen.getByLabelText('first.name');
    fireEvent.change(firstNameInput, { target: { value: 'Changed' } });
    fireEvent.click(screen.getByText('cancel'));
    expect(firstNameInput).toHaveValue('Test');
  });
}); 