import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Navigation from '../Navigation';
import { en, ti } from '../../i18n/dictionaries';

// Drives Navigation's t() off the real dictionaries so the assertions below
// prove the heading is looked up, not hardcoded.
let mockActiveLang: 'en' | 'ti' = 'en';
jest.mock('../../i18n/I18nProvider', () => ({
  useI18n: () => {
    const dicts = jest.requireActual('../../i18n/dictionaries');
    const dict = mockActiveLang === 'ti' ? dicts.ti : dicts.en;
    return {
      lang: mockActiveLang,
      setLang: jest.fn(),
      // Mirrors the provider's dot-path lookup with an English fallback
      t: (key: string) => {
        const walk = (o: any) => key.split('.').reduce((acc, k) => acc?.[k], o);
        return dict[key] ?? walk(dict) ?? dicts.en[key] ?? walk(dicts.en) ?? key;
      }
    };
  }
}));

// Signed out by default, so the existing heading tests are untouched. The
// pledge link lives behind a currentUser check, so its cases opt in.
let mockCurrentUser: { uid: string } | null = null;
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: mockCurrentUser, logout: jest.fn(), getUserProfile: jest.fn() })
}));

// The real hook fetches on mount. What matters here is only which of its three
// outcomes the header is handed.
let mockCampaignState: { campaign: unknown; loading: boolean; error: string | null } = {
  campaign: null, loading: false, error: null
};
jest.mock('../../hooks/useActiveCampaign', () => ({
  useActiveCampaign: () => mockCampaignState
}));

const LIVE_CAMPAIGN = { id: 7, name: 'Building Fund', description: 'A drive' };

const renderNav = (lang: 'en' | 'ti') => {
  mockActiveLang = lang;
  return render(<MemoryRouter><Navigation /></MemoryRouter>);
};

afterEach(() => {
  mockActiveLang = 'en';
  mockCurrentUser = null;
  mockCampaignState = { campaign: null, loading: false, error: null };
});

describe('Navigation church name heading', () => {
  it('renders the English church name when the language is English', () => {
    renderNav('en');
    expect(screen.getByText(en['church.name'])).toBeInTheDocument();
  });

  it('renders the Tigrigna church name when the language is Tigrigna', () => {
    renderNav('ti');
    expect(screen.getByText(ti['church.name'])).toBeInTheDocument();
    // The heading used to be hardcoded English — it must not survive the switch
    expect(screen.queryByText(en['church.name'])).not.toBeInTheDocument();
  });

  it('has a distinct Tigrigna translation for the church name', () => {
    expect(ti['church.name']).toBeTruthy();
    expect(ti['church.name']).not.toBe(en['church.name']);
  });
});

// A pledge link with no drive behind it leads to PledgePage's "no active
// campaign" state — a dead end offered from the header of every page. The home
// page card already gates on exactly this condition, so the header must agree
// with it rather than advertise a drive that is not running.
describe('Navigation pledge link', () => {
  const pledgeLinks = () => screen.queryAllByText(en.nav.makePledge);

  it('offers the pledge link while a drive is running', () => {
    mockCurrentUser = { uid: 'member-1' };
    mockCampaignState = { campaign: LIVE_CAMPAIGN, loading: false, error: null };
    renderNav('en');

    expect(pledgeLinks().length).toBeGreaterThan(0);
  });

  it('hides the pledge link when no drive is running', () => {
    mockCurrentUser = { uid: 'member-1' };
    mockCampaignState = { campaign: null, loading: false, error: null };
    renderNav('en');

    expect(pledgeLinks()).toHaveLength(0);
  });

  // Fails closed, matching QuickLinks: a link that appears and then vanishes a
  // moment later is worse than one that arrives late.
  it('hides the pledge link while the drive is still being looked up', () => {
    mockCurrentUser = { uid: 'member-1' };
    mockCampaignState = { campaign: null, loading: true, error: null };
    renderNav('en');

    expect(pledgeLinks()).toHaveLength(0);
  });

  // The mobile menu holds a second copy of the link, in its own JSX block. It
  // is closed by default, so the desktop cases above never reach it: gating one
  // and not the other passes every test that does not open this menu.
  const openMobileMenu = () =>
    fireEvent.click(screen.getByRole('button', { name: /open main menu/i }));

  it('offers the pledge link in the mobile menu while a drive is running', () => {
    mockCurrentUser = { uid: 'member-1' };
    mockCampaignState = { campaign: LIVE_CAMPAIGN, loading: false, error: null };
    renderNav('en');
    openMobileMenu();

    expect(pledgeLinks().length).toBeGreaterThan(0);
  });

  it('hides the pledge link in the mobile menu when no drive is running', () => {
    mockCurrentUser = { uid: 'member-1' };
    mockCampaignState = { campaign: null, loading: false, error: null };
    renderNav('en');
    openMobileMenu();

    expect(pledgeLinks()).toHaveLength(0);
  });

  it('hides the pledge link when the lookup failed', () => {
    mockCurrentUser = { uid: 'member-1' };
    mockCampaignState = { campaign: null, loading: false, error: 'network down' };
    renderNav('en');

    expect(pledgeLinks()).toHaveLength(0);
  });
});
