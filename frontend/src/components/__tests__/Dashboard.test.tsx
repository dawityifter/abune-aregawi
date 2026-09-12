import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { LanguageProvider } from '../../contexts/LanguageContext';
import Dashboard from '../Dashboard';

/**
 * The dashboard's twelve colour-coded cards became two lists: the member's own
 * destinations, and a separated "Church administration" section.
 *
 * The gates moved with them, and a gate that silently widened would put
 * treasurer and admin entry points in front of every member. That is what the
 * bulk of this file is checking.
 */

jest.mock('../LiturgicalToday', () => () => <div data-testid="liturgical" />);
jest.mock('../ParishAnnouncements', () => () => <div data-testid="announcements" />);
jest.mock('../BaptismalNamePrompt', () => () => null);
jest.mock('../NextService', () => () => <div data-testid="next-service" />);

// The standing strip does its own authenticated fetch; it has its own
// behaviour and is not what these tests are about.
jest.mock('../../hooks/useMemberDues', () => ({
  useMemberDues: () => ({ dues: null, loading: false }),
}));

const mockUseAuth = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => mockUseAuth(),
}));

const memberUser = (roles: string[]) => ({
  data: {
    member: {
      id: '1',
      firstName: 'Selamawit',
      lastName: 'Tesfay',
      email: 'member@example.com',
      role: roles[0],
      roles,
      phoneNumber: '+15550000000',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
  },
});

const renderDashboard = (roles: string[]) => {
  mockUseAuth.mockReturnValue({
    user: memberUser(roles),
    firebaseUser: { email: 'member@example.com', getIdToken: async () => 'token' },
    loading: false,
    authReady: true,
  });
  return render(
    <MemoryRouter>
      <I18nProvider>
        <LanguageProvider>
          <Dashboard />
        </LanguageProvider>
      </I18nProvider>
    </MemoryRouter>
  );
};

const ADMIN_DESTINATIONS = [/Treasurer/i, /Admin/i, /Communications/i, /Relationship/i];

describe('Dashboard', () => {
  afterEach(() => jest.clearAllMocks());

  it('greets the member by name', () => {
    renderDashboard(['member']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Selamawit');
  });

  it('opens with the member’s standing, before any navigation', () => {
    renderDashboard(['member']);
    const heading = screen.getByRole('heading', { level: 1 });
    const memberNav = screen.getByRole('navigation', { name: /your church/i });
    // The greeting precedes the list of destinations in document order.
    expect(heading.compareDocumentPosition(memberNav) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('shows a plain member their own destinations', () => {
    renderDashboard(['member']);
    const nav = screen.getByRole('navigation', { name: /your church/i });
    ['Profile', 'Dues', 'Give', 'Gallery'].forEach((label) => {
      expect(screen.getAllByRole('button').some((b) => b.textContent?.includes(label))).toBe(true);
    });
    expect(nav).toBeInTheDocument();
  });

  it('shows a plain member no administration section at all', () => {
    renderDashboard(['member']);
    expect(screen.queryByRole('navigation', { name: /administration/i })).not.toBeInTheDocument();
    ADMIN_DESTINATIONS.forEach((label) => {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    });
  });

  it('gives a treasurer the administration section, separated from their own', () => {
    renderDashboard(['treasurer']);

    const adminNav = screen.getByRole('navigation', { name: /administration/i });
    expect(adminNav.textContent).toMatch(/Treasurer/i);
    // The treasurer role is granted canAccessAdminPanel deliberately — see the
    // "Needs access to finance modules" note in utils/roles.ts — so the admin
    // panel belongs here too.
    expect(adminNav.textContent).toMatch(/Admin Panel/i);

    // The separation that matters: privileged destinations never appear among
    // the member's own, whatever the role.
    const memberNav = screen.getByRole('navigation', { name: /your church/i });
    ADMIN_DESTINATIONS.forEach((label) => {
      expect(memberNav.textContent).not.toMatch(label);
    });
  });

  it('hides household management from a dependent', () => {
    renderDashboard(['dependent']);
    const nav = screen.getByRole('navigation', { name: /your church/i });
    expect(nav.textContent).not.toMatch(/Children|Household|Dependents/i);
  });
});
