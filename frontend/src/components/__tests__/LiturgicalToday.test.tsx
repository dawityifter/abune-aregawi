import React from 'react';
import { render, screen, within } from '@testing-library/react';
import LiturgicalToday from '../LiturgicalToday';
import { I18nProvider } from '../../i18n/I18nProvider';

/**
 * Dates are injected rather than mocked globally, so each case pins a real day
 * whose status is known from the parish's own published calendar.
 */
const renderOn = (iso: string, lang?: 'en' | 'ti') => {
  if (lang) localStorage.setItem('app.lang', lang);
  const [y, m, d] = iso.split('-').map(Number);
  return render(
    <I18nProvider>
      <LiturgicalToday now={new Date(y, m - 1, d)} />
    </I18nProvider>
  );
};

afterEach(() => localStorage.clear());

describe('fast days', () => {
  it('names the season and the day within it', () => {
    renderOn('2025-02-11'); // second of the three Nineveh days
    expect(screen.getByText(/Fast of Nineveh/i)).toBeInTheDocument();
    expect(screen.getByText(/Day 2 of 3/i)).toBeInTheDocument();
  });

  it('exposes progress to assistive technology, not just as a coloured bar', () => {
    renderOn('2025-02-11');
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
  });

  it('marks a day inside Great Lent', () => {
    renderOn('2025-03-10');
    expect(screen.getByText(/Great Lent/i)).toBeInTheDocument();
  });
});

describe('feast days', () => {
  it('names the feast on Fasika and claims no fast', () => {
    renderOn('2025-04-20');
    expect(screen.getByText(/Fasika/i)).toBeInTheDocument();
    expect(screen.queryByText(/Day \d+ of/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('names Gena, and does not carry Tsome Nebiyat into it', () => {
    renderOn('2026-01-07');
    expect(screen.getByText(/Gena/i)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

describe('ordinary days', () => {
  it('still shows a commemoration rather than an empty band', () => {
    const { container } = renderOn('2025-10-15');
    expect(screen.getByText(/An ordinary day/i)).toBeInTheDocument();
    expect(screen.getByText(/Commemoration/i)).toBeInTheDocument();
    expect(container.textContent).toBeTruthy();
  });

  it('counts down to the next feast', () => {
    renderOn('2025-10-15');
    expect(screen.getByText(/Next feast/i)).toBeInTheDocument();
    expect(screen.getByText(/in \d+ days|tomorrow/i)).toBeInTheDocument();
  });
});

describe('both calendars and both languages', () => {
  it('shows the Ethiopian and Gregorian date together', () => {
    renderOn('2025-04-20');
    expect(screen.getByText(/Miazia 12, 2017/)).toBeInTheDocument();
    expect(screen.getByText(/April 20/)).toBeInTheDocument();
  });

  it('renders Tigrigna with Geez numerals when the language is ti', () => {
    renderOn('2025-04-20', 'ti');
    // ሚያዝያ ፲፪ ፳፻፲፯ — month name in Tigrigna, day in Geez numerals.
    expect(screen.getByText(/ሚያዝያ/)).toBeInTheDocument();
    expect(screen.getByText(/፲፪/)).toBeInTheDocument();
  });

  it('names the fast in Tigrigna', () => {
    renderOn('2025-02-11', 'ti');
    expect(screen.getByText(/ጾመ ነነዌ/)).toBeInTheDocument();
  });
});

describe('does not claim Wednesday or Friday fasting', () => {
  it('treats an ordinary Wednesday outside a season as ordinary', () => {
    // 15 Oct 2025 is a Wednesday and sits in no fast season. Until the
    // fast-free windows are confirmed by clergy, the band must not assert a
    // fast here.
    expect(new Date(2025, 9, 15).getDay()).toBe(3);
    renderOn('2025-10-15');
    expect(screen.getByText(/An ordinary day/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Fast$/i)).not.toBeInTheDocument();
  });
});

describe('Tigrigna date rendering', () => {
  it('uses Tigrigna weekday names, not the Amharic ones Intl falls back to', () => {
    // 11 Feb 2025 is a Tuesday: ሰሉስ in Tigrigna, ማክሰኞ in Amharic.
    renderOn('2025-02-11', 'ti');
    expect(screen.getByText(/ሰሉስ/)).toBeInTheDocument();
    expect(screen.queryByText(/ማክሰኞ/)).not.toBeInTheDocument();
  });

  it('avoids asserting Gregorian month names in the wrong language', () => {
    renderOn('2025-02-11', 'ti');
    expect(screen.getByText(/11\/2\/2025/)).toBeInTheDocument();
  });
});
