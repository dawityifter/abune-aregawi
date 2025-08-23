import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import '@testing-library/jest-dom';
import { setFirebaseUserToken, extractHeader } from '../../../testUtils/authTestUtils';

// Under test
import OutreachDashboard from '../OutreachDashboard';

// Mock useAuth from AuthContext to control auth state
const mockGetUserProfile = jest.fn();
const mockCurrentUser = { uid: 'uid-1', email: 'admin@example.com', phoneNumber: '+15550001111' } as any;
const mockFirebaseUser = { getIdToken: jest.fn().mockResolvedValue('test-token') } as any;

jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => ({
    currentUser: mockCurrentUser,
    firebaseUser: mockFirebaseUser,
    getUserProfile: mockGetUserProfile,
  }),
}));

// Helper wrapper
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <LanguageProvider>
      {children}
    </LanguageProvider>
  </BrowserRouter>
);

// Ensure API base URL exists for component fetch
beforeAll(() => {
  (process as any).env.REACT_APP_API_URL = 'http://localhost';
});

beforeEach(() => {
  jest.clearAllMocks();
  // default: admin role profile structure as used by component
  mockGetUserProfile.mockResolvedValue({
    success: true,
    data: { member: { role: 'admin', firstName: 'Admin' } },
  });
  // Reinitialize getIdToken after clearAllMocks so it returns a token
  setFirebaseUserToken(mockFirebaseUser, 'test-token');
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Global fetch mock that we can customize per test
const gfetch = global.fetch as unknown as jest.Mock;

describe('OutreachDashboard', () => {
  it('denies access for non-privileged users', async () => {
    mockGetUserProfile.mockResolvedValueOnce({
      success: true,
      data: { member: { role: 'member' } },
    });

    // No network needed because it will render access denied after profile loads
    (global.fetch as any) = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    render(
      <Wrapper>
        <OutreachDashboard />
      </Wrapper>
    );

    // Wait for loading to finish and access denied text
    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to view the Outreach dashboard.")).toBeInTheDocument();
  });

  it('shows pending count and list for admin and supports marking welcomed', async () => {
    // Mock pending list response
    (global.fetch as any) = jest
      .fn()
      // First call: GET /onboarding/pending
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            members: [
              {
                id: 'm1',
                firstName: 'Alpha',
                lastName: 'User',
                phoneNumber: '+10000000001',
                email: 'alpha@example.com',
                createdAt: '2025-01-01T00:00:00Z',
              },
              {
                id: 'm2',
                firstName: 'Beta',
                lastName: 'User',
                phoneNumber: '+10000000002',
                email: 'beta@example.com',
                createdAt: '2025-01-02T00:00:00Z',
              },
            ],
          },
        }),
      })
      // Second call: POST /:id/mark-welcomed
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });

    render(
      <Wrapper>
        <OutreachDashboard />
      </Wrapper>
    );

    // Header renders after initial profile load
    expect(await screen.findByText('Outreach & Member Relations')).toBeInTheDocument();

    // Summary count shows from pending list
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());

    // Table rows render
    expect(screen.getByText('Alpha User')).toBeInTheDocument();
    expect(screen.getByText('Beta User')).toBeInTheDocument();

    // Click Mark Welcomed for first member
    const firstButton = screen.getAllByRole('button', { name: 'Mark Welcomed' })[0];
    fireEvent.click(firstButton);

    // Button changes to Marking… while busy
    expect(await screen.findByRole('button', { name: 'Marking…' })).toBeInTheDocument();

    // After success, first member should be removed, count becomes 1
    await waitFor(() => expect(screen.queryByText('Alpha User')).not.toBeInTheDocument());
    expect(screen.getByText('1')).toBeInTheDocument();

    // Verify fetch calls were made with Authorization header
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/api/members/onboarding/pending');
    const postCall = (global.fetch as jest.Mock).mock.calls[1];
    expect(postCall[0]).toMatch(/\/api\/members\/m1\/mark-welcomed$/);
    const headers = postCall[1]?.headers as any;
    const authHeader = extractHeader(headers, 'Authorization');
    expect(authHeader).toBe('Bearer test-token');
  });

  it('shows error state when pending fetch fails', async () => {
    (global.fetch as any) = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ message: 'Failed to load pending welcomes' }) });

    render(
      <Wrapper>
        <OutreachDashboard />
      </Wrapper>
    );

    const errs = await screen.findAllByText('Failed to load pending welcomes');
    expect(errs.length).toBeGreaterThan(0);
  });
});
