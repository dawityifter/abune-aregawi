import React from 'react';
import { render, screen } from '@testing-library/react';
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

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: null, logout: jest.fn(), getUserProfile: jest.fn() })
}));

const renderNav = (lang: 'en' | 'ti') => {
  mockActiveLang = lang;
  return render(<MemoryRouter><Navigation /></MemoryRouter>);
};

afterEach(() => { mockActiveLang = 'en'; });

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
