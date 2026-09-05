import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole, getMergedPermissions } from '../../utils/roles';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  canInstall: boolean;
  isIos: boolean;
  onInstall: () => void;
  onDismissInstall: () => void;
}

interface SheetLink {
  to: string;
  labelKey: string;
}

// Everything in the sheet a keyboard user can land on: the close button and
// every link (member links, staff links, sign in/out). Queried fresh rather
// than tracked with individual refs, since the link list is data-driven and
// its length varies by role.
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])';

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] =>
  container ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];

/**
 * The overflow destination for the bottom bar. Draws its role-gated entries
 * from getMergedPermissions() rather than keeping a second list, so a
 * permission change in roles.ts reaches the phone without a second edit.
 */
const MoreSheet: React.FC<MoreSheetProps> = ({
  open, onClose, canInstall, isIos, onInstall, onDismissInstall
}) => {
  const { t, lang, setLang } = useI18n();
  const { currentUser, logout, getUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!currentUser || !open) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUserProfile(
          currentUser.uid || currentUser.id,
          currentUser.email,
          currentUser.phoneNumber
        );
        if (!cancelled) setUserProfile(profile);
      } catch {
        // A failed profile lookup degrades to the member-only link set rather
        // than blanking the sheet.
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser, open, getUserProfile]);

  // Escape closes, matching the dialog role.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Same shape as FirstLoginModal (src/components/auth/FirstLoginModal.tsx:59-71):
  // focus the first actionable element and lock background scroll while open,
  // restoring both on close. Additionally captures whatever had focus when the
  // sheet opened — for the bottom bar that's the "More" tab button in
  // BottomNav.tsx, which stays mounted behind the sheet the whole time — and
  // restores focus to it on close, since (unlike FirstLoginModal, which always
  // navigates away on dismiss) closing this sheet just returns to the same page.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const focusable = getFocusableElements(panelRef.current);
    (focusable[0] ?? panelRef.current)?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Basic Tab/Shift+Tab focus trap between the sheet's first and last
  // focusable elements, matching FirstLoginModal's onKeyDown (lines 88-111)
  // but querying the current focusable set instead of two fixed refs, since
  // the sheet's link list varies by role.
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = getFocusableElements(panelRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !focusable.includes(active as HTMLElement)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !focusable.includes(active as HTMLElement)) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  const member = userProfile?.data?.member || userProfile;
  const roles: UserRole[] = member?.roles || [member?.role || 'member'];
  const perms = getMergedPermissions(roles);

  const links: SheetLink[] = currentUser
    ? [
        { to: '/profile', labelKey: 'mobileNav.profile' },
        { to: '/dependents', labelKey: 'mobileNav.dependents' },
        { to: '/departments', labelKey: 'mobileNav.departments' },
        { to: '/gallery', labelKey: 'mobileNav.gallery' },
        { to: '/board-members', labelKey: 'mobileNav.board' },
        { to: '/church-bylaw', labelKey: 'mobileNav.bylaw' },
      ]
    : [
        { to: '/#service-times', labelKey: 'mobileNav.serviceTimes' },
        { to: '/#watch', labelKey: 'mobileNav.watch' },
        { to: '/church-bylaw', labelKey: 'mobileNav.bylaw' },
        { to: '/privacy', labelKey: 'mobileNav.privacy' },
      ];

  const staffLinks: SheetLink[] = currentUser
    ? [
        perms.canAccessAdminPanel && { to: '/admin', labelKey: 'mobileNav.admin' },
        perms.canViewFinancialRecords && { to: '/treasurer', labelKey: 'mobileNav.treasurer' },
        perms.canAccessOutreachDashboard && { to: '/outreach', labelKey: 'mobileNav.outreach' },
        perms.canSendCommunications && { to: '/sms', labelKey: 'mobileNav.sms' },
      ].filter(Boolean) as SheetLink[]
    : [];

  const itemClass =
    'block w-full px-4 py-3 min-h-[44px] text-left text-gray-800 hover:bg-gray-50 rounded-lg';

  return (
    <div className="md:hidden print:hidden fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('mobileNav.menuTitle')}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto pb-safe-b focus:outline-none"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-gray-900">{t('mobileNav.menuTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 min-h-[44px] text-sm text-gray-500"
          >
            {t('mobileNav.closeMore')}
          </button>
        </div>

        {/* First item in the sheet, deliberately. This is the one control a
            member may need BEFORE they can read anything else here: someone
            who reads only Tigrigna cannot navigate an English menu to find
            the language setting. Both options stay in their own script and
            are never translated, so ትግርኛ is recognisable without reading the
            surrounding UI.

            The sheet does not close on selection. Every label in it re-renders
            in the new language, and that is the confirmation the tap worked —
            closing would hide the only feedback there is. */}
        <div className="px-4 pb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            {t('language')}
          </p>
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            <button
              type="button"
              aria-pressed={lang === 'en'}
              onClick={() => setLang('en')}
              className={`flex-1 min-h-[44px] px-4 text-sm font-medium ${
                lang === 'en' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              English
            </button>
            <div className="w-px bg-gray-300" aria-hidden="true" />
            <button
              type="button"
              aria-pressed={lang === 'ti'}
              onClick={() => setLang('ti')}
              className={`flex-1 min-h-[44px] px-4 text-sm font-medium ${
                lang === 'ti' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              ትግርኛ
            </button>
          </div>
        </div>

        {(canInstall || isIos) && (
          <div className="mx-4 mb-2 rounded-lg bg-accent-50 border border-accent-200 p-3">
            <p className="text-sm font-semibold text-gray-900">{t('pwa.installTitle')}</p>
            <p className="mt-1 text-sm text-gray-600">
              {isIos ? t('pwa.iosInstallBody') : t('pwa.installBody')}
            </p>
            <div className="mt-2 flex gap-2">
              {!isIos && (
                <button
                  type="button"
                  onClick={onInstall}
                  className="min-h-[44px] px-3 rounded-md bg-primary-700 text-white text-sm font-medium"
                >
                  {t('pwa.install')}
                </button>
              )}
              <button
                type="button"
                onClick={onDismissInstall}
                className="min-h-[44px] px-3 text-sm text-gray-500"
              >
                {t('pwa.installDismiss')}
              </button>
            </div>
          </div>
        )}

        <div className="px-2 pb-4">
          {links.map((l) => (
            <Link key={l.to} to={l.to} onClick={onClose} className={itemClass}>
              {t(l.labelKey)}
            </Link>
          ))}

          {staffLinks.length > 0 && (
            <>
              <hr className="my-2 border-gray-200" />
              {staffLinks.map((l) => (
                <Link key={l.to} to={l.to} onClick={onClose} className={itemClass}>
                  {t(l.labelKey)}
                </Link>
              ))}
            </>
          )}

          <hr className="my-2 border-gray-200" />
          {currentUser ? (
            <button
              type="button"
              onClick={() => { logout(); onClose(); }}
              className={`${itemClass} text-red-600`}
            >
              {t('sign.out')}
            </button>
          ) : (
            <Link to="/login" onClick={onClose} className={`${itemClass} text-primary-700 font-medium`}>
              {t('sign.in')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoreSheet;
