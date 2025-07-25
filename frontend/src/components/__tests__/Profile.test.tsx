import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Profile from '../Profile';
import { AuthProvider } from '../../contexts/AuthContext';
import { LanguageProvider } from '../../contexts/LanguageContext';

// Mock useAuth
const mockGetUserProfile = jest.fn();
const mockUpdateUserProfileData = jest.fn();
const mockUpdateUserProfile = jest.fn();

const mockCurrentUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  phoneNumber: '+15555555555',
  firstName: 'Test',
  lastName: 'User',
};

jest.mock('../../contexts/AuthContext', () => {
  const actual = jest.requireActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      currentUser: mockCurrentUser,
      getUserProfile: mockGetUserProfile,
      updateUserProfileData: mockUpdateUserProfileData,
      updateUserProfile: mockUpdateUserProfile,
    }),
  };
});

jest.mock('../../contexts/LanguageContext', () => {
  const actual = jest.requireActual('../../contexts/LanguageContext');
  return {
    ...actual,
    useLanguage: () => ({ t: (key: string) => key }),
    LanguageProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

global.fetch = jest.fn();

const renderProfile = () =>
  render(
    <LanguageProvider>
      <AuthProvider>
        <Profile />
      </AuthProvider>
    </LanguageProvider>
  );

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
    // To simulate loading, render with loading state
    // This is a simple check for the spinner element
    renderProfile();
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
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