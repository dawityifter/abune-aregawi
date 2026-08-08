import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
// A level of indirection over plain `jest.fn().mockResolvedValue(mockProfile)`:
// most tests just want the default (resolve immediately to whatever
// mockProfile currently is), but one test below needs to hold the promise
// open so it can resolve it manually after the sheet has already mounted —
// reassigning this per-test is how that stays controllable without touching
// every other call site.
//
// The default implementation is (re)installed in beforeEach, not just here
// at module scope. CRA's jest preset sets `resetMocks: true`, which runs
// jest.resetAllMocks() before every test — that strips the .mockImplementation
// off this jest.fn() (leaving it returning undefined) right after it's set,
// module-scope assignments and afterEach reassignments alike don't survive
// it. beforeEach runs after Jest's own automatic reset, so it's the only
// place a reassignment here actually sticks for the test that follows.
let mockGetUserProfile = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockCurrentUser,
    logout: jest.fn(),
    getUserProfile: (...args: any[]) => mockGetUserProfile(...args)
  })
}));

const defaultInstallProps = {
  canInstall: false,
  isIos: false,
  onInstall: jest.fn(),
  onDismissInstall: jest.fn(),
};

const renderSheet = (installProps: Partial<typeof defaultInstallProps> = {}) =>
  render(
    <MemoryRouter>
      <MoreSheet open onClose={jest.fn()} {...defaultInstallProps} {...installProps} />
    </MemoryRouter>
  );

beforeEach(() => {
  mockGetUserProfile = jest.fn().mockImplementation(() => Promise.resolve(mockProfile));
});

afterEach(() => {
  mockCurrentUser = null;
  mockProfile = null;
  document.body.style.overflow = '';
});

describe('MoreSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <MemoryRouter>
        <MoreSheet open={false} onClose={jest.fn()} {...defaultInstallProps} />
      </MemoryRouter>
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

  describe('focus management', () => {
    // Mirrors real usage: BottomNav's "More" button opens the sheet, so it
    // is what has focus at the moment the sheet mounts.
    const Harness: React.FC = () => {
      const [open, setOpen] = React.useState(false);
      return (
        <MemoryRouter>
          <button onClick={() => setOpen(true)}>open-more</button>
          <MoreSheet open={open} onClose={() => setOpen(false)} {...defaultInstallProps} />
        </MemoryRouter>
      );
    };

    it('moves initial focus into the sheet, traps Tab at the edges, and restores focus to the opener on close', async () => {
      render(<Harness />);
      const opener = screen.getByRole('button', { name: 'open-more' });
      await userEvent.click(opener);

      // Initial focus: the close button, first in DOM order.
      const closeButton = screen.getByRole('button', { name: (en as any).mobileNav.closeMore });
      expect(closeButton).toHaveFocus();

      // Forward wrap: Tab from the last focusable element returns to the first.
      const signInLink = screen.getByText((en as any).sign.in).closest('a') as HTMLElement;
      signInLink.focus();
      await userEvent.tab();
      expect(closeButton).toHaveFocus();

      // Backward wrap: Shift+Tab from the first focusable element goes to the last.
      await userEvent.tab({ shift: true });
      expect(signInLink).toHaveFocus();

      // Closing returns focus to whatever opened the sheet.
      await userEvent.click(closeButton);
      expect(opener).toHaveFocus();
    });

    // Regression guard: getFocusableElements() must be queried fresh on every
    // Tab keystroke (see onKeyDown in MoreSheet.tsx), not captured once into
    // first/last refs when the sheet mounts.
    //
    // This used to be tested by rendering with canInstall from the start and
    // checking the install card's buttons were reachable — but canInstall is
    // a prop present from the very first render, so the focusable set never
    // actually *changes* between the mount effect and the Tab press; a
    // first/last-refs-cached-at-mount implementation captures the right
    // elements by coincidence and passes just as well as the correct one.
    // The real dynamic case is the staff links, which arrive asynchronously
    // from getUserProfile() *after* the sheet (and its mount-time focus
    // effect) has already rendered — deferring that resolution here, past
    // the initial-focus assertion, is what actually exercises the
    // fresh-query requirement.
    it('includes staff links that resolve after the sheet is already open in the Tab wrap order', async () => {
      mockCurrentUser = { uid: 'abc' };
      let resolveProfile!: (value: any) => void;
      mockGetUserProfile = jest.fn().mockImplementation(
        () => new Promise((resolve) => { resolveProfile = resolve; })
      );

      const Harness: React.FC = () => {
        const [open, setOpen] = React.useState(false);
        return (
          <MemoryRouter>
            <button onClick={() => setOpen(true)}>open-more</button>
            <MoreSheet open={open} onClose={() => setOpen(false)} {...defaultInstallProps} />
          </MemoryRouter>
        );
      };

      render(<Harness />);
      await userEvent.click(screen.getByRole('button', { name: 'open-more' }));

      // Mount-time focus effect has already run. The profile fetch is still
      // pending, so at this instant the sheet only has the member-only link
      // list — no staff links exist in the DOM yet.
      const closeButton = screen.getByRole('button', { name: (en as any).mobileNav.closeMore });
      expect(closeButton).toHaveFocus();
      expect(screen.queryByText((en as any).mobileNav.treasurer)).not.toBeInTheDocument();

      // Now resolve it, with a role that adds staff links (admin + treasurer,
      // per the "treasurer" tests above) — this changes the sheet's
      // focusable set well after mount, and before any Tab key is pressed.
      resolveProfile({ data: { member: { roles: ['treasurer'] } } });
      const treasurerLink = (await screen.findByText((en as any).mobileNav.treasurer)).closest('a') as HTMLElement;

      // The true last focusable element is still "Sign out" (staff links sit
      // above it), so simple forward/backward wrap alone can't tell a fresh
      // query apart from stale-but-lucky cached refs here. The real tell:
      // Tab from the treasurer link — new, mid-list, not first or last —
      // must behave like an ordinary Tab press to the next element (Sign
      // out), not get treated as "focus escaped the trap" and yanked back to
      // the close button, which is what happens if the trap's `focusable`
      // array was snapshotted at mount and simply doesn't contain this node.
      const signOutButton = screen.getByRole('button', { name: (en as any).sign.out });
      treasurerLink.focus();
      await userEvent.tab();
      expect(signOutButton).toHaveFocus();
      expect(closeButton).not.toHaveFocus();

      // Forward wrap from the true last element still returns to the close
      // button, and backward wrap from the close button still reaches the
      // true last element — both now including the staff links in between.
      await userEvent.tab();
      expect(closeButton).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(signOutButton).toHaveFocus();
    });
  });

  describe('body scroll lock', () => {
    it('locks body scroll while open and restores the previous value after', () => {
      document.body.style.overflow = 'auto';
      const onClose = jest.fn();
      const { rerender } = render(
        <MemoryRouter><MoreSheet open={false} onClose={onClose} {...defaultInstallProps} /></MemoryRouter>
      );
      expect(document.body.style.overflow).toBe('auto');

      rerender(<MemoryRouter><MoreSheet open onClose={onClose} {...defaultInstallProps} /></MemoryRouter>);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(<MemoryRouter><MoreSheet open={false} onClose={onClose} {...defaultInstallProps} /></MemoryRouter>);
      expect(document.body.style.overflow).toBe('auto');
    });
  });

  // The install card itself is driven entirely by props now — App.tsx owns the
  // single useServiceWorker() call and passes canInstall/isIos/onInstall/
  // onDismissInstall down, so MoreSheet has no hook of its own to fake here.
  describe('install offer', () => {
    it('is absent when installation is not offered and the device is not iOS', () => {
      renderSheet();
      expect(screen.queryByText((en as any).pwa.installTitle)).not.toBeInTheDocument();
    });

    it('offers Install and Not now when the browser can install, and wires them to the callbacks', async () => {
      const onInstall = jest.fn();
      const onDismissInstall = jest.fn();
      renderSheet({ canInstall: true, isIos: false, onInstall, onDismissInstall });

      expect(screen.getByText((en as any).pwa.installTitle)).toBeInTheDocument();
      expect(screen.getByText((en as any).pwa.installBody)).toBeInTheDocument();

      const installButton = screen.getByRole('button', { name: (en as any).pwa.install });
      const dismissButton = screen.getByRole('button', { name: (en as any).pwa.installDismiss });

      await userEvent.click(installButton);
      expect(onInstall).toHaveBeenCalledTimes(1);

      await userEvent.click(dismissButton);
      expect(onDismissInstall).toHaveBeenCalledTimes(1);
    });

    it('shows the Share-sheet instructions and no Install button on iOS, but still offers Not now', async () => {
      const onDismissInstall = jest.fn();
      renderSheet({ canInstall: false, isIos: true, onDismissInstall });

      expect(screen.getByText((en as any).pwa.installTitle)).toBeInTheDocument();
      expect(screen.getByText((en as any).pwa.iosInstallBody)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: (en as any).pwa.install })).not.toBeInTheDocument();

      // iOS can never be prompted programmatically, but the card must still be
      // dismissible — otherwise it is a permanent nag in the app's main menu.
      const dismissButton = screen.getByRole('button', { name: (en as any).pwa.installDismiss });
      await userEvent.click(dismissButton);
      expect(onDismissInstall).toHaveBeenCalledTimes(1);
    });
  });
});
