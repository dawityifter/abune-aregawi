import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import MoreSheet from './components/mobile/MoreSheet';
import UpdateToast from './components/mobile/UpdateToast';
import { en } from './i18n/dictionaries';

/**
 * UpdateToast and MoreSheet are both z-50, and App.tsx renders the toast
 * after the sheet, so with both visible the toast painted over the sheet
 * panel — including the sign-out button — at ~72px from the bottom, and put
 * an actionable Refresh button outside the sheet's aria-modal="true"
 * container where a screen-reader user inside the sheet couldn't reach it.
 *
 * This reproduces just the piece of App.tsx that fixes it — the `moreOpen`
 * state feeding both `<MoreSheet open={moreOpen} .../>` and
 * `<UpdateToast show={updateAvailable && !moreOpen} .../>` — rather than the
 * whole App tree, which would need Firebase/Stripe/etc. mocked wholesale to
 * render at all.
 */
jest.mock('./i18n/I18nProvider', () => ({
  useI18n: () => {
    const dicts = jest.requireActual('./i18n/dictionaries');
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

jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: null, logout: jest.fn(), getUserProfile: jest.fn() })
}));

const AppFragment: React.FC<{ updateAvailable: boolean }> = ({ updateAvailable }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setMoreOpen(true)}>open more</button>
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        canInstall={false}
        isIos={false}
        onInstall={jest.fn()}
        onDismissInstall={jest.fn()}
      />
      <UpdateToast show={updateAvailable && !moreOpen} onRefresh={jest.fn()} />
    </>
  );
};

const renderFragment = (updateAvailable: boolean) =>
  render(
    <MemoryRouter>
      <AppFragment updateAvailable={updateAvailable} />
    </MemoryRouter>
  );

describe('UpdateToast vs. MoreSheet', () => {
  it('shows the update toast when the sheet is closed', () => {
    renderFragment(true);
    expect(screen.getByText((en as any).pwa.updateAvailable)).toBeInTheDocument();
  });

  it('hides the update toast while the More sheet is open', async () => {
    renderFragment(true);

    expect(screen.getByText((en as any).pwa.updateAvailable)).toBeInTheDocument();

    await userEvent.click(screen.getByText('open more'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText((en as any).pwa.updateAvailable)).not.toBeInTheDocument();
  });

  it('shows the toast again once the sheet is closed', async () => {
    renderFragment(true);

    await userEvent.click(screen.getByText('open more'));
    expect(screen.queryByText((en as any).pwa.updateAvailable)).not.toBeInTheDocument();

    await userEvent.click(screen.getByText((en as any).mobileNav.closeMore));

    expect(screen.getByText((en as any).pwa.updateAvailable)).toBeInTheDocument();
  });
});
