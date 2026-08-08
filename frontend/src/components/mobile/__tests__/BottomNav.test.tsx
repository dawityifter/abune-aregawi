import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from '../BottomNav';
import { en, ti } from '../../../i18n/dictionaries';

let mockActiveLang: 'en' | 'ti' = 'en';
jest.mock('../../../i18n/I18nProvider', () => ({
  useI18n: () => {
    const dicts = jest.requireActual('../../../i18n/dictionaries');
    const dict = mockActiveLang === 'ti' ? dicts.ti : dicts.en;
    return {
      lang: mockActiveLang,
      setLang: jest.fn(),
      t: (key: string) => {
        const walk = (o: any) => key.split('.').reduce((acc: any, k) => acc?.[k], o);
        return dict[key] ?? walk(dict) ?? dicts.en[key] ?? walk(dicts.en) ?? key;
      }
    };
  }
}));

let mockCurrentUser: any = null;
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: mockCurrentUser })
}));

const renderBar = (route: string) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <BottomNav onMoreClick={jest.fn()} />
    </MemoryRouter>
  );

afterEach(() => { mockActiveLang = 'en'; mockCurrentUser = null; });

describe('BottomNav', () => {
  it('renders all four tabs', () => {
    renderBar('/');
    ['today', 'calendar', 'give', 'more'].forEach((id) => {
      expect(screen.getByText((en as any).mobileNav[id])).toBeInTheDocument();
    });
  });

  it('marks the active tab for assistive technology', () => {
    renderBar('/calendar');
    const active = screen.getByRole('link', { current: 'page' });
    expect(active).toHaveTextContent((en as any).mobileNav.calendar);
  });

  // "today" (star) and "give" (heart) are single closed silhouettes, so
  // filling them solid on the active tab reads cleanly.
  it('fills the active tab icon solid when it is a silhouette icon (today, give)', () => {
    renderBar('/');
    const active = screen.getByRole('link', { current: 'page' });
    const svg = active.querySelector('svg');
    expect(svg).toHaveAttribute('fill', 'currentColor');
  });

  // calendar's outline path has interior strokes (binder ticks, header
  // divider) drawn in the same currentColor as its body — filling the body
  // solid paints over those lines and leaves an unreadable blob. So calendar
  // (and "more", which has no enclosed area to fill anyway) never fill; the
  // active tab is instead a bolder stroke on the same outline glyph.
  it('never fills calendar or more solid, even when active — uses a bolder stroke instead', () => {
    renderBar('/calendar');
    const active = screen.getByRole('link', { current: 'page' });
    const activeSvg = active.querySelector('svg');
    expect(activeSvg).toHaveAttribute('fill', 'none');
    expect(activeSvg).toHaveAttribute('stroke-width', '2.5');
  });

  it('leaves inactive tab icons unfilled with the resting stroke weight', () => {
    renderBar('/calendar');
    const inactive = screen.getByText((en as any).mobileNav.today).closest('a');
    const svg = inactive?.querySelector('svg');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('stroke-width', '1.8');
  });

  it('points Today at the home page for a signed-out visitor', () => {
    renderBar('/');
    expect(screen.getByText((en as any).mobileNav.today).closest('a'))
      .toHaveAttribute('href', '/');
  });

  it('points Today at the dashboard for a signed-in member', () => {
    mockCurrentUser = { uid: 'abc' };
    renderBar('/dashboard');
    expect(screen.getByText((en as any).mobileNav.today).closest('a'))
      .toHaveAttribute('href', '/dashboard');
  });

  it('renders Tigrigna labels when the language is Tigrigna', () => {
    mockActiveLang = 'ti';
    renderBar('/');
    expect(screen.getByText((ti as any).mobileNav.give)).toBeInTheDocument();
    expect(screen.queryByText((en as any).mobileNav.give)).not.toBeInTheDocument();
  });

  it('renders More as a button, not a link', () => {
    renderBar('/');
    expect(screen.getByRole('button', { name: (en as any).mobileNav.more }))
      .toBeInTheDocument();
  });

  // iOS Safari does not move focus to a tapped <button> the way a mouse click
  // does, so MoreSheet's "capture document.activeElement when it opens"
  // focus-restore would capture document.body and silently no-op on a real
  // phone. fireEvent.click (unlike userEvent.click) does not simulate the
  // browser's own focus-on-click behavior, so it stands in here for a raw
  // touch tap: if this test passes, focus came from BottomNav's own explicit
  // call, not from a testing-library default that iOS doesn't actually have.
  it('explicitly focuses the More button on click, so a tap-only activation still leaves it focused', () => {
    const onMoreClick = jest.fn();
    render(
      <MemoryRouter>
        <BottomNav onMoreClick={onMoreClick} />
      </MemoryRouter>
    );
    const moreButton = screen.getByRole('button', { name: (en as any).mobileNav.more });
    expect(moreButton).not.toHaveFocus();

    fireEvent.click(moreButton);

    expect(moreButton).toHaveFocus();
    expect(onMoreClick).toHaveBeenCalledTimes(1);
  });
});
