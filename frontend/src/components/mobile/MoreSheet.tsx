import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole, getMergedPermissions } from '../../utils/roles';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

interface SheetLink {
  to: string;
  labelKey: string;
}

/**
 * The overflow destination for the bottom bar. Draws its role-gated entries
 * from getMergedPermissions() rather than keeping a second list, so a
 * permission change in roles.ts reaches the phone without a second edit.
 */
const MoreSheet: React.FC<MoreSheetProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const { currentUser, logout, getUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);

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
        role="dialog"
        aria-modal="true"
        aria-label={t('mobileNav.menuTitle')}
        className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto pb-safe-b"
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
