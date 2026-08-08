import { ComponentType, lazy } from 'react';

type LazyFactory<T extends ComponentType<any>> = () => Promise<{ default: T }>;

/**
 * The service worker precaches index.html and serves it for navigations
 * (see service-worker.js), so a member's device can stay pinned to an old
 * build until they accept the update toast. If that old build then lazily
 * navigates to a route whose chunk hash the current deploy no longer serves,
 * webpack's dynamic import() rejects with a "ChunkLoadError" and
 * React.lazy() has nothing to render.
 *
 * That failure means "a newer build exists and this device is pinned to an
 * old one" — the fix drives the same skip-waiting-then-reload mechanism the
 * Refresh button uses (useServiceWorker's applyUpdate: post SKIP_WAITING,
 * reload only after controllerchange fires), not a plain
 * window.location.reload(). A plain reload would be served the exact same
 * precached index.html and fail identically. This is not an *exact* mirror
 * of applyUpdate, though: applyUpdate assumes a worker is already waiting
 * (it's only invoked once the useServiceWorker hook has already observed
 * one) and has no timeout on controllerchange — if it never fires, the
 * Refresh button just does nothing further. This module cannot assume that;
 * see below.
 *
 * A worker being "already waiting" depends on the browser having already run
 * its own update check, which normally happens on navigation. A staff member
 * who opens the SPA once and then navigates only client-side for the rest of
 * the afternoon (exactly the treasurer-doing-reconciliation case this exists
 * for) may never trigger one — so before giving up, this module forces a
 * check itself via registration.update() and waits for the resulting worker
 * to install, with a timeout backstop at each waiting step so a member is
 * never left on the Suspense fallback forever.
 *
 * One-shot per tab via sessionStorage: if recovery has already been
 * attempted once this session and the chunk still fails, we rethrow instead
 * of trying again, so a genuinely broken chunk shows ErrorBoundary's normal
 * error rather than cycling reloads forever. The guard covers this entire
 * longer path (forced update check included), not just the skip-waiting step.
 */
const RECOVERY_ATTEMPTED_KEY = 'app.chunkLoadRecoveryAttempted';

// How long to wait for a single async step (an installing worker reaching
// 'installed', or an activated worker's controllerchange) before giving up
// on this attempt and surfacing the original error instead of leaving the
// route stuck on its Suspense fallback forever. Applied independently at
// each step, so activating a freshly-installed worker can take up to
// roughly 2x this value end to end.
// Exported so useServiceWorker's applyUpdate can guard its own
// controllerchange wait with the same value instead of a second hardcoded
// number drifting out of sync with this one.
export const CONTROLLER_CHANGE_TIMEOUT_MS = 8000;

// Exported so ErrorBoundary can tell a chunk-load failure apart from any
// other render error without duplicating the detection rule.
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Webpack 5 (react-scripts 5) names this error "ChunkLoadError" and puts
  // "Loading chunk N failed" in the message. Both are checked so a bundler
  // version change doesn't silently disable recovery.
  return error.name === 'ChunkLoadError' || /loading chunk .*failed/i.test(error.message);
}

function recoveryAlreadyAttempted(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_ATTEMPTED_KEY) === '1';
  } catch {
    // Storage access can throw (e.g. Safari private browsing). Fail toward
    // "already attempted" so we never risk looping.
    return true;
  }
}

function markRecoveryAttempted(): void {
  try {
    sessionStorage.setItem(RECOVERY_ATTEMPTED_KEY, '1');
  } catch {
    // Nothing we can do; recoveryAlreadyAttempted()'s catch-branch above
    // still keeps a storage failure on the safe (non-looping) side.
  }
}

/**
 * Waits for an installing worker to reach the 'installed' state (at which
 * point, with an existing controller, it becomes registration.waiting) and
 * resolves with it. Resolves `undefined` if installation fails/is superseded
 * (state goes to 'redundant'), or if it doesn't settle within the timeout.
 */
function waitForInstalled(installing: ServiceWorker): Promise<ServiceWorker | undefined> {
  return new Promise((resolve) => {
    let settled = false;

    const onStateChange = () => {
      if (settled) return;
      if (installing.state === 'installed') {
        settled = true;
        clearTimeout(timer);
        installing.removeEventListener('statechange', onStateChange);
        resolve(installing);
      } else if (installing.state === 'redundant') {
        settled = true;
        clearTimeout(timer);
        installing.removeEventListener('statechange', onStateChange);
        resolve(undefined);
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      installing.removeEventListener('statechange', onStateChange);
      resolve(undefined);
    }, CONTROLLER_CHANGE_TIMEOUT_MS);

    installing.addEventListener('statechange', onStateChange);
  });
}

/**
 * Posts SKIP_WAITING to a waiting worker and reloads once it has actually
 * taken control. Resolves `true` once the reload has been triggered, or
 * `false` if controllerchange never fires within the timeout.
 */
function skipWaitingAndReload(waiting: ServiceWorker): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(false);
    }, CONTROLLER_CHANGE_TIMEOUT_MS);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.location.reload();
      resolve(true);
    }, { once: true });

    waiting.postMessage({ type: 'SKIP_WAITING' });
  });
}

/**
 * Activates a waiting service worker and reloads once it has taken control.
 * If nothing is waiting yet — this tab may have stayed open across a deploy
 * via client-side navigation only, so the browser's own update check never
 * ran — forces one with registration.update() and waits for the resulting
 * worker to install before activating it.
 *
 * Resolves `true` once the reload has been triggered. Resolves `false` if
 * there is nothing to activate: no service worker, no registration, the
 * member is offline (registration.update() rejects — treated the same as
 * "no new worker" rather than surfaced as its own error), or a worker never
 * finished installing/activating within the timeout. The caller falls back
 * to rethrowing the *original* chunk-load error in every `false` case, so a
 * network hiccup during the update check never masks the real failure.
 */
async function activateWaitingWorkerAndReload(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return false;
  }

  const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  if (!registration) return false;

  let worker: ServiceWorker | undefined = registration.waiting || undefined;

  if (!worker) {
    try {
      await registration.update();
    } catch {
      // Offline, or the update check failed outright — nothing to activate.
      return false;
    }

    worker = registration.waiting || undefined;
    if (!worker && registration.installing) {
      worker = await waitForInstalled(registration.installing);
    }
  }

  if (!worker) return false;

  return skipWaitingAndReload(worker);
}

/**
 * Runs a React.lazy() factory, recovering from a chunk-load failure by
 * activating the waiting service worker and reloading — once. Exported
 * separately from lazyWithRecovery so tests can exercise the recovery logic
 * directly without rendering a component through Suspense.
 */
export async function loadWithRecovery<T extends ComponentType<any>>(
  factory: LazyFactory<T>
): Promise<{ default: T }> {
  try {
    return await factory();
  } catch (error) {
    if (!isChunkLoadError(error) || recoveryAlreadyAttempted()) {
      throw error;
    }

    markRecoveryAttempted();
    const reloading = await activateWaitingWorkerAndReload();
    if (!reloading) {
      throw error;
    }

    // A reload is already in flight (window.location.reload() has been
    // called). Never settle: resolving would render whatever partial module
    // we have, and rejecting would flash ErrorBoundary for the instant
    // before the navigation actually happens.
    return new Promise<{ default: T }>(() => {});
  }
}

/**
 * Drop-in replacement for React.lazy() that recovers from the chunk-load
 * failure described above instead of leaving ErrorBoundary to catch a dead
 * end with no retry.
 */
export function lazyWithRecovery<T extends ComponentType<any>>(factory: LazyFactory<T>) {
  return lazy(() => loadWithRecovery(factory));
}

export default lazyWithRecovery;
