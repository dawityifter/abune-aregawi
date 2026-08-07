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
 * old one" — the fix is the same skip-waiting-then-reload path the Refresh
 * button uses (useServiceWorker's applyUpdate), not a plain
 * window.location.reload(). A plain reload would be served the exact same
 * precached index.html and fail identically.
 *
 * One-shot per tab via sessionStorage: if recovery has already been
 * attempted once this session and the chunk still fails, we rethrow instead
 * of trying again, so a genuinely broken chunk shows ErrorBoundary's normal
 * error rather than cycling reloads forever.
 */
const RECOVERY_ATTEMPTED_KEY = 'app.chunkLoadRecoveryAttempted';

// How long to wait for the new worker to actually take control before giving
// up on this attempt and surfacing the original error instead of leaving the
// route stuck on its Suspense fallback forever.
const CONTROLLER_CHANGE_TIMEOUT_MS = 8000;

function isChunkLoadError(error: unknown): boolean {
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
 * Activates a waiting service worker and reloads once it has taken control —
 * mirroring useServiceWorker's applyUpdate() exactly. Resolves `true` once
 * the reload has been triggered, or `false` if there was nothing to activate
 * (no service worker, no waiting worker, or it never took control in time),
 * in which case the caller should fall back to rethrowing the original error.
 */
function activateWaitingWorkerAndReload(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return Promise.resolve(false);
  }

  return navigator.serviceWorker.getRegistration().then((registration) => {
    const waiting = registration?.waiting;
    if (!waiting) return false;

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
  }, () => false);
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
