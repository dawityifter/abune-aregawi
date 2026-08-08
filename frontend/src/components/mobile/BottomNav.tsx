import React, { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../../contexts/AuthContext';
import { TABS, resolveActiveTab, TabDef } from './tabs';

interface BottomNavProps {
  onMoreClick: () => void;
}

// React 19 removed the global JSX namespace, so JSX.Element does not resolve here.
const ICONS: Record<string, React.ReactElement> = {
  today: <path d="M12 3l2.09 6.26H21l-5.45 3.97L17.64 21 12 17.27 6.36 21l2.09-7.77L3 9.26h6.91z" />,
  calendar: <path d="M7 2v3M17 2v3M3.5 8h17M4 5h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />,
  give: <path d="M12 21s-7.5-4.6-9.3-9A5 5 0 0112 5.8 5 5 0 0121.3 12c-1.8 4.4-9.3 9-9.3 9z" />,
  more: <path d="M4 7h16M4 12h16M4 17h16" />,
};

const Icon: React.FC<{ id: string; active: boolean }> = ({ id, active }) => (
  <svg
    className="h-6 w-6"
    viewBox="0 0 24 24"
    fill={active ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {ICONS[id]}
  </svg>
);

/**
 * Phone-only chrome. The congregation is overwhelmingly mobile, and the only
 * navigation they had was a hamburger. Hidden from md: up, where the existing
 * header already works.
 */
const BottomNav: React.FC<BottomNavProps> = ({ onMoreClick }) => {
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const { pathname } = useLocation();
  const active = resolveActiveTab(pathname);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);

  const pathFor = (tab: TabDef) => (currentUser ? tab.authedPath : tab.publicPath);

  // iOS Safari does not move focus to a tapped <button> the way a mouse click
  // or keyboard activation does, so MoreSheet's "capture document.activeElement
  // when it opens" focus-restore (MoreSheet.tsx) would capture document.body on
  // a real phone and silently no-op when the sheet closes. Focusing the button
  // explicitly, synchronously, before telling the parent to open the sheet
  // guarantees there is something real for MoreSheet to restore focus to,
  // regardless of how the tap itself was handled.
  const handleMoreClick = () => {
    moreButtonRef.current?.focus();
    onMoreClick();
  };

  const itemClass = (isActive: boolean) =>
    [
      'flex flex-col items-center justify-center gap-0.5 flex-1',
      // 44px minimum touch target.
      'min-h-[44px] py-1.5 text-[11px] font-medium transition-colors',
      isActive ? 'text-primary-700' : 'text-gray-500 hover:text-primary-600',
    ].join(' ');

  return (
    <nav
      aria-label={t('mobileNav.label')}
      className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-1px_3px_rgba(0,0,0,0.06)] pb-safe-b"
    >
      <div className="flex items-stretch">
        {TABS.map((tab) =>
          tab.id === 'more' ? (
            <button
              key={tab.id}
              ref={moreButtonRef}
              type="button"
              onClick={handleMoreClick}
              className={itemClass(active === tab.id)}
              aria-haspopup="dialog"
            >
              <Icon id={tab.id} active={active === tab.id} />
              <span>{t(tab.labelKey)}</span>
            </button>
          ) : (
            <Link
              key={tab.id}
              to={pathFor(tab)}
              aria-current={active === tab.id ? 'page' : undefined}
              className={itemClass(active === tab.id)}
            >
              <Icon id={tab.id} active={active === tab.id} />
              <span>{t(tab.labelKey)}</span>
            </Link>
          )
        )}
      </div>
    </nav>
  );
};

export default BottomNav;
