import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import MoreSheet from '../MoreSheet';
import { en } from '../../../i18n/dictionaries';

jest.mock('../../../i18n/I18nProvider', () => ({
  useI18n: () => {
    const dicts = jest.requireActual('../../../i18n/dictionaries');
    return {
      lang: 'en',
      setLang: jest.fn(),
      t: (key: string) => {
        const walk = (o: any) => key.split('.').reduce((acc: any, k) => acc?.[k], o);
        return dicts.en[key] ?? walk(dicts.en) ?? key;
      }
    };
  }
}));

let mockCurrentUser: any = null;
let mockProfile: any = null;
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
    logout: jest.fn(),
    getUserProfile: jest.fn().mockResolvedValue(mockProfile)
  })
}));

const renderSheet = () =>
  render(<MemoryRouter><MoreSheet open onClose={jest.fn()} /></MemoryRouter>);

afterEach(() => { mockCurrentUser = null; mockProfile = null; });

describe('MoreSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <MemoryRouter><MoreSheet open={false} onClose={jest.fn()} /></MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('is a dialog when open', () => {
    renderSheet();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  describe('signed out', () => {
    it('offers service times and the stream as homepage anchors', () => {
      renderSheet();
      expect(screen.getByText((en as any).mobileNav.serviceTimes).closest('a'))
        .toHaveAttribute('href', '/#service-times');
      expect(screen.getByText((en as any).mobileNav.watch).closest('a'))
        .toHaveAttribute('href', '/#watch');
    });

    it('offers sign in and does not offer member-only links', () => {
      renderSheet();
      expect(screen.getByText((en as any).sign.in)).toBeInTheDocument();
      expect(screen.queryByText((en as any).mobileNav.profile)).not.toBeInTheDocument();
    });
  });

  describe('signed in', () => {
    it('offers member links but no admin panel for a plain member', async () => {
      mockCurrentUser = { uid: 'abc' };
      mockProfile = { data: { member: { roles: ['member'] } } };
      renderSheet();
      expect(await screen.findByText((en as any).mobileNav.profile)).toBeInTheDocument();
      expect(screen.queryByText((en as any).mobileNav.admin)).not.toBeInTheDocument();
    });

    it('offers the admin panel to an admin', async () => {
      mockCurrentUser = { uid: 'abc' };
      mockProfile = { data: { member: { roles: ['admin'] } } };
      renderSheet();
      expect(await screen.findByText((en as any).mobileNav.admin)).toBeInTheDocument();
    });

    // `canAccessAdminPanel` is true for treasurer, bookkeeper, budget_committee,
    // auditor, ar_team, ap_team and church_leadership — it means "may reach
    // admin-adjacent tooling", not "is an admin". Dashboard.tsx:617 uses the
    // identical gate, so a treasurer already sees an Admin Panel entry there
    // today. Do not narrow this component's gate to a role check: that would
    // show a treasurer less on the phone than the desktop dashboard shows them.
    it('offers a treasurer both the treasurer dashboard and the admin panel, matching the desktop dashboard', async () => {
      mockCurrentUser = { uid: 'abc' };
      mockProfile = { data: { member: { roles: ['treasurer'] } } };
      renderSheet();
      expect(await screen.findByText((en as any).mobileNav.treasurer)).toBeInTheDocument();
      expect(screen.getByText((en as any).mobileNav.admin)).toBeInTheDocument();
    });

    it('merges permissions for a multi-role member', async () => {
      mockCurrentUser = { uid: 'abc' };
      mockProfile = { data: { member: { roles: ['member', 'treasurer'] } } };
      renderSheet();
      expect(await screen.findByText((en as any).mobileNav.treasurer)).toBeInTheDocument();
      expect(screen.getByText((en as any).mobileNav.profile)).toBeInTheDocument();
    });
  });
});
