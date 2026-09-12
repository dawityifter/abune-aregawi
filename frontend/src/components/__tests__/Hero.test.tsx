import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import Hero from '../Hero';

/**
 * Guards the two things the hero exists to do, both of which it previously
 * failed to do.
 *
 * 1. Say whose church this is. A visitor sent the link used to learn the
 *    parish's name nowhere above the fold: the hero carried none and the
 *    header hides it below the `sm` breakpoint.
 * 2. Express one opinion about what to do next, rather than offering Give,
 *    YouTube and WhatsApp as three identically-weighted buttons.
 *
 * Also pins the background image down. It used to be chosen with
 * `Math.random()`, so one visit in five showed a different photograph.
 */

const NAME_LATIN = 'Debre Tsehay Abune Aregawi';
const NAME_GEEZ = 'ደብረ ጸሓይ ኣቡነ ኣረጋዊ';

const renderHero = (lang: 'en' | 'ti') => {
  window.localStorage.setItem('app.lang', lang);
  return render(
    <MemoryRouter>
      <I18nProvider>
        <Hero />
      </I18nProvider>
    </MemoryRouter>
  );
};

afterEach(() => {
  window.localStorage.clear();
});

describe('Hero', () => {
  it('names the parish in both scripts, whichever language is active', () => {
    const { unmount } = renderHero('en');
    const heading = screen.getByRole('heading', { level: 1 });
    expect(within(heading).getByText(NAME_LATIN)).toBeInTheDocument();
    expect(within(heading).getByText(NAME_GEEZ)).toBeInTheDocument();
    unmount();

    renderHero('ti');
    const tiHeading = screen.getByRole('heading', { level: 1 });
    expect(within(tiHeading).getByText(NAME_LATIN)).toBeInTheDocument();
    expect(within(tiHeading).getByText(NAME_GEEZ)).toBeInTheDocument();
  });

  it('tells a visitor what kind of church it is and where', () => {
    renderHero('en');
    expect(screen.getByText(/Orthodox Tewahedo Church/)).toBeInTheDocument();
    expect(screen.getByText(/Garland, Texas/)).toBeInTheDocument();
  });

  it('offers exactly one primary action, and it is giving', () => {
    const { container } = renderHero('en');
    const primaries = container.querySelectorAll('.btn-primary');
    expect(primaries).toHaveLength(1);
    expect(primaries[0]).toHaveAttribute('href', '/donate');

    // YouTube and WhatsApp are still reachable, just not as buttons.
    expect(container.querySelectorAll('.btn')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /YouTube/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp/i })).toBeInTheDocument();
  });

  it('uses the same background image on every render', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      const { container, unmount } = renderHero('en');
      const img = container.querySelector('img');
      seen.add(img?.getAttribute('src') ?? 'missing');
      unmount();
    }
    expect(seen.size).toBe(1);
  });
});
