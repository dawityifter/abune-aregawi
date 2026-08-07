import { useCallback, useEffect, useRef, useState } from 'react';

const DISMISS_KEY = 'pwa.installDismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const detectIos = (): boolean => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const isIosUa = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // iPadOS 13+ Safari reports a desktop Mac user agent with no "ipad"
  // substring at all. A Mac reports maxTouchPoints === 0, so pairing the
  // platform string with a touch point count distinguishes a real iPad from
  // desktop Safari without misfiring on a Mac with a touchscreen-less trackpad.
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const isIosDevice = isIosUa || isIpadOs;
  // Already installed: nothing to prompt.
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
  return isIosDevice && !standalone;
};

const readDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    // Safari private mode can throw on localStorage access, same as the write
    // side below. A throwing read at mount must not take the hook down.
    return false;
  }
};

/**
 * Owns the service worker lifecycle so no other module has to know about it.
 *
 * A new worker installs and *waits* rather than taking over. Members fill in
 * payment forms on this site; swapping the assets under them mid-form is worse
 * than a few extra minutes on an old build.
 */
export const useServiceWorker = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  const [rawCanInstall, setRawCanInstall] = useState(false);
  const [isIosDevice] = useState(detectIos);
  // Single source of truth for "the member asked not to see this again",
  // shared by both the Android offer and the iOS instructions so dismissing
  // either one suppresses both, on this mount and every mount after it.
  const [dismissed, setDismissed] = useState(readDismissed);
  const installEventRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Checked by value, not `'serviceWorker' in navigator`: a test double (or a
    // browser polyfill) can define the property with an `undefined` value, which
    // the `in` operator still reports as present.
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    if (process.env.NODE_ENV !== 'production') return;

    let cancelled = false;

    const track = (worker: ServiceWorker | null) => {
      if (!worker || cancelled) return;
      waitingRef.current = worker;
      setUpdateAvailable(true);
    };

    navigator.serviceWorker
      .register(`${process.env.PUBLIC_URL || ''}/service-worker.js`)
      .then((registration) => {
        if (cancelled) return;

        // A worker may already be waiting from a previous visit.
        track(registration.waiting);

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // 'installed' with an existing controller means an update, not a
            // first install.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              track(installing);
            }
          });
        });
      })
      .catch(() => {
        // The app must behave identically with no service worker.
      });

    return () => { cancelled = true; };
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = waitingRef.current;
    if (!waiting) return;

    // Reload once the new worker has actually taken control, not before.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });

    waiting.postMessage({ type: 'SKIP_WAITING' });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onBeforeInstallPrompt = (e: Event) => {
      // Without this the browser shows its own mini-infobar and we lose the
      // ability to place the offer where it makes sense.
      e.preventDefault();
      installEventRef.current = e as BeforeInstallPromptEvent;
      // Dismissal is applied uniformly below (canInstall = rawCanInstall &&
      // !dismissed), not here, so there is exactly one place that decides
      // whether a dismissed member sees the offer again.
      setRawCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const promptInstall = useCallback(() => {
    const event = installEventRef.current;
    if (!event) return;
    event.prompt();
    setRawCanInstall(false);
  }, []);

  const dismissInstall = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, 'true'); } catch { /* private mode */ }
    setDismissed(true);
  }, []);

  const canInstall = rawCanInstall && !dismissed;
  const isIos = isIosDevice && !dismissed;

  return { updateAvailable, applyUpdate, canInstall, isIos, promptInstall, dismissInstall };
};
