import { useCallback, useEffect, useRef, useState } from 'react';

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

  return { updateAvailable, applyUpdate };
};
