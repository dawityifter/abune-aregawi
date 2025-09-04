import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

// Accessible, dismissible modal shown on first-time sign-in
// Shows once per session per uid using sessionStorage
const FirstLoginModal: React.FC = () => {
  const { user, authReady } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Only show for temp users (first-time) and only once per session
  const uid = user?.uid;
  const isTemp = user?._temp === true;

  const sessionKey = useMemo(() => (uid ? `firstLoginPromptDismissed:${uid}` : ''), [uid]);
  const alreadyDismissed = useMemo(() => {
    if (!sessionKey) return true; // Don't show if no uid context yet
    try {
      return sessionStorage.getItem(sessionKey) === '1';
    } catch {
      return false;
    }
  }, [sessionKey]);

  // Dev-only: allow forcing the modal via query string for testing
  const forceShow = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search);
      return params.get('forceFirstLoginModal') === '1';
    } catch {
      return false;
    }
  }, [location.search]);

  // Show only for true first-time members; do not show for unlinked dependents or established dependents
  const isUnlinkedDependent = user?.unlinkedDependent === true;
  const isDependent = user?.role === 'dependent';
  // Show the modal on /register regardless of prior dismissal in this session
  const onRegisterRoute = location.pathname === '/register';
  const shouldShow = authReady && isTemp && !!uid && ((!alreadyDismissed || forceShow) || onRegisterRoute) && !isUnlinkedDependent && !isDependent;

  const okRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (shouldShow) {
      setMounted(true);
    } else {
      setMounted(false);
    }
  }, [shouldShow]);

  useEffect(() => {
    if (!mounted) return;
    // Focus first actionable element
    const toFocus = okRef.current || cancelRef.current;
    toFocus?.focus();

    // Prevent background scroll while modal open
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [mounted]);

  if (!mounted) return null;

  const dismiss = (navigateTo: '/' | '/register') => {
    try {
      // Persist dismissal only when proceeding to registration (OK),
      // so a refresh after Cancel/ESC will show the modal again.
      if (navigateTo === '/register' && sessionKey) {
        sessionStorage.setItem(sessionKey, '1');
      }
    } catch {}
    // Close modal immediately in the current view
    setMounted(false);
    navigate(navigateTo, { replace: false, state: location.state });
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dismiss('/');
      return;
    }
    if (e.key === 'Tab') {
      // Basic focus trap between OK and Cancel buttons
      const focusable: (HTMLElement | null)[] = [okRef.current, cancelRef.current].filter(Boolean);
      const active = document.activeElement as HTMLElement | null;
      const idx = focusable.findIndex((el) => el === active);
      if (e.shiftKey) {
        if (idx <= 0) {
          e.preventDefault();
          (focusable[focusable.length - 1] as HTMLElement)?.focus();
        }
      } else {
        if (idx === focusable.length - 1) {
          e.preventDefault();
          (focusable[0] as HTMLElement)?.focus();
        }
      }
    }
  };

  const titleId = 'first-login-modal-title';
  const descId = 'first-login-modal-desc';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onKeyDown={onKeyDown}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true"></div>

      {/* Modal panel */}
      <div
        ref={modalRef}
        className="relative mx-4 w-full max-w-lg card p-6 sm:p-7 focus:outline-none"
      >
        <h2 id={titleId} className="text-xl sm:text-2xl font-serif text-primary-700 tracking-tight">
          {t('firstLoginModal.title')}
        </h2>
        <p id={descId} className="mt-3 text-sm sm:text-base leading-relaxed text-accent-700">
          {t('firstLoginModal.body')}
        </p>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => dismiss('/')}
          >
            {t('firstLoginModal.cancel')}
          </button>
          <button
            ref={okRef}
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => dismiss('/register')}
          >
            {t('firstLoginModal.ok')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirstLoginModal;
