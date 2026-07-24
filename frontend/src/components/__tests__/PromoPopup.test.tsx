import React from 'react';
import { render, screen, act } from '@testing-library/react';
import PromoPopup from '../PromoPopup';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { I18nProvider } from '../../i18n/I18nProvider';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock location search parameter
const mockSearch = { search: '' };
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => mockSearch
}));

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <I18nProvider>
      <LanguageProvider>
        <MemoryRouter>
          {ui}
        </MemoryRouter>
      </LanguageProvider>
    </I18nProvider>
  );
};

describe('PromoPopup', () => {
  let originalLocalStorage: Storage;
  let dateNowSpy: jest.SpyInstance;

  beforeAll(() => {
    originalLocalStorage = window.localStorage;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockSearch.search = '';

    // Mock localStorage
    let store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => {
          store[key] = value.toString();
        }),
        removeItem: jest.fn((key) => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    if (dateNowSpy) {
      dateNowSpy.mockRestore();
    }
  });

  afterAll(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
  });

  it('renders nothing when no promos are active', () => {
    // August 1, 2026: all promos are expired
    const futureDate = new Date('2026-08-01T00:00:00Z').getTime();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(futureDate);

    renderWithProviders(<PromoPopup />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the single active promo without navigation controls', () => {
    // July 20, 2026: the graduation promo is active
    const testDate = new Date('2026-07-20T10:00:00-05:00').getTime();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(testDate);

    renderWithProviders(<PromoPopup />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    expect(screen.getByRole('img')).toHaveAttribute('src', '/images/promo/july26-graduation.jpeg');

    // With only one active promo, the carousel controls are not rendered.
    expect(screen.queryByTitle('Next Image')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Previous Image')).not.toBeInTheDocument();
  });

  it('honors daily frequency capping using localStorage', () => {
    const testDate = new Date('2026-06-29T15:15:43-05:00').getTime();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(testDate);

    // Simulate shown already today
    window.localStorage.setItem('last_promo_popup_shown_date', new Date().toDateString());

    renderWithProviders(<PromoPopup />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('forces display when forcePromoPopup=1 is active', () => {
    // Expired dates
    const futureDate = new Date('2026-08-01T00:00:00Z').getTime();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(futureDate);

    // Shown today already
    window.localStorage.setItem('last_promo_popup_shown_date', new Date().toDateString());

    // Dev force override
    mockSearch.search = '?forcePromoPopup=1';

    renderWithProviders(<PromoPopup />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/images/promo/july26-graduation.jpeg');
  });

  it('does not auto-rotate when only one promo is active', () => {
    jest.useFakeTimers();
    const testDate = new Date('2026-07-20T10:00:00-05:00').getTime();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(testDate);

    renderWithProviders(<PromoPopup />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/images/promo/july26-graduation.jpeg');

    act(() => {
      jest.advanceTimersByTime(15000);
    });
    // A single promo has nothing to rotate to; it stays put.
    expect(screen.getByRole('img')).toHaveAttribute('src', '/images/promo/july26-graduation.jpeg');
  });
});
